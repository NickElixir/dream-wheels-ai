"""Shared single-attempt guard for explicitly keyed recognition operations."""

import hashlib
import json
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
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
    pending = json.dumps({"fingerprint": fingerprint, "status": "pending", "owner": uuid4().hex})
    try:
        client = redis_client.get_client()
        claimed = await client.set(key, pending, nx=True, ex=RETENTION_SECONDS)
        if not claimed:
            raw = await client.get(key)
            if not raw:
                raise HTTPException(503, detail={"code": "recognition_state_unavailable"})
            operation = json.loads(raw)
            if (
                not isinstance(operation, dict)
                or operation.get("status") not in {"pending", "completed"}
                or not isinstance(operation.get("fingerprint"), str)
            ):
                raise ValueError("invalid operation")
            if operation["fingerprint"] != fingerprint:
                raise HTTPException(409, detail={"code": "recognition_request_conflict"})
            if operation["status"] == "completed":
                return VehicleIdentityResolution.model_validate(operation["result"])
            raise HTTPException(409, detail={"code": "recognition_pending_or_uncertain"})
    except (RedisError, RuntimeError, ValueError, KeyError, TypeError, ValidationError) as exc:
        raise HTTPException(503, detail={"code": "recognition_state_unavailable"}) from exc
    result = await resolve()
    # Provider failure or process interruption leaves the marker in place: no hidden retry.
    try:
        saved = await client.eval(
            "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]) else return false end",
            1,
            key,
            pending,
            json.dumps(
                {
                    "fingerprint": fingerprint,
                    "status": "completed",
                    "result": result.model_dump(mode="json"),
                }
            ),
            RETENTION_SECONDS,
        )
        if not saved:
            raise HTTPException(503, detail={"code": "recognition_state_unavailable"})
    except RedisError as exc:
        raise HTTPException(503, detail={"code": "recognition_state_unavailable"}) from exc
    return result
