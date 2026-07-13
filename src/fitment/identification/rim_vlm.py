"""Понимание диска по фото: VLM → RimExtractionHints (mode 1, visual-support).

Это подсказки для форм/рендера (evidence E1), НЕ технический вердикт.
Числовые «спеки» VLM заполняет только если на фото явно видна маркировка;
иначе null — правило прошито в промпт и продублировано валидацией.
"""

from __future__ import annotations

import logging
from typing import Any

from src.fitment.identification.vlm_client import VlmClient
from src.fitment.schemas import RimExtractionHints

logger = logging.getLogger(__name__)

RIM_HINTS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "brand": {"type": ["string", "null"]},
        "model": {"type": ["string", "null"]},
        "style": {"type": ["string", "null"]},
        "spoke_count": {"type": ["integer", "null"]},
        "primary_color": {"type": ["string", "null"]},
        "finish": {"type": ["string", "null"]},
        "visible_marking_text": {"type": ["string", "null"]},
        "suggested_diameter_in": {"type": ["number", "null"]},
        "suggested_width_j": {"type": ["number", "null"]},
        "suggested_offset_et_mm": {"type": ["number", "null"]},
        "suggested_bolt_count": {"type": ["integer", "null"]},
        "suggested_pcd_mm": {"type": ["number", "null"]},
        "confidence": {"type": "number"},
        "notes": {"type": ["string", "null"]},
    },
    "required": [
        "brand",
        "model",
        "style",
        "spoke_count",
        "primary_color",
        "finish",
        "visible_marking_text",
        "suggested_diameter_in",
        "suggested_width_j",
        "suggested_offset_et_mm",
        "suggested_bolt_count",
        "suggested_pcd_mm",
        "confidence",
        "notes",
    ],
    "additionalProperties": False,
}

RIM_HINTS_PROMPT = (
    "Identify and describe the wheel rim in the image. Return only the JSON object matching "
    "the schema. Rules: "
    "1) Identify brand/model only from visible logo, center cap, casting or distinctive "
    "catalog design; otherwise null. style is one of: mesh, multi-spoke, 5-spoke, 6-spoke, dish, split-spoke, "
    "turbine, other. "
    "2) suggested_diameter_in and suggested_width_j may be conservative visual estimates "
    "from proportions and common product sizes. Use null if the image gives no useful scale. "
    "3) suggested_bolt_count may be counted from clearly visible mounting holes. "
    "4) suggested_offset_et_mm and suggested_pcd_mm are allowed ONLY when a marking/label "
    "is clearly readable; never infer PCD from the number of holes. "
    "5) visible_marking_text: transcribe all visible technical marking verbatim, else null. "
    "6) confidence must be between 0 and 1 and includes identification and estimate quality. "
    "7) Do not decide whether this rim fits any car."
)


async def extract_rim_hints(
    vlm: VlmClient,
    *,
    image_b64: str,
    image_mime: str = "image/jpeg",
) -> RimExtractionHints | None:
    raw = await vlm.complete_json(
        prompt=RIM_HINTS_PROMPT,
        image_b64=image_b64,
        image_mime=image_mime,
        schema_name="rim_extraction_hints",
        json_schema=RIM_HINTS_SCHEMA,
    )

    try:
        return RimExtractionHints(
            brand=raw.get("brand"),
            model=raw.get("model"),
            style=raw.get("style"),
            spoke_count=raw.get("spoke_count"),
            primary_color=raw.get("primary_color"),
            finish=raw.get("finish"),
            visible_marking_text=raw.get("visible_marking_text"),
            suggested_diameter_in=raw.get("suggested_diameter_in"),
            suggested_width_j=raw.get("suggested_width_j"),
            suggested_offset_et_mm=raw.get("suggested_offset_et_mm"),
            suggested_bolt_count=raw.get("suggested_bolt_count"),
            suggested_pcd_mm=raw.get("suggested_pcd_mm"),
            confidence=float(raw.get("confidence") or 0.0),
            notes=raw.get("notes"),
        )
    except (TypeError, ValueError) as exc:
        logger.warning("VLM rim payload не прошёл валидацию: %s", exc)
        return None
