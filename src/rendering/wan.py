"""Async Alibaba Cloud Model Studio connector for Wan image editing."""

import asyncio
import base64
import re
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any
from urllib.parse import urljoin, urlsplit

import aiohttp
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.rendering.base import (
    GeneratedImage,
    ImageEditRequest,
    ImageProviderConfigError,
    ImageProviderError,
    ImageProviderInputError,
)

_TRANSIENT_HTTP_STATUSES = {408, 425, 429, 500, 502, 503, 504}
_TERMINAL_FAILURE_STATUSES = {"FAILED", "CANCELED", "UNKNOWN"}
_SUPPORTED_MODELS = {"wan2.6-image", "wan2.7-image", "wan2.7-image-pro"}
_PIXEL_SIZE_RE = re.compile(r"(?P<width>\d{3,4})\*(?P<height>\d{3,4})")


class _WanContent(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str | None = None
    image: str | None = None


class _WanMessage(BaseModel):
    model_config = ConfigDict(extra="allow")

    content: list[_WanContent] = Field(default_factory=list)


class _WanChoice(BaseModel):
    model_config = ConfigDict(extra="allow")

    message: _WanMessage | None = None


class _WanOutput(BaseModel):
    model_config = ConfigDict(extra="allow")

    task_id: str | None = None
    task_status: str | None = None
    choices: list[_WanChoice] = Field(default_factory=list)


class _WanResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    output: _WanOutput | None = None
    usage: dict[str, Any] = Field(default_factory=dict)
    request_id: str | None = None
    code: str | None = None
    message: str | None = None


@dataclass(frozen=True, slots=True)
class WanImageConfig:
    api_key: str
    base_url: str
    model: str = "wan2.7-image"
    output_size: str = "2K"
    watermark: bool = False
    poll_interval_seconds: float = 5.0
    task_timeout_seconds: float = 300.0
    request_timeout_seconds: float = 30.0
    max_poll_errors: int = 3
    max_input_bytes: int = 10 * 1024 * 1024
    max_output_bytes: int = 20 * 1024 * 1024
    max_result_redirects: int = 2
    result_allowed_host_suffixes: tuple[str, ...] = field(default_factory=lambda: ("aliyuncs.com",))

    def __post_init__(self) -> None:
        api_key = self.api_key.strip()
        base_url = self.base_url.rstrip("/")
        parsed = urlsplit(base_url)
        host = (parsed.hostname or "").lower()
        if not api_key:
            raise ImageProviderConfigError("WAN_API_KEY or DASHSCOPE_API_KEY is required")
        if (
            parsed.scheme != "https"
            or not host
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            raise ImageProviderConfigError("WAN_BASE_URL must be a clean HTTPS API base URL")
        if not (host == "aliyuncs.com" or host.endswith(".aliyuncs.com")):
            raise ImageProviderConfigError("WAN_BASE_URL must point to Alibaba Cloud")
        if not parsed.path.rstrip("/").endswith("/api/v1"):
            raise ImageProviderConfigError("WAN_BASE_URL must end with /api/v1")
        if self.model not in _SUPPORTED_MODELS:
            raise ImageProviderConfigError(f"Unsupported Wan image model: {self.model}")
        if self.poll_interval_seconds <= 0 or self.task_timeout_seconds <= 0:
            raise ImageProviderConfigError("Wan polling intervals must be positive")
        if (
            self.request_timeout_seconds <= 0
            or self.max_poll_errors < 0
            or self.max_result_redirects < 0
        ):
            raise ImageProviderConfigError("Wan HTTP limits are invalid")
        if self.max_input_bytes <= 0 or self.max_output_bytes <= 0:
            raise ImageProviderConfigError("Wan image byte limits must be positive")
        suffixes = tuple(suffix.lower().lstrip(".") for suffix in self.result_allowed_host_suffixes)
        if not suffixes or any(not suffix for suffix in suffixes):
            raise ImageProviderConfigError("Wan result host suffix allowlist cannot be empty")
        object.__setattr__(self, "api_key", api_key)
        object.__setattr__(self, "base_url", base_url)
        object.__setattr__(self, "result_allowed_host_suffixes", suffixes)


@dataclass(frozen=True, slots=True)
class _EncodedImage:
    data_uri: str
    source_width: int
    source_height: int
    encoded_width: int
    encoded_height: int


class _TransientWanError(ImageProviderError):
    pass


class WanImageProvider:
    """Wan2.6/2.7 asynchronous image-editing provider."""

    def __init__(
        self,
        config: WanImageConfig,
        *,
        session_factory: Any = aiohttp.ClientSession,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._config = config
        self._session_factory = session_factory
        self._sleep = sleep
        self._clock = clock

    @property
    def name(self) -> str:
        return "wan"

    async def edit(self, request: ImageEditRequest) -> tuple[GeneratedImage, ...]:
        self._validate_request(request)
        encoded_images = tuple(
            _encode_image(image, max_bytes=self._config.max_input_bytes) for image in request.images
        )
        payload = self._build_payload(request, encoded_images)
        timeout = aiohttp.ClientTimeout(total=self._config.request_timeout_seconds)
        async with self._session_factory(
            timeout=timeout,
            trust_env=False,
            auto_decompress=True,
        ) as session:
            submitted = await self._submit_task(session, payload)
            task_id = submitted.output.task_id if submitted.output else None
            if not task_id:
                raise ImageProviderError("Wan task submission returned no task_id")
            completed = await self._wait_for_task(session, task_id)
            image_urls = _extract_image_urls(completed)
            if not image_urls:
                raise ImageProviderError("Wan task succeeded without image output")
            images = []
            for image_url in image_urls:
                data, content_type = await self._download_result(session, image_url)
                images.append(
                    GeneratedImage(
                        data=data,
                        content_type=content_type,
                        provider=self.name,
                        model=self._config.model,
                        request_id=completed.request_id or submitted.request_id,
                        task_id=task_id,
                        usage=dict(completed.usage),
                    )
                )
            return tuple(images)

    def _validate_request(self, request: ImageEditRequest) -> None:
        max_images = 9 if self._config.model.startswith("wan2.7-") else 4
        if len(request.images) > max_images:
            raise ImageProviderInputError(
                f"{self._config.model} accepts at most {max_images} input images"
            )
        if len(request.prompt) > 2_000:
            raise ImageProviderInputError("Wan prompt exceeds 2,000 characters")
        _validate_edit_size(request.size or self._config.output_size, model=self._config.model)
        if request.bbox_list is not None:
            if not self._config.model.startswith("wan2.7-"):
                raise ImageProviderInputError("bbox_list is supported only by Wan2.7 image models")
            for boxes in request.bbox_list:
                if len(boxes) > 2:
                    raise ImageProviderInputError("Wan2.7 supports at most two boxes per image")
                for x1, y1, x2, y2 in boxes:
                    if min(x1, y1, x2, y2) < 0 or x2 <= x1 or y2 <= y1:
                        raise ImageProviderInputError("Wan bounding box coordinates are invalid")

    def _build_payload(
        self,
        request: ImageEditRequest,
        images: Sequence[_EncodedImage],
    ) -> dict[str, Any]:
        content = [{"image": image.data_uri} for image in images]
        content.append({"text": request.prompt.strip()})
        parameters: dict[str, Any] = {
            "size": request.size or self._config.output_size,
            "n": request.n,
            "watermark": self._config.watermark,
        }
        if request.seed is not None:
            parameters["seed"] = request.seed
        if self._config.model == "wan2.6-image":
            parameters["enable_interleave"] = False
            parameters["prompt_extend"] = False
        if request.bbox_list is not None:
            parameters["bbox_list"] = [
                [_scale_box(box, image) for box in boxes]
                for boxes, image in zip(request.bbox_list, images, strict=True)
            ]
        return {
            "model": self._config.model,
            "input": {"messages": [{"role": "user", "content": content}]},
            "parameters": parameters,
        }

    async def _submit_task(self, session: Any, payload: dict[str, Any]) -> _WanResponse:
        url = f"{self._config.base_url}/services/aigc/image-generation/generation"
        try:
            async with session.post(
                url,
                json=payload,
                headers=self._headers(async_request=True),
                allow_redirects=False,
            ) as response:
                return await _parse_response(response, action="submit Wan task")
        except (aiohttp.ClientError, TimeoutError) as exc:
            # Retrying a timed-out POST can create a second billable task.
            raise ImageProviderError("Wan task submission transport failed") from exc

    async def _wait_for_task(self, session: Any, task_id: str) -> _WanResponse:
        deadline = self._clock() + self._config.task_timeout_seconds
        transient_errors = 0
        while self._clock() < deadline:
            try:
                task = await self._fetch_task(session, task_id)
                transient_errors = 0
            except _TransientWanError:
                transient_errors += 1
                if transient_errors > self._config.max_poll_errors:
                    raise ImageProviderError("Wan task polling failed repeatedly")
                await self._sleep(self._config.poll_interval_seconds)
                continue

            status = (task.output.task_status if task.output else "") or ""
            if status == "SUCCEEDED":
                return task
            if status in _TERMINAL_FAILURE_STATUSES:
                detail = _safe_detail(task.code or task.message or status)
                raise ImageProviderError(f"Wan task ended with {status}: {detail}")
            if status not in {"PENDING", "RUNNING"}:
                raise ImageProviderError(
                    f"Wan task returned unexpected status: {status or 'empty'}"
                )
            await self._sleep(self._config.poll_interval_seconds)
        raise ImageProviderError("Wan task polling timed out")

    async def _fetch_task(self, session: Any, task_id: str) -> _WanResponse:
        url = f"{self._config.base_url}/tasks/{task_id}"
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
                )
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise _TransientWanError("Wan polling transport failed") from exc

    async def _download_result(self, session: Any, url: str) -> tuple[bytes, str]:
        current_url = url
        for redirect_count in range(self._config.max_result_redirects + 1):
            _validate_result_url(current_url, self._config.result_allowed_host_suffixes)
            try:
                response_context = session.get(
                    current_url,
                    headers={"Accept": "image/*"},
                    allow_redirects=False,
                )
            except (aiohttp.ClientError, TimeoutError) as exc:
                raise ImageProviderError("Wan result download transport failed") from exc
            try:
                async with response_context as response:
                    if response.status in {301, 302, 303, 307, 308}:
                        location = response.headers.get("Location")
                        if not location or redirect_count >= self._config.max_result_redirects:
                            raise ImageProviderError("Wan result redirect is invalid")
                        current_url = urljoin(current_url, location)
                        continue
                    return await self._read_result_response(response)
            except (aiohttp.ClientError, TimeoutError) as exc:
                raise ImageProviderError("Wan result download transport failed") from exc
        raise ImageProviderError("Wan result redirect limit exceeded")

    async def _read_result_response(self, response: Any) -> tuple[bytes, str]:
        if response.status != 200:
            raise ImageProviderError(f"Wan result download failed with HTTP {response.status}")
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
        if not content_type.startswith("image/"):
            raise ImageProviderError("Wan result response is not an image")
        content_length = response.headers.get("Content-Length")
        if content_length:
            try:
                declared_length = int(content_length)
            except ValueError as exc:
                raise ImageProviderError("Wan result has invalid Content-Length") from exc
            if declared_length > self._config.max_output_bytes:
                raise ImageProviderError("Wan result exceeds configured output size")
        body = bytearray()
        async for chunk in response.content.iter_chunked(64 * 1024):
            body.extend(chunk)
            if len(body) > self._config.max_output_bytes:
                raise ImageProviderError("Wan result exceeds configured output size")
        data = bytes(body)
        _verify_output_image(data)
        return data, content_type

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
    transient: bool = False,
) -> _WanResponse:
    try:
        payload = await response.json(content_type=None)
        parsed = _WanResponse.model_validate(payload)
    except (ValueError, ValidationError) as exc:
        raise ImageProviderError(f"Alibaba returned invalid JSON while trying to {action}") from exc

    if response.status != 200:
        detail = _safe_detail(parsed.code or parsed.message or f"HTTP {response.status}")
        if transient and response.status in _TRANSIENT_HTTP_STATUSES:
            raise _TransientWanError(f"{action} failed: {detail}")
        raise ImageProviderError(f"{action} failed: {detail}")
    if parsed.code:
        raise ImageProviderError(f"{action} failed: {_safe_detail(parsed.code)}")
    return parsed


def _encode_image(data: bytes, *, max_bytes: int) -> _EncodedImage:
    try:
        with Image.open(BytesIO(data)) as opened:
            opened_width, opened_height = opened.size
            if opened_width * opened_height > 64_000_000:
                raise ImageProviderInputError("Wan input image exceeds 64 megapixels")
            opened.load()
            image = ImageOps.exif_transpose(opened)
            source_width, source_height = image.size
            image = _resize_for_wan(image)
            if image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info):
                rgba = image.convert("RGBA")
                background = Image.new("RGBA", rgba.size, "white")
                background.alpha_composite(rgba)
                image = background.convert("RGB")
            else:
                image = image.convert("RGB")
            encoded_width, encoded_height = image.size
            encoded = _encode_jpeg_with_limit(image, max_bytes=max_bytes)
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise ImageProviderInputError("Wan input is not a supported image") from exc
    return _EncodedImage(
        data_uri=f"data:image/jpeg;base64,{base64.b64encode(encoded).decode('ascii')}",
        source_width=source_width,
        source_height=source_height,
        encoded_width=encoded_width,
        encoded_height=encoded_height,
    )


