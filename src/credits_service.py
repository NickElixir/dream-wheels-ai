"""Credit ledger и безопасное списание за рендеры."""

import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import asyncpg

from src.config import (
    JOB_CREDIT_COST,
    PURCHASE_GRANT_TTL_DAYS,
    STARTER_GRANT_CREDITS,
    STARTER_GRANT_TTL_DAYS,
)

logger = logging.getLogger(__name__)


class InsufficientCreditsError(Exception):
    """Недостаточно credits для запуска рендера."""


@dataclass(slots=True)
class CreditAccountState:
    balance: int
    starter_credits_granted_now: bool


async def create_credit_package(
    conn: asyncpg.Connection,
    *,
    user_id: int,
    source: str,
    credits: int,
    expires_at: datetime,
    idempotency_key: str,
    related_payment_id: str | None = None,
) -> None:
    await conn.execute(
        """
        INSERT INTO credit_packages (
            user_id, source, credits_granted, remaining_credits, expires_at,
            related_payment_id, idempotency_key
        ) VALUES ($1, $2, $3, $3, $4, $5::uuid, $6)
        ON CONFLICT (idempotency_key) DO NOTHING
        """,
        user_id,
        source,
        credits,
        expires_at,
        related_payment_id,
        idempotency_key,
    )


async def expire_credit_packages(conn: asyncpg.Connection, *, user_id: int) -> int:
    rows = await conn.fetch(
        """
        SELECT id, remaining_credits, expires_at
        FROM credit_packages
        WHERE user_id = $1 AND remaining_credits > 0 AND expires_at <= CURRENT_TIMESTAMP
        ORDER BY expires_at, created_at
        FOR UPDATE
        """,
        user_id,
    )
    expired = sum(int(row["remaining_credits"]) for row in rows)
    if not expired:
        return 0
    for row in rows:
        await conn.execute(
            "UPDATE credit_packages SET remaining_credits = 0 WHERE id = $1", row["id"]
        )
        await conn.execute(
            """
            INSERT INTO credit_ledger (user_id, event_type, credits_delta, balance_after,
                idempotency_key, metadata)
            VALUES (
                $1,
                'expiration',
                $2,
                0,
                $3,
                jsonb_build_object(
                    'package_id', $4::text,
                    'expires_at', $5::timestamptz
                )
            )
            ON CONFLICT (idempotency_key) DO NOTHING
            """,
            user_id,
            -int(row["remaining_credits"]),
            f"package_expire:{row['id']}",
            row["id"],
            row["expires_at"].isoformat(),
        )
    await conn.execute(
        "UPDATE user_credit_accounts SET balance = GREATEST(0, balance - $2), updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
        user_id,
        expired,
    )
    return expired


async def list_credit_packages(
    conn: asyncpg.Connection, *, user_id: int
) -> list[dict[str, object]]:
    await expire_credit_packages(conn, user_id=user_id)
    rows = await conn.fetch(
        """
        SELECT id, source, remaining_credits, expires_at, created_at
        FROM credit_packages
        WHERE user_id = $1 AND remaining_credits > 0 AND expires_at > CURRENT_TIMESTAMP
        ORDER BY expires_at, created_at
        """,
        user_id,
    )
    return [
        {
            "id": str(row["id"]),
            "source": row["source"],
            "remaining_credits": int(row["remaining_credits"]),
            "expires_at": row["expires_at"].isoformat(),
        }
        for row in rows
    ]


def _starter_grant_idempotency_key(user_id: int) -> str:
    return f"starter_grant:{user_id}"


def _starter_grant_expiration_idempotency_key(user_id: int) -> str:
    return f"starter_grant_expire:{user_id}"


def _starter_grant_expires_at(created_at: datetime) -> datetime:
    return created_at + timedelta(days=STARTER_GRANT_TTL_DAYS)


def _metadata_kind(metadata: object) -> str:
    """Read JSONB consistently when a database codec returns text."""
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            return ""
    if not isinstance(metadata, Mapping):
        return ""
    value = metadata.get("kind")
    return value if isinstance(value, str) else ""


