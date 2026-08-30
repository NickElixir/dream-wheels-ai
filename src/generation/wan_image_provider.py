"""Alibaba Cloud Model Studio Wan image-editing provider."""

from __future__ import annotations

import asyncio
import base64
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from urllib.parse import urljoin, urlsplit

import aiohttp
from PIL import Image, UnidentifiedImageError

from src.generation.base import (
    GenerationProviderError,
    GenerationRequest,
    GenerationResult,
    ProviderDiagnostics,
)
from src.generation.config import WanImageConfig
from src.generation.sizing import validate_explicit_output_size

TRANSIENT_HTTP_STATUSES = {408, 425, 429, 500, 502, 503, 504}
TERMINAL_TASK_STATUSES = {"FAILED", "CANCELED", "UNKNOWN"}
REDIRECT_STATUSES = {301, 302, 303, 307, 308}
_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class _WanResponse:
    payload: dict[str, Any]
    http_status: int
    request_id: str | None
    task_id: str | None
    task_status: str | None
    provider_error_code: str | None
    provider_message: str | None


class _TransientWanError(GenerationProviderError):
    pass


class WanImageProvider:
    """Asynchronous Wan 2.7 image editor behind the provider-neutral contract."""

    def __init__(
        self,
        config: WanImageConfig,
        *,
        session_factory: Callable[..., Any] = aiohttp.ClientSession,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._config = config
        self._session_factory = session_factory
        self._sleep = sleep
        self._clock = clock

    @property
    def name(self) -> str:
        return "alibaba_model_studio"

    async def edit(self, request: GenerationRequest) -> GenerationResult:
        self._validate_request(request)
        vehicle_uri = _encode_image(
            request.vehicle_image,
            request.vehicle_content_type,
            max_bytes=self._config.max_input_bytes,
        )
        rim_uri = _encode_image(
            request.rim_reference_image,
            request.rim_reference_content_type,
            max_bytes=self._config.max_input_bytes,
        )
        payload = self._build_payload(request, vehicle_uri, rim_uri)
        started = self._clock()
        submit_response: _WanResponse | None = None
        poll_diagnostics: ProviderDiagnostics | None = None
        timeout = aiohttp.ClientTimeout(total=self._config.http_timeout_sec)
        try:
            async with self._session_factory(
                timeout=timeout,
                trust_env=False,
                auto_decompress=True,
            ) as session:
                submit_response = await self._submit_task(session, payload)
                task_id = submit_response.task_id
                if not task_id:
                    raise GenerationProviderError(
                        "provider_response_error",
                        "Wan submission response has no task ID",
                        diagnostics=_response_diagnostics(submit_response),
                    )
                completed, poll_diagnostics = await self._poll_task(
                    session,
                    task_id,
                    request_id=submit_response.request_id,
                )
                result_url = _extract_result_url(completed)
                if not result_url:
                    raise GenerationProviderError(
                        "provider_result_download_error",
                        "Wan succeeded without an image result URL",
                        diagnostics=poll_diagnostics,
                    )
                data, content_type, output_width, output_height = await self._download_result(
                    session,
                    result_url,
                    context=poll_diagnostics,
                )
        except GenerationProviderError as exc:
            if exc.diagnostics is None and poll_diagnostics is not None:
                raise GenerationProviderError(
                    exc.code,
                    str(exc),
                    diagnostics=poll_diagnostics,
                ) from exc
            raise

        latency_ms = max(0, round((self._clock() - started) * 1000))
        request_id = completed.request_id or (
            submit_response.request_id if submit_response else None
        )
        return GenerationResult(
            image_bytes=data,
            content_type=content_type,
            provider="alibaba_model_studio",
            model=self._config.model,
            provider_request_id=request_id,
            provider_task_id=completed.task_id,
            latency_ms=latency_ms,
            billed_image_count=1,
            output_width=output_width,
            output_height=output_height,
            diagnostics=poll_diagnostics,
            generation_cost=self._config.estimated_cost_usd,
        )

    def _validate_request(self, request: GenerationRequest) -> None:
        if len(request.instruction) > 2_000:
            raise GenerationProviderError(
                "provider_input_error", "Generation instruction exceeds 2,000 characters"
            )
        validate_explicit_output_size(request.output_width, request.output_height)

    def _build_payload(
        self,
        request: GenerationRequest,
        vehicle_uri: str,
        rim_uri: str,
    ) -> dict[str, Any]:
        parameters: dict[str, Any] = {
            "size": f"{request.output_width}*{request.output_height}",
            "n": 1,
            "watermark": False,
        }
        if request.seed is not None:
            parameters["seed"] = request.seed
        if request.edit_regions is not None:
            parameters["bbox_list"] = [
                [[x1, y1, x2, y2] for x1, y1, x2, y2 in request.edit_regions],
                [],
            ]
        return {
            "model": self._config.model,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"image": vehicle_uri},
                            {"image": rim_uri},
                            {"text": request.instruction.strip()},
                        ],
                    }
                ]
            },
            "parameters": parameters,
        }

    async def _submit_task(self, session: Any, payload: dict[str, Any]) -> _WanResponse:
        url = f"{self._config.api_base_url}/services/aigc/image-generation/generation"
        try:
            async with session.post(
                url,
                json=payload,
                headers=self._headers(async_request=True),
                allow_redirects=False,
            ) as response:
                return await _parse_response(
                    response,
                    action="submit Wan task",
                    secret=self._config.api_key,
                )
        except GenerationProviderError:
            raise
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise GenerationProviderError(
                "provider_submission_uncertain",
                "Wan submission outcome is uncertain",
            ) from exc

    async def _poll_task(
        self,
        session: Any,
        task_id: str,
        *,
        request_id: str | None,
    ) -> tuple[_WanResponse, ProviderDiagnostics]:
        deadline = self._clock() + self._config.task_timeout_sec
        transient_errors = 0
        attempts = 0
        transitions: list[str] = []
        while self._clock() < deadline:
            attempts += 1
            try:
                task = await self._fetch_task(session, task_id)
                transient_errors = 0
            except _TransientWanError as exc:
                transient_errors += 1
                if transient_errors > self._config.max_poll_errors:
                    failure_code = (
                        "provider_rate_limited"
                        if exc.code == "provider_rate_limited"
                        else "provider_unavailable"
                    )
                    raise GenerationProviderError(
                        failure_code,
                        "Wan polling failed repeatedly",
                        diagnostics=_merge_diagnostics(
                            exc.diagnostics,
                            request_id=request_id,
                            task_id=task_id,
                            poll_attempts=attempts,
                            transitions=transitions,
                        ),
                    ) from exc
                await self._sleep(self._config.poll_initial_sec)
                continue

            status = task.task_status
            if status:
                transitions.append(status)
            diagnostics = _response_diagnostics(
                task,
                task_id=task_id,
                poll_attempts=attempts,
                transitions=transitions,
            )
            if diagnostics.request_id is None and request_id:
                diagnostics = _merge_diagnostics(diagnostics, request_id=request_id)
            if status == "SUCCEEDED":
                return task, diagnostics
            if status in TERMINAL_TASK_STATUSES:
                raise GenerationProviderError(
                    "provider_task_failed",
                    f"Wan task ended with {status}",
                    diagnostics=diagnostics,
                )
            if status not in {"PENDING", "RUNNING"}:
                raise GenerationProviderError(
                    "provider_response_error",
                    "Wan task status is malformed",
                    diagnostics=diagnostics,
                )
            await self._sleep(self._config.poll_initial_sec)
        raise GenerationProviderError(
            "provider_task_timeout",
            "Wan task polling timed out",
            diagnostics=ProviderDiagnostics(
                request_id=request_id,
                task_id=task_id,
                poll_attempts=attempts,
                status_transitions=tuple(transitions),
            ),
        )

    async def _fetch_task(self, session: Any, task_id: str) -> _WanResponse:
        url = f"{self._config.api_base_url}/tasks/{task_id}"
        try:
            async with session.get(
                url,
                headers=self._headers(),
                allow_redirects=False,
            ) as response:
                return await _parse_response(
                    response,
                    action="poll Wan task",
                    transient=True,
                    secret=self._config.api_key,
                )
        except _TransientWanError:
            raise
        except GenerationProviderError:
            raise
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise _TransientWanError(
                "provider_unavailable",
                "Wan polling transport failed",
            ) from exc

    async def _download_result(
        self,
        session: Any,
        url: str,
        *,
        context: ProviderDiagnostics | None,
    ) -> tuple[bytes, str, int, int]:
        current_url = url
        for redirect_count in range(self._config.result_max_redirects + 1):
            _validate_result_url(current_url, self._config.result_allowed_host_suffixes)
            try:
                async with session.get(
                    current_url,
                    headers={"Accept": "image/*"},
                    allow_redirects=False,
                ) as response:
                    if response.status in REDIRECT_STATUSES:
                        location = response.headers.get("Location")
                        if not location or redirect_count >= self._config.result_max_redirects:
                            raise GenerationProviderError(
                                "provider_result_download_error",
                                "Wan result redirect limit exceeded",
                                diagnostics=context,
                            )
                        current_url = urljoin(current_url, location)
                        continue
                    return await self._read_result_response(response, context=context)
            except GenerationProviderError:
                raise
            except (aiohttp.ClientError, TimeoutError) as exc:
                raise GenerationProviderError(
                    "provider_result_download_error",
                    "Wan result download transport failed",
                    diagnostics=context,
                ) from exc
        raise GenerationProviderError(
            "provider_result_download_error",
            "Wan result redirect limit exceeded",
            diagnostics=context,
        )

    async def _read_result_response(
        self,
        response: Any,
        *,
        context: ProviderDiagnostics | None,
    ) -> tuple[bytes, str, int, int]:
        if response.status != 200:
            raise GenerationProviderError(
                "provider_result_download_error",
                "Wan result download failed",
                diagnostics=_merge_diagnostics(context, http_status=response.status),
            )
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
        if not content_type.startswith("image/"):
            raise GenerationProviderError(
                "provider_result_download_error",
                "Wan result MIME is not an image",
                diagnostics=context,
            )
        content_length = response.headers.get("Content-Length")
        if content_length:
            try:
                declared_length = int(content_length)
            except (TypeError, ValueError) as exc:
                raise GenerationProviderError(
                    "provider_result_download_error",
                    "Wan result Content-Length is invalid",
                    diagnostics=context,
                ) from exc
            if declared_length > self._config.max_output_bytes:
                raise GenerationProviderError(
                    "provider_result_download_error",
                    "Wan result exceeds configured output size",
                    diagnostics=context,
                )
        body = bytearray()
        async for chunk in response.content.iter_chunked(64 * 1024):
            body.extend(chunk)
            if len(body) > self._config.max_output_bytes:
                raise GenerationProviderError(
                    "provider_result_download_error",
                    "Wan result exceeds configured output size",
                    diagnostics=context,
                )
        data = bytes(body)
        output_width, output_height = _validate_output_image(data, context=context)
        return data, content_type, output_width, output_height

    def _headers(self, *, async_request: bool = False) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._config.api_key}",
            "Accept": "application/json",
        }
        if async_request:
            headers["Content-Type"] = "application/json"
            headers["X-DashScope-Async"] = "enable"
        return headers


