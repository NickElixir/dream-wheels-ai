"""Provider-neutral contracts for image generation."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Protocol

PROVIDER_ERROR_CODES = frozenset(
    {
        "provider_config_error",
        "provider_auth_error",
        "provider_input_error",
        "provider_content_rejected",
        "provider_rate_limited",
        "provider_unavailable",
        "provider_submission_uncertain",
        "provider_task_failed",
        "provider_task_timeout",
        "provider_result_download_error",
        "provider_response_error",
    }
)

EditRegion = tuple[int, int, int, int]


@dataclass(frozen=True, slots=True)
class ProviderDiagnostics:
    """Safe provider metadata suitable for logs or durable error evidence."""

    http_status: int | None = None
    request_id: str | None = None
    task_id: str | None = None
    raw_task_status: str | None = None
    provider_error_code: str | None = None
    provider_message: str | None = None
    poll_attempts: int = 0
    status_transitions: tuple[str, ...] = ()
    extra: Mapping[str, str | int | float | bool | None] = field(default_factory=dict)


class GenerationProviderError(RuntimeError):
    """Normalized, safe provider error."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        diagnostics: ProviderDiagnostics | None = None,
    ) -> None:
        if code not in PROVIDER_ERROR_CODES:
            raise ValueError(f"Unsupported provider error code: {code}")
        super().__init__(message)
        self.code = code
        self.diagnostics = diagnostics


@dataclass(frozen=True, slots=True)
class GenerationRequest:
    """Semantic image-edit request; vehicle and rim cannot be positionally swapped."""

    vehicle_image: bytes
    vehicle_content_type: str
    rim_reference_image: bytes
    rim_reference_content_type: str
    instruction: str
    prompt_version: str
    output_width: int
    output_height: int
    edit_regions: tuple[EditRegion, ...] | None = None
    seed: int | None = None

    def __post_init__(self) -> None:
        if not self.vehicle_image:
            raise GenerationProviderError("provider_input_error", "Vehicle image is empty")
        if not self.rim_reference_image:
            raise GenerationProviderError("provider_input_error", "Rim reference image is empty")
        for role, content_type in (
            ("vehicle", self.vehicle_content_type),
            ("rim reference", self.rim_reference_content_type),
        ):
            if not content_type.startswith("image/"):
                raise GenerationProviderError(
                    "provider_input_error", f"{role} content type is not an image"
                )
        if not self.instruction.strip():
            raise GenerationProviderError("provider_input_error", "Generation instruction is empty")
        if not self.prompt_version.strip():
            raise GenerationProviderError("provider_input_error", "Prompt version is empty")
        if self.output_width <= 0 or self.output_height <= 0:
            raise GenerationProviderError("provider_input_error", "Output dimensions are invalid")
        if self.seed is not None and not 0 <= self.seed <= 2_147_483_647:
            raise GenerationProviderError("provider_input_error", "Seed is outside supported range")
        if self.edit_regions is not None:
            for region in self.edit_regions:
                if len(region) != 4:
                    raise GenerationProviderError(
                        "provider_input_error", "Edit region is malformed"
                    )
                x1, y1, x2, y2 = region
                if min(x1, y1, x2, y2) < 0 or x2 <= x1 or y2 <= y1:
                    raise GenerationProviderError("provider_input_error", "Edit region is invalid")


@dataclass(frozen=True, slots=True)
class GenerationResult:
    image_bytes: bytes
    content_type: str
    provider: str
    model: str
    provider_request_id: str | None
    provider_task_id: str | None
    latency_ms: int
    billed_image_count: int
    output_width: int
    output_height: int
    diagnostics: ProviderDiagnostics | None = None
    generation_cost: float | None = None

    def __post_init__(self) -> None:
        if not self.image_bytes:
            raise ValueError("Generation result image is empty")
        if not self.content_type.startswith("image/"):
            raise ValueError("Generation result content type is not an image")
        if not self.provider or not self.model:
            raise ValueError("Generation result provider and model are required")
        if self.latency_ms < 0 or self.billed_image_count < 1:
            raise ValueError("Generation result usage metadata is invalid")
        if self.output_width <= 0 or self.output_height <= 0:
            raise ValueError("Generation result dimensions are invalid")
        if self.generation_cost is not None and self.generation_cost < 0:
            raise ValueError("Generation result cost metadata is invalid")


class GenerationProvider(Protocol):
    @property
    def name(self) -> str: ...

    async def edit(self, request: GenerationRequest) -> GenerationResult: ...