async def _has_starter_grant_ledger_entry(conn: asyncpg.Connection, user_id: int) -> bool:
    try:
        found = await conn.fetchval(
            """
            SELECT 1
            FROM credit_ledger
            WHERE user_id = $1
              AND (
                  metadata->>'kind' = 'starter_grant'
                  OR event_type = 'trial_grant'
                  OR idempotency_key = $2
              )
            LIMIT 1
            """,
            user_id,
            _starter_grant_idempotency_key(user_id),
        )
    except asyncpg.UndefinedColumnError:
        try:
            found = await conn.fetchval(
                """
                SELECT 1
                FROM credit_ledger
                WHERE user_id = $1
                  AND metadata->>'kind' = 'starter_grant'
                LIMIT 1
                """,
                user_id,
            )
        except asyncpg.PostgresError:
            return False
    except asyncpg.PostgresError:
        return False
    return found is not None


async def _get_starter_grant_ledger_entry(
    conn: asyncpg.Connection,
    user_id: int,
) -> asyncpg.Record | None:
    try:
        return await conn.fetchrow(
            """
            SELECT credits_delta, created_at
            FROM credit_ledger
            WHERE user_id = $1
              AND (
                  metadata->>'kind' = 'starter_grant'
                  OR event_type = 'trial_grant'
                  OR idempotency_key = $2
              )
            ORDER BY created_at ASC
            LIMIT 1
            """,
            user_id,
            _starter_grant_idempotency_key(user_id),
        )
    except asyncpg.UndefinedColumnError:
        try:
            return await conn.fetchrow(
                """
                SELECT delta_credits AS credits_delta, created_at
                FROM credit_ledger
                WHERE user_id = $1
                  AND metadata->>'kind' = 'starter_grant'
                ORDER BY created_at ASC
                LIMIT 1
                """,
                user_id,
            )
        except asyncpg.PostgresError:
            return None
    except asyncpg.PostgresError:
        logger.exception(f"❌ starter grant ledger lookup failed for user_id={user_id}")
        return None


async def _has_starter_grant_expiration_ledger_entry(
    conn: asyncpg.Connection, user_id: int
) -> bool:
    try:
        found = await conn.fetchval(
            """
            SELECT 1
            FROM credit_ledger
            WHERE user_id = $1
              AND (
                  metadata->>'kind' = 'starter_grant_expiration'
                  OR event_type = 'expiration'
                  OR idempotency_key = $2
              )
            LIMIT 1
            """,
            user_id,
            _starter_grant_expiration_idempotency_key(user_id),
        )
    except asyncpg.UndefinedColumnError:
        try:
            found = await conn.fetchval(
                """
                SELECT 1
                FROM credit_ledger
                WHERE user_id = $1
                  AND metadata->>'kind' = 'starter_grant_expiration'
                LIMIT 1
                """,
                user_id,
            )
        except asyncpg.PostgresError:
            return False
    except asyncpg.PostgresError:
        logger.exception(f"❌ starter grant expiration lookup failed for user_id={user_id}")
        return False
    return found is not None


def _calculate_remaining_starter_grant_credits(
    ledger_rows: list[Mapping[str, Any]],
    *,
    user_id: int,
    granted_credits: int,
) -> int:
    remaining = granted_credits
    starter_seen = False
    starter_key = _starter_grant_idempotency_key(user_id)

    for row in ledger_rows:
        row_idempotency_key = row.get("idempotency_key")
        row_kind = _metadata_kind(row.get("metadata"))
        row_event_type = row.get("event_type")
        credits_delta = int(row.get("credits_delta") or 0)

        if not starter_seen:
            if (
                row_kind == "starter_grant"
                or row_event_type == "trial_grant"
                or row_idempotency_key == starter_key
            ) and credits_delta > 0:
                starter_seen = True
            continue

        if credits_delta < 0:
            remaining = max(0, remaining + credits_delta)
            continue

        if row_event_type == "job_refund":
            remaining = min(granted_credits, remaining + credits_delta)

    return remaining


async def _list_credit_ledger_rows_for_user(
    conn: asyncpg.Connection,
    user_id: int,
) -> list[asyncpg.Record]:
    try:
        return await conn.fetch(
            """
            SELECT event_type, credits_delta, idempotency_key, metadata, created_at
            FROM credit_ledger
            WHERE user_id = $1
            ORDER BY created_at ASC, idempotency_key ASC
            """,
            user_id,
        )
    except asyncpg.UndefinedColumnError:
        return await conn.fetch(
            """
            SELECT operation_type AS event_type,
                   delta_credits AS credits_delta,
                   idempotency_key,
                   metadata,
                   created_at
            FROM credit_ledger
            WHERE user_id = $1
            ORDER BY created_at ASC, idempotency_key ASC
            """,
            user_id,
        )


