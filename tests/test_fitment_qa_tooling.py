"""QA setup safeguards; optional real PostgreSQL verification stays local only."""

import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import asyncpg
import pytest

from scripts.qa import fitment_context as qa

STAGING_DSN = f"postgresql://postgres.{qa.STAGING_PROJECT}:unused@aws-1-us-east-1.pooler.supabase.com:6543/postgres"


@pytest.mark.parametrize("environment", ["", "production", "main", "dev"])
def test_refuses_non_staging(environment):
    with pytest.raises(qa.SafetyError):
        qa.validate_target(environment, STAGING_DSN)


@pytest.mark.parametrize(
    "dsn",
    [
        "postgresql://postgres:unused@db.qmgyccghsbdpehiybjae.supabase.co/postgres",
        "postgresql://postgres.qmgyccghsbdpehiybjae:unused@aws-1-us-east-1.pooler.supabase.com/postgres",
        "postgresql://postgres:unused@localhost/postgres",
        STAGING_DSN.replace("/postgres", "/other"),
        STAGING_DSN + "?host=db.qmgyccghsbdpehiybjae.supabase.co",
        STAGING_DSN + "?user=postgres.other",
        STAGING_DSN + "?dbname=other",
        STAGING_DSN + "?sslmode=disable",
        STAGING_DSN + "#fragment",
        STAGING_DSN.replace(":6543", ":5433"),
        STAGING_DSN.replace("postgresql:", "https:"),
    ],
)
def test_refuses_wrong_target_and_dsn_overrides(dsn):
    with pytest.raises(qa.SafetyError):
        qa.validate_target("staging", dsn)


def test_accepts_only_known_staging_targets():
    qa.validate_target("staging", STAGING_DSN)
    qa.validate_target(
        "staging", f"postgresql://postgres:unused@db.{qa.STAGING_PROJECT}.supabase.co:5432/postgres"
    )


@pytest.mark.parametrize(
    "key", ["credit_balance", "ledger_count", "render_job_count", "render_reservations"]
)
def test_unexpected_side_effect_aborts(key):
    before = dict.fromkeys(
        (
            "credit_balance",
            "ledger_count",
            "render_job_count",
            "render_reservations",
            "total_job_envelopes",
        ),
        0,
    )
    with pytest.raises(qa.SafetyError):
        qa.assert_no_paid_effects(before, before | {key: 1})


