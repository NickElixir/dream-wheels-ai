"""Pure comparison and aggregate metric helpers for the marketplace benchmark."""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

CRITICAL_FIELDS = ("diameter", "width", "pcd", "et", "dia")
FIELD_MAP = {
    "diameter": "wheel_diameter_in",
    "width": "wheel_width_j",
    "et": "offset_et_mm",
    "dia": "center_bore_mm",
}
_PCD_RE = re.compile(r"^(?P<count>\d+)\s*x\s*(?P<pcd>\d+(?:\.\d+)?)$", re.I)


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _same_number(expected: Any, actual: Any) -> bool:
    expected_number = _number(expected)
    actual_number = _number(actual)
    return (
        expected_number is not None
        and actual_number is not None
        and math.isclose(expected_number, actual_number, rel_tol=0, abs_tol=0.01)
    )


def _same_text(expected: Any, actual: Any) -> bool:
    if expected is None or actual is None:
        return False
    return (
        re.sub(r"\s+", "", str(expected)).casefold() == re.sub(r"\s+", "", str(actual)).casefold()
    )


def _expected_pcd(value: Any) -> tuple[int, float] | None:
    if not isinstance(value, str):
        return None
    match = _PCD_RE.fullmatch(value.replace(",", ".").strip())
    if not match:
        return None
    return int(match["count"]), float(match["pcd"])


def _actual_pcd(values: dict[str, Any]) -> str | None:
    count = _number(values.get("bolt_count"))
    pcd = _number(values.get("pcd_mm"))
    if count is None or pcd is None:
        return None
    count_text = str(int(count)) if count.is_integer() else str(count)
    pcd_text = str(int(pcd)) if pcd.is_integer() else f"{pcd:g}"
    return f"{count_text}x{pcd_text}"


def expected_field_values(ground_truth: dict[str, Any]) -> dict[str, Any]:
    """Return the resolver-shaped expected values without using the resolver."""
    values: dict[str, Any] = {}
    for field, resolver_field in FIELD_MAP.items():
        if ground_truth.get(field) is not None:
            values[resolver_field] = ground_truth[field]
    pcd = _expected_pcd(ground_truth.get("pcd"))
    if pcd is not None:
        values["bolt_count"], values["pcd_mm"] = pcd
    if ground_truth.get("brand") is not None:
        values["brand"] = ground_truth["brand"]
    if ground_truth.get("model") is not None:
        values["model"] = ground_truth["model"]
    if ground_truth.get("sku_or_article") is not None:
        values["sku"] = ground_truth["sku_or_article"]
    return values


def _compare_field(expected: Any, actual: Any, *, field: str) -> dict[str, Any]:
    if expected is None:
        if actual is None:
            return {"status": "field_not_present_on_page", "expected": None, "actual": None}
        return {"status": "unexpected_extraction", "expected": None, "actual": actual}
    if actual is None:
        return {"status": "missing_extraction", "expected": expected, "actual": None}
    matches = (
        _same_text(expected, actual)
        if field in {"brand", "model", "sku_or_article"}
        else _same_number(expected, actual)
    )
    return {
        "status": "correct" if matches else "incorrect_extraction",
        "expected": expected,
        "actual": actual,
    }


