"""Normalization helpers."""

from __future__ import annotations

import re
from typing import Any


def normalize_bolt_pattern(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = str(value).lower().replace(" ", "").replace("×", "x").replace(",", ".")
    return cleaned


def parse_bolt_pattern(value: str | None) -> tuple[int | None, float | None]:
    normalized = normalize_bolt_pattern(value)
    if not normalized or "x" not in normalized:
        return None, None
    left, right = normalized.split("x", 1)
    try:
        return int(left), float(right)
    except ValueError:
        return None, None


def to_float(value: Any) -> float | None:
    if value in (None, "", "N/A", "n/a", "null"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def almost_equal(a: float | None, b: float | None, tol: float) -> bool:
    if a is None or b is None:
        return False
    return abs(float(a) - float(b)) <= tol


def fuzzy_ratio(a: str, b: str) -> float:
    from difflib import SequenceMatcher

    return SequenceMatcher(None, a.lower(), b.lower()).ratio() * 100.0


def safe_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def market_to_region(market: str | None, default: str = "russia") -> str:
    if not market:
        return default
    mapping = {
        "russia": "russia",
        "chdm": "chdm",
        "china": "chdm",
        "europe": "eudm",
        "eudm": "eudm",
        "usa": "usdm",
        "usdm": "usdm",
        "japan": "jdm",
        "jdm": "jdm",
        "korea": "kdm",
        "kdm": "kdm",
    }
    return mapping.get(market.lower(), default)


def region_fallback(region: str) -> str | None:
    pairs = {
        "russia": "chdm",
        "chdm": "russia",
        "eudm": "usdm",
        "usdm": "eudm",
    }
    return pairs.get(region)
