"""Weighted risk scoring and recommendations for confirmed fitment checks."""

from __future__ import annotations

from fitment_verdict.schemas import (
    ParameterRisk,
    RimSpec,
    RiskAssessment,
    RiskLevel,
    RuleResult,
    VerdictStatus,
)

RISK_MODEL_VERSION = "v1"

# Parameter weights, sum ~100. Mounting geometry dominates: wrong bolt pattern
# or a too-small bore cannot be worked around, unlike offset or width nuances.
RISK_WEIGHTS: dict[str, float] = {
    "bolt_pattern": 35.0,
    "center_bore": 15.0,
    "size": 20.0,
    "offset": 15.0,
    "fastener_seat": 5.0,
    "load_rating": 5.0,
    "other": 5.0,
}

STATUS_FACTOR: dict[VerdictStatus, float] = {
    VerdictStatus.compatible: 0.0,
    VerdictStatus.compatible_with_conditions: 0.45,
    VerdictStatus.unknown: 0.7,
    VerdictStatus.incompatible: 1.0,
}

BLOCKING_REASON_CODES = {
    "MOUNTING_BOLT_COUNT_MISMATCH",
    "MOUNTING_BOLT_PATTERN_MISMATCH",
    "MOUNTING_PCD_MISMATCH",
    "MOUNTING_BORE_TOO_SMALL",
    "OFFSET_OUT_OF_RANGE",
}

# reason_code -> (recommendation_code, recommendation text)
RECOMMENDATIONS: dict[str, tuple[str, str]] = {
    "MOUNTING_BOLT_COUNT_MISMATCH": (
        "REC_WRONG_BOLT_COUNT",
        "The rim has a different number of bolt holes than the hub. Choose a rim with the vehicle's bolt pattern.",
    ),
    "MOUNTING_BOLT_PATTERN_MISMATCH": (
        "REC_WRONG_BOLT_PATTERN",
        "Bolt pattern does not match the hub. Choose a rim with the vehicle's factory bolt pattern.",
    ),
    "MOUNTING_PCD_MISMATCH": (
        "REC_WRONG_PCD",
        "PCD does not match the hub. Adapters are not recommended; choose a rim with the correct PCD.",
    ),
    "MOUNTING_BORE_TOO_SMALL": (
        "REC_BORE_TOO_SMALL",
        "Center bore is smaller than the hub; the rim will not seat. Choose a rim with DIA at least equal to the hub diameter.",
    ),
    "CONDITION_HUB_RINGS_REQUIRED": (
        "REC_USE_HUB_RINGS",
        "Center bore is larger than the hub. Install hub-centric rings of the matching size.",
    ),
    "SIZE_NOT_APPROVED": (
        "REC_VERIFY_SIZE",
        "This size is not in the approved fitment list for the vehicle. Verify rolling radius and clearance with a specialist.",
    ),
    "CONDITION_OFFSET_UNVERIFIED": (
        "REC_CONFIRM_OFFSET",
        "Offset (ET) could not be fully verified. Confirm the stamped ET value before purchase.",
    ),
    "CONDITION_OFFSET_INWARD": (
        "REC_CHECK_SUSPENSION_CLEARANCE",
        "Offset moves the wheel inward. Check clearance to suspension components.",
    ),
    "CONDITION_OFFSET_OUTWARD": (
        "REC_CHECK_ARCH_CLEARANCE",
        "Offset moves the wheel outward. Check fender/arch clearance and local regulations.",
    ),
    "CONDITION_OFFSET_CLEARANCE": (
        "REC_CHECK_CLEARANCE",
        "Offset differs from OEM. Clearance verification is required.",
    ),
    "OFFSET_OUT_OF_RANGE": (
        "REC_OFFSET_INCOMPATIBLE",
        "Offset is far outside the acceptable range for this vehicle. Not recommended to install.",
    ),
    "EVIDENCE_MISSING_RIM_PCD": (
        "REC_PROVIDE_PCD",
        "Provide the rim bolt pattern (e.g. 5x108) or a product link to complete the check.",
    ),
    "EVIDENCE_MISSING_RIM_BORE": (
        "REC_PROVIDE_BORE",
        "Provide the rim center bore (DIA) to verify hub fit.",
    ),
    "EVIDENCE_MISSING_RIM_SIZE": (
        "REC_PROVIDE_SIZE",
        "Provide rim diameter and width to verify against approved sizes.",
    ),
    "EVIDENCE_MISSING_VEHICLE_PCD": (
        "REC_CONFIRM_VEHICLE",
        "Vehicle mounting data is unavailable. Confirm make/model/year/modification.",
    ),
    "EVIDENCE_MISSING_VEHICLE_BORE": (
        "REC_CONFIRM_VEHICLE",
        "Vehicle hub data is unavailable. Confirm make/model/year/modification.",
    ),
    "EVIDENCE_MISSING_PROFILE": (
        "REC_CONFIRM_VEHICLE",
        "No approved wheel list found for this vehicle. Confirm vehicle details or modification.",
    ),
    "EVIDENCE_MISSING_PROFILE_AND_ET": (
        "REC_PROVIDE_OFFSET",
        "Provide rim offset (ET) — without it and without provider data the check cannot proceed.",
    ),
    "REC_PROVIDE_FASTENER_SEAT": (
        "REC_PROVIDE_FASTENER_SEAT",
        "Fastener seat type (conical/ball/flat) is unknown. Verify seat compatibility with the vehicle's bolts or nuts.",
    ),
    "REC_PROVIDE_LOAD_RATING": (
        "REC_PROVIDE_LOAD_RATING",
        "Rim load rating is unknown. Verify it covers the vehicle's axle load.",
    ),
}

