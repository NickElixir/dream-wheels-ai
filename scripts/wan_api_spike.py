"""Developer-only Wan 2.7 API spike.

This module is intentionally outside the application runtime. It has no imports
from the jobs, credits, storage, queue, frontend, Telegram or Fitment layers.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit

import aiohttp
from PIL import Image, UnidentifiedImageError

PROMPT_VERSION = "P0_API_SPIKE"
MODEL = "wan2.7-image"
MODEL_PRO = "wan2.7-image-pro"
SUPPORTED_MODELS = frozenset({MODEL, MODEL_PRO})
REGION = "ap-southeast-1"
MAX_OUTPUT_PIXELS = 2048 * 2048
MIN_OUTPUT_PIXELS = 768 * 768
MAX_OUTPUT_ASPECT = 8.0
TRANSIENT_HTTP_STATUSES = {408, 425, 429, 500, 502, 503, 504}
TERMINAL_STATUSES = {"SUCCEEDED", "FAILED", "CANCELED", "UNKNOWN"}

BASELINE_PROMPT = (
    "Replace only the visible wheel rims on the vehicle in image 1 using the supplied rim "
    "reference in image 2. Preserve the vehicle identity, body shape, paint and color, camera "
    "viewpoint and perspective, background and scene, tyre and wheel-arch geometry as much as "
    "possible. Use the supplied rim design faithfully. Return one photorealistic edited photo."
)


def load_local_env(path: Path = Path(".env")) -> None:
    """Load simple local KEY=value entries without overriding exported variables."""
    if not path.is_file():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        name, separator, value = line.partition("=")
        name = name.strip()
        if not separator or not name or name in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[name] = value


class SpikeError(RuntimeError):
    """A sanitized, user-safe spike failure."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class ImageInfo:
    data: bytes
    width: int
    height: int
    content_type: str


@dataclass(frozen=True, slots=True)
class OutputSize:
    width: int
    height: int

    @property
    def value(self) -> str:
        return f"{self.width}*{self.height}"


@dataclass(frozen=True, slots=True)
class SpikeConfig:
    api_key: str
    region: str
    workspace_id: str
    model: str = MODEL
    task_timeout_sec: float = 300.0
    poll_initial_sec: float = 2.0
    http_timeout_sec: float = 30.0
    result_host_suffixes: tuple[str, ...] = ("aliyuncs.com",)

    @property
    def base_url(self) -> str:
        return f"https://{self.workspace_id}.{self.region}.maas.aliyuncs.com/api/v1"

    @classmethod
    def from_env(cls, *, model_override: str | None = None) -> SpikeConfig:
        api_key = os.getenv("WAN_API_KEY", "").strip()
        region = os.getenv("WAN_REGION", "").strip()
        workspace_id = os.getenv("WAN_WORKSPACE_ID", "").strip()
        model = (model_override or os.getenv("WAN_MODEL", "")).strip()
        if not api_key:
            raise SpikeError("provider_config_error", "WAN_API_KEY is required")
        if region != REGION:
            raise SpikeError("provider_config_error", f"WAN_REGION must be {REGION}")
        if not workspace_id or any(char in workspace_id for char in "/?:#@"):
            raise SpikeError("provider_config_error", "WAN_WORKSPACE_ID is invalid")
        if model not in SUPPORTED_MODELS:
            allowed = ", ".join(sorted(SUPPORTED_MODELS))
            raise SpikeError("provider_config_error", f"WAN_MODEL must be one of: {allowed}")
        try:
            return cls(
                api_key=api_key,
                region=region,
                workspace_id=workspace_id,
                model=model,
                task_timeout_sec=float(os.getenv("WAN_TASK_TIMEOUT_SEC", "300")),
                poll_initial_sec=float(os.getenv("WAN_POLL_INITIAL_SEC", "2")),
                http_timeout_sec=float(os.getenv("WAN_HTTP_TIMEOUT_SEC", "30")),
            )
        except ValueError as exc:
            raise SpikeError("provider_config_error", "WAN timing settings are invalid") from exc


