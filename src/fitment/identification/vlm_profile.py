"""Low-trust vehicle fitment prior used only by preliminary stage."""

from __future__ import annotations

from datetime import UTC, datetime

from src.fitment.schemas import AxleFitment, ExpectedOemSpec, FitmentProfile

VLM_PRIOR_PROVIDER = "vlm_prior"


def _range_values(start: float | None, end: float | None, *, step: float) -> list[float]:
    if start is None or end is None or end < start:
        return []
    values: list[float] = []
    current = start
    while current <= end + 1e-9 and len(values) < 20:
        values.append(round(current, 2))
        current += step
    return values


def profile_from_vlm_prior(expected: ExpectedOemSpec | None) -> FitmentProfile | None:
    if expected is None or not expected.has_mounting_prior:
        return None

    diameters = _range_values(
        expected.rim_diameter_min,
        expected.rim_diameter_max,
        step=1.0,
    )
    widths = _range_values(
        expected.rim_width_min,
        expected.rim_width_max,
        step=0.5,
    )
    allowed = [
        AxleFitment(
            axle=axle,
            rim_diameter=diameter,
            rim_width=width,
            # ET prior is not an approved catalog value. It is kept only as
            # reference below, so an exact preliminary fit cannot be asserted.
            offset=None,
            is_stock=None,
        )
        for axle in ("front", "rear")
        for diameter in diameters
        for width in widths
    ]

    reference_et = None
    if expected.offset_min is not None and expected.offset_max is not None:
        reference_et = round((expected.offset_min + expected.offset_max) / 2, 1)

    return FitmentProfile(
        provider=VLM_PRIOR_PROVIDER,
        provider_version=None,
        fetched_at=datetime.now(UTC).isoformat(),
        raw_response_ref=None,
        bolt_count=expected.bolt_count,
        pcd_mm=expected.pcd_mm,
        center_bore_mm=expected.center_bore_mm,
        allowed_wheels=allowed,
        oem_offset_front=reference_et,
        oem_offset_rear=reference_et,
    )
