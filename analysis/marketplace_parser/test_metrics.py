from analysis.marketplace_parser.metrics import (
    calculate_metrics,
    classify_failure,
    compare_case,
    variant_comparison,
)


def test_compare_case_preserves_unknowns_and_detects_critical_false_data() -> None:
    ground_truth = {
        "diameter": 16,
        "width": 6.5,
        "pcd": "5x112",
        "et": None,
        "dia": 57.1,
        "brand": "Example",
        "model": None,
        "sku_or_article": None,
    }
    comparison = compare_case(
        ground_truth,
        {
            "wheel_diameter_in": 16,
            "wheel_width_j": 6.5,
            "bolt_count": 5,
            "pcd_mm": 112,
            "offset_et_mm": 45,
            "center_bore_mm": 57.1,
            "brand": "Example",
        },
    )
    assert comparison["field_comparisons"]["et"]["status"] == "unexpected_extraction"
    assert comparison["critical_false_data"] == ["et"]


def test_compare_case_distinguishes_missing_from_incorrect() -> None:
    ground_truth = {
        "diameter": 15,
        "width": 6,
        "pcd": "4x100",
        "et": 35,
        "dia": 60.1,
        "brand": "Example",
        "model": None,
        "sku_or_article": None,
    }
    comparison = compare_case(ground_truth, {"wheel_diameter_in": 15})
    assert "width" in comparison["missing_fields"]
    assert "pcd" in comparison["missing_fields"]
    assert "et" in comparison["missing_fields"]
    assert comparison["critical_false_data_count"] == 0


def test_single_variant_is_explicitly_not_applicable() -> None:
    result = variant_comparison(
        {"variant_count_visible": 1, "variants": [], "selected_variant": None},
        {"selection_required": False, "variants": []},
    )
    assert result["applicable"] is False
    assert result["cross_variant_contamination"] is None


def test_empty_successful_document_is_classified_as_js_only() -> None:
    assert (
        classify_failure(
            fetch_error=None,
            comparison={"critical_false_data_count": 0, "missing_fields": ["diameter"]},
            variant=None,
            resolver_values={},
            resolver_candidates=[],
        )
        == "JS_ONLY"
    )


def test_metrics_include_marketplace_breakdown_without_recursive_nesting() -> None:
    item = {
        "marketplace": "yandex_market",
        "fetch": {"outcome": "success"},
        "failure_class": "SUPPORTED",
        "ground_truth": {
            "diameter": 15,
            "width": None,
            "pcd": None,
            "et": None,
            "dia": None,
            "brand": None,
            "model": None,
            "sku_or_article": None,
        },
        "comparison": {
            "critical_false_data_count": 0,
            "missing_fields": [],
            "field_comparisons": {
                field: {
                    "actual": 15 if field == "diameter" else None,
                    "status": "correct" if field == "diameter" else "field_not_present_on_page",
                }
                for field in (
                    "brand",
                    "model",
                    "sku_or_article",
                    "diameter",
                    "width",
                    "pcd",
                    "et",
                    "dia",
                )
            },
        },
        "variant": {"applicable": False},
        "manual_fallback_applicable": False,
    }
    result = calculate_metrics([item])
    assert result["by_marketplace"]["yandex_market"]["case_count"] == 1
    assert "by_marketplace" not in result["by_marketplace"]["yandex_market"]
