"""OpenAI Responses API adapter for strict vehicle identity extraction."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import socket
import time
from datetime import UTC, datetime
from typing import Any

import aiohttp
from jsonschema import Draft202012Validator
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
    VehicleIdentityProviderRequestError,
)
from src.identity.schemas import (
    ProviderVehicleResolution,
    VehicleIdentityResolution,
    VehicleResolutionMetadata,
)
from src.vision.image_normalization import NormalizedImage

_WIRE_VALIDATOR = Draft202012Validator(VEHICLE_IDENTITY_JSON_SCHEMA)

_RESPONSES_URL = "https://api.openai.com/v1/responses"


def _transport_failure_kind(exc: BaseException) -> str:
    # Exception strings may contain URLs, credentials or provider response data.
    if isinstance(exc, TimeoutError):
        return "timeout"
    if isinstance(exc, aiohttp.ClientConnectorCertificateError | aiohttp.ClientSSLError):
        return "tls"
    if isinstance(exc, aiohttp.ClientConnectorError) and isinstance(exc.os_error, socket.gaierror):
        return "dns"
    if isinstance(exc, aiohttp.ClientPayloadError):
        return "response_body"
    if isinstance(exc, aiohttp.ClientConnectionError):
        return "connection"
    return "client_error"


class OpenAIVehicleIdentityResolver:
    provider_name = "openai"
    endpoint = _RESPONSES_URL
    prompt_version = PROMPT_VERSION

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
            raise VehicleIdentityProviderConfigurationError(
                f"{self.provider_name} API key is not configured"
            )
        payload = self._payload(image)
        started_at = time.monotonic()
        last_error: VehicleIdentityProviderError | None = None
        for attempt in range(self.max_retries + 1):
            attempt_started = time.monotonic()
            phase = "connecting"
            trace = aiohttp.TraceConfig()

            async def dns_start(*_args):
                nonlocal phase
                phase = "dns"

            async def connect_start(*_args):
                nonlocal phase
                phase = "connecting"

            async def headers_sent(*_args):
                nonlocal phase
                phase = "awaiting_headers"

            trace.on_dns_resolvehost_start.append(dns_start)
            trace.on_dns_resolvehost_end.append(connect_start)
            trace.on_request_headers_sent.append(headers_sent)
            try:
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=self.timeout_sec), trace_configs=[trace]
                ) as session:
                    async with session.post(
                        self.endpoint,
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        json=payload,
                    ) as response:
                        if response.status in {429, 500, 502, 503, 504}:
                            raise VehicleIdentityProviderError(
                                f"{self.provider_name} temporary response status={response.status}"
                            )
                        if response.status in {401, 403}:
                            raise VehicleIdentityProviderConfigurationError(
                                f"{self.provider_name} authentication response status={response.status}"
                            )
                        if response.status >= 400:
                            raise VehicleIdentityProviderRequestError(
                                f"{self.provider_name} response status={response.status}"
                            )
                        phase = "reading_body"
                        body = await response.text()
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
                last_error = VehicleIdentityProviderError(
                    f"{self.provider_name} request failed"
                    f" failure_kind={_transport_failure_kind(exc)} phase={phase}"
                    f" elapsed_ms={int((time.monotonic() - attempt_started) * 1000)}"
                    f" attempt={attempt + 1} max_retries={self.max_retries}"
                )
            except VehicleIdentityProviderError as exc:
                if not exc.retryable:
                    raise
                last_error = exc
            if attempt < self.max_retries:
                await asyncio.sleep(0.25 * (attempt + 1))
        raise last_error or VehicleIdentityProviderError(f"{self.provider_name} request failed")

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
            output_text = self._output_text(provider_response)
        except json.JSONDecodeError:
            raise VehicleIdentityProviderInvalidResponseError(
                f"{self.provider_name} returned invalid structured vehicle identity reason=envelope_invalid_json"
            ) from None
        except (KeyError, TypeError, IndexError, AttributeError):
            raise VehicleIdentityProviderInvalidResponseError(
                f"{self.provider_name} returned invalid structured vehicle identity reason=envelope_invalid_structure"
            ) from None
        try:
            wire_payload = json.loads(output_text)
        except (json.JSONDecodeError, TypeError):
            raise VehicleIdentityProviderInvalidResponseError(
                f"{self.provider_name} returned invalid JSON"
            ) from None
        violations = _schema_diagnostics(wire_payload)
        if violations:
            request_id = provider_request_id or provider_response.get("id")
            request_hash = (
                hashlib.sha256(request_id.encode()).hexdigest()[:16]
                if isinstance(request_id, str)
                else "unavailable"
            )
            raise VehicleIdentityProviderInvalidResponseError(
                f"{self.provider_name} structured vehicle identity violates JSON schema "
                f"request_id_hash={request_hash} violations={json.dumps(violations)}"
            )
        try:
            payload = ProviderVehicleResolution.model_validate(wire_payload)
        except ValidationError:
            raise VehicleIdentityProviderInvalidResponseError(
                f"{self.provider_name} structured vehicle identity violates semantic contract"
            ) from None
        try:
            return VehicleIdentityResolution(
                status=payload.status,
                primary=payload.primary,
                alternatives=payload.alternatives,
                abstention_reason=payload.abstention_reason,
                metadata=VehicleResolutionMetadata(
                    provider=self.provider_name,
                    model=self.model,
                    prompt_version=self.prompt_version,
                    resolver_version=RESOLVER_VERSION,
                    provider_request_id=provider_request_id or provider_response.get("id"),
                    latency_ms=latency_ms,
                    estimated_cost=self._estimated_cost(provider_response),
                    normalized_input_sha256=image.sha256,
                    response_hash=hashlib.sha256(body.encode("utf-8")).hexdigest(),
                    captured_at=datetime.now(UTC),
                ),
            )
        except (ValidationError, TypeError, AttributeError):
            raise VehicleIdentityProviderInvalidResponseError(
                f"{self.provider_name} returned invalid response metadata"
            ) from None

    def _output_text(self, response: dict[str, Any]) -> str:
        return _response_output_text(response)

    def _estimated_cost(self, response: dict[str, Any]) -> float | None:
        return _estimated_cost_usd(response, self.model)


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


_DIAGNOSTIC_FIELDS = frozenset(
    {
        "status",
        "primary",
        "alternatives",
        "abstention_reason",
        "make",
        "model",
        "year",
        "year_start",
        "year_end",
        "confidence",
        "source",
    }
)


def _schema_diagnostics(payload: Any) -> list[dict[str, Any]]:
    """Only schema-owned field names and validator keywords may enter diagnostics."""
    diagnostics: list[dict[str, Any]] = []

    def collect(error: Any) -> None:
        if len(diagnostics) >= 8:
            return
        if error.context:
            for child in error.context:
                collect(child)
            return
        item: dict[str, Any] = {
            "path": [
                part if isinstance(part, int) or part in _DIAGNOSTIC_FIELDS else "[field]"
                for part in error.absolute_path
            ],
            "rule": error.validator,
            "actual_type": type(error.instance).__name__,
        }
        if error.validator == "required" and isinstance(error.instance, dict):
            item["missing"] = [
                field
                for field in error.validator_value
                if field in _DIAGNOSTIC_FIELDS and field not in error.instance
            ]
        diagnostics.append(item)

    for error in _WIRE_VALIDATOR.iter_errors(payload):
        collect(error)
        if len(diagnostics) >= 8:
            break
    return diagnostics
