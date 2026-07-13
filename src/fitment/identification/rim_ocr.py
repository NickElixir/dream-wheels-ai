"""Парсинг маркировки диска из OCR/VLM-текста.

Сам OCR-движок (PaddleOCR/RapidOCR) — тяжёлая GPU/CPU-зависимость и в основной
backend не ставится; сюда приходит уже распознанный текст (со стороны
OCR-сервиса или из visible_marking_text VLM). Здесь — детерминированные
регэкспы под типовые форматы маркировки:

    "8.5Jx19 ET35"  "7J x 16 H2 ET40"  "PCD 5x114.3"  "CB 66.6"  "DIA 57.1"
"""

from __future__ import annotations

import re

from src.fitment.schemas import FieldValue, RimSpec, Source

# 8.5Jx19 / 8,5J x 19 / 7Jx16 — ширина(J) и диаметр
_SIZE_RE = re.compile(
    r"(?P<width>\d{1,2}(?:[.,]\d)?)\s*J?\s*[xх×]\s*(?P<diameter>\d{2})\b",
    re.IGNORECASE,
)
# ET35 / ET 35 / ET-6
_ET_RE = re.compile(r"\bET\s*(?P<et>-?\d{1,3})\b", re.IGNORECASE)
# 5x114.3 / 5х108 (кириллическая х тоже) — bolt pattern
_PCD_RE = re.compile(
    r"\b(?P<count>[4-6])\s*[xх×]\s*(?P<pcd>\d{2,3}(?:[.,]\d)?)\b",
    re.IGNORECASE,
)
# CB 66.6 / DIA 57,1 / D57.1
_CB_RE = re.compile(
    r"\b(?:CB|DIA|D)\s*[:=]?\s*(?P<cb>\d{2,3}(?:[.,]\d)?)\b",
    re.IGNORECASE,
)

_OCR_CONFIDENCE = 0.6  # E1: одиночное распознавание маркировки


def _f(raw: str) -> float:
    return float(raw.replace(",", "."))


def parse_rim_marking(text: str | None) -> RimSpec:
    """Текст маркировки → RimSpec с source=ocr. Ничего не найдено → пустые поля."""
    spec = RimSpec()
    if not text:
        return spec

    size = _SIZE_RE.search(text)
    if size:
        spec.wheel_width_j = FieldValue(
            value=_f(size.group("width")), source=Source.ocr, confidence=_OCR_CONFIDENCE
        )
        spec.wheel_diameter_in = FieldValue(
            value=_f(size.group("diameter")), source=Source.ocr, confidence=_OCR_CONFIDENCE
        )

    et = _ET_RE.search(text)
    if et:
        spec.offset_et_mm = FieldValue(
            value=float(et.group("et")), source=Source.ocr, confidence=_OCR_CONFIDENCE
        )

    # PCD ищем после вырезания size-совпадения: "8.5Jx19" сам похож на "5x19".
    pcd_text = text
    if size:
        pcd_text = text[: size.start()] + " " + text[size.end() :]
    pcd = _PCD_RE.search(pcd_text)
    if pcd:
        spec.bolt_count = FieldValue(
            value=int(pcd.group("count")), source=Source.ocr, confidence=_OCR_CONFIDENCE
        )
        spec.pcd_mm = FieldValue(
            value=_f(pcd.group("pcd")), source=Source.ocr, confidence=_OCR_CONFIDENCE
        )

    cb = _CB_RE.search(text)
    if cb:
        spec.center_bore_mm = FieldValue(
            value=_f(cb.group("cb")), source=Source.ocr, confidence=_OCR_CONFIDENCE
        )

    return spec
