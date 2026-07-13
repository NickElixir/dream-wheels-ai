"""Merge vehicle/rim fields by trust order."""

from __future__ import annotations

from fitment_verdict.schemas import ProvenanceField, RimSpec, Source, VehicleQuery

TRUST_ORDER = {
    Source.user_confirmed: 6,
    Source.user_input: 5,
    Source.catalog: 4,
    Source.partner_feed: 4,
    Source.provider: 3,
    Source.ocr: 2,
    Source.vlm: 1,
    Source.unknown: 0,
}


def _pick[T](
    current: T | None, candidate: T | None, current_source: Source, candidate_source: Source
) -> tuple[T | None, Source]:
    if candidate is None:
        return current, current_source
    if current is None:
        return candidate, candidate_source
    if TRUST_ORDER[candidate_source] >= TRUST_ORDER[current_source]:
        return candidate, candidate_source
    return current, current_source


def merge_vehicle(base: VehicleQuery | None, override: VehicleQuery | None) -> VehicleQuery:
    result = (override or base or VehicleQuery()).model_copy(deep=True)
    if base and override:
        for field in (
            "make",
            "model",
            "year",
            "generation",
            "modification",
            "body",
            "region",
            "market",
            "make_slug",
            "model_slug",
            "generation_slug",
            "modification_slug",
        ):
            base_val = getattr(base, field)
            override_val = getattr(override, field)
            picked, _source = _pick(base_val, override_val, base.source, override.source)
            setattr(result, field, picked)
            if picked == override_val and override_val is not None:
                result.source = override.source
                result.confidence = max(result.confidence, override.confidence)
                result.is_user_confirmed = override.is_user_confirmed or result.is_user_confirmed
    return result


def merge_rim(base: RimSpec | None, override: RimSpec | None) -> RimSpec:
    result = (override or base or RimSpec()).model_copy(deep=True).sync_bolt_fields()
    if not base or not override:
        return result

    numeric_fields = (
        "diameter",
        "width",
        "offset",
        "bolt_count",
        "pcd_mm",
        "center_bore_mm",
        "load_rating",
    )
    text_fields = ("brand", "model", "style", "finish", "fastener_seat")

    for field in (*numeric_fields, *text_fields):
        base_val = getattr(base, field)
        override_val = getattr(override, field)
        picked, source = _pick(base_val, override_val, base.source, override.source)
        setattr(result, field, picked)
        if picked is not None:
            result.field_provenance[field] = ProvenanceField(
                value=picked,
                source=source,
                confidence=max(base.confidence, override.confidence),
                is_user_confirmed=override.is_user_confirmed or base.is_user_confirmed,
            )

    result.source = max([base.source, override.source], key=lambda item: TRUST_ORDER[item])
    result.confidence = max(base.confidence, override.confidence)
    result.is_user_confirmed = base.is_user_confirmed or override.is_user_confirmed
    return result.sync_bolt_fields()