async def _execute_ledger_insert_with_savepoint(
    conn: asyncpg.Connection,
    query: str,
    *args: object,
) -> None:
    async with conn.transaction():
        await conn.execute(query, *args)


async def _insert_starter_grant_ledger_entry(
    conn: asyncpg.Connection,
    *,
    user_id: int,
    balance_after: int,
) -> None:
    # Ledger is an audit trail. Missing compat columns should not block the user-facing balance flow.
    try:
        await _execute_ledger_insert_with_savepoint(
            conn,
            """
            INSERT INTO credit_ledger (
                user_id,
                event_type,
                credits_delta,
                balance_after,
                idempotency_key,
                metadata
            )
            VALUES (
                $1,
                'trial_grant',
                $2,
                $3,
                $4,
                jsonb_build_object('kind', 'starter_grant')
            )
            ON CONFLICT (idempotency_key) DO NOTHING
            """,
            user_id,
            STARTER_GRANT_CREDITS,
            balance_after,
            _starter_grant_idempotency_key(user_id),
        )
        return
    except asyncpg.UndefinedColumnError:
        logger.warning(
            "⚠️ legacy credit_ledger schema detected; using fallback starter grant insert"
        )
    except asyncpg.PostgresError:
        logger.exception(f"❌ starter grant ledger insert failed for user_id={user_id}")
        return

    try:
        await _execute_ledger_insert_with_savepoint(
            conn,
            """
            INSERT INTO credit_ledger (
                user_id,
                operation_type,
                delta_credits,
                amount_value,
                currency,
                idempotency_key,
                metadata
            )
            VALUES (
                $1,
                'manual_adjustment',
                $2,
                NULL,
                'RUB',
                $3,
                jsonb_build_object('kind', 'starter_grant')
            )
            ON CONFLICT (idempotency_key) DO NOTHING
            """,
            user_id,
            STARTER_GRANT_CREDITS,
            _starter_grant_idempotency_key(user_id),
        )
    except asyncpg.PostgresError:
        logger.exception(f"❌ legacy starter grant ledger insert failed for user_id={user_id}")


async def _insert_starter_grant_expiration_ledger_entry(
    conn: asyncpg.Connection,
    *,
    user_id: int,
    credits_to_expire: int,
    balance_after: int,
    expires_at: datetime,
) -> bool:
    try:
        async with conn.transaction():
            inserted = await conn.fetchval(
                """
                INSERT INTO credit_ledger (
                    user_id,
                    event_type,
                    credits_delta,
                    balance_after,
                    idempotency_key,
                    metadata
                )
                VALUES (
                    $1,
                    'expiration',
                    $2,
                    $3,
                    $4,
                    jsonb_build_object(
                        'kind', 'starter_grant_expiration',
                        'grant_kind', 'starter_grant',
                        'expired_credits', $5::integer,
                        'expires_at', $6::timestamptz
                    )
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING 1
                """,
                user_id,
                -credits_to_expire,
                balance_after,
                _starter_grant_expiration_idempotency_key(user_id),
                credits_to_expire,
                expires_at.isoformat(),
            )
        return inserted == 1
    except asyncpg.UndefinedColumnError:
        logger.warning(
            "⚠️ legacy credit_ledger schema detected; using fallback starter grant expiration insert"
        )
    except asyncpg.PostgresError:
        logger.exception(f"❌ starter grant expiration insert failed for user_id={user_id}")

    try:
        async with conn.transaction():
            inserted = await conn.fetchval(
                """
                INSERT INTO credit_ledger (
                    user_id,
                    operation_type,
                    delta_credits,
                    amount_value,
                    currency,
                    idempotency_key,
                    metadata
                )
                VALUES (
                    $1,
                    'manual_adjustment',
                    $2,
                    NULL,
                    'RUB',
                    $3,
                    jsonb_build_object(
                        'kind', 'starter_grant_expiration',
                        'grant_kind', 'starter_grant',
                        'expired_credits', $4::integer,
                        'expires_at', $5::timestamptz
                    )
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING 1
                """,
                user_id,
                -credits_to_expire,
                _starter_grant_expiration_idempotency_key(user_id),
                credits_to_expire,
                expires_at.isoformat(),
            )
        return inserted == 1
    except asyncpg.PostgresError:
        logger.exception(f"❌ legacy starter grant expiration insert failed for user_id={user_id}")
        return False


