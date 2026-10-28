"""W-02 real local PostgreSQL transactions, HTTP signatures and credit races."""

import asyncio
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import asyncpg
import httpx
import pytest

from src import credits_service, payments_api, payments_service
from src.main import app


def test_payment_timeout_callbacks_and_reconciliation(monkeypatch):
    dsn = os.getenv("TEST_PAYMENT_LIFECYCLE_DATABASE_URL")
    if not dsn:
        pytest.skip("Set TEST_PAYMENT_LIFECYCLE_DATABASE_URL to isolated local PostgreSQL")
    parsed = urlsplit(dsn)
    assert parsed.hostname in {"localhost", "127.0.0.1", "::1"} and not parsed.query
    monkeypatch.setattr(credits_service, "STARTER_GRANT_CREDITS", 0)
    monkeypatch.setattr(payments_service, "PAYMENT_PENDING_TIMEOUT_SECONDS", 3600)
    monkeypatch.setattr(payments_service, "ROBOKASSA_IS_TEST", True)
    monkeypatch.setattr(payments_api, "ROBOKASSA_IS_TEST", True)
    monkeypatch.setattr(payments_service, "ROBOKASSA_MERCHANT_LOGIN", "isolated-test")
    monkeypatch.setattr(payments_service, "ROBOKASSA_TEST_PASSWORD1", "test-only-p1")
    monkeypatch.setattr(payments_service, "ROBOKASSA_TEST_PASSWORD2", "test-only-p2")

    async def scenario():
        admin = await asyncpg.connect(dsn)
        schema = "payment_lifecycle_" + uuid4().hex
        pool = None
        await admin.execute(f'CREATE SCHEMA "{schema}"')
        await admin.execute(f'SET search_path TO "{schema}"')
        try:
            root = Path(__file__).resolve().parents[1]
            for number in (
                "0001",
                "0006",
                "0007",
                "0008",
                "0009",
                "0012",
                "0010",
                "0011",
                "0013",
                "0014",
                "0016",
                "0024",
                "0025",
                "0033",
                "0039",
                "0039",
            ):
                await admin.execute(next((root / "migrations").glob(number + "*.sql")).read_text())
            pool = await asyncpg.create_pool(
                dsn,
                min_size=1,
                max_size=5,
                statement_cache_size=0,
                server_settings={"search_path": schema},
            )
            monkeypatch.setattr(payments_api.db, "get_pool", lambda: pool)
            owner = await admin.fetchval(
                "INSERT INTO users(telegram_user_id) VALUES(123) RETURNING id"
            )
            await admin.execute(
                "INSERT INTO user_credit_accounts(user_id,trial_used_at) VALUES($1,CURRENT_TIMESTAMP)",
                owner,
            )

            async def payment(age=61, status="pending"):
                return await admin.fetchrow(
                    """
                    INSERT INTO payments(user_id,provider_payment_id,status,amount_rub,credits_granted,receipt_email,pricing_version,source_screen,created_at)
                    VALUES($1,$2,$3,200,7,'test@example.test','credits-v1','test',statement_timestamp()-($4 * INTERVAL '1 minute')) RETURNING *
                """,
                    owner,
                    str(uuid4()),
                    status,
                    age,
                )

            async def callback(
                client, row, amount="200.00", identifier=None, invoice=None, valid=True
            ):
                inv = row["invoice_id"] if invoice is None else invoice
                pid = row["provider_payment_id"] if identifier is None else identifier
                signature = hashlib.md5(
                    f"{amount}:{inv}:test-only-p2:Shp_payment_id={pid}".encode()
                ).hexdigest()
                return await client.get(
                    "/payments/robokassa/result",
                    params={
                        "OutSum": amount,
                        "InvId": inv,
                        "Shp_payment_id": pid,
                        "IsTest": "1",
                        "SignatureValue": signature if valid else "bad-signature",
                    },
                )

            async def timeout(batch=100):
                async with pool.acquire() as conn:
                    return await payments_service.cancel_expired_pending_payments(
                        conn, batch_size=batch
                    )

            async def status(row):
                return await admin.fetchval("SELECT status FROM payments WHERE id=$1", row["id"])

            async def counts(row):
                return tuple(
                    await admin.fetchrow(
                        "SELECT (SELECT count(*) FROM credit_ledger WHERE related_payment_id::text=$1::text AND event_type='purchase_grant'),(SELECT count(*) FROM credit_packages WHERE related_payment_id=$1::uuid)",
                        str(row["id"]),
                    )
                )

            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                fresh = await payment(59)
                expired = await payment(61)
                failed = await payment(90, "failed")
                refunded = await payment(90, "refunded")
                cancelled = await payment(90, "cancelled")
                paid = await payment(90)
                assert (await callback(client, paid)).status_code == 200
                paid_before = dict(
                    await admin.fetchrow("SELECT * FROM payments WHERE id=$1", paid["id"])
                )
                assert await timeout() == 1
                assert await status(expired) == "cancelled"
                assert await status(fresh) == "pending"
                assert await status(failed) == "failed"
                assert await status(refunded) == "refunded"
                assert await status(cancelled) == "cancelled"
                assert (
                    dict(await admin.fetchrow("SELECT * FROM payments WHERE id=$1", paid["id"]))
                    == paid_before
                )
                assert await counts(expired) == (0, 0)
                assert await timeout() == 0
                assert (await callback(client, expired)).text == f"OK{expired['invoice_id']}"
                assert await status(expired) == "paid"
                assert await counts(expired) == (1, 1)
                assert (await callback(client, expired)).status_code == 200  # response-loss replay
                assert await counts(expired) == (1, 1)

                duplicate = await payment(10)
                replies = await asyncio.gather(
                    callback(client, duplicate), callback(client, duplicate)
                )
                assert all(r.status_code == 200 for r in replies)
                assert await status(duplicate) == "paid"
                assert await counts(duplicate) == (1, 1)

                race = await payment(61)
                result = await asyncio.gather(timeout(), callback(client, race))
                assert result[1].status_code == 200
                assert await status(race) == "paid"
                assert await counts(race) == (1, 1)
                assert await timeout() == 0  # paid cannot revert

                # Lock a pending row: the timeout skips it and settles on its next scan.
                locked = await payment(61)
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        await conn.execute(
                            "SELECT id FROM payments WHERE id=$1 FOR UPDATE", locked["id"]
                        )
                        assert await timeout() == 0
                assert await timeout() == 1
                assert (await callback(client, locked)).status_code == 200
                assert await counts(locked) == (1, 1)

                # Both rejected pending and rejected cancelled callbacks retain zero grants.
                invalid = await payment(61)
                for row in (fresh, invalid):
                    if row["id"] == invalid["id"]:
                        assert await timeout() == 1
                    expected = await status(row)
                    for kwargs, code in (
                        ({"valid": False}, 401),
                        ({"amount": "300.00"}, 400),
                        ({"identifier": str(uuid4())}, 400),
                        ({"invoice": 99999999}, 404),
                    ):
                        assert (await callback(client, row, **kwargs)).status_code == code
                        assert await status(row) == expected
                        assert await counts(row) == (0, 0)

                # Existing failed -> paid contract is preserved, with one grant.
                assert (await callback(client, failed)).status_code == 200
                assert await counts(failed) == (1, 1)
                # Fresh checkout is a new durable order, not a revival of cancelled.
                async with admin.transaction():
                    new = await payments_service.create_topup_payment(
                        admin,
                        user_id=owner,
                        intent=payments_service.TopUpIntent(
                            amount_rub=payments_service.normalize_amount_rub(200),
                            pricing_version="credits-v1",
                            source_screen="test",
                            receipt_email="test@example.test",
                            client_channel="web",
                            return_to="/app",
                        ),
                    )
                assert new["invoice_id"] != invalid["invoice_id"]
                assert await status(invalid) == "cancelled"

                # Batches are bounded and repeatable; other statuses stay untouched.
                old_rows = [await payment(61) for _ in range(3)]
                assert await timeout(2) == 2
                assert await timeout(2) == 1
                assert await timeout(2) == 0
                assert all([await counts(row) == (0, 0) for row in old_rows])
                with pytest.raises(asyncpg.CheckViolationError):
                    async with admin.transaction():
                        await admin.execute(
                            "UPDATE payments SET status='invalid' WHERE id=$1", fresh["id"]
                        )
                # Durable uniqueness exists independently of the status shortcut.
                with pytest.raises(asyncpg.UniqueViolationError):
                    async with admin.transaction():
                        await admin.execute(
                            "INSERT INTO credit_ledger(user_id,event_type,credits_delta,idempotency_key) VALUES($1,'purchase_grant',7,$2)",
                            owner,
                            f"payment_paid:{expired['invoice_id']}",
                        )

                # The callback transaction must roll back status, balance and ledger
                # if the durable package write fails after the ledger insert.
                rollback_row = await payment(90, "cancelled")
                before_balance = await admin.fetchval(
                    "SELECT balance FROM user_credit_accounts WHERE user_id=$1", owner
                )
                await admin.execute(
                    "CREATE FUNCTION reject_package() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated package failure'; END $$; CREATE TRIGGER reject_package BEFORE INSERT ON credit_packages FOR EACH ROW EXECUTE FUNCTION reject_package()"
                )
                with pytest.raises(asyncpg.RaiseError, match="isolated package failure"):
                    await callback(client, rollback_row)
                assert await status(rollback_row) == "cancelled"
                assert await counts(rollback_row) == (0, 0)
                assert (
                    await admin.fetchval(
                        "SELECT balance FROM user_credit_accounts WHERE user_id=$1", owner
                    )
                    == before_balance
                )
                await admin.execute("DROP TRIGGER reject_package ON credit_packages")

                sql = (root / "docs/evidence/p05b-payment-lifecycle/reconciliation.sql").read_text()
                async with admin.transaction(readonly=True):
                    discrepancies = await admin.fetch(
                        sql.split("BEGIN READ ONLY;", 1)[1].rsplit("ROLLBACK;", 1)[0]
                    )
                    assert await admin.fetchval("SHOW transaction_read_only") == "on"
                assert discrepancies == []
                balance = await admin.fetchval(
                    "SELECT balance FROM user_credit_accounts WHERE user_id=$1", owner
                )
                package_balance = await admin.fetchval(
                    "SELECT sum(remaining_credits) FROM credit_packages WHERE user_id=$1", owner
                )
                assert balance == package_balance == 42
                print(
                    "W02_DB_EVIDENCE="
                    + json.dumps(
                        {
                            "late_callback": "paid",
                            "duplicate_grants": 1,
                            "race_final": "paid",
                            "timeout_repeat_noop": True,
                            "batch_limit": 2,
                            "paid_never_cancelled": True,
                            "reconciliation_discrepancies": len(discrepancies),
                            "balance": balance,
                            "migration_applied_twice": True,
                            "callback_atomic_rollback": True,
                        }
                    )
                )
        finally:
            if pool is not None:
                await pool.close()
            await admin.execute("SET search_path TO public")
            await admin.execute(f'DROP SCHEMA "{schema}" CASCADE')
            await admin.close()

    asyncio.run(scenario())
