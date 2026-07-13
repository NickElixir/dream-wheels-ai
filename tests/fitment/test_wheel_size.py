from __future__ import annotations

import asyncio
from collections.abc import Awaitable
from typing import Any

import httpx
import pytest

from src.fitment.providers import wheel_size
from src.fitment.providers.base import ProviderError
from src.fitment.providers.cache import InMemoryProviderCache
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment.schemas import VehicleIdentity


def _run(coro: Awaitable[Any]) -> Any:
    return asyncio.run(coro)


def test_resolution_ladder_resolves_modification_and_caches_catalog() -> None:
    calls: list[tuple[str, dict[str, str]]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        params = dict(request.url.params)
        calls.append((request.url.path, params))
        data_by_path: dict[str, list[Any]] = {
            "/v2/makes/": [{"slug": "bmw", "name": "BMW"}],
            "/v2/models/": [{"slug": "3-series", "name": "3 Series"}],
            "/v2/years/": [2020, 2021],
            "/v2/generations/": [{"slug": "g20", "name": "G20", "body": "Sedan"}],
            "/v2/modifications/": [
                {"slug": "330i-xdrive", "name": "330i xDrive", "body": "Sedan"},
                {"slug": "320d", "name": "320d", "body": "Sedan"},
            ],
        }
        return httpx.Response(200, json={"data": data_by_path[request.url.path]})

    async def scenario() -> tuple[VehicleIdentity | None, VehicleIdentity | None]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WheelSizeProvider(
                api_key="test-key",
                base_url="https://wheel.test/v2",
                cache=InMemoryProviderCache(),
                client=client,
            )
            identity = VehicleIdentity(
                make="BMW",
                model="3 Series",
                year=2020,
                generation="G20",
                modification="330i xDrive",
                body="Sedan",
                market="europe",
            )
            return (
                await provider.resolve_vehicle(identity),
                await provider.resolve_vehicle(identity),
            )

    first, second = _run(scenario())

    assert first is not None
    assert second is not None
    assert first.provider_mappings["wheel_size"] == {
        "make_slug": "bmw",
        "model_slug": "3-series",
        "region": "eudm",
        "generation_slug": "g20",
        "modification_slug": "330i-xdrive",
    }
    assert [path for path, _params in calls] == [
        "/v2/makes/",
        "/v2/models/",
        "/v2/years/",
        "/v2/generations/",
        "/v2/modifications/",
    ]
    assert calls[-1][1]["generation"] == "g20"
    assert all(params["user_key"] == "test-key" for _path, params in calls)


def test_ambiguous_modification_searches_without_slug_and_caches_empty_results() -> None:
    search_params: list[dict[str, str]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        data_by_path: dict[str, list[Any]] = {
            "/v2/makes/": [{"slug": "bmw", "name": "BMW"}],
            "/v2/models/": [{"slug": "3-series", "name": "3 Series"}],
            "/v2/years/": [2020],
            "/v2/generations/": [{"slug": "g20", "name": "G20"}],
            "/v2/modifications/": [
                {"slug": "320i", "name": "320i", "body": "Sedan"},
                {"slug": "330i", "name": "330i", "body": "Sedan"},
            ],
            "/v2/search/by_model/": [],
        }
        if request.url.path == "/v2/search/by_model/":
            search_params.append(dict(request.url.params))
        return httpx.Response(200, json={"data": data_by_path[request.url.path]})

    async def scenario() -> tuple[VehicleIdentity | None, Any, Any]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WheelSizeProvider(
                api_key="test-key",
                base_url="https://wheel.test/v2",
                cache=InMemoryProviderCache(),
                client=client,
            )
            identity = VehicleIdentity(
                make="BMW",
                model="3 Series",
                year=2020,
                generation="G20",
                body="Sedan",
                market="europe",
            )
            resolved = await provider.resolve_vehicle(identity)
            assert resolved is not None
            first = await provider.get_fitment_profile(resolved)
            second = await provider.get_fitment_profile(resolved)
            return resolved, first, second

    resolved, first, second = _run(scenario())

    assert resolved is not None
    assert "modification_slug" not in resolved.provider_mappings["wheel_size"]
    assert first is None
    assert second is None
    assert len(search_params) == 2
    assert [params["region"] for params in search_params] == ["eudm", "usdm"]
    assert all("modification" not in params for params in search_params)


def test_non_user_initiated_profile_never_searches() -> None:
    requests = 0

    async def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(200, json={"data": []})

    async def scenario() -> Any:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WheelSizeProvider(
                api_key="test-key",
                base_url="https://wheel.test/v2",
                client=client,
            )
            identity = VehicleIdentity(
                make="BMW",
                model="3 Series",
                year=2020,
                provider_mappings={
                    "wheel_size": {
                        "make_slug": "bmw",
                        "model_slug": "3-series",
                    }
                },
            )
            return await provider.get_fitment_profile(identity, user_initiated=False)

    assert _run(scenario()) is None
    assert requests == 0


@pytest.mark.parametrize("transient_status", [429, 500, 503])
def test_request_retries_transient_statuses(
    transient_status: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0
    delays: list[float] = []

    async def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(transient_status, json={"error": "temporary"})
        return httpx.Response(200, json={"data": [{"slug": "bmw"}]})

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)

    monkeypatch.setattr(wheel_size, "WHEEL_SIZE_MAX_RETRIES", 3)
    monkeypatch.setattr(wheel_size.asyncio, "sleep", fake_sleep)

    async def scenario() -> Any:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WheelSizeProvider(
                api_key="test-key",
                base_url="https://wheel.test/v2",
                client=client,
            )
            return await provider._request("makes", {"region": "eudm"})

    assert _run(scenario()) == {"data": [{"slug": "bmw"}]}
    assert attempts == 2
    assert delays == [0.5]


def test_request_retries_network_error(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.ConnectError("connection failed", request=request)
        return httpx.Response(200, json={"data": []})

    async def fake_sleep(_delay: float) -> None:
        return None

    monkeypatch.setattr(wheel_size, "WHEEL_SIZE_MAX_RETRIES", 2)
    monkeypatch.setattr(wheel_size.asyncio, "sleep", fake_sleep)

    async def scenario() -> Any:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WheelSizeProvider(
                api_key="test-key",
                base_url="https://wheel.test/v2",
                client=client,
            )
            return await provider._request("makes", {})

    assert _run(scenario()) == {"data": []}
    assert attempts == 2


def test_request_does_not_retry_ordinary_4xx(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0

    async def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(400, json={"error": "invalid request"})

    monkeypatch.setattr(wheel_size, "WHEEL_SIZE_MAX_RETRIES", 3)

    async def scenario() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WheelSizeProvider(
                api_key="test-key",
                base_url="https://wheel.test/v2",
                client=client,
            )
            with pytest.raises(ProviderError, match="HTTP 400"):
                await provider._request("makes", {})

    _run(scenario())
    assert attempts == 1


def test_ambiguous_technical_values_require_complete_consensus() -> None:
    provider = WheelSizeProvider(api_key="test-key")
    data = [
        {
            "technical": {
                "stud_holes": 5,
                "pcd": 112,
                "centre_bore": "66.6",
                "fasteners": {"type": "Lug bolts", "thread_size": "M14 x 1.25"},
            }
        },
        {
            "technical": {
                "stud_holes": 5,
                "pcd": 114.3,
                "fasteners": {"type": "Lug bolts"},
            }
        },
    ]

    profile = provider._normalize_profile(data)

    assert profile is not None
    assert profile.bolt_count is None
    assert profile.pcd_mm is None
    assert profile.center_bore_mm is None
    assert profile.fastener_type == "Lug bolts"
    assert profile.thread_size is None


def test_normalization_preserves_zero_offset() -> None:
    provider = WheelSizeProvider(api_key="test-key")
    profile = provider._normalize_profile(
        [
            {
                "technical": {"stud_holes": 4, "pcd": 100},
                "wheels": [
                    {
                        "front": {
                            "rim_diameter": 15,
                            "rim_width": 7,
                            "offset": 0,
                            "is_stock": True,
                        },
                        "rear": {
                            "rim_diameter": 15,
                            "rim_width": 7,
                            "offset": 0,
                            "is_stock": True,
                        },
                    }
                ],
            }
        ]
    )

    assert profile is not None
    assert profile.oem_offset_front == 0
    assert profile.oem_offset_rear == 0