async def _parse_response(
    response: Any,
    *,
    action: str,
    secret: str,
    transient: bool = False,
) -> _WanResponse:
    try:
        payload = await response.json(content_type=None)
    except (TypeError, ValueError) as exc:
        raise GenerationProviderError(
            "provider_response_error",
            f"Alibaba returned malformed JSON while trying to {action}",
            diagnostics=ProviderDiagnostics(http_status=response.status),
        ) from exc
    if not isinstance(payload, dict):
        raise GenerationProviderError(
            "provider_response_error",
            f"Alibaba returned malformed JSON while trying to {action}",
            diagnostics=ProviderDiagnostics(http_status=response.status),
        )
    output = payload.get("output") if isinstance(payload.get("output"), dict) else {}
    parsed = _WanResponse(
        payload=payload,
        http_status=response.status,
        request_id=_optional_text(payload.get("request_id")),
        task_id=_optional_text(output.get("task_id")),
        task_status=_optional_text(output.get("task_status")),
        provider_error_code=_safe_detail(
            _optional_text(payload.get("code")) or _optional_text(output.get("code")),
            secret=secret,
        ),
        provider_message=_safe_detail(
            _optional_text(payload.get("message")) or _optional_text(output.get("message")),
            secret=secret,
        ),
    )
    if response.status != 200:
        detail = _safe_detail(
            parsed.provider_message or parsed.provider_error_code or f"HTTP {response.status}",
            secret=secret,
        )
        diagnostics = _response_diagnostics(parsed)
        if transient and response.status in TRANSIENT_HTTP_STATUSES:
            raise _TransientWanError(
                _http_error_code(response.status),
                f"{action} temporarily unavailable",
                diagnostics=diagnostics,
            )
        raise GenerationProviderError(
            _http_error_code(response.status),
            f"{action} failed: {detail}",
            diagnostics=diagnostics,
        )
    if parsed.provider_error_code and not parsed.task_status:
        raise GenerationProviderError(
            "provider_response_error",
            f"{action} returned an error",
            diagnostics=_response_diagnostics(parsed),
        )
    return parsed


