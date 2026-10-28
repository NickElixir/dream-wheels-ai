"""OpenAI Responses API adapter for strict vehicle identity extraction."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import time
from datetime import UTC, datetime
from typing import Any

import aiohttp
from pydantic import ValidationError

from src.identity.prompts import (
    PROMPT_VERSION,
    RESOLVER_VERSION,
    VEHICLE_IDENTITY_JSON_SCHEMA,
    VEHICLE_IDENTITY_PROMPT,
)
from src.identity.providers.base import (
    VehicleIdentityProviderConfigurationError,
    VehicleIdentityProviderError,
    VehicleIdentityProviderInvalidResponseError,
)
from src.identity.schemas import (
    ProviderVehicleResolution,
    VehicleIdentityResolution,
    VehicleResolutionMetadata,
)
from src.vision.image_normalization import NormalizedImage

_RESPONSES_URL = "https://api.openai.com/v1/responses"


class OpenAIVehicleIdentityResolver:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_sec: float,
        max_retries: int,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout_sec = timeout_sec
        self.max_retries = max_retries

    async def resolve(self, image: NormalizedImage) -> VehicleIdentityResolution:
        if not self.api_key:
            raise VehicleIdentityProviderConfigurationError("OpenAI API key is not configured")
        payload = self._payload(image)
        started_at = time.monotonic()
        last_error: VehicleIdentityProviderError | None = None
        for attempt in range(self.max_retries + 1):
            try:
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=self.timeout_sec)
                ) as session:
                    async with session.post(
                        _RESPONSES_URL,
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        json=payload,
                    ) as response:
                        body = await response.text()
                        if response.status in {429, 500, 502, 503, 504}:
                            raise VehicleIdentityProviderError(
                                f"OpenAI temporary response status={response.status}"
                            )
                        if response.status in {401, 403}:
                            raise VehicleIdentityProviderConfigurationError(
                                f"OpenAI authentication response status={response.status}"
                            )
                        if response.status >= 400:
                            raise VehicleIdentityProviderError(
                                f"OpenAI response status={response.status}"
                            )
                        return self._parse_response(
                            body,
                            image=image,
                            provider_request_id=response.headers.get("x-request-id"),
                            latency_ms=int((time.monotonic() - started_at) * 1000),
                        )
            except VehicleIdentityProviderConfigurationError:
                raise
            except VehicleIdentityProviderInvalidResponseError:
                raise
            except (aiohttp.ClientError, TimeoutError) as exc:
                last_error = VehicleIdentityProviderError("OpenAI request failed")
                last_error.__cause__ = exc
            except VehicleIdentityProviderError as exc:
                last_error = exc
            if attempt < self.max_retries:
                await asyncio.sleep(0.25 * (attempt + 1))
        raise last_error or VehicleIdentityProviderError("OpenAI request failed")

    def _payload(self, image: NormalizedImage) -> dict[str, Any]:
        image_data = base64.b64encode(image.bytes).decode("ascii")
        return {
            "model": self.model,
            "store": False,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": VEHICLE_IDENTITY_PROMPT}],
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": "Resolve this vehicle image."},
                        {
                            "type": "input_image",
                            "image_url": f"data:{image.content_type};base64,{image_data}",
                            "detail": "low",
                        },
                    ],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "vehicle_identity_resolution",
                    "strict": True,
                    "schema": VEHICLE_IDENTITY_JSON_SCHEMA,
                }
            },
        }

    def _parse_response(
        self,
        body: str,
        *,
        image: NormalizedImage,
        provider_request_id: str | None,
        latency_ms: int,
    ) -> VehicleIdentityResolution:
        try:
            provider_response = json.loads(body)
            output_text = _response_output_text(provider_response)
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            raise VehicleIdentityProviderInvalidResponseError(
                "OpenAI returned invalid structured vehicle identity"
            ) from exc
        try:
            payload = ProviderVehicleResolution.model_validate_json(output_text)
        except ValidationError as exc:
            first_error = exc.errors()[0]
            location = ".".join(str(part) for part in first_error["loc"])
            raise VehicleIdentityProviderInvalidResponseError(
                "OpenAI structured vehicle identity violates contract at "
                f"{location}: {first_error['msg']}"
            ) from exc
        return VehicleIdentityResolution(
            status=payload.status,
            primary=payload.primary,
            alternatives=payload.alternatives,
            abstention_reason=payload.abstention_reason,
            metadata=VehicleResolutionMetadata(
                provider="openai",
                model=self.model,
                prompt_version=PROMPT_VERSION,
                resolver_version=RESOLVER_VERSION,
                provider_request_id=provider_request_id or provider_response.get("id"),
                latency_ms=latency_ms,
                estimated_cost=_estimated_cost_usd(provider_response, self.model),
                normalized_input_sha256=image.sha256,
                response_hash=hashlib.sha256(body.encode("utf-8")).hexdigest(),
                captured_at=datetime.now(UTC),
            ),
        )


def _response_output_text(response: dict[str, Any]) -> str:
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    raise KeyError("output_text")


def _estimated_cost_usd(response: dict[str, Any], model: str) -> float | None:
    """Estimate GPT-4o mini token cost from the completed Responses usage object."""
    if model not in {"gpt-4o-mini", "gpt-4o-mini-2024-07-18"}:
        return None
    usage = response.get("usage")
    if not isinstance(usage, dict):
        return None
    input_tokens = usage.get("input_tokens")
    output_tokens = usage.get("output_tokens")
    if not isinstance(input_tokens, int) or not isinstance(output_tokens, int):
        return None
    input_details = usage.get("input_tokens_details", {})
    cached_tokens = input_details.get("cached_tokens", 0) if isinstance(input_details, dict) else 0
    if not isinstance(cached_tokens, int) or not 0 <= cached_tokens <= input_tokens:
        return None
    return (
        (input_tokens - cached_tokens) * 0.15 + cached_tokens * 0.075 + output_tokens * 0.60
    ) / 1_000_000
