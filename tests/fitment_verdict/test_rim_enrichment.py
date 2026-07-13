"""Tests for rim enrichment from vehicle profile."""

from fitment_verdict.identification.rim_enrichment import enrich_rim_from_profile
from fitment_verdict.schemas import FitmentProfile, RimSpec, Source


def test_enrich_pcd_from_vehicle_when_lug_count_matches():
    profile = FitmentProfile(
        provider="wheel_size",
        fetched_at="2026-01-01T00:00:00Z",
        bolt_pattern="5x108",
        stud_holes=5,
        pcd=108.0,
        center_bore=63.4,
    )
    rim = RimSpec(bolt_count=5, diameter=18, width=8.5, source=Source.vlm, confidence=0.5)
    enriched = enrich_rim_from_profile(rim, profile)
    assert enriched.pcd_mm == 108.0
    assert enriched.bolt_pattern == "5x108"
