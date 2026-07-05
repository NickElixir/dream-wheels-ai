import asyncio
import os
import uuid
from pathlib import Path

import asyncpg
import pytest

ROOT = Path(__file__).resolve().parents[1]
BASELINE_MIGRATIONS = [
    ROOT / "migrations" / "0001_initial.sql",
    ROOT / "migrations" / "0004_add_feedback.sql",
]
TARGET_MIGRATION = ROOT / "migrations" / "0018_render_feedback.sql"


async def _apply_sql(conn: asyncpg.Connection, path: Path) -> None:
    await conn.execute(path.read_text())


async def _with_temp_schema(callback) -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL is not set")

    conn = await asyncpg.connect(database_url, statement_cache_size=0)
    schema = f"test_render_feedback_{uuid.uuid4().hex[:8]}"
    try:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        await conn.execute(f'CREATE SCHEMA "{schema}"')
        await conn.execute(f'SET search_path TO "{schema}", public')
        await callback(conn)
    finally:
        await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        await conn.close()


def test_render_feedback_migration_creates_table_and_constraints():
    async def run(conn: asyncpg.Connection) -> None:
        for migration in BASELINE_MIGRATIONS:
            await _apply_sql(conn, migration)
        await _apply_sql(conn, TARGET_MIGRATION)

        assert (
            await conn.fetchval("SELECT to_regclass('render_feedback')::text") == "render_feedback"
        )

        constraints = {
            row["conname"]
            for row in await conn.fetch(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'render_feedback'::regclass
                """
            )
        }
        assert "render_feedback_owner_job_unique" in constraints
        assert "render_feedback_sentiment_check" in constraints
        assert "render_feedback_reason_check" in constraints
        assert "render_feedback_liked_reason_null_check" in constraints

        indexes = {
            row["indexname"]
            for row in await conn.fetch(
                """
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = current_schema()
                  AND tablename = 'render_feedback'
                """
            )
        }
        assert "idx_render_feedback_render_job_id" in indexes

    asyncio.run(_with_temp_schema(run))


def test_render_feedback_migration_backfills_legacy_values_and_ignores_unknowns():
    async def run(conn: asyncpg.Connection) -> None:
        for migration in BASELINE_MIGRATIONS:
            await _apply_sql(conn, migration)

        await conn.execute(
            """
            INSERT INTO users (id, telegram_user_id, username)
            VALUES
                (10, 10010, 'liked-user'),
                (11, 10011, 'disliked-user')
            """
        )
        await conn.execute(
            """
            INSERT INTO jobs (
                id, user_id, status, feedback, created_at, completed_at
            )
            VALUES
                ('11111111-1111-4111-8111-111111111111', 10, 'completed', 'like', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('22222222-2222-4222-8222-222222222222', 11, 'completed', 'dislike', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('33333333-3333-4333-8333-333333333333', 10, 'completed', 'unexpected', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('44444444-4444-4444-8444-444444444444', 11, 'processing', 'like', CURRENT_TIMESTAMP, NULL)
            )
            """
        )

        await _apply_sql(conn, TARGET_MIGRATION)

        rows = await conn.fetch(
            """
            SELECT render_job_id::text, owner_user_id, sentiment, reason
            FROM render_feedback
            ORDER BY render_job_id
            """
        )

        assert [dict(row) for row in rows] == [
            {
                "render_job_id": "11111111-1111-4111-8111-111111111111",
                "owner_user_id": 10,
                "sentiment": "liked",
                "reason": None,
            },
            {
                "render_job_id": "22222222-2222-4222-8222-222222222222",
                "owner_user_id": 11,
                "sentiment": "disliked",
                "reason": None,
            },
        ]

    asyncio.run(_with_temp_schema(run))


def test_render_feedback_migration_constraints_reject_invalid_values():
    async def run(conn: asyncpg.Connection) -> None:
        for migration in BASELINE_MIGRATIONS:
            await _apply_sql(conn, migration)
        await _apply_sql(conn, TARGET_MIGRATION)

        await conn.execute(
            """
            INSERT INTO users (id, telegram_user_id, username)
            VALUES (10, 10010, 'feedback-user')
            """
        )
        await conn.execute(
            """
            INSERT INTO jobs (id, user_id, status)
            VALUES ('11111111-1111-4111-8111-111111111111', 10, 'completed')
            """
        )

        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute(
                """
                INSERT INTO render_feedback (render_job_id, owner_user_id, sentiment)
                VALUES ('11111111-1111-4111-8111-111111111111', 10, 'meh')
                """
            )

        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute(
                """
                INSERT INTO render_feedback (render_job_id, owner_user_id, sentiment, reason)
                VALUES ('11111111-1111-4111-8111-111111111111', 10, 'disliked', 'wrong')
                """
            )

        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute(
                """
                INSERT INTO render_feedback (render_job_id, owner_user_id, sentiment, reason)
                VALUES ('11111111-1111-4111-8111-111111111111', 10, 'liked', 'other')
                """
            )

    asyncio.run(_with_temp_schema(run))
