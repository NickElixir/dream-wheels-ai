"""Verdict assembly from rule results."""

from __future__ import annotations

from fitment_verdict.config import FitmentConfig
from fitment_verdict.schemas import (
    FitmentProfile,
    FitmentVerdict,
    RimSpec,
    RuleResult,
    VehicleQuery,
    VerdictStatus,
)

STATUS_PRIORITY = {
    VerdictStatus.incompatible: 4,
    VerdictStatus.unknown: 3,
    VerdictStatus.compatible_with_conditions: 2,
    VerdictStatus.compatible: 1,
}


def _collect_lists(
    rule_results: list[RuleResult],
) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    reasons: list[str] = []
    reason_codes: list[str] = []
    conditions: list[str] = []
    condition_codes: list[str] = []
    missing_data: list[str] = []

    for item in rule_results:
        if item.reason_code.startswith("EVIDENCE_MISSING"):
            missing_data.append(item.reason_code)
        if item.status == VerdictStatus.incompatible:
            reasons.append(item.reason)
            reason_codes.append(item.reason_code)
        elif item.status == VerdictStatus.unknown:
            reasons.append(item.reason)
            reason_codes.append(item.reason_code)
        elif item.status == VerdictStatus.compatible_with_conditions:
            conditions.append(item.reason)
            condition_codes.append(item.reason_code)

    return reasons, reason_codes, conditions, condition_codes, missing_data


def assemble_verdict(
    *,
    rule_results: list[RuleResult],
    vehicle: VehicleQuery,
    rim: RimSpec,
    profile: FitmentProfile | None,
    config: FitmentConfig,
    is_preliminary: bool = True,
) -> FitmentVerdict:
    if not rule_results:
        status = VerdictStatus.unknown
    else:
        status = max(
            (item.status for item in rule_results),
            key=lambda value: STATUS_PRIORITY[value],
        )

    reasons, reason_codes, conditions, condition_codes, missing_data = _collect_lists(rule_results)

    if status == VerdictStatus.compatible:
        low_evidence = rim.source.value in {"vlm", "ocr", "unknown"} and not rim.is_user_confirmed
        if low_evidence and (rim.offset is None or rim.center_bore_mm is None):
            status = VerdictStatus.unknown
            missing_data.extend(["EVIDENCE_LOW_CONFIDENCE_RIM"])

    return FitmentVerdict(
        status=status,
        rule_results=rule_results,
        reasons=reasons,
        reason_codes=reason_codes,
        conditions=conditions,
        condition_codes=condition_codes,
        missing_data=sorted(set(missing_data)),
        vehicle=vehicle,
        rim=rim,
        profile_ref=profile.raw_response_ref if profile else None,
        engine_version=config.engine_version,
        tolerances_version=config.tolerances_version,
        provider=config.fitment_provider,
        is_preliminary=is_preliminary,
    )
