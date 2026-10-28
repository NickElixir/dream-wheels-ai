"""Real PostgreSQL invariants. Use a dedicated TEST_DATABASE_URL, never the app database."""

import asyncio
import os
import uuid
from pathlib import Path

import asyncpg
import pytest

from src import account_linking_service

MIGRATION = Path(__file__).resolve().parents[1] / "migrations/0040_account_try_on_numbers.sql"


def test_numbering_backfill_concurrency_rollback_and_merge(monkeypatch):
    async def run():
        url = os.getenv("TEST_DATABASE_URL")
        if not url:
            pytest.skip("TEST_DATABASE_URL not set (dedicated test PostgreSQL required)")
        schema = "numbering_" + uuid.uuid4().hex
        conn = await asyncpg.connect(url)
        await conn.execute(f'CREATE SCHEMA "{schema}"')
        await conn.execute(f'SET search_path TO "{schema}"')
        migration = (
            MIGRATION.read_text()
            .replace("public.", f'"{schema}".')
            .replace("search_path = public", f'search_path = "{schema}"')
        )
        try:
            await conn.execute("""
                CREATE TABLE users(id integer PRIMARY KEY, merged_into_user_id integer,
                    created_at timestamptz DEFAULT now(), telegram_user_id bigint,
                    username text, job_count integer DEFAULT 0, merged_at timestamptz);
                CREATE TABLE user_identities(user_id integer REFERENCES users(id),
                    provider text, provider_subject text, UNIQUE(provider,provider_subject));
                CREATE TABLE account_merges(survivor_user_id integer, source_user_id integer UNIQUE,
                    initiated_by_user_id integer);
                CREATE TABLE jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id integer REFERENCES users(id), status text DEFAULT 'queued',
                    created_at timestamptz DEFAULT now());
                INSERT INTO users(id,created_at,telegram_user_id) VALUES
                    (1,'2018-01-01',1001),(2,'2019-01-01',NULL),(3,'2020-01-01',NULL);
                INSERT INTO user_identities VALUES (1,'telegram','1001'),
                    (2,'supabase','00000000-0000-0000-0000-000000000002');
                INSERT INTO jobs(id,user_id,status,created_at) VALUES
                    ('00000000-0000-0000-0000-000000000002',1,'failed','2020-01-01'),
                    ('00000000-0000-0000-0000-000000000001',1,'completed','2020-01-01'),
                    ('00000000-0000-0000-0000-000000000003',2,'cancelled','2019-01-01'),
                    ('00000000-0000-0000-0000-000000000004',2,'failed','2020-01-01'),
                    ('00000000-0000-0000-0000-000000000005',NULL,'failed','2020-01-01');
            """)
            await conn.execute(migration)
            await conn.execute(migration)
            assert (
                await conn.fetchval(
                    "SELECT try_on_number FROM jobs WHERE id='00000000-0000-0000-0000-000000000001'"
                )
                == 1
            )
            assert (
                await conn.fetchval("SELECT try_on_number FROM jobs WHERE user_id IS NULL") is None
            )

            async def create(owner):
                c = await asyncpg.connect(url, server_settings={"search_path": schema})
                try:
                    return await c.fetchval(
                        "INSERT INTO jobs(user_id) VALUES($1) RETURNING try_on_number", owner
                    )
                finally:
                    await c.close()

            issued = await asyncio.gather(*(create(1) for _ in range(12)))
            assert sorted(issued) == list(range(3, 15))
            assert await create(3) == 1
            # Deletion never reuses the largest issued number, including migration reruns.
            await conn.execute("DELETE FROM jobs WHERE user_id=1 AND try_on_number=14")
            await conn.execute(migration)
            assert await create(1) == 15
            tx = conn.transaction()
            await tx.start()
            assert (
                await conn.fetchval("INSERT INTO jobs(user_id) VALUES(1) RETURNING try_on_number")
                == 16
            )
            await tx.rollback()
            assert await create(1) == 16
            with pytest.raises(asyncpg.RaiseError):
                await conn.execute("UPDATE jobs SET try_on_number=999 WHERE user_id=1")

            async def relation_exists(_conn, relation):
                return relation == "jobs"

            monkeypatch.setattr(account_linking_service, "_relation_exists", relation_exists)
            before = dict(await conn.fetch("SELECT id,try_on_number FROM jobs WHERE user_id=1"))
            monkeypatch.setattr(
                account_linking_service,
                "_read_merge_token",
                lambda _: {
                    "current_user_id": 2,
                    "target_user_id": 1,
                    "provider": "telegram",
                    "provider_subject": "1001",
                },
            )
            # Real merge selects the older account, locks both users and transfers jobs.
            result = await account_linking_service.confirm_account_merge(
                conn, current_user_id=2, merge_token="test-only"
            )
            assert result.status == "merged"
            assert result.survivor_user_id == 1
            assert await conn.fetchval("SELECT merged_into_user_id FROM users WHERE id=2") == 1
            assert await conn.fetchval("SELECT count(*) FROM user_identities WHERE user_id=2") == 0
            assert (
                await conn.fetchval("SELECT count(*) FROM account_merges WHERE source_user_id=2")
                == 1
            )
            repeat = await account_linking_service.confirm_account_merge(
                conn, current_user_id=1, merge_token="test-only"
            )
            assert repeat.status == "already_linked"
            assert (
                dict(
                    await conn.fetch(
                        "SELECT id,try_on_number FROM jobs WHERE id=ANY($1::uuid[])", list(before)
                    )
                )
                == before
            )
            moved = await conn.fetch(
                "SELECT try_on_number FROM jobs WHERE id IN ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004') ORDER BY created_at,id"
            )
            assert [r["try_on_number"] for r in moved] == [17, 18]
            assert await create(1) == 19
            with pytest.raises(asyncpg.RaiseError):
                await create(2)
        finally:
            await conn.execute(f'DROP SCHEMA "{schema}" CASCADE')
            await conn.close()

    asyncio.run(run())
