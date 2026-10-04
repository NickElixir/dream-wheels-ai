"""Field-level presentation from saved evidence, independent of overall rules."""

import math

from pydantic import ValidationError

from src.fitment.rules import tolerances as tol
from src.fitment.schemas import FieldValue


def numeric(value: object) -> float | int | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    try:
        return value if math.isfinite(value) else None
    except OverflowError:
        return None


def saved_field(raw: object) -> tuple[float | int | None, bool]:
    if not isinstance(raw, dict):
        return numeric(raw), False
    value = numeric(raw.get("value"))
    try:
        trusted = FieldValue.model_validate(raw).is_trusted
    except ValidationError:
        trusted = False
    return value, value is not None and trusted


def reference_values(profile: dict, axle: str, name: str) -> list[float | int]:
    rows = profile.get("allowed_wheels")
    if not isinstance(rows, list):
        return []
    return sorted(
        {
            value
            for item in rows
            if isinstance(item, dict) and item.get("axle") == axle
            if (value := numeric(item.get(name))) is not None and value > 0
        }
    )


def discrete_result(
    raw: object, references: list[float | int], tolerance: float
) -> tuple[str, str]:
    value, trusted = saved_field(raw)
    if value is None or not references:
        return "unknown", "size_unknown"
    if not trusted:
        return "unknown", "conflict_low_evidence"
    if any(abs(value - reference) <= tolerance for reference in references):
        return "pass", "matches_approved_fitment"
    return "unknown", "size_not_in_reference"


def bolt_result(raw: object, reference: object, *, count: bool) -> tuple[str, str]:
    value, trusted = saved_field(raw)
    reference = numeric(reference)
    if value is None or reference is None:
        return "unknown", "pcd_unknown"
    if not trusted:
        return "unknown", "conflict_low_evidence"
    matched = value == reference if count else abs(value - reference) <= tol.PCD_TOL_MM
    if matched:
        return "pass", "matches_approved_fitment"
    return "fail", "bolt_count_mismatch" if count else "pcd_mismatch"


def offset_reference(profile: dict, rim: dict, axle: str) -> dict:
    diameter, diameter_trusted = saved_field(rim.get("wheel_diameter_in"))
    width, width_trusted = saved_field(rim.get("wheel_width_j"))
    if not diameter_trusted or not width_trusted:
        return {}
    rows = profile.get("offset_references")
    if not isinstance(rows, list):
        return {}
    # Match FitmentProfile.offset_reference_for exactly; size tolerances do not
    # authorize choosing an ET interval for a different submitted combination.
    matches = [
        item
        for item in rows
        if isinstance(item, dict)
        and item.get("axle") == axle
        and item.get("rim_diameter_in") == diameter
        and item.get("rim_width_j") == width
    ]
    return next(
        (item for item in matches if item.get("evidence_class", "stock") == "stock"),
        matches[0] if matches else {},
    )


def offset_result(raw: object, reference: dict) -> tuple[str, str]:
    value, trusted = saved_field(raw)
    if value is None:
        return "unknown", "rim_offset_missing"
    if not trusted:
        return "unknown", "conflict_low_evidence"
    lower, upper = numeric(reference.get("et_min_mm")), numeric(reference.get("et_max_mm"))
    if lower is None or upper is None or lower > upper:
        return "unknown", "vehicle_reference_offset_missing"
    if lower <= value <= upper:
        return "pass", "matches_approved_fitment"
    return "unknown", "et_outside_reference_range"
