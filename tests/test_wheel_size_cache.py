import asyncio

import httpx
import pytest

from src.fitment.providers import wheel_size
from src.fitment.providers.base import ProviderError
from src.fitment.providers.wheel_size import WheelSizeProvider


def test_default_provider_cache_is_shared_between_requests():
    first = WheelSizeProvider(api_key="test-key")
    second = WheelSizeProvider(api_key="test-key")

    assert first._cache is second._cache


class RecordingCache:
    def __init__(self) -> None:
        self.values: dict[str, object] = {}
        self.gets: list[str] = []
        self.sets: list[str] = []

    async def get(self, key: str):
        self.gets.append(key)
        return self.values.get(key)

    async def set(self, key: str, value: object, ttl_sec: int) -> None:
        assert ttl_sec > 0
        self.sets.append(key)
        self.values[key] = value


class RecordingClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    async def get(self, url: str, *, params: dict[str, object]):
        self.calls.append((url, params))
        path = url.rstrip("/").rsplit("/", 1)[-1]
        if path == "makes":
            data = [{"slug": "porsche", "name": "Porsche"}]
        elif path == "years":
            data = [{"year": 2021}]
        else:
            data = []
        return httpx.Response(200, json={"data": data})


def test_catalogue_cache_keys_keep_parent_contexts_separate():
    cache = RecordingCache()
    http_client = RecordingClient()
    provider = WheelSizeProvider(api_key="test-key", cache=cache, client=http_client)

    async def run() -> None:
        await provider.catalogue_makes(region="russia")
        await provider.catalogue_makes(region="russia")
        await provider.catalogue_makes(region="eudm")
        await provider.catalogue_years(make="porsche", model="cayenne", region="russia")
        await provider.catalogue_years(make="porsche", model="macan", region="russia")

    asyncio.run(run())

    assert len(http_client.calls) == 4
    assert len(set(cache.sets)) == 4
    assert any("('region', 'russia')" in key for key in cache.sets)
    assert any("('region', 'eudm')" in key for key in cache.sets)
    assert any("('model', 'cayenne')" in key for key in cache.sets)
    assert any("('model', 'macan')" in key for key in cache.sets)


def test_catalogue_provider_failure_is_not_cached_as_no_data(monkeypatch):
    class FailedClient:
        async def get(self, _url: str, *, params: dict[str, object]):
            del params
            return httpx.Response(503)

    cache = RecordingCache()
    provider = WheelSizeProvider(api_key="test-key", cache=cache, client=FailedClient())
    monkeypatch.setattr(wheel_size, "WHEEL_SIZE_MAX_RETRIES", 1)

    with pytest.raises(ProviderError):
        asyncio.run(provider.catalogue_regions())

    assert cache.values == {}
    assert cache.sets == []
