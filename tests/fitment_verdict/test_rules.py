"""Golden tests for deterministic fitment rules."""

from fitment_verdict.config import FitmentConfig
from fitment_verdict.rules.engine import evaluate
from fitment_verdict.rules.verdict import assemble_verdict
from fitment_verdict.schemas import RimSpec, Source, VerdictStatus


def test_incompatible_pcd(sample_profile):
    rim = RimSpec(
        diameter=18,
        width=7,
        offset=40,
        bolt_pattern="5x108",
        pcd_mm=108.0,
        center_bore_mm=66.6,
        source=Source.user_confirmed,
        is_user_confirmed=True,
    ).sync_bolt_fields()
    results = evaluate(sample_profile, rim)
    verdict = assemble_verdict(
        rule_results=results,
        vehicle=sample_profile.vehicle_query,
        rim=rim,
        profile=sample_profile,
        config=FitmentConfig(),
    )
    assert verdict.status == VerdictStatus.incompatible
    assert "MOUNTING" in verdict.reason_codes[0]


def test_conditions_hub_rings(sample_profile):
    rim = RimSpec(
        diameter=18,
        width=7,
        offset=40,
        bolt_pattern="5x114.3",
        pcd_mm=114.3,
        center_bore_mm=67.1,
        source=Source.user_confirmed,
        is_user_confirmed=True,
    ).sync_bolt_fields()
    results = evaluate(sample_profile, rim)
    verdict = assemble_verdict(
        rule_results=results,
        vehicle=sample_profile.vehicle_query,
        rim=rim,
        profile=sample_profile,
        config=FitmentConfig(),
    )
    assert verdict.status == VerdictStatus.compatible_with_conditions
    assert "CONDITION_HUB_RINGS_REQUIRED" in verdict.condition_codes


def test_compatible_exact_fit(sample_profile):
    rim = RimSpec(
        diameter=18,
        width=7,
        offset=40,
        bolt_pattern="5x114.3",
        pcd_mm=114.3,
        center_bore_mm=66.6,
        source=Source.user_confirmed,
        is_user_confirmed=True,
    ).sync_bolt_fields()
    results = evaluate(sample_profile, rim)
    verdict = assemble_verdict(
        rule_results=results,
        vehicle=sample_profile.vehicle_query,
        rim=rim,
        profile=sample_profile,
        config=FitmentConfig(),
    )
    assert verdict.status == VerdictStatus.compatible


def test_unknown_missing_rim_size(sample_profile):
    rim = RimSpec(
        bolt_pattern="5x114.3",
        pcd_mm=114.3,
        center_bore_mm=66.6,
        source=Source.user_confirmed,
        is_user_confirmed=True,
    ).sync_bolt_fields()
    results = evaluate(sample_profile, rim)
    verdict = assemble_verdict(
        rule_results=results,
        vehicle=sample_profile.vehicle_query,
        rim=rim,
        profile=sample_profile,
        config=FitmentConfig(),
    )
    assert verdict.status == VerdictStatus.unknown
    assert "EVIDENCE_MISSING_RIM_SIZE" in verdict.missing_data
