"""Pseudo fitment profile built from the VLM prior (stage 1 only).

The VLM knows typical factory wheel parameters for common vehicles. That prior
lets the deterministic rule engine produce a *preliminary* verdict from photos
alone. It is never used in stage 2, where Wheel-Size data replaces it.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fitment_verdict.schemas import (
    AxleFitment,
    ExpectedOemSpec,
    FitmentProfile,
    VehicleQuery,
)

VLM_PRIOR_PROVIDER = "vlm_prior"


def expected_oem_from_parsed(parsed: dict) -> ExpectedOemSpec | None:
    raw = parsed.get("expected_oem")
    if not isinstance(raw, dict):
        return None
    try:
        expected = ExpectedOemSpec.model_validate(raw)
    except Exception:
        return None
    return expected if expected.has_mounting_prior else None


def _width_steps(width_min: float, width_max: float) -> list[float]:
    if width_min == width_max:
        return [width_min]
    mid = round((width_min + width_max) / 2, 1)
    return sorted({width_min, mid, width_max})


def _allowed_wheels(expected: ExpectedOemSpec) -> list[AxleFitment]:
    if (
        expected.rim_diameter_min is None
        or expected.rim_diameter_max is None
        or expected.rim_width_min is None
        or expected.rim_width_max is None
    ):
        return []

    diameters = [
        float(d) for d in range(int(expected.rim_diameter_min), int(expected.rim_diameter_max) + 1)
    ]
    widths = _width_steps(expected.rim_width_min, expected.rim_width_max)

    # Offset is intentionally left None: the ET prior lives in oem_offset_front,
    # so size matches degrade to "conditions" (ET unverified), never "compatible".
    return [
        AxleFitment(axle="front", rim_diameter=d, rim_width=w, offset=None, is_stock=None)
        for d in diameters
        for w in widths
    ]


def profile_from_expected_oem(
    expected: ExpectedOemSpec | None,
    vehicle: VehicleQuery,
) -> FitmentProfile | None:
    if expected is None:
        return None

    bolt_pattern = None
    if expected.bolt_count and expected.pcd_mm:
        bolt_pattern = f"{expected.bolt_count}x{float(expected.pcd_mm):g}"

    oem_offset = None
    if expected.offset_min is not None and expected.offset_max is not None:
        oem_offset = round((expected.offset_min + expected.offset_max) / 2, 1)

    return FitmentProfile(
        provider=VLM_PRIOR_PROVIDER,
        provider_version=None,
        fetched_at=datetime.now(UTC).isoformat(),
        raw_response_ref="vlm_prior",
        bolt_pattern=bolt_pattern,
        stud_holes=expected.bolt_count,
        pcd=expected.pcd_mm,
        center_bore=expected.center_bore_mm,
        allowed_wheels=_allowed_wheels(expected),
        oem_offset_front=oem_offset,
        vehicle_query=vehicle,
    )
