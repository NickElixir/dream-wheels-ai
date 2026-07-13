"""Configuration for the standalone fitment verdict pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class FitmentConfig:
    wheel_size_api_key: str | None = field(default_factory=lambda: os.getenv("WHEEL_SIZE_API_KEY"))
    wheel_size_base_url: str = field(
        default_factory=lambda: os.getenv(
            "WHEEL_SIZE_BASE_URL", "https://api.wheel-size.com/v2"
        ).rstrip("/")
    )
    fitment_provider: str = field(
        default_factory=lambda: os.getenv("FITMENT_PROVIDER", "wheel_size")
    )
    engine_version: str = field(
        default_factory=lambda: os.getenv("FITMENT_ENGINE_VERSION", "1.0.0")
    )
    tolerances_version: str = field(
        default_factory=lambda: os.getenv("FITMENT_TOLERANCES_VERSION", "v1")
    )
    vlm_model: str = field(default_factory=lambda: os.getenv("FITMENT_VLM_MODEL", "gpt-4.1-mini"))
    vlm_min_confidence: float = field(
        default_factory=lambda: float(os.getenv("FITMENT_VLM_MIN_CONFIDENCE", "0.4"))
    )
    openai_api_key: str | None = field(default_factory=lambda: os.getenv("OPENAI_API_KEY"))
    cache_dir: str = field(
        default_factory=lambda: os.getenv("FITMENT_CACHE_DIR", ".cache/fitment_verdict")
    )
    catalog_cache_ttl_days: int = field(
        default_factory=lambda: int(os.getenv("FITMENT_CATALOG_CACHE_TTL_DAYS", "14"))
    )
    profile_cache_ttl_hours: int = field(
        default_factory=lambda: int(os.getenv("FITMENT_PROFILE_CACHE_TTL_HOURS", "48"))
    )
    http_connect_timeout_s: float = 5.0
    http_read_timeout_s: float = 20.0
    http_max_retries: int = 3
    cv_long_side_px: int = 1536
    max_vlm_year_span: int = 2

    @property
    def provider_enabled(self) -> bool:
        return bool(self.wheel_size_api_key)


def load_config() -> FitmentConfig:
    return FitmentConfig()
