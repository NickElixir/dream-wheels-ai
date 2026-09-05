"""HTTP API для website Telegram auth поверх backend-issued bearer token."""

from __future__ import annotations

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from src import db
from src.auth import (
    WebsiteAuthInvalid,
    build_website_login_nonce,
    issue_website_auth_token,
    verify_telegram_login_id_token,
)
from src.auth_principal import AuthPrincipalError, resolve_auth_principal
from src.config import TELEGRAM_AUTH_TOKEN_TTL_SEC, TELEGRAM_LOGIN_CLIENT_ID
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
