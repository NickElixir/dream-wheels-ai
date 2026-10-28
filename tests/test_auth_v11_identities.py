import asyncio
import copy
import os
import uuid
from pathlib import Path

import anyio
import asyncpg
import pytest

from src.users_service import (
    IdentityConflictError,
    ensure_user,
    ensure_user_identity,
    get_user_by_identity,
)

ROOT = Path(__file__).resolve().parents[1]
BASELINE_MIGRATIONS = [
    ROOT / "migrations" / "0001_initial.sql",
    ROOT / "migrations" / "0002_enable_rls.sql",
]
TARGET_MIGRATION = ROOT / "migrations" / "0031_auth_v11_identities.sql"
SUPABASE_SUBJECT = "5d4f9d7f-6bb4-48b2-8ac7-8f4f407f2f0b"


async def _apply_sql(conn: asyncpg.Connection, path: Path) -> None:
    await conn.execute(await anyio.Path(path).read_text())


async def _with_temp_schema(callback) -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL is not set")

    conn = await asyncpg.connect(database_url, statement_cache_size=0)
    schema = f"test_auth_v11_identities_{uuid.uuid4().hex[:8]}"
    try:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        await conn.execute(f'CREATE SCHEMA "{schema}"')
        await conn.execute(f'SET search_path TO "{schema}", public')
        await callback(conn, schema, database_url)
    finally:
        await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        await conn.close()


def test_auth_v11_identities_migration_contract_is_backend_only() -> None:
    migration = TARGET_MIGRATION.read_text(encoding="utf-8")
    normalized = " ".join(migration.split())

    assert "CREATE TABLE IF NOT EXISTS user_identities" in normalized
    assert "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE" in normalized
    assert "provider VARCHAR(32) NOT NULL" in normalized
    assert "provider_subject TEXT NOT NULL" in normalized
    assert "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP" in normalized
    assert "last_authenticated_at TIMESTAMPTZ" in normalized
    assert "UNIQUE (provider, provider_subject)" in normalized
    assert "CREATE INDEX IF NOT EXISTS idx_user_identities_user_id" in normalized
    assert "ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY" in normalized
    assert "REVOKE ALL ON TABLE user_identities FROM anon, authenticated" in normalized
    assert "ALTER TABLE users" in normalized
    assert "ALTER COLUMN telegram_user_id DROP NOT NULL" in normalized
    assert "INSERT INTO user_identities (user_id, provider, provider_subject)" in normalized
    assert "ON CONFLICT (provider, provider_subject) DO NOTHING" in normalized
    assert "INSERT INTO users" not in normalized
    assert "CREATE POLICY" not in normalized
    assert "CREATE TYPE" not in normalized


class _FakeTransaction:
    def __init__(self, conn):
        self.conn = conn
        self.snapshot = None

    async def __aenter__(self):
        self.snapshot = (copy.deepcopy(self.conn.users), copy.deepcopy(self.conn.identities))
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if exc_type:
            self.conn.users, self.conn.identities = self.snapshot
        return False


class _FakeConn:
    def __init__(self):
        self.users: dict[int, dict[str, object]] = {}
        self.identities: dict[tuple[str, str], int] = {}
        self.next_user_id = 1
        self.lock_keys: list[str] = []
        self.race_identity_conflict = False

    def transaction(self):
        return _FakeTransaction(self)

    async def execute(self, query: str, *args):
        normalized = " ".join(query.split())
        if normalized.startswith("SELECT pg_advisory_xact_lock"):
            self.lock_keys.append(args[0])
            return "SELECT 1"
        if normalized.startswith("UPDATE users SET username = $1 WHERE id = $2"):
            self.users[int(args[1])]["username"] = args[0]
            return "UPDATE 1"
        if normalized.startswith("UPDATE user_identities SET last_authenticated_at"):
            return "UPDATE 1"
        raise AssertionError(f"Unexpected execute query: {normalized}")

    async def fetchval(self, query: str, *args):
        normalized = " ".join(query.split())
        if normalized.startswith("SELECT user_id FROM user_identities"):
            return self.identities.get((args[0], args[1]))
        if normalized.startswith("SELECT id FROM users WHERE telegram_user_id"):
            return next(
                (
                    user_id
                    for user_id, user in self.users.items()
                    if user["telegram_user_id"] == args[0]
                ),
                None,
            )
        if normalized.startswith("INSERT INTO users (telegram_user_id, username)"):
            user_id = self.next_user_id
            self.next_user_id += 1
            self.users[user_id] = {"telegram_user_id": args[0], "username": args[1]}
            return user_id
        if normalized.startswith("INSERT INTO users (telegram_user_id)"):
            user_id = self.next_user_id
            self.next_user_id += 1
            self.users[user_id] = {"telegram_user_id": None, "username": None}
            return user_id
        if normalized.startswith("INSERT INTO user_identities"):
            key = (args[1], args[2])
            if self.race_identity_conflict or key in self.identities:
                return None
            self.identities[key] = int(args[0])
            return int(args[0])
        raise AssertionError(f"Unexpected fetchval query: {normalized}")


