import asyncio

import pytest
from fastapi import HTTPException

from src.identity import recognition_operations as operations


class MemoryRedis:
    def __init__(self):
        self.values = {}

    async def set(self, key, value, **kwargs):
        if kwargs.get("nx") and key in self.values:
            return False
        self.values[key] = value
        return True

    async def get(self, key):
        return self.values.get(key)


def test_pending_duplicate_does_not_call_provider(monkeypatch):
    asyncio.run(_pending_duplicate(monkeypatch))


async def _pending_duplicate(monkeypatch):
    store = MemoryRedis()
    monkeypatch.setattr(operations.redis_client, "get_client", lambda: store)
    entered, release = asyncio.Event(), asyncio.Event()
    calls = 0

    async def resolve():
        nonlocal calls
        calls += 1
        entered.set()
        await release.wait()
        raise TimeoutError

    args = dict(user_id=1, request_id="click", fingerprint="photo", resolve=resolve)
    first = asyncio.create_task(operations.resolve_once(**args))
    await entered.wait()
    with pytest.raises(HTTPException) as duplicate:
        await operations.resolve_once(**args)
    assert duplicate.value.status_code == 409
    release.set()
    with pytest.raises(TimeoutError):
        await first
    with pytest.raises(HTTPException):
        await operations.resolve_once(**args)
    assert calls == 1
    with pytest.raises(HTTPException) as conflict:
        await operations.resolve_once(**{**args, "fingerprint": "different"})
    assert conflict.value.detail["code"] == "recognition_request_conflict"


def test_completed_result_reused_and_users_isolated(monkeypatch):
    asyncio.run(_completed_result(monkeypatch))


async def _completed_result(monkeypatch):
    from unittest.mock import Mock

    store = MemoryRedis()
    monkeypatch.setattr(operations.redis_client, "get_client", lambda: store)
    result = Mock()
    result.model_dump.return_value = {"safe": "result"}
    monkeypatch.setattr(operations.VehicleIdentityResolution, "model_validate", lambda value: value)
    calls = 0

    async def resolve():
        nonlocal calls
        calls += 1
        return result

    args = dict(user_id=1, request_id="click", fingerprint="photo", resolve=resolve)
    await operations.resolve_once(**args)
    assert await operations.resolve_once(**args) == {"safe": "result"}
    assert calls == 1
    await operations.resolve_once(**{**args, "user_id": 2})
    await operations.resolve_once(**{**args, "request_id": "new-click"})
    assert calls == 3


def test_unavailable_guard_does_not_call_provider(monkeypatch):
    from unittest.mock import AsyncMock

    def unavailable():
        raise RuntimeError("not initialized")

    monkeypatch.setattr(operations.redis_client, "get_client", unavailable)
    resolve = AsyncMock()
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            operations.resolve_once(
                user_id=1, request_id="click", fingerprint="photo", resolve=resolve
            )
        )
    assert error.value.status_code == 503
    resolve.assert_not_called()
