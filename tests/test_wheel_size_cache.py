import asyncio

import httpx
import pytest

from src.fitment.providers import wheel_size
from src.fitment.providers.base import ProviderError
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment.schemas import VehicleIdentity


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


def test_profile_cache_version_bypasses_pre_rim_offset_normalization():
    """A deployed parser fix must not wait up to a day for an old profile key."""
    cache = RecordingCache()
    params = {
        "make": "lexus",
        "model": "rx",
        "year": 2023,
        "region": "russia",
        "modification": "rx350",
    }
    old_key = f"ws:profile:{sorted(params.items())}"
    raw_key = f"ws:search:by_model:{sorted(params.items())}"
    cache.values[old_key] = {
        "provider": "wheel_size",
        "provider_version": "v2",
        "allowed_wheels": [{"axle": "front", "rim_diameter": 19, "rim_width": 8, "offset": None}],
        "offset_references": [],
    }
    cache.values[raw_key] = [
        {
            "technical": {"stud_holes": 5, "pcd": 114.3, "centre_bore": 60.1},
            "wheels": [
                {
                    "is_stock": True,
                    "front": {"rim_diameter": 19, "rim_width": 8, "rim_offset": 40},
                }
            ],
        }
    ]
    provider = WheelSizeProvider(api_key="test-key", cache=cache)
    identity = VehicleIdentity(
        make="Lexus",
        model="RX",
        year=2023,
        provider_mappings={
            "wheel_size": {
                "make_slug": "lexus",
                "model_slug": "rx",
                "region": "russia",
                "generation_slug": "al30",
                "modification_slug": "rx350",
            }
        },
    )

    profile = asyncio.run(provider.get_fitment_profile(identity))

    assert profile is not None
    reference = profile.offset_reference_for("front", 19, 8)
    assert reference is not None
    assert reference.source_offsets_mm == [40]
    assert all(old_key != key for key in cache.gets)
    assert any(wheel_size.PROFILE_NORMALIZATION_VERSION in key for key in cache.sets)