def inspect_image(data: bytes, *, role: str) -> ImageInfo:
    try:
        with Image.open(BytesIO(data)) as image:
            image.load()
            content_type = Image.MIME.get(image.format or "")
            if not content_type or not content_type.startswith("image/"):
                raise SpikeError("provider_input_error", f"Unsupported {role} image format")
            return ImageInfo(data, image.width, image.height, content_type)
    except SpikeError:
        raise
    except (UnidentifiedImageError, OSError) as exc:
        raise SpikeError("provider_input_error", f"Invalid {role} image") from exc


def vehicle_output_size(width: int, height: int) -> OutputSize:
    """Return the largest API-compatible integer size preserving vehicle ratio."""
    if width <= 0 or height <= 0:
        raise SpikeError("provider_input_error", "Vehicle image dimensions are invalid")
    ratio = width / height
    if max(ratio, 1 / ratio) > MAX_OUTPUT_ASPECT:
        raise SpikeError("provider_input_error", "Vehicle aspect ratio exceeds Wan limits")

    scale = (MAX_OUTPUT_PIXELS / (width * height)) ** 0.5
    if scale > 1:
        scale = (MIN_OUTPUT_PIXELS / (width * height)) ** 0.5
    scale = min(scale, 1.0 if width * height >= MIN_OUTPUT_PIXELS else scale)
    out_width = max(1, round(width * scale))
    out_height = max(1, round(height * scale))
    while out_width * out_height > MAX_OUTPUT_PIXELS:
        if out_width >= out_height:
            out_width -= 1
        else:
            out_height -= 1
    while out_width * out_height < MIN_OUTPUT_PIXELS:
        next_width = out_width + 1
        next_height = out_height + 1
        if next_width * next_height > MAX_OUTPUT_PIXELS:
            break
        if abs(next_width / next_height - ratio) <= abs(out_width / out_height - ratio):
            out_width, out_height = next_width, next_height
        else:
            break
    return OutputSize(out_width, out_height)


def _data_uri(image: ImageInfo) -> str:
    return f"data:{image.content_type};base64," + base64.b64encode(image.data).decode("ascii")


def build_payload(
    vehicle: ImageInfo,
    rim_reference: ImageInfo,
    size: OutputSize,
    *,
    model: str = MODEL,
    prompt: str = BASELINE_PROMPT,
) -> dict[str, Any]:
    return {
        "model": model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"image": _data_uri(vehicle)},
                        {"image": _data_uri(rim_reference)},
                        {"text": prompt},
                    ],
                }
            ]
        },
        "parameters": {"size": size.value, "n": 1, "watermark": False},
    }


def _safe_message(value: Any, *, secret: str | None = None) -> str:
    text = " ".join(str(value or "provider error").split())
    if secret:
        text = text.replace(secret, "[redacted]")
    return text[:240]


def _response_code(status: int, payload: dict[str, Any]) -> str:
    if status == 401 or status == 403:
        return "provider_auth_error"
    if status == 429:
        return "provider_rate_limited"
    if status in {400, 422}:
        return "provider_content_rejected"
    if status in TRANSIENT_HTTP_STATUSES:
        return "provider_unavailable"
    return "provider_response_error"


