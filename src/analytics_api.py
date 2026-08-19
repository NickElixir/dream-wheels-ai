"""First-party product event ingestion and UTM attribution."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from src import db
from src.auth import resolve_telegram_auth
from src.users_service import ensure_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

EventName = Literal[
    "app_opened", "auth_completed", "upload_started", "upload_completed",
    "render_started", "render_completed", "render_failed", "result_opened",
    "feedback_submitted", "repeat_render_started", "payment_started",
    "payment_completed", "payment_failed",
]


class Attribution(BaseModel):
    utm_source: str | None = Field(default=None, max_length=256)
    utm_medium: str | None = Field(default=None, max_length=256)
    utm_campaign: str | None = Field(default=None, max_length=512)
    utm_content: str | None = Field(default=None, max_length=512)
    utm_term: str | None = Field(default=None, max_length=512)
    landing_url: str = Field(max_length=4096)
    referrer: str | None = Field(default=None, max_length=4096)
    first_seen_at: datetime
    last_seen_at: datetime


class AnalyticsEventRequest(BaseModel):
    visitor_id: UUID
    event_name: EventName
    attribution: Attribution
    properties: dict[str, Any] = Field(default_factory=dict)
    init_data: str | None = None
    telegram_user_id: int | None = None


def _clean_properties(properties: dict[str, Any]) -> dict[str, Any]:
    # Events are analytical metadata only: cap size and avoid accepting a free-form dump.
    if len(properties) > 24:
        raise HTTPException(status_code=422, detail="Too many analytics properties")
    cleaned: dict[str, Any] = {}
    for key, value in properties.items():
        if not isinstance(key, str) or len(key) > 64:
            raise HTTPException(status_code=422, detail="Invalid analytics property key")
        if isinstance(value, str | int | float | bool) or value is None:
            if isinstance(value, str) and len(value) > 512:
                raise HTTPException(status_code=422, detail="Analytics property value too long")
            cleaned[key] = value
    return cleaned


async def record_system_event(conn, *, user_id: int, event_name: EventName, properties: dict[str, Any]) -> None:
    """Record durable server-side outcomes when no browser is open to report them."""
    await conn.execute(
        "INSERT INTO analytics_events (user_id, event_name, properties) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING",
        user_id, event_name, json.dumps(_clean_properties(properties)),
    )


@router.post("/events", status_code=202)
async def ingest_event(
    request: AnalyticsEventRequest,
    authorization: Annotated[str | None, Header()] = None,
):
    user_id = None
    if authorization or request.init_data or request.telegram_user_id is not None:
        auth = resolve_telegram_auth(
            init_data=request.init_data or "",
            telegram_user_id=request.telegram_user_id,
            authorization=authorization,
            auth_name="analytics",
        )
    else:
        auth = None
    touch = request.attribution.model_dump(exclude_none=True)
    properties = _clean_properties(request.properties)
    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            if auth:
                user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
            await conn.execute(
                """
                INSERT INTO analytics_visitors (
                    visitor_id, user_id, first_touch, last_touch, landing_url, referrer,
                    first_seen_at, last_seen_at
                ) VALUES ($1, $2, $3::jsonb, $3::jsonb, $4, $5, $6, $7)
                ON CONFLICT (visitor_id) DO UPDATE SET
                    user_id = COALESCE(EXCLUDED.user_id, analytics_visitors.user_id),
                    last_touch = EXCLUDED.last_touch,
                    last_seen_at = GREATEST(analytics_visitors.last_seen_at, EXCLUDED.last_seen_at)
                """,
                request.visitor_id, user_id, json.dumps(touch),
                request.attribution.landing_url, request.attribution.referrer,
                request.attribution.first_seen_at, request.attribution.last_seen_at,
            )
            await conn.execute(
                """INSERT INTO analytics_events (visitor_id, user_id, event_name, properties)
                   VALUES ($1, $2, $3, $4::jsonb)""",
                request.visitor_id, user_id, request.event_name,
                json.dumps(properties),
            )
    return {"accepted": True}
