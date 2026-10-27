"""Permanent legacy balances on an explicitly isolated, disposable local database."""

import asyncio
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import asyncpg
import pytest

from scripts import migrate_legacy_credit_balances as cutover
from src import account_linking_service, credits_service


def test_permanent_balance_cutover(monkeypatch):
    dsn = os.getenv("TEST_CREDIT_CUTOVER_DATABASE_URL")
    if not dsn:
        pytest.skip("Requires isolated local TEST_CREDIT_CUTOVER_DATABASE_URL")
    assert urlsplit(dsn).hostname in {"localhost", "127.0.0.1", "::1"}

    async def run():
        admin = await asyncpg.connect(dsn)
        await admin.execute(
            "DO $$ BEGIN "
            "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; "
            "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; "
            "END $$"
        )
        name = "credit_cutover_" + uuid4().hex
        await admin.execute(f'CREATE DATABASE "{name}"')
        target = urlsplit(dsn)._replace(path="/" + name).geturl()
        c = await asyncpg.connect(target)
        try:
            root = Path(__file__).resolve().parents[1]
            for n in (1, 4, 6, 7, 8, 9, 12, 10, 11, 13, 14, 15, 16):
                await c.execute(next((root / "migrations").glob(f"{n:04d}_*.sql")).read_text())
            await c.execute(
                "CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,file_size_limit bigint); INSERT INTO storage.buckets VALUES('results',5242880)"
            )
            await c.execute("INSERT INTO users(id,telegram_user_id) VALUES(1,101),(2,102),(3,103)")
            await c.execute(
                "INSERT INTO user_credit_accounts(user_id,balance,trial_used_at) VALUES(1,10,now()-interval '90 days'),(2,18,now()-interval '90 days'),(3,0,now()-interval '90 days')"
            )
            await c.execute(
                "INSERT INTO credit_ledger(user_id,event_type,credits_delta,balance_after,idempotency_key,created_at) VALUES(1,'trial_grant',15,15,'old:1',now()-interval '90 days'),(2,'trial_grant',20,20,'old:2',now()-interval '90 days')"
            )
            original = cutover.migration_sql

            def fail(number):
                if number == 42:
                    raise RuntimeError("injected failure after FIFO")
                return original(number)

            monkeypatch.setattr(cutover, "migration_sql", fail)
            with pytest.raises(RuntimeError, match="injected"):
                await cutover.migrate_legacy_balances(c)
            assert await c.fetchval("SELECT sum(balance) FROM user_credit_accounts") == 28
            assert await c.fetchval("SELECT to_regclass('credit_packages')") is None
            monkeypatch.setattr(cutover, "migration_sql", original)
            result = await cutover.migrate_legacy_balances(c)
            assert result == {"status": "applied", "accounts": 3, "credits": 28}
            assert await credits_service.get_balance(c, 1) == 10
            assert await credits_service.get_balance(c, 2) == 18
            assert await c.fetchval("SELECT count(*) FROM credit_ledger") == 2
            packages = await credits_service.list_credit_packages(c, user_id=1)
            assert len(packages) == 1 and packages[0]["expires_at"] is None
            assert await credits_service.expire_credit_packages(c, user_id=1) == 0
            # Expiring packages are consumed before permanent packages.
            await credits_service.create_credit_package(
                c,
                user_id=1,
                source="purchase",
                credits=1,
                expires_at=datetime.now(UTC) + timedelta(days=1),
                idempotency_key="new:paid",
            )
            job = str(
                await c.fetchval("INSERT INTO jobs(user_id,credit_cost) VALUES(1,2) RETURNING id")
            )
            async with c.transaction():
                assert (
                    await credits_service.reserve_job_credit(
                        c, user_id=1, job_id=job, credit_cost=2
                    )
                    == 9
                )
            assert (
                await c.fetchval(
                    "SELECT remaining_credits FROM credit_packages WHERE source='purchase'"
                )
                == 0
            )
            assert (
                await c.fetchval(
                    "SELECT remaining_credits FROM credit_packages WHERE user_id=1 AND source='legacy_balance'"
                )
                == 9
            )
            async with c.transaction():
                assert await credits_service.refund_job_credit(c, user_id=1, job_id=job) == 11
            assert await cutover.migrate_legacy_balances(c) == {"status": "already_applied"}
            assert await credits_service.get_balance(c, 1) == 11
            # Schema-only deployment and repeat do not alter existing packages.
            await c.execute(original(42))
            assert await credits_service.get_balance(c, 1) == 11
            async with c.transaction():
                await c.execute("UPDATE credit_packages SET user_id=1 WHERE user_id=2")
                await account_linking_service._merge_credit_accounts(
                    c, survivor_user_id=1, source_user_id=2
                )
            assert await credits_service.get_balance(c, 1) == 29
            assert await cutover.migrate_legacy_balances(c) == {"status": "already_applied"}
            assert (
                await c.fetchval("SELECT count(*) FROM user_credit_accounts WHERE user_id=2") == 0
            )
            with pytest.raises(asyncpg.CheckViolationError):
                await credits_service.create_credit_package(
                    c,
                    user_id=1,
                    source="purchase",
                    credits=2,
                    expires_at=None,
                    idempotency_key="invalid",
                )
        finally:
            await c.close()
            await admin.execute(f'DROP DATABASE "{name}"')
            await admin.close()

    asyncio.run(run())
