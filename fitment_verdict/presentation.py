"""UX presentation for fitment verdict."""

from __future__ import annotations

from fitment_verdict.schemas import FitmentVerdict, RiskAssessment, VerdictStatus

STATUS_LABELS = {
    VerdictStatus.compatible: "preliminary_compatible",
    VerdictStatus.compatible_with_conditions: "requires_conditions",
    VerdictStatus.unknown: "requires_verification",
    VerdictStatus.incompatible: "incompatible",
}

PRELIMINARY_STATUS_LABELS = {
    VerdictStatus.compatible: "likely_fits",
    VerdictStatus.compatible_with_conditions: "likely_fits_with_conditions",
    VerdictStatus.unknown: "cannot_guess",
    VerdictStatus.incompatible: "likely_does_not_fit",
}


def build_presentation(verdict: FitmentVerdict) -> dict:
    headline = STATUS_LABELS[verdict.status]
    primary_reason = verdict.reasons[0] if verdict.reasons else None
    if not primary_reason and verdict.conditions:
        primary_reason = verdict.conditions[0]
    if not primary_reason and verdict.missing_data:
        primary_reason = "Critical evidence is missing."

    return {
        "headline_code": headline,
        "status": verdict.status.value,
        "is_preliminary": verdict.is_preliminary,
        "primary_reason_code": verdict.reason_codes[0] if verdict.reason_codes else None,
        "primary_condition_code": verdict.condition_codes[0] if verdict.condition_codes else None,
        "reason_codes": verdict.reason_codes,
        "condition_codes": verdict.condition_codes,
        "missing_data": verdict.missing_data,
        "disclaimer_code": "SPECIALIST_VERIFICATION_REQUIRED",
        "engine_version": verdict.engine_version,
        "tolerances_version": verdict.tolerances_version,
        "provider": verdict.provider,
        "summary_hint": primary_reason,
    }


def build_preliminary_presentation(verdict: FitmentVerdict, fit_likelihood: float) -> dict:
    """Stage-1 card: an explicit guess, never a final answer."""
    return {
        "stage": "preliminary",
        "headline_code": PRELIMINARY_STATUS_LABELS[verdict.status],
        "status": verdict.status.value,
        "fit_likelihood": fit_likelihood,
        "is_preliminary": True,
        "reason_codes": verdict.reason_codes,
        "condition_codes": verdict.condition_codes,
        "missing_data": verdict.missing_data,
        "disclaimer_code": "PRELIMINARY_VLM_GUESS_ONLY",
        "next_step_code": "CONFIRM_DATA_FOR_FULL_CHECK",
        "engine_version": verdict.engine_version,
        "tolerances_version": verdict.tolerances_version,
    }


def build_confirmed_presentation(verdict: FitmentVerdict, risk: RiskAssessment) -> dict:
    """Stage-2 card: verdict + weighted risk + actionable recommendations."""
    base = build_presentation(verdict)
    base.update(
        {
            "stage": "confirmed",
            "is_preliminary": False,
            "risk_score": risk.score,
            "risk_level": risk.level.value,
            "blocking_parameters": risk.blocking_parameters,
            "recommendation_codes": risk.recommendation_codes,
            "recommendations": risk.recommendations,
        }
    )
    return base