def compare_case(ground_truth: dict[str, Any], resolver_values: dict[str, Any]) -> dict[str, Any]:
    """Compare one current-product observation, preserving unknowns as null."""
    actual = dict(resolver_values)
    comparisons: dict[str, dict[str, Any]] = {}
    for field in ("brand", "model", "sku_or_article", *CRITICAL_FIELDS):
        if field == "pcd":
            expected = ground_truth.get("pcd")
            actual_value = _actual_pcd(actual)
            if expected is None:
                comparison = _compare_field(None, actual_value, field=field)
            elif actual_value is None:
                comparison = _compare_field(expected, None, field=field)
            else:
                comparison = {
                    "status": "correct"
                    if _same_text(expected, actual_value)
                    else "incorrect_extraction",
                    "expected": expected,
                    "actual": actual_value,
                }
        elif field in FIELD_MAP:
            comparison = _compare_field(
                ground_truth.get(field), actual.get(FIELD_MAP[field]), field=field
            )
        else:
            comparison = _compare_field(
                ground_truth.get(field),
                actual.get({"sku_or_article": "sku"}.get(field, field)),
                field=field,
            )
        comparisons[field] = comparison

    missing_fields = [
        field for field, result in comparisons.items() if result["status"] == "missing_extraction"
    ]
    incorrect_fields = [
        field
        for field, result in comparisons.items()
        if result["status"] in {"incorrect_extraction", "unexpected_extraction"}
    ]
    critical_false_data = [
        field
        for field in CRITICAL_FIELDS
        if comparisons[field]["status"]
        in {
            "incorrect_extraction",
            "unexpected_extraction",
        }
    ]
    return {
        "field_comparisons": comparisons,
        "missing_fields": missing_fields,
        "incorrect_fields": incorrect_fields,
        "critical_false_data": critical_false_data,
        "critical_false_data_count": len(critical_false_data),
    }


def variant_comparison(
    ground_truth: dict[str, Any], resolver: dict[str, Any] | None
) -> dict[str, Any]:
    """Compare variant selection metadata; return explicit N/A for single-SKU cards."""
    expected_variants = ground_truth.get("variants") or []
    expected_multi = (
        len(expected_variants) > 1 or (ground_truth.get("variant_count_visible") or 0) > 1
    )
    if not expected_multi:
        return {
            "applicable": False,
            "variant_detected_correctly": None,
            "selection_required_correctly": (
                resolver is not None and not bool(resolver.get("selection_required"))
            ),
            "selected_variant_correctly": None,
            "cross_variant_contamination": None,
        }
    resolver = resolver or {}
    detected = bool(resolver.get("variants"))
    selection_required = bool(resolver.get("selection_required"))
    selected_expected = ground_truth.get("selected_variant")
    selected_actual = resolver.get("selected_variant_sku")
    selected_correct = (
        _same_text(selected_expected, selected_actual)
        if selected_expected is not None
        else selected_actual is None
    )
    return {
        "applicable": True,
        "variant_detected_correctly": detected,
        "selection_required_correctly": selection_required,
        "selected_variant_correctly": selected_correct,
        "cross_variant_contamination": _cross_variant_contamination(ground_truth, resolver),
    }


def _cross_variant_contamination(
    ground_truth: dict[str, Any], resolver: dict[str, Any]
) -> bool | None:
    """Detect mixed technical fields when both selected and variant values are representable."""
    selected = ground_truth.get("selected_variant")
    if selected is None:
        return None
    selected_gt = next(
        (
            variant
            for variant in ground_truth.get("variants", [])
            if variant.get("label") == selected or variant.get("sku") == selected
        ),
        None,
    )
    if selected_gt is None:
        return None
    values = resolver.get("values") or {}
    expected = expected_field_values(selected_gt)
    present_expected_fields = [field for field in CRITICAL_FIELDS if field in expected]
    if not present_expected_fields:
        return None
    wrong = 0
    for field in present_expected_fields:
        if field == "pcd":
            actual = _actual_pcd(values)
            expected_value = selected_gt.get("pcd")
            if actual is not None and not _same_text(expected_value, actual):
                wrong += 1
        else:
            actual = values.get(FIELD_MAP[field])
            if actual is not None and not _same_number(selected_gt.get(field), actual):
                wrong += 1
    return wrong > 0


