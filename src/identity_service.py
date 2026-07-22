"""Sprint 2 vehicle and rim identity helpers.

This boundary is intentionally render-oriented. It can suggest values from a
mock VLM/OCR adapter, but it must not produce technical fitment verdicts.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal
from urllib.parse import urlparse

import asyncpg
from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from src.identity.schemas import VehicleIdentityResolution

IdentitySource = Literal[
    "user_input",
    "user_confirmed",
    "user_edited",
    "ocr",
    "vlm",
    "vlm_visual",
    "provider",
    "unknown",
]


class VehicleCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    make: str
    model: str
    year: int | None = Field(default=None, ge=1886, le=2100)
    year_start: int | None = Field(default=None, ge=1886, le=2100)
    year_end: int | None = Field(default=None, ge=1886, le=2100)
    confidence: float = Field(ge=0.0, le=1.0)
    source: IdentitySource = "vlm"

    @field_validator("make", "model")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("field must not be empty")
        return normalized

    @field_validator("year_end")
    @classmethod
    def validate_year_range(cls, value: int | None, info):
        year_start = info.data.get("year_start")
        if value is not None and year_start is not None and value < year_start:
            raise ValueError("year_end must be greater than or equal to year_start")
        return value

    @model_validator(mode="after")
    def validate_year_choice(self) -> VehicleCandidate:
        if self.year is not None and (self.year_start is not None or self.year_end is not None):
            raise ValueError("year must not be combined with year_start or year_end")
        if (self.year_start is None) != (self.year_end is None):
            raise ValueError("year_start and year_end must be supplied together")
        return self


class RimProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    brand: str | None = None
    model: str | None = None
    sku: str | None = None
    product_url: str | None = None
    wheel_diameter_in: float = Field(gt=0)
    wheel_width_j: float = Field(gt=0)
    bolt_count: int = Field(gt=0)
    pcd_mm: float = Field(gt=0)
    center_bore_mm: float | None = Field(default=None, gt=0)
    offset_et_mm: float | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    source: IdentitySource = "ocr"

    @field_validator("brand", "model", "sku", mode="before")
    @classmethod
    def normalize_optional_short_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(str(value).strip().split())
        return normalized or None

    @field_validator("product_url", mode="before")
    @classmethod
    def normalize_product_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @field_validator("product_url")
    @classmethod
    def validate_product_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 2048:
            raise ValueError("product_url must be at most 2048 characters")
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("product_url must use http or https")
        return value

    @field_validator("offset_et_mm")
    @classmethod
    def validate_offset(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if abs(value) > 500:
            raise ValueError("offset_et_mm is out of range")
        return value


class RimIdentityProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["manual_required", "resolved"] = "manual_required"
    brand: str | None = None
    model: str | None = None
    sku: str | None = None
    product_url: str | None = None
    wheel_diameter_in: float | None = Field(default=None, gt=0)
    wheel_width_j: float | None = Field(default=None, gt=0)
    bolt_count: int | None = Field(default=None, gt=0)
    pcd_mm: float | None = Field(default=None, gt=0)
    center_bore_mm: float | None = Field(default=None, gt=0)
    offset_et_mm: float | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source: IdentitySource = "unknown"


class IdentityResolutionError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error_code: str
    retryable: bool


class IdentityProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle: VehicleIdentityResolution
    rim: RimIdentityProposal = Field(default_factory=RimIdentityProposal)
    resolver: str = "vehicle_identity_resolver_v1"
    error: IdentityResolutionError | None = None


class ConfirmedIdentityRequest(BaseModel):
    draft_id: str
    vehicle: VehicleCandidate
    rim: RimProposal
    rim_user_confirmed: bool = True


class FitmentVehicleUpdate(BaseModel):
    make: str | None = None
    model: str | None = None
    year: int | None = Field(default=None, ge=1886, le=2100)
    body: str | None = None
    generation: str | None = None
    modification: str | None = None
    market: str | None = None

    @field_validator("make", "model", "body", "generation", "modification", "market", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(str(value).strip().split())
        return normalized or None


class FitmentRimUpdate(BaseModel):
    brand: str | None = None
    model: str | None = None
    sku: str | None = None
    product_url: str | None = None
    bolt_count: int | None = Field(default=None, gt=0)
    pcd_mm: float | None = Field(default=None, gt=0)
    center_bore_mm: float | None = Field(default=None, gt=0)
    wheel_diameter_in: float | None = Field(default=None, gt=0)
    wheel_width_j: float | None = Field(default=None, gt=0)
    offset_et_mm: float | None = None

    @field_validator("brand", "model", "sku", mode="before")
    @classmethod
    def normalize_optional_short_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(str(value).strip().split())
        return normalized or None

    @field_validator("product_url", mode="before")
    @classmethod
    def normalize_product_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @field_validator("product_url")
    @classmethod
    def validate_product_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 2048:
            raise ValueError("product_url must be at most 2048 characters")
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("product_url must use http or https")
        return value

    @field_validator("offset_et_mm")
    @classmethod
    def validate_offset(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if abs(value) > 500:
            raise ValueError("offset_et_mm is out of range")
        return value


class FitmentDetailsUpdateRequest(BaseModel):
    expected_vehicle_revision: int = Field(ge=1)
    expected_rim_revision: int = Field(ge=1)
    vehicle: FitmentVehicleUpdate = Field(default_factory=FitmentVehicleUpdate)
    rim: FitmentRimUpdate = Field(default_factory=FitmentRimUpdate)

    @field_validator("rim")
    @classmethod
    def require_any_payload(
        cls,
        value: FitmentRimUpdate,
        info: ValidationInfo,
    ) -> FitmentRimUpdate:
        vehicle = info.data.get("vehicle")
        vehicle_fields = vehicle.model_fields_set if vehicle else set()
        if not vehicle_fields and not value.model_fields_set:
            raise ValueError("at least one fitment field must be provided")
        return value


def _field_meta(source: IdentitySource, confidence: float, *, confirmed: bool) -> dict:
    return {
        "source": _candidate_source(source),
        "confidence": confidence,
        "is_user_confirmed": confirmed,
    }


def is_user_source(source: IdentitySource) -> bool:
    return source in {"user_input", "user_confirmed", "user_edited"}


def _candidate_source(source: IdentitySource) -> str:
    return "vlm_visual" if source == "vlm" else source


def _append_field_candidate(
    candidates: dict[str, list[dict]],
    field_name: str,
    value: object,
    *,
    source: IdentitySource,
    confidence: float,
    resolver: str,
    captured_at: str,
    provider: str | None = None,
    model: str | None = None,
    prompt_version: str | None = None,
) -> None:
    if value is None:
        return
    candidate = {
        "value": value,
        "source": _candidate_source(source),
        "confidence": confidence,
        "resolver": resolver,
        "origin": "render_input_draft",
        "captured_at": captured_at,
    }
    if provider is not None:
        candidate["provider"] = provider
    if model is not None:
        candidate["model"] = model
    if prompt_version is not None:
        candidate["prompt_version"] = prompt_version
    candidates.setdefault(field_name, []).append(candidate)


def parse_identity_proposal(raw: object) -> IdentityProposal | None:
    if isinstance(raw, IdentityProposal):
        return raw
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return None
    if not raw:
        return None
    try:
        if isinstance(raw, dict):
            raw = _adapt_legacy_identity_proposal(raw)
        return IdentityProposal.model_validate(raw)
    except ValueError:
        return None


def _adapt_legacy_identity_proposal(raw: dict) -> dict:
    """Read pre-VLM drafts while new drafts retain the strict resolution envelope."""
    vehicle = raw.get("vehicle")
    if not isinstance(vehicle, dict) or "status" in vehicle:
        return raw
    primary = vehicle.get("primary")
    if isinstance(primary, dict) and primary.get("source") == "vlm":
        primary = {**primary, "source": "vlm_visual"}
    alternatives = []
    for candidate in vehicle.get("alternatives", []):
        if isinstance(candidate, dict) and candidate.get("source") == "vlm":
            alternatives.append({**candidate, "source": "vlm_visual"})
        else:
            alternatives.append(candidate)
    raw = dict(raw)
    raw["vehicle"] = {
        "status": "resolved" if primary else "unknown",
        "primary": primary,
        "alternatives": alternatives,
        "abstention_reason": None if primary else "provider_returned_no_candidates",
        "metadata": {
            "provider": "legacy",
            "model": "legacy",
            "prompt_version": "legacy",
            "resolver_version": raw.get("resolver", "legacy_identity"),
            "normalized_input_sha256": "0" * 64,
            "captured_at": datetime.now(UTC).isoformat(),
        },
    }
    rim = raw.get("rim")
    if isinstance(rim, dict) and "status" not in rim:
        raw["rim"] = {"status": "resolved", **rim}
    return raw


def field_candidates_from_identity_proposal(
    proposal: IdentityProposal | None,
) -> tuple[dict[str, list[dict]], dict[str, list[dict]]]:
    if proposal is None:
        return {}, {}

    captured_at = datetime.now(UTC).isoformat()
    vehicle_candidates: dict[str, list[dict]] = {}
    rim_candidates: dict[str, list[dict]] = {}

    raw_vehicle_candidates = []
    primary = proposal.vehicle.primary
    if primary is not None:
        raw_vehicle_candidates.append(primary)
    raw_vehicle_candidates.extend(proposal.vehicle.alternatives)

    for candidate in raw_vehicle_candidates:
        for field_name in ("make", "model", "year", "year_start", "year_end"):
            _append_field_candidate(
                vehicle_candidates,
                field_name,
                getattr(candidate, field_name),
                source="vlm_visual",
                confidence=candidate.confidence,
                resolver=proposal.resolver,
                captured_at=captured_at,
                provider=proposal.vehicle.metadata.provider,
                model=proposal.vehicle.metadata.model,
                prompt_version=proposal.vehicle.metadata.prompt_version,
            )

    for field_name in (
        "brand",
        "model",
        "sku",
        "product_url",
        "wheel_diameter_in",
        "wheel_width_j",
        "bolt_count",
        "pcd_mm",
        "center_bore_mm",
        "offset_et_mm",
    ):
        _append_field_candidate(
            rim_candidates,
            field_name,
            getattr(proposal.rim, field_name),
            source=proposal.rim.source,
            confidence=proposal.rim.confidence,
            resolver=proposal.resolver,
            captured_at=captured_at,
        )

    return vehicle_candidates, rim_candidates


def prefill_vehicle_from_proposal(
    vehicle: VehicleCandidate,
    proposal: IdentityProposal | None,
) -> VehicleCandidate:
    if proposal is None:
        return vehicle
    primary = proposal.vehicle.primary
    if primary is None:
        return vehicle
    update: dict[str, object] = {}
    for field_name in ("year", "year_start", "year_end"):
        if getattr(vehicle, field_name) is None and getattr(primary, field_name) is not None:
            update[field_name] = getattr(primary, field_name)
    if not update:
        return vehicle
    return vehicle.model_copy(update=update)


def prefill_rim_from_proposal(
    rim: RimProposal,
    proposal: IdentityProposal | None,
) -> RimProposal:
    if proposal is None:
        return rim
    proposal_rim = proposal.rim
    if proposal_rim.status != "resolved":
        return rim
    update: dict[str, object] = {}
    for field_name in (
        "brand",
        "model",
        "sku",
        "product_url",
        "wheel_diameter_in",
        "wheel_width_j",
        "bolt_count",
        "pcd_mm",
        "center_bore_mm",
        "offset_et_mm",
    ):
        if getattr(rim, field_name) is None and getattr(proposal_rim, field_name) is not None:
            update[field_name] = getattr(proposal_rim, field_name)
    if not update:
        return rim
    return rim.model_copy(update=update)


def pcd_display_value(*, bolt_count: int, pcd_mm: float | Decimal) -> str:
    pcd = Decimal(str(pcd_mm)).normalize()
    return f"{bolt_count}×{pcd:f}"


def vehicle_display_value(candidate: VehicleCandidate) -> str:
    if candidate.year is not None:
        year = str(candidate.year)
    elif candidate.year_start is not None and candidate.year_end is not None:
        year = f"{candidate.year_start}-{candidate.year_end}"
    else:
        year = ""
    suffix = f" · {year}" if year else ""
    return f"{candidate.make} {candidate.model}{suffix}"


def rim_display_value(rim: RimProposal) -> str:
    return (
        f'{rim.wheel_diameter_in:g}" · {rim.wheel_width_j:g}J · '
        f"{pcd_display_value(bolt_count=rim.bolt_count, pcd_mm=rim.pcd_mm)}"
    )


def _decimal_or_none(value: float | None) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def identity_proposal_from_resolution(resolution: VehicleIdentityResolution) -> IdentityProposal:
    """Wrap vehicle VLM output without implying that the rim was recognized."""
    return IdentityProposal(
        vehicle=resolution,
        rim=RimIdentityProposal(status="manual_required"),
        resolver=resolution.metadata.resolver_version,
    )


async def insert_vehicle_identity(
    conn: asyncpg.Connection,
    *,
    owner_user_id: int,
    vehicle: VehicleCandidate,
    field_candidates: dict[str, list[dict]] | None = None,
) -> str:
    confirmed = is_user_source(vehicle.source)
    field_provenance = {
        "make": _field_meta(vehicle.source, vehicle.confidence, confirmed=confirmed),
        "model": _field_meta(vehicle.source, vehicle.confidence, confirmed=confirmed),
        "year": _field_meta(vehicle.source, vehicle.confidence, confirmed=confirmed),
        "year_start": _field_meta(vehicle.source, vehicle.confidence, confirmed=confirmed),
        "year_end": _field_meta(vehicle.source, vehicle.confidence, confirmed=confirmed),
    }
    return str(
        await conn.fetchval(
            """
            INSERT INTO vehicle_identities (
                owner_user_id, make, model, year, year_start, year_end,
                is_user_confirmed, field_provenance, field_candidates
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
            RETURNING id
            """,
            owner_user_id,
            vehicle.make,
            vehicle.model,
            vehicle.year,
            vehicle.year_start,
            vehicle.year_end,
            confirmed,
            json.dumps(field_provenance),
            json.dumps(field_candidates or {}),
        )
    )


async def insert_rim_spec(
    conn: asyncpg.Connection,
    *,
    owner_user_id: int,
    rim: RimProposal,
    is_user_confirmed: bool,
    field_candidates: dict[str, list[dict]] | None = None,
) -> str:
    source: IdentitySource = "user_confirmed" if is_user_confirmed else rim.source
    field_provenance = {}
    for field_name in (
        "brand",
        "model",
        "sku",
        "product_url",
        "wheel_diameter_in",
        "wheel_width_j",
        "bolt_count",
        "pcd_mm",
        "center_bore_mm",
        "offset_et_mm",
    ):
        if getattr(rim, field_name) is not None:
            field_provenance[field_name] = _field_meta(
                source,
                rim.confidence,
                confirmed=is_user_confirmed,
            )
    return str(
        await conn.fetchval(
            """
            INSERT INTO rim_specs (
                owner_user_id, brand, model, sku, product_url, wheel_diameter_in,
                wheel_width_j, bolt_count, pcd_mm, center_bore_mm, offset_et_mm,
                field_provenance, field_candidates
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb
            )
            RETURNING id
            """,
            owner_user_id,
            rim.brand,
            rim.model,
            rim.sku,
            rim.product_url,
            Decimal(str(rim.wheel_diameter_in)),
            Decimal(str(rim.wheel_width_j)),
            rim.bolt_count,
            Decimal(str(rim.pcd_mm)),
            _decimal_or_none(rim.center_bore_mm),
            _decimal_or_none(rim.offset_et_mm),
            json.dumps(field_provenance),
            json.dumps(field_candidates or {}),
        )
    )


async def insert_rim_setup(
    conn: asyncpg.Connection,
    *,
    owner_user_id: int,
    rim_spec_id: str,
) -> str:
    return str(
        await conn.fetchval(
            """
            INSERT INTO rim_setups (
                owner_user_id, front_rim_spec_id, rear_rim_spec_id, is_staggered
            )
            VALUES ($1, $2::uuid, $2::uuid, false)
            RETURNING id
            """,
            owner_user_id,
            rim_spec_id,
        )
    )


def render_input_snapshot(
    *,
    vehicle_identity_id: str,
    rim_setup_id: str,
    vehicle: VehicleCandidate,
    rim: RimProposal,
    rim_user_confirmed: bool,
    car_asset_id: str,
    rim_asset_id: str,
) -> dict:
    return {
        "version": "render-input-sprint-2-v1",
        "purpose": "visual_render",
        "fitment_verdict": None,
        "vehicle_identity_id": vehicle_identity_id,
        "rim_setup_id": rim_setup_id,
        "vehicle": vehicle.model_dump(mode="json"),
        "rim": rim.model_dump(mode="json")
        | {
            "pcd_display": pcd_display_value(
                bolt_count=rim.bolt_count,
                pcd_mm=rim.pcd_mm,
            ),
            "is_user_confirmed": rim_user_confirmed,
        },
        "assets": {
            "car_asset_id": car_asset_id,
            "rim_asset_id": rim_asset_id,
        },
        "disclaimer_code": "VISUAL_RENDER_NOT_FITMENT_VERDICT",
    }


def vehicle_fitment_summary(vehicle_row: dict) -> str:
    parts = [
        vehicle_row.get("make"),
        vehicle_row.get("model"),
    ]
    title = " ".join(part for part in parts if part).strip()
    detail_parts = [
        str(vehicle_row.get("year")) if vehicle_row.get("year") is not None else None,
        vehicle_row.get("generation"),
    ]
    detail = " · ".join(part for part in detail_parts if part)
    if title and detail:
        return f"{title} · {detail}"
    return title or detail or "Не указано"


def rim_fitment_summary(rim_row: dict) -> str:
    parts: list[str] = []
    if rim_row.get("wheel_diameter_in") is not None:
        parts.append(f'{Decimal(str(rim_row["wheel_diameter_in"])).normalize():f}"')
    if rim_row.get("wheel_width_j") is not None:
        parts.append(f"{Decimal(str(rim_row['wheel_width_j'])).normalize():f}J")
    if rim_row.get("bolt_count") is not None and rim_row.get("pcd_mm") is not None:
        parts.append(
            pcd_display_value(
                bolt_count=int(rim_row["bolt_count"]),
                pcd_mm=rim_row["pcd_mm"],
            )
        )
    return " · ".join(parts) if parts else "Не указано"
