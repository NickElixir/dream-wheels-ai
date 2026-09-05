"""Provider-neutral authenticated principal boundary.

Credential verification remains in :mod:`src.auth`; this module only
classifies already supplied credentials, resolves the verified external
identity through ``user_identities`` and returns canonical ``users.id``.
"""

import base64
import json
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

import asyncpg
from fastapi import HTTPException

from src.auth import (
    AuthContext,
    SupabaseAccessTokenInvalid,
    SupabaseTokenClaims,
    _extract_bearer_token,
    resolve_telegram_auth,
    verify_supabase_access_token,
    verify_website_auth_token,
)
from src.users_service import ensure_user_identity

AuthAuthority = Literal["telegram", "supabase"]
AuthFailureCode = Literal[
    "MISSING_CREDENTIALS",
    "INVALID_CREDENTIALS",
    "EXPIRED_CREDENTIALS",
    "INVALID_SUPABASE_TOKEN",
    "INVALID_LEGACY_TOKEN",
    "IDENTITY_RESOLUTION_FAILED",
]


class AuthPrincipalError(RuntimeError):
    """Normalized internal error for the provider-neutral auth boundary."""

    def __init__(self, code: AuthFailureCode):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True, slots=True)
class AuthPrincipal:
    """Authenticated canonical Dream Wheels user."""

    user_id: int
    authority: AuthAuthority
    subject: str
    auth_channel: str
    session_id: UUID | None = None
    aal: str | None = None
    telegram_username: str | None = None


def _jwt_header_routing_hint(token: str) -> str | None:
    """Return an algorithm hint without trusting any token claim.

    This is only used to keep a JWT-looking Supabase token from falling back
    to the legacy serializer. Cryptographic verification still happens before
    any identity or user lookup.
    """
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        padded = parts[0] + "=" * (-len(parts[0]) % 4)
        header = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    algorithm = header.get("alg") if isinstance(header, dict) else None
    return algorithm if isinstance(algorithm, str) else None


def _is_supabase_bearer_candidate(token: str) -> bool:
    """Use only an untrusted header shape as a routing hint."""
    algorithm = _jwt_header_routing_hint(token)
    return algorithm is not None


def _principal_from_telegram(*, user_id: int, context: AuthContext) -> AuthPrincipal:
    return AuthPrincipal(
        user_id=user_id,
        authority="telegram",
        subject=str(context.telegram_user_id),
        auth_channel=context.auth_channel,
        telegram_username=context.username,
    )


def _principal_from_supabase(*, user_id: int, claims: SupabaseTokenClaims) -> AuthPrincipal:
    return AuthPrincipal(
        user_id=user_id,
        authority="supabase",
        subject=str(claims.subject),
        auth_channel="supabase",
        session_id=claims.session_id,
        aal=claims.aal,
    )


async def _resolve_telegram_principal(
    conn: asyncpg.Connection,
    *,
    init_data: str | None,
    telegram_user_id: int | None,
    auth_name: str,
) -> AuthPrincipal:
    try:
        context = resolve_telegram_auth(
            init_data=init_data,
            telegram_user_id=telegram_user_id,
            authorization=None,
            auth_name=auth_name,
        )
    except HTTPException as exc:
        code: AuthFailureCode = (
            "MISSING_CREDENTIALS"
            if exc.status_code == 400 and not init_data and telegram_user_id is None
            else "INVALID_CREDENTIALS"
        )
        raise AuthPrincipalError(code) from exc

    try:
        user_id = await ensure_user_identity(
            conn,
            provider="telegram",
            provider_subject=str(context.telegram_user_id),
            username=context.username,
        )
    except Exception as exc:
        raise AuthPrincipalError("IDENTITY_RESOLUTION_FAILED") from exc
    return _principal_from_telegram(user_id=user_id, context=context)


async def _resolve_legacy_bearer_principal(
    conn: asyncpg.Connection,
    *,
    token: str,
) -> AuthPrincipal:
    try:
        context = verify_website_auth_token(token)
    except Exception as exc:
        raise AuthPrincipalError("INVALID_LEGACY_TOKEN") from exc

    try:
        user_id = await ensure_user_identity(
            conn,
            provider="telegram",
            provider_subject=str(context.telegram_user_id),
            username=context.username,
        )
    except Exception as exc:
        raise AuthPrincipalError("IDENTITY_RESOLUTION_FAILED") from exc
    return _principal_from_telegram(user_id=user_id, context=context)


async def _resolve_supabase_bearer_principal(
    conn: asyncpg.Connection,
    *,
    token: str,
) -> AuthPrincipal:
    try:
        claims = await verify_supabase_access_token(token)
    except SupabaseAccessTokenInvalid as exc:
        code = (
            exc.code
            if exc.code in {"INVALID_SUPABASE_TOKEN", "EXPIRED_CREDENTIALS"}
            else "INVALID_SUPABASE_TOKEN"
        )
        raise AuthPrincipalError(code) from exc
    except Exception as exc:
        raise AuthPrincipalError("INVALID_SUPABASE_TOKEN") from exc

    try:
        user_id = await ensure_user_identity(
            conn,
            provider="supabase",
            provider_subject=str(claims.subject),
        )
    except Exception as exc:
        raise AuthPrincipalError("IDENTITY_RESOLUTION_FAILED") from exc
    return _principal_from_supabase(user_id=user_id, claims=claims)


async def resolve_auth_principal(
    conn: asyncpg.Connection,
    *,
    init_data: str | None,
    telegram_user_id: int | None,
    authorization: str | None = None,
    auth_name: str,
) -> AuthPrincipal:
    """Resolve Telegram or Supabase credentials to canonical ``users.id``.

    Bearer precedence is explicit: a JWT-shaped bearer is verified only as a
    Supabase token, while the existing signed website token is verified by its
    serializer. No failed Supabase token can downgrade into legacy auth.
    """
    if authorization:
        try:
            bearer = _extract_bearer_token(authorization)
        except HTTPException as exc:
            raise AuthPrincipalError("INVALID_CREDENTIALS") from exc
        if bearer is None:
            raise AuthPrincipalError("MISSING_CREDENTIALS")
        if _is_supabase_bearer_candidate(bearer):
            return await _resolve_supabase_bearer_principal(conn, token=bearer)
        return await _resolve_legacy_bearer_principal(conn, token=bearer)

    if not init_data and telegram_user_id is None:
        raise AuthPrincipalError("MISSING_CREDENTIALS")
    return await _resolve_telegram_principal(
        conn,
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        auth_name=auth_name,
    )