async def _expire_starter_grant_if_due(
    conn: asyncpg.Connection,
    *,
    user_id: int,
    balance: int,
) -> int:
    if STARTER_GRANT_CREDITS <= 0 or STARTER_GRANT_TTL_DAYS <= 0:
        return balance

    starter_grant_row = await _get_starter_grant_ledger_entry(conn, user_id)
    if starter_grant_row is None:
        return balance

    expires_at = _starter_grant_expires_at(starter_grant_row["created_at"])
    if expires_at > datetime.now(UTC):
        return balance

    if await _has_starter_grant_expiration_ledger_entry(conn, user_id):
        return balance

    ledger_rows = await _list_credit_ledger_rows_for_user(conn, user_id)
    remaining_trial_credits = _calculate_remaining_starter_grant_credits(
        ledger_rows,
        user_id=user_id,
        granted_credits=int(starter_grant_row["credits_delta"] or 0),
    )
    credits_to_expire = min(balance, remaining_trial_credits)
    if credits_to_expire <= 0:
        return balance

    balance_after = balance - credits_to_expire
    inserted = await _insert_starter_grant_expiration_ledger_entry(
        conn,
        user_id=user_id,
        credits_to_expire=credits_to_expire,
        balance_after=balance_after,
        expires_at=expires_at,
    )
    if not inserted:
        return balance

    await conn.execute(
        """
        UPDATE user_credit_accounts
        SET balance = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        """,
        user_id,
        balance_after,
    )
    logger.info(
        "✅ Starter grant expired user_id=%s expired_credits=%s ttl_days=%s",
        user_id,
        credits_to_expire,
        STARTER_GRANT_TTL_DAYS,
    )
    return balance_after


async def ensure_credit_account_state(
    conn: asyncpg.Connection,
    user_id: int,
) -> CreditAccountState:
    """Создать аккаунт credits и вернуть актуальное состояние стартового grant."""
    await conn.execute(
        """
        INSERT INTO user_credit_accounts (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        """,
        user_id,
    )
    has_trial_used_at_column = True
    try:
        account = await conn.fetchrow(
            """
            SELECT balance, trial_used_at
            FROM user_credit_accounts
            WHERE user_id = $1
            FOR UPDATE
            """,
            user_id,
        )
        trial_used_at = account["trial_used_at"] if account is not None else None
    except asyncpg.UndefinedColumnError:
        has_trial_used_at_column = False
        account = await conn.fetchrow(
            """
            SELECT balance
            FROM user_credit_accounts
            WHERE user_id = $1
            FOR UPDATE
            """,
            user_id,
        )
        trial_used_at = None
    if account is None:
        raise RuntimeError(f"user_credit_accounts row missing for user_id={user_id}")

    balance = int(account["balance"])
    balance = await _expire_starter_grant_if_due(conn, user_id=user_id, balance=balance)
    if trial_used_at is None and STARTER_GRANT_CREDITS > 0:
        if await _has_starter_grant_ledger_entry(conn, user_id):
            return CreditAccountState(balance=balance, starter_credits_granted_now=False)
        balance_after = balance + STARTER_GRANT_CREDITS
        if has_trial_used_at_column:
            try:
                await conn.execute(
                    """
                    UPDATE user_credit_accounts
                    SET balance = $2,
                        trial_used_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $1
                    """,
                    user_id,
                    balance_after,
                )
            except asyncpg.UndefinedColumnError:
                has_trial_used_at_column = False
                await conn.execute(
                    """
                    UPDATE user_credit_accounts
                    SET balance = $2
                    WHERE user_id = $1
                    """,
                    user_id,
                    balance_after,
                )
        else:
            try:
                await conn.execute(
                    """
                    UPDATE user_credit_accounts
                    SET balance = $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $1
                    """,
                    user_id,
                    balance_after,
                )
            except asyncpg.UndefinedColumnError:
                await conn.execute(
                    """
                    UPDATE user_credit_accounts
                    SET balance = $2
                    WHERE user_id = $1
                    """,
                    user_id,
                    balance_after,
                )
        await _insert_starter_grant_ledger_entry(
            conn,
            user_id=user_id,
            balance_after=balance_after,
        )
        await create_credit_package(
            conn,
            user_id=user_id,
            source="starter_grant",
            credits=STARTER_GRANT_CREDITS,
            expires_at=datetime.now(UTC) + timedelta(days=STARTER_GRANT_TTL_DAYS),
            idempotency_key=_starter_grant_idempotency_key(user_id),
        )
        logger.info(f"✅ Выдан стартовый grant user_id={user_id}: +{STARTER_GRANT_CREDITS} credits")
        return CreditAccountState(balance=balance_after, starter_credits_granted_now=True)
    return CreditAccountState(balance=balance, starter_credits_granted_now=False)


