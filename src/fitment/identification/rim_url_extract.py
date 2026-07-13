"""Deterministic rim metadata extraction from product-page HTML."""

import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any

from src.fitment.identification.rim_ocr import parse_rim_marking

_SPACE_RE = re.compile(r"\s+")
_VISIBLE_FIELD_PATTERNS = {
    "brand": re.compile(
        r"\b(?:brand|manufacturer|бренд|производитель)\s*[:\-]\s*([^\n|;]{2,80})", re.I
    ),
    "model": re.compile(r"\b(?:model|модель)\s*[:\-]\s*([^\n|;]{2,120})", re.I),
    "sku": re.compile(
        r"\b(?:sku|артикул|part\s*(?:no|number))\s*[:#\-]\s*([A-Z0-9._/ -]{2,64})", re.I
    ),
}
_TECHNICAL_FIELDS = (
    "bolt_count",
    "pcd_mm",
    "center_bore_mm",
    "wheel_diameter_in",
    "wheel_width_j",
    "offset_et_mm",
)


@dataclass(frozen=True, slots=True)
class ExtractedCandidate:
    field: str
    value: str | int | float
    source: str
    confidence: float


@dataclass(frozen=True, slots=True)
class ExtractedPage:
    candidates: tuple[ExtractedCandidate, ...]


class _ProductHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.json_ld_blocks: list[str] = []
        self.meta: list[tuple[str, str]] = []
        self.visible_parts: list[str] = []
        self.title_parts: list[str] = []
        self._json_depth = 0
        self._ignored_depth = 0
        self._title_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}
        if tag == "script":
            script_type = attributes.get("type", "").split(";", 1)[0].strip().lower()
            if script_type == "application/ld+json":
                self._json_depth += 1
            else:
                self._ignored_depth += 1
        elif tag in {"style", "noscript", "template"}:
            self._ignored_depth += 1
        elif tag == "title":
            self._title_depth += 1
        elif tag == "meta":
            key = attributes.get("property") or attributes.get("name")
            content = attributes.get("content")
            if key and content:
                self.meta.append((key.lower(), content))

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            if self._json_depth:
                self._json_depth -= 1
            elif self._ignored_depth:
                self._ignored_depth -= 1
        elif tag in {"style", "noscript", "template"} and self._ignored_depth:
            self._ignored_depth -= 1
        elif tag == "title" and self._title_depth:
            self._title_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._json_depth:
            self.json_ld_blocks.append(data)
        elif self._title_depth:
            self.title_parts.append(data)
        elif not self._ignored_depth:
            self.visible_parts.append(data)


def _clean_text(value: Any, *, max_length: int = 160) -> str | None:
    if not isinstance(value, str | int | float):
        return None
    cleaned = _SPACE_RE.sub(" ", str(value)).strip(" \t\r\n|")
    return cleaned[:max_length] if cleaned else None


def _clean_sku(value: Any) -> str | None:
    cleaned = _clean_text(value, max_length=64)
    if not cleaned:
        return None
    return re.sub(r"\s+", "-", cleaned).upper()


def _json_ld_products(value: Any) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    if isinstance(value, list):
        for item in value:
            products.extend(_json_ld_products(item))
    elif isinstance(value, dict):
        item_type = value.get("@type")
        types = [item_type] if isinstance(item_type, str) else item_type
        if isinstance(types, list) and any(
            isinstance(name, str) and name.lower() == "product" for name in types
        ):
            products.append(value)
        for key in ("@graph", "mainEntity", "itemListElement"):
            if key in value:
                products.extend(_json_ld_products(value[key]))
    return products


def _add_candidate(
    candidates: list[ExtractedCandidate],
    field: str,
    value: Any,
    source: str,
    confidence: float,
) -> None:
    normalized = _clean_sku(value) if field == "sku" else _clean_text(value)
    if normalized is not None:
        candidates.append(ExtractedCandidate(field, normalized, source, confidence))


def _add_marking_candidates(
    candidates: list[ExtractedCandidate],
    text: str,
    source: str,
    confidence: float,
) -> None:
    spec = parse_rim_marking(text)
    for field_name in _TECHNICAL_FIELDS:
        value = getattr(spec, field_name).value
        if value is not None:
            candidates.append(ExtractedCandidate(field_name, value, source, confidence))


def extract_rim_product(html: str) -> ExtractedPage:
    """Extract ordered candidates: JSON-LD Product, OpenGraph, then visible text."""
    parser = _ProductHtmlParser()
    parser.feed(html)
    candidates: list[ExtractedCandidate] = []

    for block in parser.json_ld_blocks:
        try:
            data = json.loads(block)
        except (json.JSONDecodeError, TypeError):
            continue
        for product in _json_ld_products(data):
            brand = product.get("brand")
            if isinstance(brand, dict):
                brand = brand.get("name")
            _add_candidate(candidates, "brand", brand, "json_ld", 0.95)
            _add_candidate(
                candidates, "model", product.get("model") or product.get("name"), "json_ld", 0.95
            )
            _add_candidate(
                candidates,
                "sku",
                product.get("sku") or product.get("mpn") or product.get("productID"),
                "json_ld",
                0.95,
            )
            marking_text = " ".join(
                str(value)
                for key, value in product.items()
                if key in {"name", "model", "description", "sku", "mpn"}
                and isinstance(value, str | int | float)
            )
            _add_marking_candidates(candidates, marking_text, "json_ld", 0.9)

    meta = dict(parser.meta)
    _add_candidate(
        candidates,
        "brand",
        meta.get("product:brand") or meta.get("og:brand"),
        "opengraph",
        0.8,
    )
    _add_candidate(candidates, "model", meta.get("og:title"), "opengraph", 0.8)
    _add_candidate(
        candidates,
        "sku",
        meta.get("product:retailer_item_id") or meta.get("product:sku"),
        "opengraph",
        0.8,
    )
    meta_text = " ".join(
        value
        for key, value in parser.meta
        if key in {"og:title", "og:description", "product:description"}
    )
    _add_marking_candidates(candidates, meta_text, "opengraph", 0.75)

    visible_text = "\n".join(
        part
        for part in (_clean_text(value, max_length=20_000) for value in parser.visible_parts)
        if part
    )
    for field_name, pattern in _VISIBLE_FIELD_PATTERNS.items():
        match = pattern.search(visible_text)
        if match:
            _add_candidate(candidates, field_name, match.group(1), "visible_text", 0.65)
    _add_marking_candidates(candidates, visible_text, "visible_text", 0.6)

    if not any(candidate.field == "model" for candidate in candidates):
        _add_candidate(candidates, "model", " ".join(parser.title_parts), "visible_text", 0.55)
    return ExtractedPage(tuple(candidates))
