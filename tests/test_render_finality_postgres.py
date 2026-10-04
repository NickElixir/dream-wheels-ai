"""Render lifecycle regressions on an explicitly isolated PostgreSQL database."""

import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

import asyncpg
import httpx
import pytest

from src import assets_service, credits_service, jobs_api, main
from src.auth_principal import AuthPrincipal
from src.render_billing import billing_evidence_select, render_billing_status
from tests.test_wan_runtime_integration import FakeProvider, job_data, successful_result

DSN = os.getenv("TEST_RENDER_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="Requires isolated TEST_RENDER_DATABASE_URL")
JOB = "11111111-1111-4111-8111-111111111111"


def candidate():
    return assets_service.AssetUpload(
        id=str(uuid.uuid4()),
        owner_user_id=77,
        job_id=JOB,
        kind="result",
        bucket="results",
        storage_key="render.png",
        content_type="image/png",
        size_bytes=10,
        sha256="0" * 64,
        public_url="https://result.test/image",
    )


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
                    generation_latency_ms int, generation_cost numeric,
                    created_at timestamptz DEFAULT now(), car_asset_id uuid, rim_asset_id uuid,
                    car_image_url text, rim_setup_id uuid, vehicle_identity_id uuid,
                    render_input_snapshot jsonb);
                CREATE TABLE assets (id uuid PRIMARY KEY, owner_user_id int, job_id uuid,
                    kind text, bucket text, storage_key text, content_type text,
                    size_bytes bigint, sha256 text, render_input_draft_id uuid,
                    width int, height int, created_at timestamptz DEFAULT now());
                CREATE TABLE vehicle_identities (id uuid, owner_user_id int, make text,
                    model text, year int, year_start int, year_end int, is_user_confirmed bool);
                CREATE TABLE render_feedback (render_job_id uuid, owner_user_id int,
                    sentiment text, reason text, created_at timestamptz, updated_at timestamptz);
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

        async def upload(*args, **kwargs):
            return candidate()

        monkeypatch.setattr(main, "_upload_render_output_candidate", upload)
        monkeypatch.setattr(main.assets_service, "delete_uploaded_asset", noop)
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
            provider_calls = []

            class Provider:
                async def edit(self, request):
                    provider_calls.append(request)
                    started.set()
                    await release.wait()
                    return successful_result()

            deleted = []

            async def delete(asset):
                deleted.append(asset)

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
            assert len(provider_calls) == 1 and len(deleted) == 1
            async with pool.acquire() as conn:
                assert await conn.fetchval("SELECT count(*) FROM assets") == 0

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
                return candidate()

            monkeypatch.setattr(main, "_upload_render_output_candidate", output)
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


async def assert_failed_api_has_no_result(monkeypatch, pool):
    async def auth(**kwargs):
        return AuthPrincipal(user_id=77, authority="telegram", subject="77", auth_channel="website")

    monkeypatch.setattr(jobs_api, "_resolve_jobs_auth", auth)
    monkeypatch.setattr(main.db, "get_pool", lambda: pool)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app), base_url="http://test"
    ) as client:
        for path in ("/jobs", f"/jobs/{JOB}", f"/jobs/{JOB}/status"):
            response = await client.get(path)
            assert response.status_code == 200, response.text
            item = response.json()["jobs"][0] if path == "/jobs" else response.json()
            assert item["status"] == "failed"
            assert item["render_billing_status"] == "refunded"
            for key in ("result_url", "output_image_url", "share_url"):
                assert item.get(key) is None
            assert not (item.get("assets") or {}).get("result")
        for path, expected in (
            (f"/jobs/{JOB}/download", 409),
            (f"/jobs/{JOB}/assets/result/download", 404),
            (f"/s/{JOB[:8]}", 404),
        ):
            response = await client.get(path)
            assert response.status_code == expected, response.text


