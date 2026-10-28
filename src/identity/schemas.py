"""Strict contracts for visual vehicle identity resolution."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ResolutionStatus(StrEnum):
    resolved = "resolved"
    ambiguous = "ambiguous"
    unknown = "unknown"


class AbstentionReason(StrEnum):
    vehicle_not_visible = "vehicle_not_visible"
    multiple_vehicles = "multiple_vehicles"
    image_too_blurry = "image_too_blurry"
    vehicle_too_occluded = "vehicle_too_occluded"
    unsupported_view = "unsupported_view"
    make_uncertain = "make_uncertain"
    model_uncertain = "model_uncertain"
    year_uncertain = "year_uncertain"
    provider_returned_no_candidates = "provider_returned_no_candidates"


class VehicleIdentityCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    make: str = Field(min_length=1, max_length=120)
    model: str = Field(min_length=1, max_length=160)
    year: int | None = Field(default=None, ge=1886, le=2100)
    year_start: int | None = Field(default=None, ge=1886, le=2100)
    year_end: int | None = Field(default=None, ge=1886, le=2100)
    confidence: float = Field(ge=0.0, le=1.0)
    source: Literal["vlm_visual"] = "vlm_visual"

    @model_validator(mode="after")
    def validate_years(self) -> VehicleIdentityCandidate:
        if self.year is not None and (self.year_start is not None or self.year_end is not None):
            raise ValueError("year must not be combined with year_start or year_end")
        if (self.year_start is None) != (self.year_end is None):
            raise ValueError("year_start and year_end must be supplied together")
        if (
            self.year_start is not None
            and self.year_end is not None
            and self.year_start > self.year_end
        ):
            raise ValueError("year_start must not exceed year_end")
        return self


class VehicleResolutionMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: str
    model: str
    prompt_version: str
    resolver_version: str
    provider_request_id: str | None = None
    latency_ms: int | None = Field(default=None, ge=0)
    estimated_cost: float | None = Field(default=None, ge=0.0)
    input_asset_id: str | None = None
    input_asset_sha256: str | None = None
    normalized_input_sha256: str
    response_hash: str | None = None
    captured_at: datetime


class VehicleIdentityResolution(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ResolutionStatus
    primary: VehicleIdentityCandidate | None = None
    alternatives: list[VehicleIdentityCandidate] = Field(default_factory=list, max_length=2)
    abstention_reason: AbstentionReason | None = None
    metadata: VehicleResolutionMetadata

    @model_validator(mode="after")
    def validate_status(self) -> VehicleIdentityResolution:
        if self.status is ResolutionStatus.unknown:
            if self.primary is not None or self.alternatives:
                raise ValueError("unknown must not contain candidates")
            if self.abstention_reason is None:
                raise ValueError("unknown requires abstention_reason")
        elif self.primary is None:
            raise ValueError("resolved and ambiguous require primary")
        elif self.status is ResolutionStatus.resolved and self.abstention_reason is not None:
            raise ValueError("resolved must not contain abstention_reason")
        return self


class ProviderVehicleResolution(BaseModel):
    """Schema requested from a provider; provider metadata is added locally."""

    model_config = ConfigDict(extra="forbid")

    status: ResolutionStatus
    primary: VehicleIdentityCandidate | None = None
    alternatives: list[VehicleIdentityCandidate] = Field(default_factory=list, max_length=2)
    abstention_reason: AbstentionReason | None = None

    @model_validator(mode="after")
    def validate_status(self) -> ProviderVehicleResolution:
        VehicleIdentityResolution(
            status=self.status,
            primary=self.primary,
            alternatives=self.alternatives,
            abstention_reason=self.abstention_reason,
            metadata=VehicleResolutionMetadata(
                provider="validation",
                model="validation",
                prompt_version="validation",
                resolver_version="validation",
                normalized_input_sha256="0" * 64,
                captured_at=datetime.now().astimezone(),
            ),
        )
        return self