class WanApiSpike:
    def __init__(
        self,
        config: SpikeConfig,
        *,
        session_factory: Callable[..., Any] = aiohttp.ClientSession,
        sleep: Callable[[float], Any] = asyncio.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.config = config
        self.session_factory = session_factory
        self.sleep = sleep
        self.clock = clock

    async def run(
        self,
        vehicle_path: Path,
        rim_path: Path,
        output_dir: Path,
        *,
        case_id: str | None = None,
        prompt: str = BASELINE_PROMPT,
        prompt_version: str = PROMPT_VERSION,
    ) -> dict[str, Any]:
        vehicle = inspect_image(await asyncio.to_thread(vehicle_path.read_bytes), role="vehicle")
        rim = inspect_image(await asyncio.to_thread(rim_path.read_bytes), role="rim reference")
        size = vehicle_output_size(vehicle.width, vehicle.height)
        payload = build_payload(
            vehicle,
            rim,
            size,
            model=self.config.model,
            prompt=prompt,
        )
        started = datetime.now(UTC)
        timeout = aiohttp.ClientTimeout(total=self.config.http_timeout_sec)
        try:
            async with self.session_factory(timeout=timeout, trust_env=False) as session:
                submitted = await self._submit(session, payload)
                task_id = self._required_task_id(submitted)
                request_id = submitted.get("request_id")
                completed = await self._poll(session, task_id)
                result_url = self._required_result_url(completed)
                data, mime = await self._download(session, result_url)
        except SpikeError:
            raise
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise SpikeError("provider_unavailable", "Wan transport failed") from exc
        completed_at = datetime.now(UTC)
        try:
            result = inspect_image(data, role="provider result")
        except SpikeError as exc:
            raise SpikeError(
                "provider_result_download_error", "Wan result is not a valid image"
            ) from exc
        await asyncio.to_thread(output_dir.mkdir, parents=True, exist_ok=True)
        result_path = output_dir / f"wan-result{self._extension(mime)}"
        await asyncio.to_thread(result_path.write_bytes, data)
        report = {
            "case_id": case_id or f"{vehicle_path.stem}__{rim_path.stem}",
            "provider": "alibaba_model_studio",
            "model": self.config.model,
            "region": self.config.region,
            "prompt_version": prompt_version,
            "vehicle_input_width": vehicle.width,
            "vehicle_input_height": vehicle.height,
            "rim_input_width": rim.width,
            "rim_input_height": rim.height,
            "requested_output_width": size.width,
            "requested_output_height": size.height,
            "actual_output_width": result.width,
            "actual_output_height": result.height,
            "output_mime": mime,
            "output_bytes": len(data),
            "provider_request_id": request_id,
            "provider_task_id": task_id,
            "submission_timestamp": started.isoformat(),
            "completion_timestamp": completed_at.isoformat(),
            "latency_ms": round((completed_at - started).total_seconds() * 1000),
            "status": "SUCCEEDED",
            "task_status": "SUCCEEDED",
            "local_result_path": str(result_path),
        }
        evidence_path = output_dir / "wan-evidence.json"
        await asyncio.to_thread(evidence_path.write_text, json.dumps(report, indent=2) + "\n")
        return report

    async def _submit(self, session: Any, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.config.base_url}/services/aigc/image-generation/generation"
        try:
            async with session.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.config.api_key}",
                    "Content-Type": "application/json",
                    "X-DashScope-Async": "enable",
                },
                allow_redirects=False,
            ) as response:
                body = await self._json(response)
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise SpikeError(
                "provider_submission_uncertain", "Wan submission outcome is uncertain"
            ) from exc
        if response.status != 200:
            raise SpikeError(
                _response_code(response.status, body),
                _safe_message(body.get("message"), secret=self.config.api_key),
            )
        if not isinstance(body.get("output"), dict):
            raise SpikeError("provider_response_error", "Wan submission response is malformed")
        return body

    async def _poll(self, session: Any, task_id: str) -> dict[str, Any]:
        deadline = self.clock() + self.config.task_timeout_sec
        delay = self.config.poll_initial_sec
        transient_errors = 0
        while self.clock() < deadline:
            try:
                async with session.get(
                    f"{self.config.base_url}/tasks/{task_id}",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    allow_redirects=False,
                ) as response:
                    body = await self._json(response)
            except (aiohttp.ClientError, TimeoutError):
                transient_errors += 1
                if transient_errors > 3:
                    raise SpikeError("provider_unavailable", "Wan polling failed repeatedly")
                await self.sleep(delay)
                continue
            if response.status != 200:
                if response.status in TRANSIENT_HTTP_STATUSES and transient_errors < 3:
                    transient_errors += 1
                    await self.sleep(delay)
                    continue
                raise SpikeError(
                    _response_code(response.status, body),
                    _safe_message(body.get("message"), secret=self.config.api_key),
                )
            transient_errors = 0
            output = body.get("output")
            status = output.get("task_status") if isinstance(output, dict) else None
            if status == "SUCCEEDED":
                return body
            if status in {"FAILED", "CANCELED", "UNKNOWN"}:
                raise SpikeError("provider_task_failed", f"Wan task ended with {status}")
            if status not in {"PENDING", "RUNNING"}:
                raise SpikeError("provider_response_error", "Wan task status is malformed")
            await self.sleep(delay)
        raise SpikeError("provider_task_timeout", "Wan task polling timed out")

    async def _download(self, session: Any, url: str) -> tuple[bytes, str]:
        current_url = url
        for _ in range(3):
            self._validate_result_url(current_url)
            try:
                async with session.get(
                    current_url, headers={"Accept": "image/*"}, allow_redirects=False
                ) as response:
                    if response.status in {301, 302, 303, 307, 308}:
                        location = response.headers.get("Location")
                        if not location:
                            break
                        current_url = urljoin(current_url, location)
                        continue
                    if response.status != 200:
                        raise SpikeError(
                            "provider_result_download_error", "Wan result download failed"
                        )
                    mime = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
                    if not mime.startswith("image/"):
                        raise SpikeError(
                            "provider_result_download_error", "Wan result MIME is not an image"
                        )
                    return await response.read(), mime
            except SpikeError:
                raise
            except (aiohttp.ClientError, TimeoutError) as exc:
                raise SpikeError(
                    "provider_result_download_error", "Wan result download failed"
                ) from exc
        raise SpikeError("provider_result_download_error", "Wan result redirect is invalid")

    async def _json(self, response: Any) -> dict[str, Any]:
        try:
            body = await response.json(content_type=None)
        except (ValueError, TypeError) as exc:
            raise SpikeError("provider_response_error", "Wan returned malformed JSON") from exc
        if not isinstance(body, dict):
            raise SpikeError("provider_response_error", "Wan returned malformed JSON")
        return body

    def _required_task_id(self, body: dict[str, Any]) -> str:
        task_id = body.get("output", {}).get("task_id")
        if not isinstance(task_id, str) or not task_id:
            raise SpikeError("provider_response_error", "Wan response has no task ID")
        return task_id

    def _required_result_url(self, body: dict[str, Any]) -> str:
        choices = body.get("output", {}).get("choices", [])
        try:
            url = choices[0]["message"]["content"][0]["image"]
        except (IndexError, KeyError, TypeError) as exc:
            raise SpikeError(
                "provider_result_download_error", "Wan response has no result URL"
            ) from exc
        if not isinstance(url, str) or not url:
            raise SpikeError("provider_result_download_error", "Wan result URL is invalid")
        return url

    def _validate_result_url(self, url: str) -> None:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").lower()
        if parsed.scheme != "https" or not host or parsed.username or parsed.password:
            raise SpikeError("provider_result_download_error", "Wan result URL is unsafe")
        if not any(
            host == suffix or host.endswith(f".{suffix}")
            for suffix in self.config.result_host_suffixes
        ):
            raise SpikeError("provider_result_download_error", "Wan result host is not allowed")

    @staticmethod
    def _extension(mime: str) -> str:
        return {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(mime, ".img")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run one explicit Wan 2.7 API spike")
    parser.add_argument("vehicle_image", type=Path)
    parser.add_argument("rim_reference_image", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("wan-spike-output"))
    return parser.parse_args()


async def _main() -> None:
    args = _parse_args()
    load_local_env()
    try:
        report = await WanApiSpike(SpikeConfig.from_env()).run(
            args.vehicle_image, args.rim_reference_image, args.output_dir
        )
    except SpikeError as exc:
        print(json.dumps({"error_code": exc.code, "error": str(exc)}))
        raise SystemExit(1) from exc
    print(
        json.dumps(
            {key: value for key, value in report.items() if key != "local_result_path"}, indent=2
        )
    )


if __name__ == "__main__":
    asyncio.run(_main())