def classify_failure(
    *,
    fetch_error: str | None,
    comparison: dict[str, Any] | None,
    variant: dict[str, Any] | None,
    resolver_values: dict[str, Any] | None = None,
    resolver_candidates: list[Any] | tuple[Any, ...] | None = None,
) -> str:
    if fetch_error:
        lowered = fetch_error.casefold()
        if "429" in lowered or "rate" in lowered:
            return "RATE_LIMITED"
        if "challenge" in lowered or "captcha" in lowered or "anti" in lowered:
            return "ANTI_BOT"
        return "FETCH_BLOCKED"
    if variant and variant.get("applicable") and not variant.get("selection_required_correctly"):
        return "VARIANT_AMBIGUITY"
    if comparison is None:
        return "PARSER_UNSUPPORTED"
    if not resolver_values and not resolver_candidates:
        return "JS_ONLY"
    if comparison["critical_false_data_count"]:
        return "PARSER_UNSUPPORTED"
    if comparison["missing_fields"]:
        return "DATA_MISSING"
    return "SUPPORTED"


def _rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def calculate_metrics(
    observations: list[dict[str, Any]], *, _include_breakdown: bool = True
) -> dict[str, Any]:
    """Calculate unweighted overall, marketplace, and field metrics."""
    total = len(observations)
    fetch_successes = [item for item in observations if item["fetch"]["outcome"] == "success"]
    metrics: dict[str, Any] = {
        "case_count": total,
        "fetch_success_rate": _rate(len(fetch_successes), total),
        "failure_distribution": dict(Counter(item.get("failure_class") for item in observations)),
        "critical_false_positive_rate": _rate(
            sum(
                item.get("comparison", {}).get("critical_false_data_count", 0)
                for item in observations
            ),
            total,
        ),
        "critical_false_data_count": sum(
            item.get("comparison", {}).get("critical_false_data_count", 0) for item in observations
        ),
    }

    field_metrics: dict[str, Any] = {}
    for field in ("brand", "model", "sku_or_article", *CRITICAL_FIELDS):
        available = [item for item in observations if item["ground_truth"].get(field) is not None]
        actual = [
            item
            for item in available
            if item.get("comparison", {}).get("field_comparisons", {}).get(field, {}).get("actual")
            is not None
        ]
        correct = [
            item
            for item in available
            if item.get("comparison", {}).get("field_comparisons", {}).get(field, {}).get("status")
            == "correct"
        ]
        field_metrics[field] = {
            "available_cases": len(available),
            "availability_rate": _rate(len(available), total),
            "extracted_cases": len(actual),
            "extraction_rate": _rate(len(actual), len(available)),
            "correct_cases": len(correct),
            "precision": _rate(len(correct), len(actual)),
        }
    metrics["fields"] = field_metrics

    variant_cases = [item for item in observations if item.get("variant", {}).get("applicable")]
    metrics["variant_detection_rate"] = _rate(
        sum(bool(item["variant"].get("variant_detected_correctly")) for item in variant_cases),
        len(variant_cases),
    )
    metrics["variant_selection_correctness"] = _rate(
        sum(bool(item["variant"].get("selected_variant_correctly")) for item in variant_cases),
        len(variant_cases),
    )
    contamination_cases = [
        item
        for item in variant_cases
        if item["variant"].get("cross_variant_contamination") is not None
    ]
    metrics["cross_variant_contamination_rate"] = _rate(
        sum(
            bool(item["variant"].get("cross_variant_contamination")) for item in contamination_cases
        ),
        len(contamination_cases),
    )

    metrics["manual_fallback_applicable"] = {
        "applicable_cases": sum(
            item.get("manual_fallback_applicable") is True for item in observations
        ),
        "not_applicable_cases": sum(
            item.get("manual_fallback_applicable") is False for item in observations
        ),
    }

    if _include_breakdown:
        by_marketplace: dict[str, dict[str, Any]] = {}
        for marketplace in sorted({item["marketplace"] for item in observations}):
            subset = [item for item in observations if item["marketplace"] == marketplace]
            by_marketplace[marketplace] = calculate_metrics(subset, _include_breakdown=False)
        metrics["by_marketplace"] = by_marketplace
    return metrics
