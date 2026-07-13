"""Rim marking OCR parsing (text-first; image OCR optional later)."""

from __future__ import annotations

import re

from fitment_verdict.schemas import RimSpec, Source

SIZE_RE = re.compile(r"\b(\d{1,2}(?:\.\d)?)\s*[xX×]\s*(\d{1,2}(?:\.\d)?)\b")
ET_RE = re.compile(r"\bET\s*(-?\d{1,3})\b", re.IGNORECASE)
BOLT_RE = re.compile(r"\b(\d)\s*[xX×]\s*(\d{2,3}(?:\.\d)?)\b")
CB_RE = re.compile(r"\bCB\s*(\d{2,3}(?:\.\d)?)\b", re.IGNORECASE)


def parse_rim_text(text: str) -> RimSpec:
    diameter = width = offset = bolt_count = pcd_mm = center_bore_mm = None

    size_match = SIZE_RE.search(text)
    if size_match:
        diameter = float(size_match.group(1))
        width = float(size_match.group(2))

    et_match = ET_RE.search(text)
    if et_match:
        offset = float(et_match.group(1))

    bolt_match = BOLT_RE.search(text)
    if bolt_match:
        bolt_count = int(bolt_match.group(1))
        pcd_mm = float(bolt_match.group(2))

    cb_match = CB_RE.search(text)
    if cb_match:
        center_bore_mm = float(cb_match.group(1))

    confidence = 0.75 if any([diameter, bolt_count, offset]) else 0.0
    return RimSpec(
        diameter=diameter,
        width=width,
        offset=offset,
        bolt_count=bolt_count,
        pcd_mm=pcd_mm,
        center_bore_mm=center_bore_mm,
        source=Source.ocr if confidence > 0 else Source.unknown,
        confidence=confidence,
        is_user_confirmed=False,
    ).sync_bolt_fields()
