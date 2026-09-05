"""Общие операции над пользователями."""

from typing import Final

import asyncpg

SUPPORTED_IDENTITY_PROVIDERS: Final[frozenset[str]] = frozenset({"telegram", "supabase"})


class IdentityConflictError(RuntimeError):
    """Identity ownership changed during a create operation."""


def _validate_identity(provider: str, provider_subject: str) -> tuple[str, str]:
    if not isinstance(provider, str) or provider not in SUPPORTED_IDENTITY_PROVIDERS:
        raise ValueError("Unsupported identity provider")
    if not isinstance(provider_subject, str):
        raise ValueError("Invalid provider subject")
    if not provider_subject or provider_subject != provider_subject.strip():
        raise ValueError("Invalid provider subject")
    if provider == "telegram":
        try:
            canonical_subject = str(int(provider_subject))
        except ValueError as exc:
            raise ValueError("Telegram provider subject must be an integer") from exc
        if canonical_subject != provider_subject:
            raise ValueError("Telegram provider subject must be canonical")
    return provider, provider_subject


async def get_user_by_identity(
    conn: asyncpg.Connection,
    *,
    provider: str,
    provider_subject: str,
) -> int | None:
    """Return the canonical users.id for an external identity, if bound."""
    provider, provider_subject = _validate_identity(provider, provider_subject)
    user_id = await conn.fetchval(
        """
        SELECT user_id
        FROM user_identities
        WHERE provider = $1 AND provider_subject = $2
        """,
        provider,
        provider_subject,
    )
    return int(user_id) if user_id is not None else None


async def ensure_user_identity(
    conn: asyncpg.Connection,
    *,
    provider: str,
    provider_subject: str,
    username: str | None = None,
) -> int:
    """Find or create a canonical user for an external identity atomically.

    A transaction-scoped advisory lock serializes concurrent creates for one
    provider subject. The database unique constraint remains the final
    correctness boundary; a losing conflict rolls back the just-created user.

    ``username`` is retained exclusively for the Telegram compatibility path.
    It is not a generic profile field for Supabase identities.
    """
    provider, provider_subject = _validate_identity(provider, provider_subject)
    if provider != "telegram" and username is not None:
        raise ValueError("username is only supported for Telegram identities")

    async with conn.transaction():
        await conn.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            f"{provider}:{provider_subject}",
        )

        user_id = await conn.fetchval(
            """
            SELECT user_id
            FROM user_identities
            WHERE provider = $1 AND provider_subject = $2
            FOR UPDATE
            """,
            provider,
            provider_subject,
        )
        if user_id is not None:
            if provider == "telegram" and username:
                await conn.execute(
                    "UPDATE users SET username = $1 WHERE id = $2",
                    username,
                    user_id,
                )
            await conn.execute(
                """
                UPDATE user_identities
                SET last_authenticated_at = CURRENT_TIMESTAMP
                WHERE provider = $1 AND provider_subject = $2
                """,
                provider,
                provider_subject,
            )
            return int(user_id)

        if provider == "telegram":
            telegram_user_id = int(provider_subject)
            user_id = await conn.fetchval(
                """
                SELECT id
                FROM users
                WHERE telegram_user_id = $1
                FOR UPDATE
                """,
                telegram_user_id,
            )
            if user_id is None:
                user_id = await conn.fetchval(
                    """
                    INSERT INTO users (telegram_user_id, username)
                    VALUES ($1, $2)
                    RETURNING id
                    """,
                    telegram_user_id,
                    username,
                )
            elif username:
                await conn.execute(
                    "UPDATE users SET username = $1 WHERE id = $2",
                    username,
                    user_id,
                )
        else:
            user_id = await conn.fetchval(
                """
                INSERT INTO users (telegram_user_id)
                VALUES (NULL)
                RETURNING id
                """
            )

        identity_user_id = await conn.fetchval(
            """
            INSERT INTO user_identities (
                user_id, provider, provider_subject, last_authenticated_at
            )
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (provider, provider_subject) DO NOTHING
            RETURNING user_id
            """,
            user_id,
            provider,
            provider_subject,
        )
        if identity_user_id is None:
            raise IdentityConflictError("Identity is already owned by another user")
        return int(user_id)


async def ensure_user(
    conn: asyncpg.Connection,
    telegram_user_id: int,
    username: str | None = None,
) -> int:
    """Legacy Telegram boundary that also maintains the canonical identity."""
    return await ensure_user_identity(
        conn,
        provider="telegram",
        provider_subject=str(telegram_user_id),
        username=username,
    )