async def ensure_credit_account(conn: asyncpg.Connection, user_id: int) -> int:
    """Создать аккаунт credits и один раз выдать стартовый grant."""
    state = await ensure_credit_account_state(conn, user_id)
    return state.balance


async def get_balance(conn: asyncpg.Connection, user_id: int) -> int:
    """Вернуть баланс, синхронизированный с активными пакетами credits."""
    balance = await ensure_credit_account(conn, user_id)
    await expire_credit_packages(conn, user_id=user_id)
    return await reconcile_credit_account_balance(conn, user_id=user_id, fallback_balance=balance)


async def reconcile_credit_account_balance(
    conn: asyncpg.Connection,
    *,
    user_id: int,
    fallback_balance: int,
) -> int:
    """Сверить кэш аккаунта с доступными пакетами после миграции FIFO."""
    try:
        package_balance = await conn.fetchval(
            """
            SELECT COALESCE(SUM(remaining_credits), 0)
            FROM credit_packages
            WHERE user_id = $1
              AND remaining_credits > 0
              AND expires_at > CURRENT_TIMESTAMP
            """,
            user_id,
        )
    except asyncpg.UndefinedTableError:
        return fallback_balance

    balance = int(package_balance or 0)
    await conn.execute(
        """
        UPDATE user_credit_accounts
        SET balance = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND balance IS DISTINCT FROM $2
        """,
        user_id,
        balance,
    )
    return balance


async def reserve_job_credit(
    conn: asyncpg.Connection,
    *,
    user_id: int,
    job_id: str,
    credit_cost: int = JOB_CREDIT_COST,
) -> int:
    """Зарезервировать credit за job. Идемпотентно по job_id."""
    job_row = await conn.fetchrow(
        """
        SELECT credit_status, credit_cost
        FROM jobs
        WHERE id = $1::uuid
        FOR UPDATE
        """,
        job_id,
    )
    if job_row is None:
        raise RuntimeError(f"job not found for reserve job_id={job_id}")

    current_status = job_row["credit_status"]
    if current_status in {"reserved", "finalized"}:
        balance = await get_balance(conn, user_id)
        return balance

    balance = await get_balance(conn, user_id)
    effective_cost = int(job_row["credit_cost"] or credit_cost)
    if balance < effective_cost:
        raise InsufficientCreditsError(
            f"user_id={user_id} balance={balance} < credit_cost={effective_cost}"
        )

    packages = await conn.fetch(
        """
        SELECT id, remaining_credits FROM credit_packages
        WHERE user_id = $1 AND remaining_credits > 0 AND expires_at > CURRENT_TIMESTAMP
        ORDER BY expires_at, created_at FOR UPDATE
        """,
        user_id,
    )
    remaining = effective_cost
    for package in packages:
        allocated = min(remaining, int(package["remaining_credits"]))
        if not allocated:
            continue
        await conn.execute(
            "UPDATE credit_packages SET remaining_credits = remaining_credits - $2 WHERE id = $1",
            package["id"],
            allocated,
        )
        await conn.execute(
            """INSERT INTO credit_package_allocations (package_id, job_id, credits)
                VALUES ($1, $2::uuid, $3) ON CONFLICT (package_id, job_id)
                DO UPDATE SET credits = credit_package_allocations.credits + EXCLUDED.credits""",
            package["id"],
            job_id,
            allocated,
        )
        remaining -= allocated
    if remaining:
        raise RuntimeError(f"credit packages are out of sync for user_id={user_id}")

    balance_after = balance - effective_cost
    await conn.execute(
        """
        UPDATE user_credit_accounts
        SET balance = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        """,
        user_id,
        balance_after,
    )
    await conn.execute(
        """
        INSERT INTO credit_ledger (
            user_id,
            event_type,
            credits_delta,
            balance_after,
            related_job_id,
            idempotency_key,
            metadata
        )
        VALUES (
            $1,
            'job_reserve',
            $2,
            $3,
            $4::uuid,
            $5,
            jsonb_build_object('credit_cost', $6::int)
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        """,
        user_id,
        -effective_cost,
        balance_after,
        job_id,
        f"job_reserve:{job_id}",
        effective_cost,
    )
    await conn.execute(
        """
        UPDATE jobs
        SET credit_status = 'reserved',
            credit_cost = $2
        WHERE id = $1::uuid
        """,
        job_id,
        effective_cost,
    )
    return balance_after


