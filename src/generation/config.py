"""Wan provider configuration and endpoint derivation."""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urlsplit

from src import config as app_config
from src.generation.base import GenerationProviderError

WAN_REGION = "ap-southeast-1"
WAN_MODEL = "wan2.7-image"
DEFAULT_RESULT_HOST_SUFFIXES = ("aliyuncs.com",)


def _parse_float(name: str, value: str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise GenerationProviderError("provider_config_error", f"{name} is invalid") from exc
    if parsed <= 0:
        raise GenerationProviderError("provider_config_error", f"{name} must be positive")
    return parsed


def _parse_int(name: str, value: str, *, minimum: int = 0) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise GenerationProviderError("provider_config_error", f"{name} is invalid") from exc
    if parsed < minimum:
        raise GenerationProviderError("provider_config_error", f"{name} must be at least {minimum}")
    return parsed


def _parse_nonnegative_float(name: str, value: str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise GenerationProviderError("provider_config_error", f"{name} is invalid") from exc
    if parsed < 0:
        raise GenerationProviderError("provider_config_error", f"{name} must be non-negative")
    return parsed


@dataclass(frozen=True, slots=True)
class WanImageConfig:
    api_key: str
    region: str = WAN_REGION
    workspace_id: str = ""
    model: str = WAN_MODEL
    estimated_cost_usd: float = 0.03
    task_timeout_sec: float = 300.0
    poll_initial_sec: float = 2.0
    http_timeout_sec: float = 30.0
    max_poll_errors: int = 3
    max_input_bytes: int = 10 * 1024 * 1024
    max_output_bytes: int = 20 * 1024 * 1024
    result_max_redirects: int = 3
    result_allowed_host_suffixes: tuple[str, ...] = field(
        default_factory=lambda: DEFAULT_RESULT_HOST_SUFFIXES
    )
    base_url: str | None = None

    def __post_init__(self) -> None:
        api_key = self.api_key.strip()
        region = self.region.strip()
        workspace_id = self.workspace_id.strip()
        if not api_key:
            raise GenerationProviderError("provider_config_error", "WAN_API_KEY is required")
        if region != WAN_REGION:
            raise GenerationProviderError(
                "provider_config_error", f"WAN_REGION must be {WAN_REGION}"
            )
        if not workspace_id or any(char in workspace_id for char in "/?:#@ "):
            raise GenerationProviderError("provider_config_error", "WAN_WORKSPACE_ID is invalid")
        if self.model != WAN_MODEL:
            raise GenerationProviderError("provider_config_error", f"WAN_MODEL must be {WAN_MODEL}")
        if self.estimated_cost_usd < 0:
            raise GenerationProviderError(
                "provider_config_error", "WAN_ESTIMATED_COST_USD must be non-negative"
            )
        if self.task_timeout_sec <= 0 or self.poll_initial_sec <= 0 or self.http_timeout_sec <= 0:
            raise GenerationProviderError(
                "provider_config_error", "WAN timing settings are invalid"
            )
        if self.max_poll_errors < 0 or self.max_input_bytes <= 0 or self.max_output_bytes <= 0:
            raise GenerationProviderError(
                "provider_config_error", "WAN size/retry settings are invalid"
            )
        if self.result_max_redirects < 0:
            raise GenerationProviderError("provider_config_error", "WAN redirect limit is invalid")

        suffixes = tuple(
            suffix.strip().lower().lstrip(".") for suffix in self.result_allowed_host_suffixes
        )
        if not suffixes or any(
            not suffix or not suffix.endswith("aliyuncs.com") for suffix in suffixes
        ):
            raise GenerationProviderError(
                "provider_config_error", "WAN result host suffixes are invalid"
            )
        endpoint = self.base_url or (f"https://{workspace_id}.{region}.maas.aliyuncs.com/api/v1")
        self._validate_base_url(endpoint)
        object.__setattr__(self, "api_key", api_key)
        object.__setattr__(self, "region", region)
        object.__setattr__(self, "workspace_id", workspace_id)
        object.__setattr__(self, "base_url", endpoint.rstrip("/"))
        object.__setattr__(self, "result_allowed_host_suffixes", suffixes)

    @property
    def api_base_url(self) -> str:
        return self.base_url or ""

    @classmethod
    def from_env(cls) -> WanImageConfig:
        suffixes = tuple(
            item.strip()
            for item in app_config.WAN_RESULT_ALLOWED_HOST_SUFFIXES.split(",")
            if item.strip()
        )
        if not suffixes:
            suffixes = DEFAULT_RESULT_HOST_SUFFIXES
        return cls(
            api_key=app_config.WAN_API_KEY,
            region=app_config.WAN_REGION,
            workspace_id=app_config.WAN_WORKSPACE_ID,
            model=app_config.WAN_MODEL,
            estimated_cost_usd=_parse_nonnegative_float(
                "WAN_ESTIMATED_COST_USD", app_config.WAN_ESTIMATED_COST_USD
            ),
            task_timeout_sec=_parse_float("WAN_TASK_TIMEOUT_SEC", app_config.WAN_TASK_TIMEOUT_SEC),
            poll_initial_sec=_parse_float("WAN_POLL_INITIAL_SEC", app_config.WAN_POLL_INITIAL_SEC),
            http_timeout_sec=_parse_float("WAN_HTTP_TIMEOUT_SEC", app_config.WAN_HTTP_TIMEOUT_SEC),
            max_poll_errors=_parse_int(
                "WAN_MAX_POLL_ERRORS", app_config.WAN_MAX_POLL_ERRORS, minimum=0
            ),
            max_input_bytes=_parse_int(
                "WAN_MAX_INPUT_BYTES", app_config.WAN_MAX_INPUT_BYTES, minimum=1
            ),
            max_output_bytes=_parse_int(
                "WAN_MAX_OUTPUT_BYTES", app_config.WAN_MAX_OUTPUT_BYTES, minimum=1
            ),
            result_max_redirects=_parse_int(
                "WAN_RESULT_MAX_REDIRECTS", app_config.WAN_RESULT_MAX_REDIRECTS, minimum=0
            ),
            result_allowed_host_suffixes=suffixes,
        )

    @staticmethod
    def _validate_base_url(value: str) -> None:
        try:
            parsed = urlsplit(value.rstrip("/"))
        except ValueError as exc:
            raise GenerationProviderError(
                "provider_config_error", "WAN endpoint is malformed"
            ) from exc
        host = (parsed.hostname or "").lower()
        if (
            parsed.scheme != "https"
            or not host
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or not host.endswith("aliyuncs.com")
            or parsed.path != "/api/v1"
        ):
            raise GenerationProviderError(
                "provider_config_error", "WAN endpoint must be a clean Alibaba HTTPS /api/v1 URL"
            )
