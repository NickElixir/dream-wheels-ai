"""Saved provider diameter explanation; no width or verdict evaluation."""

import math
from typing import Literal

from pydantic import BaseModel, Field


class DiameterReferenceDetail(BaseModel):
    axle: Literal["front", "rear"]
    rim_diameter_in: float | None = None
    reference_diameters_in: list[float] = Field(default_factory=list)
    reference_min_diameter_in: float | None = None
    reference_max_diameter_in: float | None = None
    reference_relation: Literal["below", "within_bounds", "above", "unknown"] = "unknown"
    exact_diameter_match: bool | None = None
    reference_scope: Literal["normalized_allowed_wheels"] = "normalized_allowed_wheels"


def _diameter(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    try:
        parsed = float(value)
    except OverflowError:
        return None
    return parsed if math.isfinite(parsed) and parsed > 0 else None


def diameter_reference_detail(
    submitted: object, references: object, *, axle: Literal["front", "rear"]
) -> DiameterReferenceDetail:
    values = (
        {
            diameter
            for row in references
            if isinstance(row, dict) and row.get("axle") == axle
            if (diameter := _diameter(row.get("rim_diameter"))) is not None
        }
        if isinstance(references, list)
        else set()
    )
    diameter = _diameter(submitted)
    detail = DiameterReferenceDetail(
        axle=axle, rim_diameter_in=diameter, reference_diameters_in=sorted(values)
    )
    if values:
        detail.reference_min_diameter_in = min(values)
        detail.reference_max_diameter_in = max(values)
        if diameter is not None:
            detail.reference_relation = (
                "below"
                if diameter < min(values)
                else "above"
                if diameter > max(values)
                else "within_bounds"
            )
            detail.exact_diameter_match = diameter in values
    return detail
