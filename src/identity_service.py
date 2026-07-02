"""Sprint 2 vehicle and rim identity helpers.

This boundary is intentionally render-oriented. It can suggest values from a
mock VLM/OCR adapter, but it must not produce technical fitment verdicts.
"""

import json
from decimal import Decimal
from typing import Literal

import asyncpg
from pydantic import BaseModel, Field, field_validator

from src.assets_service import AssetUpload

IdentitySource = Literal["user_input", "user_confirmed", "ocr", "vlm", "provider", "unknown"]


class VehicleCandidate(BaseModel):
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


class RimProposal(BaseModel):
    wheel_diameter_in: float = Field(gt=0)
    wheel_width_j: float = Field(gt=0)
    bolt_count: int = Field(gt=0)
    pcd_mm: float = Field(gt=0)
    confidence: float = Field(ge=0.0, le=1.0)
    source: IdentitySource = "ocr"


class IdentityProposal(BaseModel):
    vehicle: dict[str, VehicleCandidate | list[VehicleCandidate]]
    rim: RimProposal
    resolver: str = "mock_visual_identity_v1"


class ConfirmedIdentityRequest(BaseModel):
    draft_id: str
    vehicle: VehicleCandidate
    rim: RimProposal
    rim_user_confirmed: bool = True


def _field_meta(source: IdentitySource, confidence: float, *, confirmed: bool) -> dict:
    return {
        "source": source,
        "confidence": confidence,
        "is_user_confirmed": confirmed,
    }


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


async def resolve_identity_mock(
    *,
    car_asset: AssetUpload,
    rim_asset: AssetUpload,
) -> IdentityProposal:
    """Return an explicit mock proposal until production VLM/OCR is wired."""
    primary = VehicleCandidate(make="Lexus", model="RX", year=2020, confidence=0.92)
    alternatives = [
        VehicleCandidate(make="Lexus", model="RX", year=2019, confidence=0.76),
        VehicleCandidate(make="Lexus", model="RX", year=2021, confidence=0.72),
    ]
    rim = RimProposal(
        wheel_diameter_in=20,
        wheel_width_j=8.5,
        bolt_count=5,
        pcd_mm=114.3,
        confidence=0.72,
    )
    return IdentityProposal(
        vehicle={"primary": primary, "alternatives": alternatives[:2]},
        rim=rim,
        resolver="mock_visual_identity_v1",
    )


async def insert_vehicle_identity(
    conn: asyncpg.Connection,
    *,
    owner_user_id: int,
    vehicle: VehicleCandidate,
) -> str:
    field_provenance = {
        "make": _field_meta("user_confirmed", vehicle.confidence, confirmed=True),
        "model": _field_meta("user_confirmed", vehicle.confidence, confirmed=True),
        "year": _field_meta("user_confirmed", vehicle.confidence, confirmed=True),
        "year_start": _field_meta("user_confirmed", vehicle.confidence, confirmed=True),
        "year_end": _field_meta("user_confirmed", vehicle.confidence, confirmed=True),
    }
    return str(
        await conn.fetchval(
            """
            INSERT INTO vehicle_identities (
                owner_user_id, make, model, year, year_start, year_end,
                is_user_confirmed, field_provenance
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, $7::jsonb)
            RETURNING id
            """,
            owner_user_id,
            vehicle.make,
            vehicle.model,
            vehicle.year,
            vehicle.year_start,
            vehicle.year_end,
            json.dumps(field_provenance),
        )
    )


async def insert_rim_spec(
    conn: asyncpg.Connection,
    *,
    owner_user_id: int,
    rim: RimProposal,
    is_user_confirmed: bool,
) -> str:
    source: IdentitySource = "user_confirmed" if is_user_confirmed else rim.source
    field_provenance = {
        "wheel_diameter_in": _field_meta(source, rim.confidence, confirmed=is_user_confirmed),
        "wheel_width_j": _field_meta(source, rim.confidence, confirmed=is_user_confirmed),
        "bolt_count": _field_meta(source, rim.confidence, confirmed=is_user_confirmed),
        "pcd_mm": _field_meta(source, rim.confidence, confirmed=is_user_confirmed),
    }
    return str(
        await conn.fetchval(
            """
            INSERT INTO rim_specs (
                owner_user_id, wheel_diameter_in, wheel_width_j, bolt_count,
                pcd_mm, field_provenance
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            RETURNING id
            """,
            owner_user_id,
            Decimal(str(rim.wheel_diameter_in)),
            Decimal(str(rim.wheel_width_j)),
            rim.bolt_count,
            Decimal(str(rim.pcd_mm)),
            json.dumps(field_provenance),
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