def test_local_postgres_create_inspect_recreate_and_guards(monkeypatch):
    dsn = os.environ.get("TEST_FITMENT_QA_DATABASE_URL")
    if not dsn:
        pytest.skip(
            "Set TEST_FITMENT_QA_DATABASE_URL to an isolated local PostgreSQL test database"
        )
    url = urlsplit(dsn)
    assert url.hostname in {"localhost", "127.0.0.1", "::1"} and not url.query

    async def forbidden_queue(*args, **kwargs):
        pytest.fail("QA setup attempted to enqueue work")

    from src import redis_client

    monkeypatch.setattr(redis_client, "get_client", lambda: pytest.fail("QA setup touched Redis"))
    monkeypatch.setattr(redis_client, "enqueue_job", forbidden_queue, raising=False)

    async def scenario():
        conn = await asyncpg.connect(dsn)
        schema = "qa_test_" + uuid4().hex
        await conn.execute(f'CREATE SCHEMA "{schema}"')
        await conn.execute(f'SET search_path TO "{schema}"')
        try:
            await conn.execute(
                "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$"
            )
            root = Path(__file__).resolve().parents[1]
            # Apply the actual model migrations; legacy payment rollout alternatives
            # are intentionally outside this local QA setup test.
            for number in (
                "0001",
                "0005",
                "0009",
                "0015",
                "0017",
                "0019",
                "0020",
                "0021",
                "0022",
                "0026",
                "0029",
                "0031",
                "0035",
                "0036",
            ):
                await conn.execute(next((root / "migrations").glob(number + "*.sql")).read_text())
            owner = await conn.fetchval(
                "INSERT INTO users(telegram_user_id) VALUES(9876543210) RETURNING id"
            )
            other = await conn.fetchval(
                "INSERT INTO users(telegram_user_id) VALUES(9876543211) RETURNING id"
            )
            await conn.execute(
                "INSERT INTO user_identities(user_id,provider,provider_subject) VALUES($1,'telegram','9876543210')",
                owner,
            )
            await conn.execute(
                "INSERT INTO user_credit_accounts(user_id,balance) VALUES($1,36)", owner
            )
            with pytest.raises(qa.SafetyError, match="not found"):
                await qa.perform(conn, "create", "telegram", "unknown")
            run_id = str(uuid4())
            created = await qa.perform(conn, "create", "telegram", "9876543210", run_id=run_id)
            context = created["context_id"]
            assert await qa.existing_owner(conn, "user_id", str(owner)) == owner
            with pytest.raises(qa.SafetyError):
                await qa.existing_owner(conn, "user_id", str(other))
            assert context in created["browser_launch"]["console_command"]
            baseline = created["overview"]
            assert created["owner_user_id"] == owner
            assert baseline["vehicle_state"] == "unconfirmed"
            assert baseline["rim_setup_state"] == "empty"
            assert created["next_action"] == "complete_vehicle_details"
            assert created["latest_check"] is None and not created["is_current"]
            assert created["setup_safety"]["credit_delta"] == 0
            assert created["setup_safety"]["render_job_delta"] == 0
            assert created["setup_safety"]["qa_envelope_delta"] == 1
            for key in ("vehicle_revision", "rim_revision", "rim_setup_revision"):
                assert baseline[key] > 0
            repeated = await qa.perform(conn, "create", "telegram", "9876543210", run_id=run_id)
            assert repeated["context_id"] == context
            assert repeated["setup_safety"]["qa_envelope_delta"] == 0
            # PostgreSQL, not a mock, enforces inspection's read-only transaction.
            inspected = await qa.perform(conn, "inspect", "telegram", "9876543210", context)
            assert inspected["overview"] == baseline
            assert inspected["setup_safety"]["qa_envelope_delta"] == 0
            original_inspect = qa.inspect_context

            async def attempt_write(conn, owner, context):
                await conn.execute(
                    "UPDATE user_credit_accounts SET balance=balance+1 WHERE user_id=$1", owner
                )

            monkeypatch.setattr(qa, "inspect_context", attempt_write)
            with pytest.raises(asyncpg.ReadOnlySQLTransactionError):
                await qa.perform(conn, "inspect", "telegram", "9876543210", context)
            monkeypatch.setattr(qa, "inspect_context", original_inspect)
            with pytest.raises(qa.SafetyError, match="not found"):
                await qa.require_qa_context(conn, other, context)
            original_create = qa.create_context
            before_jobs = await conn.fetchval("SELECT count(*) FROM jobs")

            async def unsafe_create(conn, owner, run_id):
                result = await original_create(conn, owner, run_id)
                await conn.execute(
                    "UPDATE user_credit_accounts SET balance=balance-1 WHERE user_id=$1", owner
                )
                return result

            monkeypatch.setattr(qa, "create_context", unsafe_create)
            with pytest.raises(qa.SafetyError, match="side effects"):
                await qa.perform(conn, "create", "telegram", "9876543210")
            monkeypatch.setattr(qa, "create_context", original_create)
            assert await conn.fetchval("SELECT count(*) FROM jobs") == before_jobs
            assert (
                await conn.fetchval(
                    "SELECT balance FROM user_credit_accounts WHERE user_id=$1", owner
                )
                == 36
            )
            unrelated = str(
                await conn.fetchval(
                    "INSERT INTO jobs(user_id,status) VALUES($1,'completed') RETURNING id", owner
                )
            )
            with pytest.raises(qa.SafetyError):
                await qa.reset_context(conn, owner, unrelated)
            # Sharing a rim with any second setup must block cleanup, even for the same owner.
            rim = created["qa_context"]["initial_rim_spec_id"]
            shared = await conn.fetchval(
                "INSERT INTO rim_setups(owner_user_id,front_rim_spec_id,rear_rim_spec_id) VALUES($1,$2::uuid,$2::uuid) RETURNING id",
                owner,
                rim,
            )
            with pytest.raises(qa.SafetyError, match="isolation"):
                await qa.require_qa_context(conn, owner, context)
            await conn.execute("DELETE FROM rim_setups WHERE id=$1", shared)
            vehicle = baseline["vehicle_identity_id"]
            await conn.execute(
                "UPDATE vehicle_identities SET revision=revision+1 WHERE id=$1::uuid", vehicle
            )
            old_revision = await conn.fetchval(
                "SELECT revision FROM vehicle_identities WHERE id=$1::uuid", vehicle
            )
            reset = await qa.perform(conn, "reset", "telegram", "9876543210", context)
            assert reset["context_id"] != context
            assert reset["overview"]["vehicle_identity_id"] != vehicle
            assert reset["overview"]["rim_setup_id"] != baseline["rim_setup_id"]
            assert reset["overview"]["vehicle_state"] == "unconfirmed"
            assert reset["overview"]["rim_setup_state"] == "empty"
            assert reset["latest_check"] is None
            assert reset["setup_safety"]["render_job_delta"] == 0
            assert reset["setup_safety"]["credit_delta"] == 0
            assert (
                await conn.fetchval(
                    "SELECT revision FROM vehicle_identities WHERE id=$1::uuid", vehicle
                )
                == old_revision
            )
            old_snapshot = json.loads(
                await conn.fetchval(
                    "SELECT render_input_snapshot FROM jobs WHERE id=$1::uuid", context
                )
            )
            assert old_snapshot["qa_context"]["replacement_context_id"] == reset["context_id"]
            again = await qa.perform(conn, "reset", "telegram", "9876543210", context)
            assert again["context_id"] == reset["context_id"]
            assert again["setup_safety"]["qa_envelope_delta"] == 0
            assert (
                await conn.fetchval("SELECT status FROM jobs WHERE id=$1::uuid", unrelated)
                == "completed"
            )
        finally:
            await conn.execute(f'DROP SCHEMA "{schema}" CASCADE')
            await conn.close()

    asyncio.run(scenario())
