"""Weighted, axle-aware risk assessment for confirmed fitment checks."""

from __future__ import annotations

from src.fitment.schemas import (
    ParameterRisk,
    ReasonCode,
    RiskAssessment,
    RiskLevel,
    RuleResult,
    VerdictStatus,
)

RISK_MODEL_VERSION = "v1"

_WEIGHTS = {
    "bolt_pattern": 35.0,
    "center_bore": 15.0,
    "size_offset": 35.0,
    "fasteners": 5.0,
    "load_rating": 10.0,
}
_FACTORS = {
    VerdictStatus.compatible: 0.0,
    VerdictStatus.compatible_with_conditions: 0.45,
    VerdictStatus.unknown: 0.7,
    VerdictStatus.incompatible: 1.0,
}
_BLOCKING = {
    ReasonCode.bolt_count_mismatch,
    ReasonCode.pcd_mismatch,
    ReasonCode.center_bore_too_small,
    ReasonCode.diameter_out_of_range,
    ReasonCode.offset_out_of_range,
    ReasonCode.load_rating_insufficient,
}
_RECOMMENDATIONS: dict[ReasonCode, tuple[str, str]] = {
    ReasonCode.vehicle_not_resolved: (
        "confirm_vehicle_identity",
        "Confirm vehicle year, generation and modification before relying on the verdict.",
    ),
    ReasonCode.bolt_count_mismatch: (
        "choose_correct_bolt_count",
        "Choose a rim with the same bolt-hole count as the vehicle hub.",
    ),
    ReasonCode.pcd_mismatch: (
        "choose_correct_pcd",
        "Choose a rim with the vehicle's exact PCD; adapters are not recommended.",
    ),
    ReasonCode.center_bore_too_small: (
        "choose_larger_center_bore",
        "The rim bore is smaller than the hub and cannot seat on the vehicle.",
    ),
    ReasonCode.hub_rings_required: (
        "install_hub_centric_rings",
        "Use correctly sized hub-centric rings and verify installation.",
    ),
    ReasonCode.offset_deviation_check_required: (
        "verify_suspension_and_arch_clearance",
        "Verify inner suspension and outer fender clearance for this offset.",
    ),
    ReasonCode.offset_not_verified: (
        "confirm_offset",
        "Confirm the stamped ET/offset before purchase.",
    ),
    ReasonCode.offset_out_of_range: (
        "choose_approved_offset",
        "Choose a rim within the vehicle's approved offset range.",
    ),
    ReasonCode.non_approved_size_check_required: (
        "verify_non_approved_size",
        "Verify rolling radius, tire size, brake and body clearance with a specialist.",
    ),
    ReasonCode.diameter_out_of_range: (
        "choose_approved_diameter",
        "Choose a diameter from the provider-approved fitment set.",
    ),
    ReasonCode.width_out_of_range: (
        "choose_approved_width",
        "Choose a width from the provider-approved fitment set.",
    ),
    ReasonCode.fastener_hardware_check_required: (
        "verify_fastener_hardware",
        "Verify seat type, bolt or nut system, thread and engagement length.",
    ),
    ReasonCode.load_rating_insufficient: (
        "choose_sufficient_load_rating",
        "Choose a rim whose load rating meets the required per-wheel load.",
    ),
    ReasonCode.pcd_unknown: (
        "provide_pcd",
        "Provide the rim PCD or a product link with technical specifications.",
    ),
    ReasonCode.center_bore_unknown: (
        "provide_center_bore",
        "Provide rim DIA/center bore to verify hub fit.",
    ),
    ReasonCode.size_unknown: (
        "provide_rim_size",
        "Provide rim diameter and width.",
    ),
    ReasonCode.fastener_unknown: (
        "provide_fastener_system",
        "Confirm the rim fastener system and seat type.",
    ),
    ReasonCode.load_rating_unknown: (
        "confirm_load_rating",
        "Confirm that rim load rating covers the vehicle axle load.",
    ),
    ReasonCode.allowed_set_empty: (
        "confirm_vehicle_modification",
        "Confirm vehicle generation and modification to obtain an approved wheel set.",
    ),
    ReasonCode.conflict_low_evidence: (
        "confirm_low_evidence_value",
        "A visual or unconfirmed value conflicts with provider data; verify the marking.",
    ),
}


def _risk_level(score: float, *, blocking: bool) -> RiskLevel:
    if blocking:
        return RiskLevel.critical
    if score < 10:
        return RiskLevel.low
    if score < 25:
        return RiskLevel.moderate
    if score < 45:
        return RiskLevel.elevated
    if score < 70:
        return RiskLevel.high
    return RiskLevel.critical


def build_risk_assessment(results: list[RuleResult]) -> RiskAssessment:
    axles = {result.axle for result in results if result.axle} or {None}
    axle_divisor = float(len(axles))
    parameter_risks: list[ParameterRisk] = []
    blocking_parameters: list[str] = []

    for result in results:
        weight = _WEIGHTS.get(result.rule, 0.0) / axle_divisor
        points = round(weight * _FACTORS[result.status], 2)
        is_blocking = result.reason_code in _BLOCKING
        rec = _RECOMMENDATIONS.get(result.reason_code)
        parameter_key = f"{result.axle}:{result.rule}" if result.axle else result.rule
        parameter_risks.append(
            ParameterRisk(
                parameter=result.rule,
                axle=result.axle,
                status=result.status,
                weight=weight,
                risk_points=points,
                is_blocking=is_blocking,
                reason_code=result.reason_code,
                recommendation_code=rec[0] if rec else None,
                recommendation=rec[1] if rec else None,
            )
        )
        if is_blocking and parameter_key not in blocking_parameters:
            blocking_parameters.append(parameter_key)

    score = round(min(100.0, sum(item.risk_points for item in parameter_risks)), 2)
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
        level=_risk_level(score, blocking=bool(blocking_parameters)),
        risk_model_version=RISK_MODEL_VERSION,
        blocking_parameters=blocking_parameters,
        parameter_risks=parameter_risks,
        recommendation_codes=recommendation_codes,
        recommendations=recommendations,
    )


def unresolved_vehicle_risk() -> RiskAssessment:
    recommendation_code, recommendation = _RECOMMENDATIONS[ReasonCode.vehicle_not_resolved]
    parameter = ParameterRisk(
        parameter="vehicle_identity",
        status=VerdictStatus.unknown,
        weight=100,
        risk_points=65,
        reason_code=ReasonCode.vehicle_not_resolved,
        recommendation_code=recommendation_code,
        recommendation=recommendation,
    )
    return RiskAssessment(
        score=65,
        level=RiskLevel.high,
        risk_model_version=RISK_MODEL_VERSION,
        parameter_risks=[parameter],
        recommendation_codes=[recommendation_code],
        recommendations=[recommendation],
    )


_PRELIMINARY_BASE = {
    VerdictStatus.compatible: 0.78,
    VerdictStatus.compatible_with_conditions: 0.58,
    VerdictStatus.unknown: 0.35,
    VerdictStatus.incompatible: 0.12,
}


def preliminary_fit_likelihood(
    status: VerdictStatus,
    *,
    vehicle_confidence: float,
    rim_confidence: float,
) -> float:
    confidence = max(0.0, min(1.0, (vehicle_confidence + rim_confidence) / 2))
    return round(_PRELIMINARY_BASE[status] * (0.45 + 0.55 * confidence), 2)
