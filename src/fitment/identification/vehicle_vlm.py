"""Идентификация авто по фото: VLM → консервативные кандидаты (evidence E1).

Правила промпта — из прототипа wheel_fitment_test_v2/vlm_model_probe.py:
консервативно, диапазон годов при неуверенности, confidence 0..1, не
упоминать fitment. Ответ валидируется Pydantic'ом; невалидный → пусто.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError

from src.fitment.config import FITMENT_VLM_MIN_CONFIDENCE
from src.fitment.identification.vlm_client import VlmClient
from src.fitment.schemas import (
    ExpectedOemSpec,
    Source,
    VehicleCandidate,
    VehicleIdentification,
    VehicleIdentity,
)

logger = logging.getLogger(__name__)

_MAX_YEAR_SPAN = 2

VEHICLE_ID_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "make": {"type": ["string", "null"]},
        "model": {"type": ["string", "null"]},
        "year_from": {"type": ["integer", "null"]},
        "year_to": {"type": ["integer", "null"]},
        "body_type": {"type": ["string", "null"]},
        "market_guess": {"type": ["string", "null"]},
        "confidence": {"type": "number"},
        "notes": {"type": ["string", "null"]},
        "expected_oem": {
            "type": ["object", "null"],
            "properties": {
                "bolt_count": {"type": ["integer", "null"]},
                "pcd_mm": {"type": ["number", "null"]},
                "center_bore_mm": {"type": ["number", "null"]},
                "rim_diameter_min": {"type": ["number", "null"]},
                "rim_diameter_max": {"type": ["number", "null"]},
                "rim_width_min": {"type": ["number", "null"]},
                "rim_width_max": {"type": ["number", "null"]},
                "offset_min": {"type": ["number", "null"]},
                "offset_max": {"type": ["number", "null"]},
            },
            "required": [
                "bolt_count",
                "pcd_mm",
                "center_bore_mm",
                "rim_diameter_min",
                "rim_diameter_max",
                "rim_width_min",
                "rim_width_max",
                "offset_min",
                "offset_max",
            ],
            "additionalProperties": False,
        },
    },
    "required": [
        "make",
        "model",
        "year_from",
        "year_to",
        "body_type",
        "market_guess",
        "confidence",
        "notes",
        "expected_oem",
    ],
    "additionalProperties": False,
}

VEHICLE_ID_PROMPT = (
    "Identify the car in the image as conservatively as possible. "
    "Return only the JSON object matching the schema. Rules: "
    "1) If exact year is uncertain, provide a small year range via year_from/year_to. "
    "2) If you are unsure of the model, return the most likely model and explain "
    "uncertainty in notes. "
    "3) confidence must be between 0 and 1. "
    "4) market_guess should be a short value like russia, chdm, eudm, usdm, jdm, or "
    "null if unknown. "
    "5) If there is no car in the image, return null make and model with confidence 0. "
    "6) expected_oem is a conservative prior from your vehicle knowledge: typical factory "
    "bolt count, PCD, center bore and wheel size/offset ranges. Use null for every value "
    "you are not reasonably sure about, and null for the whole object if vehicle identity "
    "is uncertain. It is not a compatibility verdict. "
    "7) Do not decide whether any wheel fits the car."
)


async def identify_vehicle(
    vlm: VlmClient,
    *,
    image_b64: str,
    image_mime: str = "image/jpeg",
) -> list[VehicleCandidate]:
    """Фото → отсортированные кандидаты. Пусто, если VLM не уверен/не нашёл авто."""
    result = await identify_vehicle_detailed(
        vlm,
        image_b64=image_b64,
        image_mime=image_mime,
    )
    return result.candidates


async def identify_vehicle_detailed(
    vlm: VlmClient,
    *,
    image_b64: str,
    image_mime: str = "image/jpeg",
) -> VehicleIdentification:
    """Фото → VLM prediction с raw payload и low-trust OEM prior."""
    raw = await vlm.complete_json(
        prompt=VEHICLE_ID_PROMPT,
        image_b64=image_b64,
        image_mime=image_mime,
        schema_name="vehicle_identification",
        json_schema=VEHICLE_ID_SCHEMA,
    )

    if not raw.get("make") or not raw.get("model"):
        return VehicleIdentification(
            vlm_model=getattr(vlm, "model_name", None),
            raw=raw,
        )

    try:
        candidate = VehicleCandidate(
            make=str(raw["make"]),
            model=str(raw["model"]),
            year_from=raw.get("year_from"),
            year_to=raw.get("year_to"),
            body=raw.get("body_type"),
            market=raw.get("market_guess"),
            confidence=float(raw.get("confidence") or 0.0),
            notes=raw.get("notes"),
        )
    except (ValidationError, TypeError, ValueError) as exc:
        logger.warning("VLM vehicle payload не прошёл валидацию: %s", exc)
        return VehicleIdentification(
            vlm_model=getattr(vlm, "model_name", None),
            raw=raw,
        )

    if candidate.confidence < FITMENT_VLM_MIN_CONFIDENCE:
        logger.info(
            "🔎 VLM confidence %.2f < %.2f: кандидат не используется автоматически",
            candidate.confidence,
            FITMENT_VLM_MIN_CONFIDENCE,
        )
        return VehicleIdentification(
            candidates=[candidate],
            vlm_model=getattr(vlm, "model_name", None),
            raw=raw,
        )

    expected_oem = None
    if isinstance(raw.get("expected_oem"), dict):
        try:
            expected_oem = ExpectedOemSpec.model_validate(raw["expected_oem"])
        except ValidationError as exc:
            logger.info("🔎 VLM expected_oem отброшен: %s", exc)

    identities = candidates_to_identities([candidate])
    return VehicleIdentification(
        candidates=[candidate],
        selected=identities[0] if identities else None,
        expected_oem=expected_oem,
        vlm_model=getattr(vlm, "model_name", None),
        raw=raw,
    )


def candidates_to_identities(candidates: list[VehicleCandidate]) -> list[VehicleIdentity]:
    """Кандидат с диапазоном годов → плоский список identity (год к году).

    Диапазон ограничен _MAX_YEAR_SPAN, свежие годы первыми: меньше
    search-запросов к провайдеру, свежие данные чаще релевантны.
    """
    identities: list[VehicleIdentity] = []
    for cand in sorted(candidates, key=lambda c: c.confidence, reverse=True):
        year_from = cand.year_from or cand.year_to
        year_to = cand.year_to or cand.year_from
        if year_from is None or year_to is None:
            continue
        year_to = min(year_to, year_from + _MAX_YEAR_SPAN)
        for year in range(year_to, year_from - 1, -1):
            identities.append(
                VehicleIdentity(
                    make=cand.make,
                    model=cand.model,
                    year=year,
                    body=cand.body,
                    market=cand.market,
                    source=Source.vlm,
                    confidence=cand.confidence,
                    is_user_confirmed=False,
                )
            )
    return identities