def _encode_jpeg_with_limit(image: Image.Image, *, max_bytes: int) -> bytes:
    for quality in (95, 90, 85, 80):
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
        encoded = buffer.getvalue()
        if len(encoded) <= max_bytes:
            return encoded
    raise ImageProviderInputError("Wan normalized input exceeds the configured byte limit")


def _resize_for_wan(image: Image.Image) -> Image.Image:
    width, height = image.size
    if width <= 0 or height <= 0:
        raise ImageProviderInputError("Wan input image dimensions are invalid")
    if max(width, height) / min(width, height) > 8:
        raise ImageProviderInputError("Wan input image aspect ratio exceeds 1:8")
    scale = max(240 / min(width, height), 1.0)
    scale = min(scale, 8_000 / max(width, height))
    if scale == 1.0:
        return image.copy()
    size = (round(width * scale), round(height * scale))
    return image.resize(size, Image.Resampling.LANCZOS)


def _scale_box(box: tuple[int, int, int, int], image: _EncodedImage) -> list[int]:
    x_scale = image.encoded_width / image.source_width
    y_scale = image.encoded_height / image.source_height
    x1, y1, x2, y2 = box
    if x2 > image.source_width or y2 > image.source_height:
        raise ImageProviderInputError("Wan bounding box exceeds its source image")
    return [
        round(x1 * x_scale),
        round(y1 * y_scale),
        round(x2 * x_scale),
        round(y2 * y_scale),
    ]


