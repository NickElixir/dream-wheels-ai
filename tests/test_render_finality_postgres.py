"""Render lifecycle regressions on an explicitly isolated PostgreSQL database."""

import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

import asyncpg
import pytest

from src import credits_service, jobs_api, main
from src.render_billing import billing_evidence_select, render_billing_status
from tests.test_wan_runtime_integration import FakeProvider, job_data, successful_result

DSN = os.getenv("TEST_RENDER_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="Requires isolated TEST_RENDER_DATABASE_URL")
JOB = "11111111-1111-4111-8111-111111111111"


@asynccontextmanager
async def database(monkeypatch, status="queued", credit_status="reserved"):
    target = urlsplit(DSN)
    assert target.hostname in {"127.0.0.1", "localhost", "::1"} and not target.query
    schema = "render_test_" + uuid.uuid4().hex
    admin = await asyncpg.connect(DSN)
    await admin.execute(f'CREATE SCHEMA "{schema}"')
    pool = await asyncpg.create_pool(
        DSN, server_settings={"search_path": schema}, min_size=1, max_size=5
    )
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE jobs (id uuid PRIMARY KEY, user_id int, status text,
                    credit_status text, credit_cost int DEFAULT 1, updated_at timestamptz,
                    completed_at timestamptz, error_code text, error_message text,
                    output_image_url text, result_asset_id uuid,
                    generation_provider text, provider_request_id text, provider_task_id text,
                    generation_latency_ms int, generation_cost numeric);
                CREATE TABLE user_credit_accounts (user_id int PRIMARY KEY, balance int,
                    updated_at timestamptz);
                CREATE TABLE credit_packages (id uuid PRIMARY KEY, user_id int,
                    remaining_credits int, credits_granted int, expires_at timestamptz,
                    created_at timestamptz DEFAULT now());
                CREATE TABLE credit_package_allocations (package_id uuid, job_id uuid,
                    credits int, UNIQUE(package_id,job_id));
                CREATE TABLE credit_ledger (user_id int, event_type text, credits_delta int,
                    balance_after int, related_job_id uuid, idempotency_key text UNIQUE,
                    metadata jsonb);
            """)
            await conn.execute(
                "INSERT INTO jobs(id,user_id,status,credit_status) VALUES($1,77,$2,$3)",
                uuid.UUID(JOB),
                status,
                credit_status,
            )
            await conn.execute("INSERT INTO user_credit_accounts VALUES(77,2,now())")
            await conn.execute(
                "INSERT INTO credit_packages VALUES($1,77,2,3,now()+interval '1 day',now())",
                uuid.UUID(JOB),
            )
            await conn.execute(
                "INSERT INTO credit_package_allocations VALUES($1,$1,1)", uuid.UUID(JOB)
            )
            await conn.execute(
                "INSERT INTO credit_ledger VALUES(77,'job_reserve',-1,2,$1,$2,NULL)",
                uuid.UUID(JOB),
                f"job_reserve:{JOB}",
            )

        async def balance(conn, user_id):
            return await conn.fetchval(
                "SELECT balance FROM user_credit_accounts WHERE user_id=$1", user_id
            )

        async def noop(*args, **kwargs):
            return None

        monkeypatch.setattr(credits_service, "get_balance", balance)
        monkeypatch.setattr(main.analytics_api, "record_system_event", noop)
        monkeypatch.setattr(main, "_save_legacy_bot_inputs", noop)
        monkeypatch.setattr(main, "_load_generation_inputs", noop)

        # Inputs are irrelevant to finality; provider transport is isolated.
        async def inputs(*args):
            return (None, None)

        monkeypatch.setattr(main, "_load_generation_inputs", inputs)
        monkeypatch.setattr(main, "build_generation_request", lambda **kwargs: object())
        yield pool
    finally:
        await pool.close()
        await admin.execute(f'DROP SCHEMA "{schema}" CASCADE')
        await admin.close()


@pytest.mark.parametrize(
    "status,credit",
    [("failed", "refunded"), ("completed", "finalized"), ("processing", "reserved")],
)
def test_replay_never_invokes_provider_or_mutates_job(monkeypatch, status, credit):
    async def run():
        async with database(monkeypatch, status, credit) as pool:
            provider = FakeProvider(result=successful_result())
            await asyncio.gather(
                *(
                    main.process_render_job(
                        pool, job_id=JOB, user_id=77, job_data=job_data(), provider=provider
                    )
                    for _ in range(2)
                )
            )
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM jobs")
                assert (row["status"], row["credit_status"]) == (status, credit)
                assert row["result_asset_id"] is None and row["output_image_url"] is None
                assert await conn.fetchval("SELECT count(*) FROM credit_ledger") == 1
            assert not provider.calls

    asyncio.run(run())


def test_concurrent_claim_and_late_refunded_result(monkeypatch):
    async def run():
        async with database(monkeypatch) as pool:
            started, release = asyncio.Event(), asyncio.Event()
            provider_calls, inserted = [], []

            class Provider:
                async def edit(self, request):
                    provider_calls.append(request)
                    started.set()
                    await release.wait()
                    return successful_result()

            async def upload(**kwargs):
                return type("Asset", (), {"id": JOB, "public_url": "https://result.test/image"})()

            async def insert(*args):
                inserted.append(args)

            monkeypatch.setattr(main.assets_service, "upload_render_asset", upload)
            monkeypatch.setattr(main.assets_service, "insert_asset", insert)

            async def delete(asset):
                return None

            monkeypatch.setattr(main.assets_service, "delete_uploaded_asset", delete)
            first = asyncio.create_task(
                main.process_render_job(
                    pool, job_id=JOB, user_id=77, job_data=job_data(), provider=Provider()
                )
            )
            await started.wait()
            await main.process_render_job(
                pool, job_id=JOB, user_id=77, job_data=job_data(), provider=Provider()
            )
            await main._mark_render_failed(
                pool, job_id=JOB, user_id=77, error=RuntimeError("failed")
            )
            release.set()
            await first
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM jobs")
                assert (row["status"], row["credit_status"]) == ("failed", "refunded")
                assert row["result_asset_id"] is None and row["output_image_url"] is None
                assert (
                    await conn.fetchval(
                        "SELECT count(*) FROM credit_ledger WHERE event_type='job_finalize'"
                    )
                    == 0
                )
                assert await conn.fetchval("SELECT balance FROM user_credit_accounts") == 3
            assert len(provider_calls) == 1 and not inserted

    asyncio.run(run())


def test_failure_refund_atomic_visibility_and_replay(monkeypatch):
    async def run():
        async with database(monkeypatch, "processing") as pool:
            refunded, release = asyncio.Event(), asyncio.Event()
            real_refund = credits_service.refund_job_credit

            async def paused_refund(conn, **kwargs):
                await real_refund(conn, **kwargs)
                refunded.set()
                await release.wait()

            monkeypatch.setattr(main, "refund_job_credit", paused_refund)
            failure = asyncio.create_task(
                main._mark_render_failed(pool, job_id=JOB, user_id=77, error=RuntimeError("failed"))
            )
            await refunded.wait()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(f"SELECT jobs.*, {billing_evidence_select()} FROM jobs")
                assert (row["status"], row["credit_status"]) == ("processing", "reserved")
                assert render_billing_status(row) == "reserved"
            release.set()
            await failure
            await main._mark_render_failed(
                pool, job_id=JOB, user_id=77, error=RuntimeError("repeat")
            )
            await jobs_api._compensate_queue_publish_failure(
                pool=pool, job_id=JOB, user_id=77, error_message="repeat"
            )
            async with pool.acquire() as conn:
                row = await conn.fetchrow(f"SELECT jobs.*, {billing_evidence_select()} FROM jobs")
                assert (row["status"], row["credit_status"]) == ("failed", "refunded")
                assert render_billing_status(row) == "refunded"
                assert await conn.fetchval("SELECT balance FROM user_credit_accounts") == 3
                assert (
                    await conn.fetchval(
                        "SELECT count(*) FROM credit_ledger WHERE event_type='job_refund'"
                    )
                    == 1
                )

    asyncio.run(run())


def test_completion_cannot_be_failed_by_late_exception(monkeypatch):
    async def run():
        async with database(monkeypatch, "completed", "finalized") as pool:
            await main._mark_render_failed(pool, job_id=JOB, user_id=77, error=RuntimeError("late"))
            await jobs_api._compensate_queue_publish_failure(
                pool=pool, job_id=JOB, user_id=77, error_message="late"
            )
            async with pool.acquire() as conn:
                assert await conn.fetchval("SELECT status FROM jobs") == "completed"
                assert await conn.fetchval("SELECT credit_status FROM jobs") == "finalized"
                assert await conn.fetchval("SELECT count(*) FROM credit_ledger") == 1

    asyncio.run(run())


def test_failure_transaction_rolls_back_credit_and_state(monkeypatch):
    async def run():
        async with database(monkeypatch, "processing") as pool:

            async def fail(*args, **kwargs):
                raise RuntimeError("analytics unavailable")

            monkeypatch.setattr(main.analytics_api, "record_system_event", fail)
            with pytest.raises(RuntimeError):
                await main._mark_render_failed(
                    pool, job_id=JOB, user_id=77, error=RuntimeError("failure")
                )
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM jobs")
                assert (row["status"], row["credit_status"]) == ("processing", "reserved")
                assert await conn.fetchval("SELECT balance FROM user_credit_accounts") == 2
                assert await conn.fetchval("SELECT count(*) FROM credit_ledger") == 1

    asyncio.run(run())


def test_completion_wins_then_replay_and_late_failure_are_noops(monkeypatch):
    async def run():
        async with database(monkeypatch) as pool:
            provider = FakeProvider(result=successful_result())

            async def output(*args, **kwargs):
                return "https://result.test/image"

            monkeypatch.setattr(main, "_save_render_output", output)
            await asyncio.gather(
                *(
                    main.process_render_job(
                        pool, job_id=JOB, user_id=77, job_data=job_data(), provider=provider
                    )
                    for _ in range(2)
                )
            )
            await main._mark_render_failed(pool, job_id=JOB, user_id=77, error=RuntimeError("late"))
            async with pool.acquire() as conn:
                row = await conn.fetchrow(f"SELECT jobs.*, {billing_evidence_select()} FROM jobs")
                assert (row["status"], row["credit_status"]) == ("completed", "finalized")
                assert render_billing_status(row) == "charged"
                assert await conn.fetchval("SELECT count(*) FROM credit_ledger") == 2
                assert await conn.fetchval("SELECT balance FROM user_credit_accounts") == 2
            assert len(provider.calls) == 1

    asyncio.run(run())


def test_late_completion_after_output_cannot_finalize_refunded_job(monkeypatch):
    async def run():
        async with database(monkeypatch) as pool:

            async def output(*args, **kwargs):
                await main._mark_render_failed(
                    pool, job_id=JOB, user_id=77, error=RuntimeError("concurrent failure")
                )
                return "https://result.test/late"

            monkeypatch.setattr(main, "_save_render_output", output)
            await main.process_render_job(
                pool,
                job_id=JOB,
                user_id=77,
                job_data=job_data(),
                provider=FakeProvider(result=successful_result()),
            )
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM jobs")
                assert (row["status"], row["credit_status"]) == ("failed", "refunded")
                assert row["output_image_url"] is None
                assert (
                    await conn.fetchval(
                        "SELECT count(*) FROM credit_ledger WHERE event_type='job_finalize'"
                    )
                    == 0
                )
                async with conn.transaction():
                    await credits_service.refund_job_credit(conn, user_id=77, job_id=JOB)
                assert await conn.fetchval("SELECT balance FROM user_credit_accounts") == 3
                with pytest.raises(RuntimeError, match="cannot reserve refunded"):
                    async with conn.transaction():
                        await credits_service.reserve_job_credit(conn, user_id=77, job_id=JOB)

    asyncio.run(run())