def test_user_service_preserves_telegram_and_supports_supabase_identity() -> None:
    async def run() -> None:
        conn = _FakeConn()

        conn.users[42] = {"telegram_user_id": 918273645, "username": "old-name"}
        conn.next_user_id = 43
        assert await ensure_user(conn, 918273645, "new-name") == 42
        assert conn.identities[("telegram", "918273645")] == 42
        assert conn.users[42]["username"] == "new-name"

        telegram_user_id = await ensure_user(conn, 111222333, "telegram-user")
        assert conn.users[telegram_user_id]["telegram_user_id"] == 111222333
        assert conn.identities[("telegram", "111222333")] == telegram_user_id

        supabase_user_id = await ensure_user_identity(
            conn,
            provider="supabase",
            provider_subject=SUPABASE_SUBJECT,
        )
        assert conn.users[supabase_user_id]["telegram_user_id"] is None
        assert conn.identities[("supabase", SUPABASE_SUBJECT)] == supabase_user_id

        assert (
            await get_user_by_identity(
                conn,
                provider="supabase",
                provider_subject=SUPABASE_SUBJECT,
            )
            == supabase_user_id
        )
        assert (
            await get_user_by_identity(
                conn,
                provider="supabase",
                provider_subject="8c14ce1c-5e47-40bb-b2f4-6e1707a2c2d7",
            )
            is None
        )
        assert (
            await ensure_user_identity(
                conn,
                provider="supabase",
                provider_subject=SUPABASE_SUBJECT,
            )
            == supabase_user_id
        )
        assert conn.lock_keys == [
            "telegram:918273645",
            "telegram:111222333",
            f"supabase:{SUPABASE_SUBJECT}",
            f"supabase:{SUPABASE_SUBJECT}",
        ]

    asyncio.run(run())


def test_user_service_does_not_leave_user_on_identity_conflict() -> None:
    async def run() -> None:
        conn = _FakeConn()
        conn.race_identity_conflict = True

        with pytest.raises(IdentityConflictError):
            await ensure_user_identity(
                conn,
                provider="supabase",
                provider_subject=SUPABASE_SUBJECT,
            )

        assert conn.users == {}
        assert conn.identities == {}

    asyncio.run(run())


def test_user_service_keeps_username_telegram_only() -> None:
    async def run() -> None:
        with pytest.raises(ValueError, match="username is only supported"):
            await ensure_user_identity(
                _FakeConn(),
                provider="supabase",
                provider_subject=SUPABASE_SUBJECT,
                username="not-a-universal-profile-name",
            )

    asyncio.run(run())


@pytest.mark.parametrize(
    ("provider", "provider_subject"),
    [
        ("unknown", "subject"),
        ("telegram", "00123"),
        ("telegram", "not-a-number"),
        ("supabase", " subject "),
    ],
)
def test_user_service_rejects_noncanonical_identity_inputs(provider, provider_subject) -> None:
    async def run() -> None:
        with pytest.raises(ValueError):
            await get_user_by_identity(
                _FakeConn(),
                provider=provider,
                provider_subject=provider_subject,
            )

    asyncio.run(run())


def test_auth_v11_identities_migration_backfills_and_preserves_users() -> None:
    async def run(conn, _schema, _database_url) -> None:
        for migration in BASELINE_MIGRATIONS:
            await _apply_sql(conn, migration)
        await conn.execute(
            """
            INSERT INTO users (id, telegram_user_id, username)
            VALUES (10, 10010, 'first'), (11, 10011, 'second')
            """
        )

        await _apply_sql(conn, TARGET_MIGRATION)
        await _apply_sql(conn, TARGET_MIGRATION)

        rows = await conn.fetch(
            """
            SELECT user_id, provider, provider_subject
            FROM user_identities
            ORDER BY user_id
            """
        )
        assert [dict(row) for row in rows] == [
            {"user_id": 10, "provider": "telegram", "provider_subject": "10010"},
            {"user_id": 11, "provider": "telegram", "provider_subject": "10011"},
        ]
        assert [row["id"] for row in await conn.fetch("SELECT id FROM users ORDER BY id")] == [
            10,
            11,
        ]
        assert (
            await conn.fetchval(
                """
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'users'
                  AND column_name = 'telegram_user_id'
                """
            )
            == "YES"
        )
        assert await conn.fetchval(
            "SELECT relrowsecurity FROM pg_class WHERE oid = 'user_identities'::regclass"
        )
        assert (
            await conn.fetchval(
                "SELECT count(*) FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'user_identities'"
            )
            == 0
        )

        await conn.execute("INSERT INTO users (id, telegram_user_id) VALUES (12, NULL)")
        await conn.execute(
            """
            INSERT INTO user_identities (user_id, provider, provider_subject)
            VALUES (12, 'supabase', $1)
            """,
            SUPABASE_SUBJECT,
        )
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute(
                "INSERT INTO user_identities (user_id, provider, provider_subject) VALUES (12, 'telegram', '10010')"
            )
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute("INSERT INTO users (telegram_user_id) VALUES (10010)")

    asyncio.run(_with_temp_schema(run))


def test_auth_v11_identity_creation_is_race_safe_when_database_is_available() -> None:
    async def run(conn, schema, database_url) -> None:
        for migration in BASELINE_MIGRATIONS:
            await _apply_sql(conn, migration)
        await _apply_sql(conn, TARGET_MIGRATION)

        contender = await asyncpg.connect(database_url, statement_cache_size=0)
        try:
            await contender.execute(f'SET search_path TO "{schema}", public')
            results = await asyncio.gather(
                ensure_user_identity(
                    conn,
                    provider="supabase",
                    provider_subject=SUPABASE_SUBJECT,
                ),
                ensure_user_identity(
                    contender,
                    provider="supabase",
                    provider_subject=SUPABASE_SUBJECT,
                ),
            )
            assert results[0] == results[1]
            assert await conn.fetchval("SELECT count(*) FROM users") == 1
            assert (
                await conn.fetchval(
                    "SELECT count(*) FROM user_identities WHERE provider = 'supabase'"
                )
                == 1
            )
        finally:
            await contender.close()

    asyncio.run(_with_temp_schema(run))
