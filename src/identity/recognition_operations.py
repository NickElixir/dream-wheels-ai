"""Shared single-attempt guard for explicitly keyed recognition operations."""

import hashlib
import json
from collections.abc import Awaitable, Callable

from fastapi import HTTPException
from redis.exceptions import RedisError

from src import redis_client
from src.identity.schemas import VehicleIdentityResolution

RETENTION_SECONDS = 900


async def resolve_once(
    *,
    user_id: int,
    request_id: str,
    fingerprint: str,
    resolve: Callable[[], Awaitable[VehicleIdentityResolution]],
) -> VehicleIdentityResolution:
    """Never reclaim an uncertain operation automatically within its retention window."""
    key = redis_client.key(
        f"recognition:{user_id}:{hashlib.sha256(request_id.encode()).hexdigest()}"
    )
    pending = json.dumps({"fingerprint": fingerprint, "status": "pending"})
    try:
        client = redis_client.get_client()
        claimed = await client.set(key, pending, nx=True, ex=RETENTION_SECONDS)
        if not claimed:
            raw = await client.get(key)
            if not raw:
                raise HTTPException(503, detail={"code": "recognition_state_unavailable"})
            operation = json.loads(raw)
            if operation["fingerprint"] != fingerprint:
                raise HTTPException(409, detail={"code": "recognition_request_conflict"})
            if operation["status"] == "completed":
                return VehicleIdentityResolution.model_validate(operation["result"])
            raise HTTPException(409, detail={"code": "recognition_pending_or_uncertain"})
    except (RedisError, RuntimeError) as exc:
        raise HTTPException(503, detail={"code": "recognition_state_unavailable"}) from exc
    result = await resolve()
    # Provider failure or process interruption leaves the marker in place: no hidden retry.
    try:
        await client.set(
            key,
            json.dumps(
                {
                    "fingerprint": fingerprint,
                    "status": "completed",
                    "result": result.model_dump(mode="json"),
                }
            ),
            xx=True,
            ex=RETENTION_SECONDS,
        )
    except RedisError as exc:
        raise HTTPException(503, detail={"code": "recognition_state_unavailable"}) from exc
    return result