async def finalize_job_credit(conn: asyncpg.Connection, *, user_id: int, job_id: str) -> int:
    """Зафиксировать успешное списание после завершения рендера."""
    job_row = await conn.fetchrow(
        """
        SELECT credit_status
        FROM jobs
        WHERE id = $1::uuid
        FOR UPDATE
        """,
        job_id,
    )
    if job_row is None:
        raise RuntimeError(f"job not found for finalize job_id={job_id}")
    if job_row["credit_status"] == "finalized":
        return await get_balance(conn, user_id)
    if job_row["credit_status"] != "reserved":
        return await get_balance(conn, user_id)

    balance = await get_balance(conn, user_id)
    await conn.execute(
        """
        INSERT INTO credit_ledger (
            user_id,
            event_type,
            credits_delta,
            balance_after,
            related_job_id,
            idempotency_key
        )
        VALUES (
            $1,
            'job_finalize',
            0,
            $2,
            $3::uuid,
            $4
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        """,
        user_id,
        balance,
        job_id,
        f"job_finalize:{job_id}",
    )
    await conn.execute(
        """
        UPDATE jobs
        SET credit_status = 'finalized'
        WHERE id = $1::uuid
        """,
        job_id,
    )
    return balance


async def refund_job_credit(conn: asyncpg.Connection, *, user_id: int, job_id: str) -> int:
    """Вернуть зарезервированный credit при техническом фейле."""
    job_row = await conn.fetchrow(
        """
        SELECT credit_status, credit_cost
        FROM jobs
        WHERE id = $1::uuid
        FOR UPDATE
        """,
        job_id,
    )
    if job_row is None:
        raise RuntimeError(f"job not found for refund job_id={job_id}")
    if job_row["credit_status"] == "refunded":
        return await get_balance(conn, user_id)
    if job_row["credit_status"] != "reserved":
        return await get_balance(conn, user_id)

    balance = await get_balance(conn, user_id)
    credit_cost = int(job_row["credit_cost"] or JOB_CREDIT_COST)
    restored_rows = await conn.fetch(
        """
        UPDATE credit_packages AS package
        SET remaining_credits = LEAST(package.credits_granted, package.remaining_credits + allocation.credits)
        FROM credit_package_allocations AS allocation
        WHERE allocation.job_id = $1::uuid
          AND allocation.package_id = package.id
          AND package.expires_at > CURRENT_TIMESTAMP
        RETURNING allocation.credits
        """,
        job_id,
    )
    restored_credits = sum(int(row["credits"]) for row in restored_rows)
    if restored_credits == 0:
        await create_credit_package(
            conn,
            user_id=user_id,
            source="refund",
            credits=credit_cost,
            expires_at=datetime.now(UTC) + timedelta(days=PURCHASE_GRANT_TTL_DAYS),
            idempotency_key=f"job_refund_package:{job_id}",
        )
        restored_credits = credit_cost
    balance_after = balance + restored_credits
    await conn.execute(
        """
        UPDATE user_credit_accounts
        SET balance = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        """,
        user_id,
        balance_after,
    )
    await conn.execute(
        """
        INSERT INTO credit_ledger (
            user_id,
            event_type,
            credits_delta,
            balance_after,
            related_job_id,
            idempotency_key,
            metadata
        )
        VALUES (
            $1,
            'job_refund',
            $2,
            $3,
            $4::uuid,
            $5,
            jsonb_build_object('credit_cost', $6::int)
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        """,
        user_id,
        restored_credits,
        balance_after,
        job_id,
        f"job_refund:{job_id}",
        restored_credits,
    )
    await conn.execute(
        """
        UPDATE jobs
        SET credit_status = 'refunded'
        WHERE id = $1::uuid
        """,
        job_id,
    )
    return balance_after
