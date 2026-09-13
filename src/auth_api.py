"""HTTP API для website Telegram auth поверх backend-issued bearer token."""

from __future__ import annotations

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict

from src import db
from src.account_linking_service import (
    AccountLinkError,
    confirm_account_merge,
    get_account_state,
    link_verified_identity,
)
from src.auth import (
    WebsiteAuthInvalid,
    build_website_login_nonce,
    issue_website_auth_token,
    verify_supabase_access_token,
    verify_telegram_login_id_token,
)
from src.auth_principal import AuthPrincipalError, require_auth_principal, resolve_auth_principal
from src.config import TELEGRAM_AUTH_TOKEN_TTL_SEC, TELEGRAM_LOGIN_CLIENT_ID
from src.credits_service import ensure_credit_account_state
from src.users_service import ensure_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class TelegramLoginVerifyRequest(BaseModel):
    id_token: str
    nonce_token: str | None = None


class TelegramLoginVerifyResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    telegram_user_id: int
    username: str | None = None


class TelegramLoginNonceResponse(BaseModel):
    client_id: str
    nonce: str
    nonce_token: str


class AuthMeResponse(BaseModel):
    authenticated: bool = True
    authority: Literal["telegram", "supabase"]
    auth_channel: str


class AuthBootstrapAccount(BaseModel):
    balance: int
    starter_grant_granted_now: bool
    saved_name: str | None = None


class AuthBootstrapResponse(BaseModel):
    authenticated: bool = True
    authority: Literal["supabase"] = "supabase"
    auth_channel: str = "supabase"
    account: AuthBootstrapAccount


class AccountIdentityResponse(BaseModel):
    linked: bool
    display: str | None = None


class AccountStateResponse(BaseModel):
    current_authority: Literal["telegram", "supabase"]
    identities: dict[str, AccountIdentityResponse]


