"""Rim understanding via VLM."""

from __future__ import annotations

import json
import logging
from typing import Any

from fitment_verdict.config import FitmentConfig
from fitment_verdict.schemas import RimSpec, Source

logger = logging.getLogger(__name__)

RIM_IDENTIFICATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "brand": {"type": ["string", "null"]},
        "model": {"type": ["string", "null"]},
        "style": {"type": ["string", "null"]},
        "finish": {"type": ["string", "null"]},
        "bolt_count": {"type": ["integer", "null"]},
        "diameter_estimate": {"type": ["number", "null"]},
        "width_estimate": {"type": ["number", "null"]},
        "offset_estimate": {"type": ["number", "null"]},
        "pcd_mm": {"type": ["number", "null"]},
        "center_bore_mm": {"type": ["number", "null"]},
        "marking_text": {"type": ["string", "null"]},
        "confidence": {"type": "number"},
        "notes": {"type": ["string", "null"]},
    },
    "required": [
        "brand",
        "model",
        "style",
        "finish",
        "bolt_count",
        "diameter_estimate",
        "width_estimate",
        "offset_estimate",
        "pcd_mm",
        "center_bore_mm",
        "marking_text",
        "confidence",
        "notes",
    ],
    "additionalProperties": False,
}


class MockRimVLM:
    def __init__(self, hints: dict | None = None) -> None:
        self._hints = hints or {}

    async def describe(self, image_bytes: bytes) -> dict:
        return self._hints


class OpenAIRimVLM:
    """Production rim VLM: brand/model/style + conservative size estimates from photo."""

    PROMPT = (
        "Analyze the wheel rim in the image for fitment identification. "
        "Identify brand and model if visible (center cap, casting, packaging). "
        "Estimate diameter and width in inches from visual proportions if no stamped marking is readable. "
        "Count visible lug holes for bolt_count. "
        "Only fill pcd_mm, center_bore_mm, offset_estimate if explicitly stamped or printed on the rim; "
        "otherwise leave them null. "
        "confidence is 0..1 for overall identification quality. "
        "Return only JSON matching the schema."
    )

    def __init__(self, config: FitmentConfig) -> None:
        self._config = config

    async def describe(self, image_bytes: bytes) -> dict:
        if not self._config.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required for OpenAIRimVLM")

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
                    "name": "rim_identification",
                    "schema": RIM_IDENTIFICATION_SCHEMA,
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

        return json.loads(raw_text)


def rim_spec_from_vlm_hints(hints: dict) -> RimSpec:
    diameter = hints.get("diameter") or hints.get("diameter_estimate")
    width = hints.get("width") or hints.get("width_estimate")
    offset = hints.get("offset") or hints.get("offset_estimate")

    return RimSpec(
        diameter=diameter,
        width=width,
        offset=offset,
        bolt_count=hints.get("bolt_count"),
        pcd_mm=hints.get("pcd_mm"),
        center_bore_mm=hints.get("center_bore_mm"),
        brand=hints.get("brand"),
        model=hints.get("model"),
        style=hints.get("style"),
        finish=hints.get("finish"),
        source=Source.vlm,
        confidence=float(hints.get("confidence") or 0.35),
        is_user_confirmed=False,
    ).sync_bolt_fields()
