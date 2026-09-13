"""Explicit, provider-neutral account linking and atomic user merges."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

import asyncpg

from src.auth import WebsiteAuthInvalid, _decode_timed_payload, _website_serializer
from src.credits_service import expire_credit_packages
from src.users_service import _validate_identity

AccountProvider = Literal["supabase", "telegram"]
MERGE_TOKEN_SALT: Final = "account-link-merge"
MERGE_TOKEN_TTL_SEC: Final = 300


class AccountLinkError(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True, slots=True)
class AccountIdentity:
    linked: bool
    display: str | None = None


@dataclass(frozen=True, slots=True)
class AccountState:
    current_authority: AccountProvider
    email: AccountIdentity
    telegram: AccountIdentity


@dataclass(frozen=True, slots=True)
class AccountLinkResult:
    status: Literal["linked", "already_linked", "merge_required"]
    merge_token: str | None = None


@dataclass(frozen=True, slots=True)
class AccountMergeResult:
    status: Literal["merged", "already_linked"]
    survivor_user_id: int


def _mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    local, domain = email.strip().split("@", 1)
    if not local or not domain:
        return None
    visible = local[:2] if len(local) > 1 else local
    return f"{visible}••••@{domain}"


async def get_account_state(
    conn: asyncpg.Connection,
    *,
    user_id: int,
    current_authority: AccountProvider,
    current_email: str | None = None,
) -> AccountState:
    rows = await conn.fetch(
        """
        SELECT provider, provider_subject
        FROM user_identities
        WHERE user_id = $1
        """,
        user_id,
    )
    providers = {str(row["provider"]): str(row["provider_subject"]) for row in rows}
    username = await conn.fetchval(
        "SELECT NULLIF(BTRIM(username), '') FROM users WHERE id = $1",
        user_id,
    )
    email_display = _mask_email(current_email) if "supabase" in providers else None
    telegram_display = f"@{username}" if username and "telegram" in providers else None
    return AccountState(
        current_authority=current_authority,
        email=AccountIdentity(linked="supabase" in providers, display=email_display),
        telegram=AccountIdentity(linked="telegram" in providers, display=telegram_display),
    )


def _issue_merge_token(
    *, current_user_id: int, target_user_id: int, provider: str, provider_subject: str
) -> str:
    serializer = _website_serializer(salt=MERGE_TOKEN_SALT)
    return serializer.dumps(
        {
            "current_user_id": current_user_id,
            "target_user_id": target_user_id,
            "provider": provider,
            "provider_subject": provider_subject,
        }
    )


def _read_merge_token(token: str) -> dict[str, object]:
    try:
        payload = _decode_timed_payload(
            token=token,
            salt=MERGE_TOKEN_SALT,
            max_age=MERGE_TOKEN_TTL_SEC,
        )
    except WebsiteAuthInvalid as exc:
        raise AccountLinkError("merge_token_invalid") from exc
    if not all(
        key in payload
        for key in ("current_user_id", "target_user_id", "provider", "provider_subject")
    ):
        raise AccountLinkError("merge_token_invalid")
    return payload


async def _legacy_telegram_owner(
    conn: asyncpg.Connection, provider: str, provider_subject: str
) -> int | None:
    if provider != "telegram":
        return None
    value = await conn.fetchval(
        """
        SELECT id FROM users
        WHERE telegram_user_id = $1::bigint
          AND merged_into_user_id IS NULL
        FOR UPDATE
        """,
        int(provider_subject),
    )
    return int(value) if value is not None else None


async def link_verified_identity(
    conn: asyncpg.Connection,
    *,
    current_user_id: int,
    provider: str,
    provider_subject: str,
    telegram_username: str | None = None,
) -> AccountLinkResult:
    provider, provider_subject = _validate_identity(provider, provider_subject)
    async with conn.transaction():
        await conn.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            f"account-link:{provider}:{provider_subject}",
        )
        existing_provider_subject = await conn.fetchval(
            """
            SELECT provider_subject FROM user_identities
            WHERE user_id = $1 AND provider = $2
            FOR UPDATE
            """,
            current_user_id,
            provider,
        )
        if (
            existing_provider_subject is not None
            and str(existing_provider_subject) != provider_subject
        ):
            raise AccountLinkError("provider_identity_conflict")

        target_user_id = await conn.fetchval(
            """
            SELECT user_id FROM user_identities
            WHERE provider = $1 AND provider_subject = $2
            FOR UPDATE
            """,
            provider,
            provider_subject,
        )
        if target_user_id is None:
            legacy_owner = await _legacy_telegram_owner(conn, provider, provider_subject)
            if legacy_owner is not None:
                target_user_id = legacy_owner
                await conn.execute(
                    """
                    INSERT INTO user_identities (user_id, provider, provider_subject)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (provider, provider_subject) DO NOTHING
                    """,
                    target_user_id,
                    provider,
                    provider_subject,
                )

        if target_user_id is None:
            await conn.execute(
                """
                INSERT INTO user_identities (user_id, provider, provider_subject, last_authenticated_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                """,
                current_user_id,
                provider,
                provider_subject,
            )
            if provider == "telegram" and telegram_username:
                await conn.execute(
                    "UPDATE users SET username = $1 WHERE id = $2",
                    telegram_username,
                    current_user_id,
                )
            return AccountLinkResult(status="linked")

        target_user_id = int(target_user_id)
        if target_user_id == current_user_id:
            return AccountLinkResult(status="already_linked")

        return AccountLinkResult(
            status="merge_required",
            merge_token=_issue_merge_token(
                current_user_id=current_user_id,
                target_user_id=target_user_id,
                provider=provider,
                provider_subject=provider_subject,
            ),
        )


async def _relation_exists(conn: asyncpg.Connection, relation: str) -> bool:
    return await conn.fetchval("SELECT to_regclass($1)", f"public.{relation}") is not None


async def _move_owned_rows(
    conn: asyncpg.Connection, *, survivor_user_id: int, source_user_id: int
) -> None:
    ownership = (
        ("assets", "owner_user_id"),
        ("vehicle_identities", "owner_user_id"),
        ("rim_specs", "owner_user_id"),
        ("rim_setups", "owner_user_id"),
        ("render_input_drafts", "owner_user_id"),
        ("fitment_checks", "owner_user_id"),
        ("fitment_change_events", "actor_user_id"),
        ("analytics_visitors", "user_id"),
        ("analytics_events", "user_id"),
        ("payments", "user_id"),
        ("credit_ledger", "user_id"),
        ("credit_packages", "user_id"),
    )
    for relation, column in ownership:
        if await _relation_exists(conn, relation):
            await conn.execute(
                f"UPDATE {relation} SET {column} = $1 WHERE {column} = $2",
                survivor_user_id,
                source_user_id,
            )

    # This update is deliberately last: render_feedback follows through the
    # ON UPDATE CASCADE composite FK installed by migration 0034.
    if await _relation_exists(conn, "jobs"):
        await conn.execute(
            "UPDATE jobs SET user_id = $1 WHERE user_id = $2",
            survivor_user_id,
            source_user_id,
        )


async def _merge_credit_accounts(
    conn: asyncpg.Connection, *, survivor_user_id: int, source_user_id: int
) -> None:
    if not await _relation_exists(conn, "user_credit_accounts"):
        return
    await expire_credit_packages(conn, user_id=survivor_user_id)
    await expire_credit_packages(conn, user_id=source_user_id)
    source_trial_used_at = await conn.fetchval(
        "SELECT trial_used_at FROM user_credit_accounts WHERE user_id = $1 FOR UPDATE",
        source_user_id,
    )
    survivor_trial_used_at = await conn.fetchval(
        "SELECT trial_used_at FROM user_credit_accounts WHERE user_id = $1 FOR UPDATE",
        survivor_user_id,
    )
    if await _relation_exists(conn, "credit_packages"):
        balance = await conn.fetchval(
            """
            SELECT COALESCE(SUM(remaining_credits), 0)
            FROM credit_packages
            WHERE user_id = $1
              AND expires_at > CURRENT_TIMESTAMP
            """,
            survivor_user_id,
        )
    else:
        balance = await conn.fetchval(
            """
            SELECT COALESCE(SUM(balance), 0)
            FROM user_credit_accounts
            WHERE user_id IN ($1, $2)
            """,
            survivor_user_id,
            source_user_id,
        )
    trial_used_at = min(
        (value for value in (source_trial_used_at, survivor_trial_used_at) if value is not None),
        default=None,
    )
    await conn.execute(
        """
        UPDATE user_credit_accounts
        SET balance = $2,
            trial_used_at = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        """,
        survivor_user_id,
        int(balance or 0),
        trial_used_at,
    )
    # The source row is a cache aggregate; all durable package and ledger rows
    # have already moved to the survivor in this transaction.
    await conn.execute("DELETE FROM user_credit_accounts WHERE user_id = $1", source_user_id)


async def confirm_account_merge(
    conn: asyncpg.Connection, *, current_user_id: int, merge_token: str
) -> AccountMergeResult:
    payload = _read_merge_token(merge_token)
    try:
        token_current_user_id = int(payload["current_user_id"])
        token_target_user_id = int(payload["target_user_id"])
        provider, provider_subject = _validate_identity(
            str(payload["provider"]), str(payload["provider_subject"])
        )
    except (TypeError, ValueError) as exc:
        raise AccountLinkError("merge_token_invalid") from exc

    async with conn.transaction():
        current_identity_owner = await conn.fetchval(
            """
            SELECT user_id FROM user_identities
            WHERE provider = $1 AND provider_subject = $2
            """,
            provider,
            provider_subject,
        )
        if current_identity_owner is not None and int(current_identity_owner) == current_user_id:
            return AccountMergeResult(status="already_linked", survivor_user_id=current_user_id)
        if token_current_user_id != current_user_id:
            raise AccountLinkError("merge_token_forbidden")

        ordered_user_ids = sorted({current_user_id, token_target_user_id})
        accounts = await conn.fetch(
            """
            SELECT id, created_at, telegram_user_id, username, merged_into_user_id
            FROM users
            WHERE id = ANY($1::integer[])
            ORDER BY id
            FOR UPDATE
            """,
            ordered_user_ids,
        )
        if len(accounts) != 2 or any(row["merged_into_user_id"] is not None for row in accounts):
            raise AccountLinkError("merge_token_invalid")
        target_owner = await conn.fetchval(
            """
            SELECT user_id FROM user_identities
            WHERE provider = $1 AND provider_subject = $2
            FOR UPDATE
            """,
            provider,
            provider_subject,
        )
        if target_owner is None or int(target_owner) != token_target_user_id:
            raise AccountLinkError("merge_token_invalid")

        survivor = min(accounts, key=lambda row: (row["created_at"], int(row["id"])))
        source = next(row for row in accounts if int(row["id"]) != int(survivor["id"]))
        survivor_user_id, source_user_id = int(survivor["id"]), int(source["id"])

        conflicting_provider = await conn.fetchval(
            """
            SELECT 1
            FROM user_identities source_identity
            JOIN user_identities survivor_identity
              ON survivor_identity.user_id = $1
             AND survivor_identity.provider = source_identity.provider
             AND survivor_identity.provider_subject <> source_identity.provider_subject
            WHERE source_identity.user_id = $2
            LIMIT 1
            """,
            survivor_user_id,
            source_user_id,
        )
        if conflicting_provider is not None:
            raise AccountLinkError("provider_identity_conflict")

        await _move_owned_rows(
            conn, survivor_user_id=survivor_user_id, source_user_id=source_user_id
        )
        await _merge_credit_accounts(
            conn, survivor_user_id=survivor_user_id, source_user_id=source_user_id
        )
        await conn.execute(
            "UPDATE users SET telegram_user_id = NULL WHERE id = $1",
            source_user_id,
        )
        await conn.execute(
            """
            UPDATE users
            SET telegram_user_id = COALESCE(telegram_user_id, $2::bigint),
                username = COALESCE(NULLIF(BTRIM(username), ''), $3),
                job_count = (SELECT COUNT(*) FROM jobs WHERE user_id = $1)
            WHERE id = $1
            """,
            survivor_user_id,
            source["telegram_user_id"],
            source["username"],
        )
        await conn.execute(
            "UPDATE user_identities SET user_id = $1 WHERE user_id = $2",
            survivor_user_id,
            source_user_id,
        )
        await conn.execute(
            """
            UPDATE users
            SET merged_into_user_id = $1,
                merged_at = CURRENT_TIMESTAMP,
                username = NULL
            WHERE id = $2
            """,
            survivor_user_id,
            source_user_id,
        )
        await conn.execute(
            """
            INSERT INTO account_merges (survivor_user_id, source_user_id, initiated_by_user_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (source_user_id) DO NOTHING
            """,
            survivor_user_id,
            source_user_id,
            current_user_id,
        )
        return AccountMergeResult(status="merged", survivor_user_id=survivor_user_id)