def _extract_image_urls(response: _WanResponse) -> tuple[str, ...]:
    if response.output is None:
        return ()
    return tuple(
        content.image
        for choice in response.output.choices
        if choice.message is not None
        for content in choice.message.content
        if content.type == "image" and content.image
    )


def _validate_edit_size(size: str, *, model: str) -> None:
    if size in {"1K", "2K"}:
        return
    match = _PIXEL_SIZE_RE.fullmatch(size)
    if match is None:
        raise ImageProviderInputError("Wan output size must be 1K, 2K or WIDTH*HEIGHT")
    width = int(match.group("width"))
    height = int(match.group("height"))
    pixels = width * height
    max_aspect_ratio = 4 if model == "wan2.6-image" else 8
    if not 768 * 768 <= pixels <= 2_048 * 2_048:
        raise ImageProviderInputError("Wan editing output pixel count is outside API limits")
    if max(width, height) / min(width, height) > max_aspect_ratio:
        raise ImageProviderInputError("Wan editing output aspect ratio is outside API limits")


def _validate_result_url(url: str, allowed_suffixes: Sequence[str]) -> None:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    if (
        parsed.scheme != "https"
        or not host
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ImageProviderError("Wan returned an unsafe result URL")
    if not any(host == suffix or host.endswith(f".{suffix}") for suffix in allowed_suffixes):
        raise ImageProviderError("Wan result URL host is not allowed")


def _verify_output_image(data: bytes) -> None:
    try:
        with Image.open(BytesIO(data)) as image:
            image.verify()
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise ImageProviderError("Wan returned invalid image bytes") from exc


def _safe_detail(value: str) -> str:
    return " ".join(value.split())[:300]