def _http_error_code(status: int) -> str:
    if status in {401, 403}:
        return "provider_auth_error"
    if status == 429:
        return "provider_rate_limited"
    if status in {400, 422}:
        return "provider_content_rejected"
    if status in TRANSIENT_HTTP_STATUSES:
        return "provider_unavailable"
    return "provider_response_error"


def _encode_image(data: bytes, content_type: str, *, max_bytes: int) -> str:
    if len(data) > max_bytes:
        raise GenerationProviderError(
            "provider_input_error", "Wan input image exceeds configured byte limit"
        )
    declared_type = content_type.split(";", 1)[0].strip().lower()
    try:
        with Image.open(BytesIO(data)) as image:
            if image.width * image.height > 64_000_000:
                raise GenerationProviderError(
                    "provider_input_error", "Wan input image exceeds 64 megapixels"
                )
            image.load()
            detected_type = Image.MIME.get(image.format or "", "").lower()
    except GenerationProviderError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise GenerationProviderError(
            "provider_input_error", "Wan input is not a supported image"
        ) from exc
    if not detected_type or detected_type != declared_type:
        raise GenerationProviderError(
            "provider_input_error", "Wan input content type does not match image bytes"
        )
    return f"data:{declared_type};base64," + base64.b64encode(data).decode("ascii")