class AccountLinkProof(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id_token: str | None = None
    nonce_token: str | None = None
    access_token: str | None = None


class AccountLinkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Literal["telegram", "supabase"]
    proof: AccountLinkProof


class AccountLinkResponse(BaseModel):
    status: Literal["linked", "already_linked", "merge_required"]
    merge_token: str | None = None


class AccountMergeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    merge_token: str


class AccountMergeResponse(BaseModel):
    status: Literal["merged", "already_linked"]


@router.get("/me", response_model=AuthMeResponse)
async def auth_me(
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Return a minimal, provider-neutral authenticated-session probe."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as conn:
            principal = await resolve_auth_principal(
                conn,
                init_data=init_data,
                telegram_user_id=telegram_user_id,
                authorization=authorization,
                auth_name="auth me",
            )
    except AuthPrincipalError as exc:
        if exc.code == "IDENTITY_RESOLUTION_FAILED":
            logger.exception("❌ auth/me identity resolution failed")
            raise HTTPException(
                status_code=500, detail="Authentication service unavailable"
            ) from exc
        logger.info("auth/me rejected credentials reason=%s", exc.code)
        raise HTTPException(status_code=401, detail="Authentication required") from exc
    except Exception as exc:
        logger.exception("❌ auth/me unavailable")
        raise HTTPException(status_code=500, detail="Authentication service unavailable") from exc

    return AuthMeResponse(authority=principal.authority, auth_channel=principal.auth_channel)


def _account_link_http_error(exc: AccountLinkError) -> HTTPException:
    if exc.code == "provider_identity_conflict":
        return HTTPException(
            status_code=409,
            detail="A different sign-in method is already connected to this account",
        )
    if exc.code == "merge_token_forbidden":
        return HTTPException(status_code=403, detail="Account merge is not authorized")
    if exc.code == "merge_token_invalid":
        return HTTPException(status_code=400, detail="Account merge confirmation expired")
    return HTTPException(status_code=500, detail="Account linking is temporarily unavailable")


@router.get("/account", response_model=AccountStateResponse)
async def auth_account(
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Return provider-neutral and display-safe account linking state."""
    pool = db.get_pool()
    try:
        async with pool.acquire() as conn:
            principal = await require_auth_principal(
                conn,
                init_data=init_data,
                telegram_user_id=telegram_user_id,
                authorization=authorization,
                auth_name="account state",
            )
            account = await get_account_state(
                conn,
                user_id=principal.user_id,
                current_authority=principal.authority,
                current_email=principal.email,
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("❌ auth/account unavailable")
        raise HTTPException(status_code=500, detail="Account is temporarily unavailable") from exc
    return AccountStateResponse(
        current_authority=account.current_authority,
        identities={
            "email": AccountIdentityResponse(
                linked=account.email.linked, display=account.email.display
            ),
            "telegram": AccountIdentityResponse(
                linked=account.telegram.linked, display=account.telegram.display
            ),
        },
    )


@router.post("/account/link", response_model=AccountLinkResponse)
async def auth_account_link(
    request: AccountLinkRequest,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Attach a cryptographically verified second sign-in method.

    The current request credential selects the existing account.  The supplied
    proof is never used as an application-login credential.
    """
    try:
        if request.provider == "telegram":
            if not request.proof.id_token:
                raise HTTPException(status_code=400, detail="Telegram proof is required")
            second_identity = await verify_telegram_login_id_token(
                id_token=request.proof.id_token,
                nonce_token=request.proof.nonce_token,
            )
            provider_subject = str(second_identity.telegram_user_id)
            telegram_username = second_identity.username
        else:
            if not request.proof.access_token:
                raise HTTPException(status_code=400, detail="Email proof is required")
            second_identity = await verify_supabase_access_token(request.proof.access_token)
            provider_subject = str(second_identity.subject)
            telegram_username = None
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        logger.info("auth/account/link rejected second identity provider=%s", request.provider)
        raise HTTPException(status_code=401, detail="Second sign-in proof was rejected") from exc

    pool = db.get_pool()
    try:
        async with pool.acquire() as conn:
            principal = await require_auth_principal(
                conn,
                init_data=init_data,
                telegram_user_id=telegram_user_id,
                authorization=authorization,
                auth_name="account link",
            )
            result = await link_verified_identity(
                conn,
                current_user_id=principal.user_id,
                provider=request.provider,
                provider_subject=provider_subject,
                telegram_username=telegram_username,
            )
    except HTTPException:
        raise
    except AccountLinkError as exc:
        raise _account_link_http_error(exc) from exc
    except Exception as exc:
        logger.exception("❌ auth/account/link unavailable provider=%s", request.provider)
        raise HTTPException(
            status_code=500, detail="Account linking is temporarily unavailable"
        ) from exc
    return AccountLinkResponse(status=result.status, merge_token=result.merge_token)


@router.post("/account/merge", response_model=AccountMergeResponse)
async def auth_account_merge(
    request: AccountMergeRequest,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    pool = db.get_pool()
    try:
        async with pool.acquire() as conn:
            principal = await require_auth_principal(
                conn,
                init_data=init_data,
                telegram_user_id=telegram_user_id,
                authorization=authorization,
                auth_name="account merge",
            )
            result = await confirm_account_merge(
                conn,
                current_user_id=principal.user_id,
                merge_token=request.merge_token,
            )
    except HTTPException:
        raise
    except AccountLinkError as exc:
        raise _account_link_http_error(exc) from exc
    except Exception as exc:
        logger.exception("❌ auth/account/merge unavailable")
        raise HTTPException(
            status_code=500, detail="Account merge is temporarily unavailable"
        ) from exc
    return AccountMergeResponse(status=result.status)


@router.post("/bootstrap", response_model=AuthBootstrapResponse)
async def auth_bootstrap(
    authorization: Annotated[str | None, Header()] = None,
):
    """Provision the authenticated Supabase account exactly once.

    This endpoint deliberately keeps account side effects separate from the
    narrow ``/auth/me`` principal probe.  Telegram accounts continue to use
    their existing ``/start`` credit bootstrap path.
    """
    pool = db.get_pool()
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                principal = await resolve_auth_principal(
                    conn,
                    init_data=None,
                    telegram_user_id=None,
                    authorization=authorization,
                    auth_name="auth bootstrap",
                )
                if principal.authority != "supabase":
                    raise HTTPException(status_code=403, detail="Supabase account required")
                credit_state = await ensure_credit_account_state(conn, principal.user_id)
                saved_name = await conn.fetchval(
                    """
                    SELECT NULLIF(BTRIM(username), '')
                    FROM users
                    WHERE id = $1
                    """,
                    principal.user_id,
                )
    except HTTPException:
        raise
    except AuthPrincipalError as exc:
        if exc.code == "IDENTITY_RESOLUTION_FAILED":
            logger.exception("❌ auth/bootstrap identity resolution failed")
            raise HTTPException(
                status_code=503, detail="Authentication service unavailable"
            ) from exc
        logger.info("auth/bootstrap rejected credentials reason=%s", exc.code)
        raise HTTPException(status_code=401, detail="Authentication required") from exc
    except Exception as exc:
        logger.exception("❌ auth/bootstrap unavailable")
        raise HTTPException(status_code=500, detail="Authentication service unavailable") from exc

    return AuthBootstrapResponse(
        account=AuthBootstrapAccount(
            balance=credit_state.balance,
            starter_grant_granted_now=credit_state.starter_credits_granted_now,
            saved_name=saved_name,
        )
    )


@router.get("/telegram/nonce", response_model=TelegramLoginNonceResponse)
async def telegram_login_nonce():
    if not TELEGRAM_LOGIN_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Telegram website login is not configured")
    return TelegramLoginNonceResponse(
        client_id=TELEGRAM_LOGIN_CLIENT_ID,
        **build_website_login_nonce(),
    )


@router.post("/telegram/verify-id-token", response_model=TelegramLoginVerifyResponse)
async def telegram_verify_id_token(request: TelegramLoginVerifyRequest):
    try:
        auth_context = await verify_telegram_login_id_token(
            id_token=request.id_token,
            nonce_token=request.nonce_token,
        )
    except WebsiteAuthInvalid as exc:
        logger.warning("⛔ website telegram auth failed reason=%s", exc)
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await ensure_user(
                conn,
                telegram_user_id=auth_context.telegram_user_id,
                username=auth_context.username,
            )

    return TelegramLoginVerifyResponse(
        access_token=issue_website_auth_token(auth_context),
        expires_in=TELEGRAM_AUTH_TOKEN_TTL_SEC,
        telegram_user_id=auth_context.telegram_user_id,
        username=auth_context.username,
    )
