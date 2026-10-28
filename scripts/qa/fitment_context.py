"""Staging operator tooling; never imports the render queue or changes credits."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import ssl
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import unquote, urlsplit
from uuid import UUID, uuid4, uuid5

import asyncpg
import certifi
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

STAGING_PROJECT = "hnawojlnfoaccinlgjyn"
STAGING_SERVICE = "srv-d83e9duk1jcs73boeqa0"
PURPOSE = "fitment_phase_b_qa"
NAMESPACE = UUID("9fe7e139-5c13-44d1-857b-16e57e343388")
logger = logging.getLogger(__name__)


class SafetyError(ValueError):
    """Fail closed without exposing credentials."""


def validate_target(environment: str, dsn: str) -> None:
    """Validate the actual database target before opening any connection."""
    url = urlsplit(dsn)
    if environment != "staging" or url.scheme not in {"postgres", "postgresql"}:
        raise SafetyError("Explicit staging environment and PostgreSQL DSN required")
    if url.query or url.fragment:
        raise SafetyError("DSN query/fragment overrides are forbidden")
    direct = url.hostname == f"db.{STAGING_PROJECT}.supabase.co" and url.username == "postgres"
    pooler = (
        url.hostname == "aws-1-us-east-1.pooler.supabase.com"
        and unquote(url.username or "") == f"postgres.{STAGING_PROJECT}"
    )
    if not (direct or pooler) or url.path != "/postgres" or url.port not in {None, 5432, 6543}:
        raise SafetyError("Database target is not the allowlisted staging project")


async def existing_owner(conn: asyncpg.Connection, provider: str, subject: str) -> int:
    """Resolve an existing identity only; never provision or link an account."""
    if provider not in {"telegram", "supabase", "user_id"} or not subject.strip():
        raise SafetyError("An existing test-account identity is required")
    if provider == "user_id":
        if not subject.isdecimal():
            raise SafetyError("Canonical user ID must be a positive integer")
        owner = await conn.fetchval(
            "SELECT user_id FROM user_identities WHERE user_id=$1 LIMIT 1", int(subject)
        )
    else:
        owner = await conn.fetchval(
            "SELECT user_id FROM user_identities WHERE provider=$1 AND provider_subject=$2",
            provider,
            subject,
        )
    if owner is None:
        raise SafetyError("Existing authenticated identity not found; owner must log in first")
    return int(owner)


async def side_effects(conn: asyncpg.Connection, owner: int) -> dict:
    """Read raw persisted balances and all non-QA jobs, without grant/expiry writes."""
    balance = await conn.fetchval(
        "SELECT balance FROM user_credit_accounts WHERE user_id=$1", owner
    )
    if balance is None:
        raise SafetyError("Existing credit account required; this tool will not create it")
    return {
        "credit_balance": balance,
        "ledger_count": await conn.fetchval(
            "SELECT count(*) FROM credit_ledger WHERE user_id=$1", owner
        ),
        "render_job_count": await conn.fetchval(
            """SELECT count(*) FROM jobs WHERE user_id=$1
               AND NOT COALESCE((COALESCE(render_input_snapshot->>'purpose', '') = $2
                   AND status='failed' AND error_code='qa_context_no_render'
                   AND credit_cost=0 AND credit_status='not_charged'
                   AND completed_at IS NULL AND output_image_url IS NULL
                   AND result_asset_id IS NULL AND provider_request_id IS NULL
                   AND provider_task_id IS NULL AND generation_provider IS NULL), false)""",
            owner,
            PURPOSE,
        ),
        "render_reservations": await conn.fetchval(
            "SELECT count(*) FROM jobs WHERE user_id=$1 AND credit_status='reserved'", owner
        ),
        "total_job_envelopes": await conn.fetchval(
            "SELECT count(*) FROM jobs WHERE user_id=$1", owner
        ),
    }


def assert_no_paid_effects(before: dict, after: dict) -> dict:
    for key in ("credit_balance", "ledger_count", "render_job_count", "render_reservations"):
        if before[key] != after[key]:
            raise SafetyError("Credit/render side effects detected; transaction must roll back")
    return {
        "before": before,
        "after": after,
        "credit_delta": 0,
        "render_job_delta": 0,
        "reservation_delta": 0,
        "qa_envelope_delta": after["total_job_envelopes"] - before["total_job_envelopes"],
        "queue_publish_calls": 0,
    }


async def require_qa_context(conn: asyncpg.Connection, owner: int, context: str) -> dict:
    """Reject arbitrary/history jobs and carrier records with any render activity."""
    row = await conn.fetchrow("SELECT * FROM jobs WHERE id=$1::uuid AND user_id=$2", context, owner)
    if row is None:
        raise SafetyError("QA context not found for selected owner")
    row = dict(row)
    snapshot = row["render_input_snapshot"]
    if isinstance(snapshot, str):
        snapshot = json.loads(snapshot)
    meta = snapshot.get("qa_context", {})
    if (
        snapshot.get("purpose") != PURPOSE
        or meta.get("version") != 1
        or meta.get("context_id") != context
        or meta.get("owner_user_id") != owner
        or row["status"] != "failed"
        or row["error_code"] != "qa_context_no_render"
        or row["credit_cost"] != 0
        or row["credit_status"] != "not_charged"
        or row["completed_at"] is not None
        or any(
            row.get(k)
            for k in (
                "car_photo_file_id",
                "wheel_photo_file_id",
                "car_image_url",
                "wheel_image_url",
                "started_at",
            )
        )
        or any(
            row.get(k)
            for k in (
                "output_image_url",
                "result_asset_id",
                "provider_request_id",
                "provider_task_id",
                "generation_provider",
                "car_asset_id",
                "rim_asset_id",
            )
        )
    ):
        raise SafetyError("Record is not an untouched no-render QA carrier")
    for column, key, table in (
        ("vehicle_identity_id", "vehicle_identity_id", "vehicle_identities"),
        ("rim_setup_id", "rim_setup_id", "rim_setups"),
    ):
        if str(row[column]) != meta.get(key):
            raise SafetyError("QA entity binding changed")
        if (
            await conn.fetchval(
                f"SELECT owner_user_id FROM {table} WHERE id=$1::uuid", str(row[column])
            )
            != owner
        ):
            raise SafetyError("QA entity ownership mismatch")
        if (
            await conn.fetchval(
                f"SELECT count(*) FROM jobs WHERE {column}=$1::uuid", str(row[column])
            )
            != 1
        ):
            raise SafetyError("QA entity is shared with another job")
    specs = await conn.fetch(
        """SELECT r.id, r.owner_user_id,
                  (SELECT count(*) FROM rim_setups s
                   WHERE s.id <> $1::uuid AND
                   (s.front_rim_spec_id=r.id OR s.rear_rim_spec_id=r.id)) AS other_setups
           FROM rim_specs r JOIN rim_setups s ON s.id=$1::uuid
           WHERE r.id=s.front_rim_spec_id OR r.id=s.rear_rim_spec_id""",
        str(row["rim_setup_id"]),
    )
    if not specs or any(spec["owner_user_id"] != owner or spec["other_setups"] for spec in specs):
        raise SafetyError("QA rim specification ownership/isolation mismatch")
    row["qa_context"] = meta
    return row


async def inspect_context(conn: asyncpg.Connection, owner: int, context: str) -> dict:
    """Reuse server-authoritative state builders; inspection only performs SELECTs."""
    from src.jobs_api import (
        _current_check_for_job,
        _fetch_fitment_job_row,
        _fitment_overview_from_row,
    )

    carrier = await require_qa_context(conn, owner, context)
    row = await _fetch_fitment_job_row(conn, job_id=context, user_id=owner)
    current = await _current_check_for_job(conn, row)
    overview = _fitment_overview_from_row(row, current_check=current).model_dump(mode="json")
    latest = await conn.fetchrow(
        """SELECT id::text, execution_status, created_at FROM fitment_checks
           WHERE owner_user_id=$1 AND vehicle_identity_id=$2::uuid AND rim_setup_id=$3::uuid
           ORDER BY created_at DESC, id DESC LIMIT 1""",
        owner,
        row["vehicle_identity_id"],
        row["rim_setup_id"],
    )
    return {
        "context_id": context,
        "owner_user_id": owner,
        "browser_launch": {
            "page": "https://dream-wheels-ai-webapp-staging.vercel.app/app/fitment",
            "console_command": (
                "if (location.origin !== 'https://dream-wheels-ai-webapp-staging.vercel.app') "
                "throw new Error('Staging only'); "
                f"window.dreamwheelsRenderBridge.action('fitment', '{UUID(context)!s}');"
            ),
            "entry_mode": "existing UI bridge; owner authentication remains required",
        },
        "created_at": carrier["created_at"].isoformat(),
        "qa_context": carrier["qa_context"],
        "overview": overview,
        "next_action": overview["next_action"]["kind"],
        "latest_check": dict(latest) if latest else None,
        "is_current": bool(latest and current and latest["id"] == current.id),
        "side_effect_baseline": await side_effects(conn, owner),
    }


async def create_context(conn: asyncpg.Connection, owner: int, run_id: str) -> dict:
    """Create isolated canonical entities and a terminal, never-enqueued QA carrier."""
    from src import identity_service

    run_id = str(UUID(run_id))
    context = str(uuid5(NAMESPACE, f"{owner}:{run_id}"))
    if await conn.fetchval("SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1::uuid)", context):
        await require_qa_context(conn, owner, context)
        return await inspect_context(conn, owner, context)
    vehicle = await identity_service.insert_vehicle_identity(
        conn,
        owner_user_id=owner,
        vehicle=identity_service.VehicleCandidate(
            make="Toyota", model="Camry", confidence=0, source="user_input"
        ),
    )
    rim = await identity_service.insert_rim_spec(
        conn,
        owner_user_id=owner,
        rim=identity_service.RimProposal(confidence=0, source="user_input"),
        is_user_confirmed=False,
    )
    setup = await identity_service.insert_rim_setup(conn, owner_user_id=owner, rim_spec_id=rim)
    meta = {
        "version": 1,
        "context_id": context,
        "owner_user_id": owner,
        "run_id": run_id,
        "vehicle_identity_id": vehicle,
        "rim_setup_id": setup,
        "initial_rim_spec_id": rim,
    }
    await conn.execute(
        """INSERT INTO jobs (id,user_id,status,error_code,error_message,credit_cost,credit_status,
                             vehicle_identity_id,rim_setup_id,render_input_snapshot)
           VALUES ($1::uuid,$2,'failed','qa_context_no_render','QA context: render never submitted',
                   0,'not_charged',$3::uuid,$4::uuid,$5::jsonb)""",
        context,
        owner,
        vehicle,
        setup,
        json.dumps({"purpose": PURPOSE, "qa_context": meta}),
    )
    return await inspect_context(conn, owner, context)


async def reset_context(conn: asyncpg.Connection, owner: int, context: str) -> dict:
    """Archive target metadata and recreate; never delete records or rewind revisions."""
    carrier = await require_qa_context(conn, owner, context)
    if carrier["qa_context"].get("replacement_context_id"):
        return await inspect_context(conn, owner, carrier["qa_context"]["replacement_context_id"])
    pending = await conn.fetchval(
        """SELECT EXISTS(SELECT 1 FROM fitment_checks WHERE owner_user_id=$1
           AND vehicle_identity_id=$2::uuid AND rim_setup_id=$3::uuid
           AND execution_status IN ('queued','processing'))""",
        owner,
        str(carrier["vehicle_identity_id"]),
        str(carrier["rim_setup_id"]),
    )
    if pending:
        raise SafetyError("Wait for the active Standard Check before recreating the context")
    replacement = await create_context(conn, owner, str(uuid5(NAMESPACE, f"reset:{context}")))
    meta = carrier["qa_context"] | {
        "archived_at": datetime.now(UTC).isoformat(),
        "replacement_context_id": replacement["context_id"],
    }
    await conn.execute(
        "UPDATE jobs SET render_input_snapshot=jsonb_set(render_input_snapshot,'{qa_context}',$2::jsonb) WHERE id=$1::uuid",
        context,
        json.dumps(meta),
    )
    return replacement


async def perform(
    conn: asyncpg.Connection,
    operation: str,
    provider: str,
    subject: str,
    context: str | None = None,
    run_id: str | None = None,
) -> dict:
    """Serialize setup for this owner and atomically reject unexpected side effects."""
    async with conn.transaction(isolation="repeatable_read", readonly=operation == "inspect"):
        owner = await existing_owner(conn, provider, subject)
        if operation != "inspect":
            await conn.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended($1,173826))", f"{PURPOSE}:{owner}"
            )
            await conn.fetchval(
                "SELECT balance FROM user_credit_accounts WHERE user_id=$1 FOR UPDATE", owner
            )
        before = await side_effects(conn, owner)
        if operation == "create":
            result = await create_context(conn, owner, run_id or str(uuid4()))
        elif operation == "reset":
            result = await reset_context(conn, owner, str(UUID(context or "")))
        elif operation == "inspect":
            result = await inspect_context(conn, owner, str(UUID(context or "")))
        else:
            raise SafetyError("Unknown operation")
        result["setup_safety"] = assert_no_paid_effects(before, await side_effects(conn, owner))
        return result


async def main(args: argparse.Namespace) -> dict:
    if args.environment != "staging":
        raise SafetyError("Only explicit staging is supported")
    dsn = os.environ.get("FITMENT_QA_DATABASE_URL", "")
    if args.from_render:
        token = os.environ.get("RENDER_API_KEY", "")
        if not token:
            raise SafetyError("RENDER_API_KEY required for the fixed staging service")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"https://api.render.com/v1/services/{STAGING_SERVICE}/env-vars",
                params={"limit": 100},
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            values = {v["envVar"]["key"]: v["envVar"]["value"] for v in response.json()}
            dsn = values.get("DATABASE_URL", "")
    validate_target(args.environment, dsn)
    conn = await asyncpg.connect(
        dsn,
        statement_cache_size=0,
        ssl=ssl.create_default_context(cafile=args.ca_file or certifi.where()),
    )
    try:
        return await perform(
            conn, args.operation, args.owner_provider, args.owner_subject, args.context, args.run_id
        )
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("create", "reset", "inspect"))
    parser.add_argument("--environment", required=True)
    parser.add_argument(
        "--owner-provider", choices=("telegram", "supabase", "user_id"), required=True
    )
    parser.add_argument("--owner-subject", required=True)
    parser.add_argument("--context")
    parser.add_argument(
        "--ca-file", help="Trusted Supabase root CA file; TLS hostname verification remains enabled"
    )
    parser.add_argument("--run-id", help="UUID idempotency key; record/reuse for a repeated create")
    parser.add_argument(
        "--from-render",
        action="store_true",
        help="Read connection settings from the fixed staging service",
    )
    options = parser.parse_args()
    try:
        print(json.dumps(asyncio.run(main(options)), default=str, indent=2))
    except SafetyError as exc:
        parser.exit(2, f"QA setup refused: {exc}\n")
    except Exception:
        logger.exception(
            "QA operation failed operation=%s context_id=%s", options.operation, options.context
        )
        parser.exit(1, "QA operation failed; no setup success asserted\n")
