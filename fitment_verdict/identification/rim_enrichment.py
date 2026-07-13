"""Post-VLM rim enrichment using vehicle profile and Wheel-Size cross-check."""

from __future__ import annotations

from fitment_verdict.schemas import FitmentProfile, ProvenanceField, RimSpec, Source


def enrich_rim_from_profile(rim: RimSpec, profile: FitmentProfile) -> RimSpec:
    """Fill missing mounting fields from the resolved vehicle profile.

    When the user asks whether a photographed rim fits *their* car and lug count
    matches, PCD is assumed equal to the vehicle hub until OCR/VLM proves otherwise.
    """
    result = rim.model_copy(deep=True).sync_bolt_fields()
    if profile.stud_holes and result.bolt_count == profile.stud_holes:
        if result.pcd_mm is None and profile.pcd is not None:
            result.pcd_mm = profile.pcd
            result.bolt_pattern = profile.bolt_pattern
            result.field_provenance["pcd_mm"] = ProvenanceField(
                value=profile.pcd,
                source=Source.vlm,
                confidence=min(result.confidence, 0.38),
                is_user_confirmed=False,
            )
    return result.sync_bolt_fields()


def apply_vlm_estimates(hints: dict) -> RimSpec:
    """Map VLM estimate fields onto RimSpec numeric fields."""
    from fitment_verdict.identification.rim_vlm import rim_spec_from_vlm_hints

    mapped = dict(hints)
    for src, dst in (
        ("diameter_estimate", "diameter"),
        ("width_estimate", "width"),
        ("offset_estimate", "offset"),
    ):
        if mapped.get(dst) is None and mapped.get(src) is not None:
            mapped[dst] = mapped[src]
    return rim_spec_from_vlm_hints(mapped)