@pytest.mark.parametrize("cleanup_fails", [False, True])
def test_finalize_failure_rolls_back_publication_and_api(monkeypatch, cleanup_fails):
    async def run():
        async with database(monkeypatch) as pool:
            deleted = []

            async def finalize_then_fail(conn, **kwargs):
                # These writes must have occurred on this transaction before the injected fault.
                assert await conn.fetchval("SELECT count(*) FROM assets") == 1
                row = await conn.fetchrow("SELECT * FROM jobs")
                assert row["status"] == "completed" and row["result_asset_id"] is not None
                assert row["output_image_url"] == "https://result.test/image"
                await credits_service.finalize_job_credit(conn, **kwargs)
                assert await conn.fetchval("SELECT credit_status FROM jobs") == "finalized"
                async with pool.acquire() as observer:
                    before = await observer.fetchrow("SELECT * FROM jobs")
                    assert (before["status"], before["credit_status"]) == ("processing", "reserved")
                    assert before["result_asset_id"] is None and before["output_image_url"] is None
                    assert await observer.fetchval("SELECT count(*) FROM assets") == 0
                raise RuntimeError("injected finalize failure")

            async def delete(asset):
                # Cleanup runs after rollback, with no publication visible.
                async with pool.acquire() as conn:
                    assert await conn.fetchval("SELECT count(*) FROM assets") == 0
                    assert await conn.fetchval("SELECT credit_status FROM jobs") == "reserved"
                deleted.append(asset)
                if cleanup_fails:
                    raise RuntimeError("storage cleanup unavailable")

            monkeypatch.setattr(main, "finalize_job_credit", finalize_then_fail)
            monkeypatch.setattr(main.assets_service, "delete_uploaded_asset", delete)
            with pytest.raises(RuntimeError, match="injected finalize failure") as failure:
                await main.process_render_job(
                    pool,
                    job_id=JOB,
                    user_id=77,
                    job_data=job_data(),
                    provider=FakeProvider(result=successful_result()),
                )
            # Same failure policy as the worker; repeated delivery must be idempotent.
            for _ in range(2):
                await main._mark_render_failed(pool, job_id=JOB, user_id=77, error=failure.value)
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM jobs")
                assert (row["status"], row["credit_status"]) == ("failed", "refunded")
                assert row["result_asset_id"] is None and row["output_image_url"] is None
                assert row["completed_at"] is None
                assert await conn.fetchval("SELECT count(*) FROM assets") == 0
                assert (
                    await conn.fetchval(
                        "SELECT count(*) FROM credit_ledger WHERE event_type='job_finalize'"
                    )
                    == 0
                )
                assert (
                    await conn.fetchval(
                        "SELECT count(*) FROM credit_ledger WHERE event_type='job_refund'"
                    )
                    == 1
                )
                assert await conn.fetchval("SELECT balance FROM user_credit_accounts") == 3
                assert await conn.fetchval("SELECT remaining_credits FROM credit_packages") == 3
            assert len(deleted) == 1
            await assert_failed_api_has_no_result(monkeypatch, pool)

    asyncio.run(run())


def test_completion_lock_wins_over_failure_and_analytics_error(monkeypatch):
    async def run():
        async with database(monkeypatch) as pool:
            finalizing, release = asyncio.Event(), asyncio.Event()
            deleted = []

            async def paused_finalize(conn, **kwargs):
                await credits_service.finalize_job_credit(conn, **kwargs)
                finalizing.set()
                await release.wait()

            async def analytics(*args, **kwargs):
                assert kwargs["event_name"] == "render_completed"
                async with pool.acquire() as observer:
                    row = await observer.fetchrow("SELECT * FROM jobs")
                    assert (row["status"], row["credit_status"]) == ("completed", "finalized")
                    assert await observer.fetchval("SELECT count(*) FROM assets") == 1
                raise RuntimeError("analytics unavailable after commit")

            async def delete(asset):
                deleted.append(asset)

            monkeypatch.setattr(main, "finalize_job_credit", paused_finalize)
            monkeypatch.setattr(main.analytics_api, "record_system_event", analytics)
            monkeypatch.setattr(main.assets_service, "delete_uploaded_asset", delete)
            completion = asyncio.create_task(
                main.process_render_job(
                    pool,
                    job_id=JOB,
                    user_id=77,
                    job_data=job_data(),
                    provider=FakeProvider(result=successful_result()),
                )
            )
            await finalizing.wait()
            failure = asyncio.create_task(
                main._mark_render_failed(
                    pool, job_id=JOB, user_id=77, error=RuntimeError("racing failure")
                )
            )
            await asyncio.sleep(0)
            assert not failure.done()
            release.set()
            await asyncio.gather(completion, failure)
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM jobs")
                assert (row["status"], row["credit_status"]) == ("completed", "finalized")
                assert row["result_asset_id"] is not None and row["output_image_url"] is not None
                assert await conn.fetchval("SELECT count(*) FROM assets") == 1
                assert await conn.fetchval("SELECT count(*) FROM credit_ledger") == 2
                assert await conn.fetchval("SELECT balance FROM user_credit_accounts") == 2
            assert not deleted

    asyncio.run(run())