_LEVEL_BOUNDS: list[tuple[float, RiskLevel]] = [
    (10.0, RiskLevel.low),
    (25.0, RiskLevel.moderate),
    (45.0, RiskLevel.elevated),
    (70.0, RiskLevel.high),
]


def _rule_to_parameter(rule: str) -> str:
    return rule if rule in RISK_WEIGHTS else "other"


def _score_to_level(score: float) -> RiskLevel:
    for bound, level in _LEVEL_BOUNDS:
        if score < bound:
            return level
    return RiskLevel.critical


def _recommendation_for(reason_code: str) -> tuple[str | None, str | None]:
    rec = RECOMMENDATIONS.get(reason_code)
    return rec if rec else (None, None)


def build_risk_assessment(
    rule_results: list[RuleResult],
    rim: RimSpec | None = None,
) -> RiskAssessment:
    """Aggregate rule results into a weighted risk score with recommendations.

    Per parameter we keep the worst rule result; residual informational risks
    (missing fastener seat / load rating) are added on top without affecting
    the verdict itself.
    """
    worst_per_parameter: dict[str, RuleResult] = {}
    for item in rule_results:
        parameter = _rule_to_parameter(item.rule)
        current = worst_per_parameter.get(parameter)
        if current is None or STATUS_FACTOR[item.status] > STATUS_FACTOR[current.status]:
            worst_per_parameter[parameter] = item

    parameter_risks: list[ParameterRisk] = []
    blocking: list[str] = []

    for parameter, item in sorted(worst_per_parameter.items()):
        weight = RISK_WEIGHTS.get(parameter, RISK_WEIGHTS["other"])
        points = round(weight * STATUS_FACTOR[item.status], 2)
        is_blocking = item.reason_code in BLOCKING_REASON_CODES
        rec_code, rec_text = _recommendation_for(item.reason_code)
        parameter_risks.append(
            ParameterRisk(
                parameter=parameter,
                status=item.status,
                weight=weight,
                risk_points=points,
                is_blocking=is_blocking,
                reason_code=item.reason_code,
                recommendation_code=rec_code,
                recommendation=rec_text,
            )
        )
        if is_blocking:
            blocking.append(parameter)

    if rim is not None:
        for field, parameter, code in (
            ("fastener_seat", "fastener_seat", "REC_PROVIDE_FASTENER_SEAT"),
            ("load_rating", "load_rating", "REC_PROVIDE_LOAD_RATING"),
        ):
            if getattr(rim, field, None) is None:
                weight = RISK_WEIGHTS[parameter]
                rec_code, rec_text = _recommendation_for(code)
                parameter_risks.append(
                    ParameterRisk(
                        parameter=parameter,
                        status=VerdictStatus.unknown,
                        weight=weight,
                        risk_points=round(weight * STATUS_FACTOR[VerdictStatus.unknown], 2),
                        is_blocking=False,
                        reason_code=code,
                        recommendation_code=rec_code,
                        recommendation=rec_text,
                    )
                )

    score = round(min(100.0, sum(item.risk_points for item in parameter_risks)), 2)
    level = RiskLevel.critical if blocking else _score_to_level(score)

    seen: set[str] = set()
    recommendation_codes: list[str] = []
    recommendations: list[str] = []
    for item in parameter_risks:
        if item.recommendation_code and item.recommendation_code not in seen:
            seen.add(item.recommendation_code)
            recommendation_codes.append(item.recommendation_code)
            recommendations.append(item.recommendation or item.recommendation_code)

    return RiskAssessment(
        score=score,
        level=level,
        blocking_parameters=blocking,
        parameter_risks=parameter_risks,
        recommendation_codes=recommendation_codes,
        recommendations=recommendations,
    )


_LIKELIHOOD_BASE: dict[VerdictStatus, float] = {
    VerdictStatus.compatible: 0.85,
    VerdictStatus.compatible_with_conditions: 0.6,
    VerdictStatus.unknown: 0.4,
    VerdictStatus.incompatible: 0.1,
}


def preliminary_fit_likelihood(
    status: VerdictStatus,
    vehicle_confidence: float | None,
    rim_confidence: float | None,
) -> float:
    """Rough 0..1 'will it fit' guess for stage 1, scaled by VLM confidence."""
    confidences = [c for c in (vehicle_confidence, rim_confidence) if c is not None]
    conf = sum(confidences) / len(confidences) if confidences else 0.3
    conf = max(0.2, min(1.0, conf))
    return round(_LIKELIHOOD_BASE[status] * (0.45 + 0.55 * conf), 2)
