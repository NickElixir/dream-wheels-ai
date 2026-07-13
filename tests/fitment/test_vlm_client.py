from __future__ import annotations

import json

import httpx
import pytest

from src.fitment.identification.vlm_client import OpenAICompatibleVlmClient, VlmError


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_vlm_retries_5xx_and_returns_structured_json() -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        assert request.headers["Authorization"] == "Bearer secret-test-key"
        if attempts == 1:
            return httpx.Response(503, json={"error": "temporary"})
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"content": json.dumps({"make": "Volvo", "model": "XC60"})}}
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = OpenAICompatibleVlmClient(
            api_key="secret-test-key",
            base_url="https://aitunnel.test/v1",
            model="vision-test",
            client=http,
        )
        result = await client.complete_json(
            prompt="identify",
            image_b64="YWJj",
            image_mime="image/jpeg",
            schema_name="vehicle_identification",
            json_schema={"type": "object"},
        )

    assert attempts == 2
    assert result == {"make": "Volvo", "model": "XC60"}


@pytest.mark.anyio
async def test_vlm_does_not_retry_ordinary_4xx_or_leak_key() -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(401, json={"error": "invalid secret-test-key"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = OpenAICompatibleVlmClient(api_key="secret-test-key", client=http)
        with pytest.raises(VlmError) as error:
            await client.complete_json(
                prompt="identify",
                image_b64="YWJj",
                image_mime="image/jpeg",
                schema_name="vehicle_identification",
                json_schema={"type": "object"},
            )

    assert attempts == 1
    assert "secret-test-key" not in str(error.value)
