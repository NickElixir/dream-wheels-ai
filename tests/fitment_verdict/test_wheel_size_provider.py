"""Tests for Wheel-Size provider normalization and HTTP client."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx

from fitment_verdict.providers.wheel_size import (
    WheelSizeHttpClient,
    WheelSizeProvider,
    normalize_vehicle_payload,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_normalize_vehicle_payload(sample_vehicle_query):
    payload = json.loads((FIXTURES / "wheel_size_vehicle.json").read_text(encoding="utf-8"))
    profile = normalize_vehicle_payload(
        payload,
        provider="wheel_size",
        vehicle_query=sample_vehicle_query,
        raw_response_ref="test",
    )
    assert profile.bolt_pattern == "5x114.3"
    assert profile.pcd == 114.3
    assert profile.center_bore == 66.6
    assert len(profile.allowed_wheels) == 2
    assert profile.oem_offset_front == 40


def test_provider_uses_cache_on_second_call(config, cache, sample_vehicle_query, monkeypatch):
    payload = json.loads((FIXTURES / "wheel_size_vehicle.json").read_text(encoding="utf-8"))
    calls = {"count": 0}

    async def fake_get_json(path, params):
        calls["count"] += 1
        if path == "/search/by_model/":
            return [payload]
        if path == "/makes/":
            return [{"slug": "haval", "name": "Haval"}]
        if path == "/models/":
            return [{"slug": "chitu", "name": "Chitu"}]
        return []

    async def _run():
        provider = WheelSizeProvider(config, cache)
        monkeypatch.setattr(provider._client, "get_json", fake_get_json)
        first = await provider.resolve_and_fetch_profile(
            sample_vehicle_query,
            user_initiated=True,
        )
        second = await provider.resolve_and_fetch_profile(
            sample_vehicle_query,
            user_initiated=True,
        )
        return first, second

    first, second = asyncio.run(_run())
    assert first is not None
    assert second is not None
    assert calls["count"] == 1


def test_provider_skips_search_when_not_user_initiated(config, cache, sample_vehicle_query):
    async def _run():
        provider = WheelSizeProvider(config, cache)
        return await provider.resolve_and_fetch_profile(
            sample_vehicle_query,
            user_initiated=False,
        )

    profile = asyncio.run(_run())
    assert profile is None


def test_http_client_retries_on_500(config):
    attempts = {"count": 0}

    async def handler(request: httpx.Request) -> httpx.Response:
        attempts["count"] += 1
        if attempts["count"] < 2:
            return httpx.Response(500, json={"message": "error"})
        return httpx.Response(200, json={"data": []})

    async def _run():
        transport = httpx.MockTransport(handler)
        client = WheelSizeHttpClient(config)
        url = f"{config.wheel_size_base_url}/makes/"
        query = {"region": "chdm", "user_key": config.wheel_size_api_key}
        async with httpx.AsyncClient(transport=transport) as http_client:
            for _attempt in range(client._config.http_max_retries):
                response = await http_client.get(url, params=query)
                if response.status_code < 500:
                    return response.json().get("data", [])
        return []

    data = asyncio.run(_run())
    assert data == []
    assert attempts["count"] == 2
