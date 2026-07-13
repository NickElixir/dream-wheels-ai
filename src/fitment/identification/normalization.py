"""Слияние источников RimSpec по trust-порядку с provenance.

Порядок доверия (handoff):
    user_confirmed > manufacturer_sku > user_input > ocr > vlm > unknown

Конфликты не затираются молча: значение с высшим trust побеждает, но все
кандидаты сохраняются вызывающей стороной (snapshot исходных spec'ов).
"""

from __future__ import annotations

from src.fitment.schemas import FieldValue, RimExtractionHints, RimSpec, Source

_TRUST_ORDER: dict[Source, int] = {
    Source.unknown: 0,
    Source.vlm: 1,
    Source.ocr: 2,
    Source.product_page: 3,
    Source.user_input: 3,
    Source.provider: 4,
    Source.catalog: 4,
    Source.partner_feed: 4,
    Source.manufacturer_sku: 5,
    Source.user_confirmed: 6,
}

_MERGEABLE_FIELDS = (
    "bolt_count",
    "pcd_mm",
    "center_bore_mm",
    "wheel_diameter_in",
    "wheel_width_j",
    "offset_et_mm",
    "load_rating_kg",
    "fastener_system",
    "seat_type",
    "thread_diameter_mm",
    "thread_pitch_mm",
    "bolt_length_mm",
)


def _trust(field: FieldValue) -> int:
    if not field.is_known:
        return -1
    base = _TRUST_ORDER[field.source]
    return base + 10 if field.is_user_confirmed else base


def merge_rim_specs(*specs: RimSpec) -> RimSpec:
    """Пофилдовое слияние: для каждого поля побеждает высший trust.

    Метаданные (brand/model/sku/url) берутся из первого spec'а, где заданы.
    """
    merged = RimSpec()
    for name in ("brand", "model", "sku", "product_url"):
        for spec in specs:
            value = getattr(spec, name)
            if value:
                setattr(merged, name, value)
                break

    for field_name in _MERGEABLE_FIELDS:
        best: FieldValue = getattr(merged, field_name)
        for spec in specs:
            candidate: FieldValue = getattr(spec, field_name)
            if _trust(candidate) > _trust(best):
                best = candidate
        setattr(merged, field_name, best)
    return merged


def rim_spec_from_hints(hints: RimExtractionHints) -> RimSpec:
    """VLM-подсказки → RimSpec с source=vlm (evidence E1).

    Diameter/width/bolt count могут быть визуальными оценками. PCD/ET
    разрешены VLM-промптом только при явно читаемой маркировке.
    """
    spec = RimSpec(brand=hints.brand, model=hints.model)
    confidence = min(hints.confidence, 0.5)  # E1: не выше "низкого" доверия

    def fv(value):
        return FieldValue(value=value, source=Source.vlm, confidence=confidence)

    if hints.suggested_diameter_in is not None:
        spec.wheel_diameter_in = fv(hints.suggested_diameter_in)
    if hints.suggested_width_j is not None:
        spec.wheel_width_j = fv(hints.suggested_width_j)
    if hints.suggested_offset_et_mm is not None:
        spec.offset_et_mm = fv(hints.suggested_offset_et_mm)
    if hints.suggested_bolt_count is not None:
        spec.bolt_count = fv(hints.suggested_bolt_count)
    if hints.suggested_pcd_mm is not None:
        spec.pcd_mm = fv(hints.suggested_pcd_mm)
    return spec
