"""Shared single-attempt guard for explicitly keyed recognition operations."""

import hashlib
import json
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from redis.exceptions import RedisError

from src import redis_client
from src.identity.providers.base import VehicleIdentityProviderError
from src.identity.schemas import VehicleIdentityResolution

RETENTION_SECONDS = 900


async def resolve_once(
    *,
    user_id: int,
    request_id: str,
    fingerprint: str,
    existing_only: bool = False,
    resolve: Callable[[], Awaitable[VehicleIdentityResolution]],
) -> VehicleIdentityResolution:
    """Never reclaim an uncertain operation automatically within its retention window."""
    key = redis_client.key(
        f"recognition:{user_id}:{hashlib.sha256(request_id.encode()).hexdigest()}"
    )
    pending = json.dumps({"fingerprint": fingerprint, "status": "pending", "owner": uuid4().hex})
    try:
        client = redis_client.get_client()
        claimed = (
            False
            if existing_only
            else await client.set(key, pending, nx=True, ex=RETENTION_SECONDS)
        )
        if not claimed:
            raw = await client.get(key)
            if not raw:
                raise HTTPException(503, detail={"code": "recognition_state_unavailable"})
            operation = json.loads(raw)
            if (
                not isinstance(operation, dict)
                or operation.get("status") not in {"pending", "completed", "failed"}
                or not isinstance(operation.get("fingerprint"), str)
            ):
                raise ValueError("invalid operation")
            if operation["fingerprint"] != fingerprint:
                raise HTTPException(409, detail={"code": "recognition_request_conflict"})
            if operation["status"] == "failed":
                failure = operation["error"]
                allowed_codes = {
                    "vehicle_identity_provider_unavailable",
                    "vehicle_identity_provider_configuration_error",
                    "vehicle_identity_provider_invalid_response",
                    "vehicle_identity_provider_request_rejected",
                }
                if (
                    not isinstance(failure, dict)
                    or failure.get("code") not in allowed_codes
                    or type(failure.get("retryable")) is not bool
                    or failure.get("kind") not in {"rate_limit", "http_response", "terminal"}
                ):
                    raise ValueError("invalid failure")
                error = VehicleIdentityProviderError("Stored recognition failure")
                error.error_code = failure["code"]
                error.retryable = failure["retryable"]
                error.failure_kind = failure["kind"]
                raise error
            if operation["status"] == "completed":
                return VehicleIdentityResolution.model_validate(operation["result"])
            raise HTTPException(409, detail={"code": "recognition_pending_or_uncertain"})
    except VehicleIdentityProviderError:
        raise
    except (RedisError, RuntimeError, ValueError, KeyError, TypeError, ValidationError) as exc:
        raise HTTPException(503, detail={"code": "recognition_state_unavailable"}) from exc
    try:
        result = await resolve()
    except VehicleIdentityProviderError as error:
        # A received HTTP rejection or validated local rejection has a known outcome.
        # Transport ambiguity/process interruption retains pending; never call again.
        if getattr(error, "http_status", None) is not None or not error.retryable:
            kind = (
                "rate_limit"
                if getattr(error, "failure_kind", None) == "rate_limit"
                else "http_response"
                if getattr(error, "http_status", None) is not None
                else "terminal"
            )
            try:
                saved = await client.eval(
                    "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]) else return false end",
                    1,
                    key,
                    pending,
                    json.dumps(
                        {
                            "fingerprint": fingerprint,
                            "status": "failed",
                            "error": {
                                "code": error.error_code,
                                "retryable": error.retryable,
                                "kind": kind,
                            },
                        }
                    ),
                    RETENTION_SECONDS,
                )
                if not saved:
                    raise HTTPException(503, detail={"code": "recognition_state_unavailable"})
            except RedisError:
                raise HTTPException(503, detail={"code": "recognition_state_unavailable"}) from None
        else:
            error.recognition_pending = True
        raise

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
