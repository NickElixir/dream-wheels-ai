"""Vehicle identification via VLM."""

from __future__ import annotations

import json
import logging
from typing import Any

from fitment_verdict.config import FitmentConfig
from fitment_verdict.schemas import Source, VehicleIdentificationResult, VehicleQuery
from fitment_verdict.utils import market_to_region

logger = logging.getLogger(__name__)

EXPECTED_OEM_SCHEMA: dict[str, Any] = {
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
}

CAR_IDENTIFICATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "make": {"type": "string"},
        "model": {"type": "string"},
        "year_from": {"type": ["integer", "null"]},
        "year_to": {"type": ["integer", "null"]},
        "body_type": {"type": ["string", "null"]},
        "market_guess": {"type": ["string", "null"]},
        "confidence": {"type": "number"},
        "notes": {"type": ["string", "null"]},
        "expected_oem": EXPECTED_OEM_SCHEMA,
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


def build_search_candidates(parsed: dict[str, Any], config: FitmentConfig) -> list[VehicleQuery]:
    year_from = parsed.get("year_from")
    year_to = parsed.get("year_to") or year_from
    if year_from is None:
        year_from = year_to
    if year_to is None:
        year_to = year_from
    if year_from is None or year_to is None:
        return []

    if year_to - year_from > config.max_vlm_year_span:
        year_to = year_from + config.max_vlm_year_span

    region = market_to_region(parsed.get("market_guess"))
    candidates: list[VehicleQuery] = []
    for year in range(int(year_from), int(year_to) + 1):
        candidates.append(
            VehicleQuery(
                make=parsed["make"],
                model=parsed["model"],
                year=year,
                body=parsed.get("body_type"),
                region=region,
                market=parsed.get("market_guess"),
                source=Source.vlm,
                confidence=float(parsed.get("confidence") or 0.0),
                is_user_confirmed=False,
            )
        )
    return candidates


def build_identification_result(
    parsed: dict[str, Any],
    *,
    model_used: str,
    config: FitmentConfig,
) -> VehicleIdentificationResult:
    return VehicleIdentificationResult(
        parsed=parsed,
        search_candidates=build_search_candidates(parsed, config),
        model_used=model_used,
    )


class MockVehicleVLM:
    """Deterministic VLM substitute for tests and offline runs."""

    def __init__(self, parsed: dict[str, Any], *, model_used: str = "mock-vlm") -> None:
        self._parsed = parsed
        self._model_used = model_used

    async def identify(self, image_bytes: bytes) -> VehicleIdentificationResult:
        from fitment_verdict.config import load_config

        return build_identification_result(
            self._parsed,
            model_used=self._model_used,
            config=load_config(),
        )


class OpenAIVehicleVLM:
    """Production VLM adapter. Not exercised in default unit tests."""

    PROMPT = (
        "Identify the car in the image as conservatively as possible. "
        "Return only JSON matching the schema. "
        "If exact year is uncertain, provide a small year range. "
        "confidence must be between 0 and 1. "
        "market_guess should be one of russia, chdm, eudm, usdm, jdm, kdm, or null. "
        "In expected_oem, provide typical FACTORY wheel mounting parameters for this "
        "vehicle from your knowledge: bolt_count, pcd_mm, center_bore_mm, and typical "
        "factory rim diameter / width / offset ranges. Use null for any value you are "
        "not reasonably sure about; set expected_oem to null if the vehicle itself is "
        "uncertain. These values are a rough prior, not a fitment decision."
    )

    def __init__(self, config: FitmentConfig) -> None:
        self._config = config

    async def identify(self, image_bytes: bytes) -> VehicleIdentificationResult:
        if not self._config.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required for OpenAIVehicleVLM")

        import base64

        from openai import OpenAI

        client = OpenAI(api_key=self._config.openai_api_key)
        data_url = "data:image/jpeg;base64," + base64.b64encode(image_bytes).decode("ascii")

        response = client.responses.create(
            model=self._config.vlm_model,
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": self.PROMPT},
                        {"type": "input_image", "image_url": data_url},
                    ],
                }
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "car_identification",
                    "schema": CAR_IDENTIFICATION_SCHEMA,
                    "strict": True,
                }
            },
        )
        raw_text = getattr(response, "output_text", None)
        if not raw_text:
            pieces: list[str] = []
            for item in getattr(response, "output", []) or []:
                for content in getattr(item, "content", []) or []:
                    text = getattr(content, "text", None)
                    if text:
                        pieces.append(text)
            raw_text = "\n".join(pieces).strip()

        parsed = json.loads(raw_text)
        return build_identification_result(
            parsed,
            model_used=self._config.vlm_model,
            config=self._config,
        )