def _validate_output_image(
    data: bytes,
    *,
    context: ProviderDiagnostics | None,
) -> tuple[int, int]:
    try:
        with Image.open(BytesIO(data)) as image:
            image.load()
            return image.width, image.height
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise GenerationProviderError(
            "provider_result_download_error",
            "Wan result is not a valid image",
            diagnostics=context,
        ) from exc


def _extract_result_url(response: _WanResponse) -> str | None:
    output = response.payload.get("output")
    if not isinstance(output, dict):
        return None
    choices = output.get("choices")
    if not isinstance(choices, list):
        return None
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        message = choice.get("message")
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if not isinstance(content, list):
            continue
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("image"), str):
                return item["image"]
    return None


def _validate_result_url(url: str, suffixes: tuple[str, ...]) -> None:
    try:
        parsed = urlsplit(url)
    except ValueError as exc:
        raise GenerationProviderError(
            "provider_result_download_error", "Wan result URL is malformed"
        ) from exc
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        raise GenerationProviderError("provider_result_download_error", "Wan result URL is unsafe")
    if not any(host == suffix or host.endswith(f".{suffix}") for suffix in suffixes):
        raise GenerationProviderError(
            "provider_result_download_error", "Wan result host is not allowed"
        )


def _response_diagnostics(
    response: _WanResponse,
    *,
    task_id: str | None = None,
    poll_attempts: int = 0,
    transitions: list[str] | tuple[str, ...] = (),
) -> ProviderDiagnostics:
    return ProviderDiagnostics(
        http_status=response.http_status,
        request_id=response.request_id,
        task_id=task_id or response.task_id,
        raw_task_status=response.task_status,
        provider_error_code=response.provider_error_code,
        provider_message=_safe_detail(response.provider_message),
        poll_attempts=poll_attempts,
        status_transitions=tuple(transitions),
    )


def _merge_diagnostics(
    current: ProviderDiagnostics | None,
    *,
    http_status: int | None = None,
    request_id: str | None = None,
    task_id: str | None = None,
    poll_attempts: int | None = None,
    transitions: list[str] | tuple[str, ...] | None = None,
) -> ProviderDiagnostics:
    current = current or ProviderDiagnostics()
    return ProviderDiagnostics(
        http_status=http_status if http_status is not None else current.http_status,
        request_id=request_id or current.request_id,
        task_id=task_id or current.task_id,
        raw_task_status=current.raw_task_status,
        provider_error_code=current.provider_error_code,
        provider_message=current.provider_message,
        poll_attempts=poll_attempts if poll_attempts is not None else current.poll_attempts,
        status_transitions=(
            tuple(transitions) if transitions is not None else current.status_transitions
        ),
        extra=current.extra,
    )


def _optional_text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _safe_detail(value: Any, *, secret: str | None = None) -> str | None:
    if value is None:
        return None
    detail = " ".join(str(value).split())
    if secret:
        detail = detail.replace(secret, "[redacted]")
    detail = _URL_RE.sub("[url-redacted]", detail)
    return detail[:240] or None
