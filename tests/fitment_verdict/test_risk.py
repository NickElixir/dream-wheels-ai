"""Unit tests for the weighted risk model."""

from __future__ import annotations

from fitment_verdict.rules.risk import build_risk_assessment, preliminary_fit_likelihood
from fitment_verdict.schemas import RimSpec, RiskLevel, RuleResult, Source, VerdictStatus


def _rule(rule: str, status: VerdictStatus, reason_code: str) -> RuleResult:
    return RuleResult(rule=rule, status=status, reason=reason_code, reason_code=reason_code)


def _full_rim() -> RimSpec:
    return RimSpec(
        diameter=19,
        width=8,
        offset=45,
        bolt_count=5,
        pcd_mm=108.0,
        center_bore_mm=63.4,
        fastener_seat="conical",
        load_rating=690,
        source=Source.user_confirmed,
        is_user_confirmed=True,
    ).sync_bolt_fields()


def test_all_compatible_is_low_risk():
    results = [
        _rule("bolt_pattern", VerdictStatus.compatible, "MOUNTING_OK"),
        _rule("center_bore", VerdictStatus.compatible, "BORE_OK"),
        _rule("size", VerdictStatus.compatible, "SIZE_EXACT_APPROVED"),
        _rule("offset", VerdictStatus.compatible, "OFFSET_OK"),
    ]
    risk = build_risk_assessment(results, rim=_full_rim())
    assert risk.score == 0
    assert risk.level == RiskLevel.low
    assert not risk.blocking_parameters


def test_conditions_produce_moderate_risk_and_recommendations():
    results = [
        _rule("bolt_pattern", VerdictStatus.compatible, "MOUNTING_OK"),
        _rule(
            "center_bore", VerdictStatus.compatible_with_conditions, "CONDITION_HUB_RINGS_REQUIRED"
        ),
        _rule("size", VerdictStatus.compatible_with_conditions, "SIZE_NOT_APPROVED"),
        _rule("offset", VerdictStatus.compatible, "OFFSET_OK"),
    ]
    risk = build_risk_assessment(results, rim=_full_rim())
    assert 10 <= risk.score < 45
    assert risk.level in {RiskLevel.moderate, RiskLevel.elevated}
    assert "REC_USE_HUB_RINGS" in risk.recommendation_codes
    assert "REC_VERIFY_SIZE" in risk.recommendation_codes


def test_wrong_pcd_is_critical_and_blocking():
    results = [
        _rule("bolt_pattern", VerdictStatus.incompatible, "MOUNTING_PCD_MISMATCH"),
        _rule("center_bore", VerdictStatus.compatible, "BORE_OK"),
        _rule("size", VerdictStatus.compatible, "SIZE_EXACT_APPROVED"),
    ]
    risk = build_risk_assessment(results, rim=_full_rim())
    assert risk.level == RiskLevel.critical
    assert "bolt_pattern" in risk.blocking_parameters
    assert "REC_WRONG_PCD" in risk.recommendation_codes


def test_missing_fastener_and_load_add_residual_risk():
    results = [
        _rule("bolt_pattern", VerdictStatus.compatible, "MOUNTING_OK"),
        _rule("center_bore", VerdictStatus.compatible, "BORE_OK"),
        _rule("size", VerdictStatus.compatible, "SIZE_EXACT_APPROVED"),
        _rule("offset", VerdictStatus.compatible, "OFFSET_OK"),
    ]
    bare_rim = _full_rim()
    bare_rim.fastener_seat = None
    bare_rim.load_rating = None
    risk = build_risk_assessment(results, rim=bare_rim)
    assert risk.score > 0
    assert "REC_PROVIDE_FASTENER_SEAT" in risk.recommendation_codes
    assert "REC_PROVIDE_LOAD_RATING" in risk.recommendation_codes
    assert not risk.blocking_parameters


def test_preliminary_fit_likelihood_ranges():
    high = preliminary_fit_likelihood(VerdictStatus.compatible, 0.9, 0.8)
    low = preliminary_fit_likelihood(VerdictStatus.incompatible, 0.9, 0.8)
    unknown = preliminary_fit_likelihood(VerdictStatus.unknown, None, None)
    assert 0.6 < high <= 1.0
    assert low < 0.15
    assert 0.1 < unknown < 0.5
