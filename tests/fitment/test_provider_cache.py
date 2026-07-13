from __future__ import annotations

import pytest

from src.fitment.providers.cache import RedisProviderCache


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.expirations: dict[str, int] = {}

    async def get(self, key: str):
        return self.values.get(key)

    async def set(self, key: str, value: str, *, ex: int):
        self.values[key] = value
        self.expirations[key] = ex

    async def delete(self, key: str):
        self.values.pop(key, None)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_redis_provider_cache_round_trip_and_ttl() -> None:
    redis = FakeRedis()
    cache = RedisProviderCache(redis, key_prefix="test:")

    await cache.set("profile", {"pcd": 108, "wheels": [18, 19]}, 60)

    assert await cache.get("profile") == {"pcd": 108, "wheels": [18, 19]}
    assert redis.expirations["test:profile"] == 60


@pytest.mark.anyio
async def test_redis_provider_cache_drops_corrupt_json() -> None:
    redis = FakeRedis()
    redis.values["test:profile"] = "not-json"
    cache = RedisProviderCache(redis, key_prefix="test:")

    assert await cache.get("profile") is None
    assert "test:profile" not in redis.values
