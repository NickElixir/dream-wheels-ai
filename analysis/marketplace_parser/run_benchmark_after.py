"""Run the frozen Yandex benchmark against the implemented adapter."""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

try:
    from .metrics import calculate_metrics, classify_failure, compare_case, variant_comparison
except ImportError:
    from metrics import calculate_metrics, classify_failure, compare_case, variant_comparison


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_jsonable(item) for item in value]
    if hasattr(value, "__dataclass_fields__"):
        return {key: _jsonable(getattr(value, key)) for key in value.__dataclass_fields__}
    return str(value)


def _base_observation(card: dict[str, Any], ground_truth: dict[str, Any]) -> dict[str, Any]:
    return {
        "case_id": card["id"],
        "marketplace": card["marketplace"],
        "requested_url": card["canonical_url"],
        "ground_truth": ground_truth,
        "fetch": {
            "outcome": "error",
            "http_status": None,
            "content_type": None,
            "response_size": None,
            "redirect_count": None,
            "duration_ms": None,
            "useful_document": False,
            "current_product_anchored": False,
            "body_truncated_at_limit": False,
            "secondary_request_used": False,
        },
        "resolver": None,
        "comparison": None,
        "variant": {
            "applicable": False,
            "variant_detected_correctly": None,
            "selection_required_correctly": None,
            "selected_variant_correctly": None,
            "cross_variant_contamination": None,
        },
        "error": None,
    }


async def resolve_card(
    card: dict[str, Any], ground_truth: dict[str, Any], adapter: Any
) -> dict[str, Any]:
    started = time.perf_counter()
    base = _base_observation(card, ground_truth)
    try:
        result = await adapter.resolve_yandex_product_url_with_diagnostics(card["canonical_url"])
    except Exception as exc:
        base["error"] = {
            "type": type(exc).__name__,
            "message": str(exc),
            "reason_code": getattr(exc, "reason_code", None),
        }
        base["fetch"]["duration_ms"] = round((time.perf_counter() - started) * 1000, 2)
        base["failure_class"] = classify_failure(
            fetch_error=f"{base['error']['reason_code']} {base['error']['message']}",
            comparison=None,
            variant=None,
        )
        base["manual_fallback_applicable"] = False
        return base

    observation = result.fetch
    base["fetch"].update(
        {
            "outcome": "success",
            "http_status": observation.status_code,
            "content_type": observation.content_type,
            "response_size": observation.response_size,
            "redirect_count": observation.redirect_count,
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            "useful_document": observation.useful_document,
            "current_product_anchored": observation.current_product_anchored,
            "body_truncated_at_limit": observation.body_truncated_at_limit,
            "secondary_request_used": observation.secondary_request_used,
        }
    )
    resolution = result.resolution
    resolver_observation = _jsonable(resolution)
    base["resolver"] = {
        "final_url": resolution.final_url,
        "values": _jsonable(resolution.values),
        "candidates": resolver_observation.get("candidates", []),
        "conflicts": resolver_observation.get("conflicts", []),
        "variants": resolver_observation.get("variants", []),
        "selection_required": resolution.selection_required,
        "selected_variant_sku": resolution.selected_variant_sku,
        "source_fingerprint": resolution.source_fingerprint,
    }
    base["comparison"] = compare_case(ground_truth, resolution.values)
    base["variant"] = variant_comparison(ground_truth, base["resolver"])
    base["failure_class"] = classify_failure(
        fetch_error=None,
        comparison=base["comparison"],
        variant=base["variant"],
        resolver_values=resolution.values,
        resolver_candidates=resolution.candidates,
    )
    base["manual_fallback_applicable"] = base["failure_class"] in {
        "PARSER_UNSUPPORTED",
        "DATA_MISSING",
        "JS_ONLY",
        "VARIANT_AMBIGUITY",
    }
    return base


async def run(manifest_path: Path, ground_truth_path: Path, resolver_root: Path) -> dict[str, Any]:
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    ground_truth_document = yaml.safe_load(ground_truth_path.read_text(encoding="utf-8"))
    cards = manifest["cards"]
    ground_truth = {
        key: value for key, value in ground_truth_document.items() if key.startswith("ym-")
    }
    if manifest.get("dataset_version") != ground_truth_document.get("dataset_version"):
        raise ValueError("Frozen dataset version mismatch")
    if manifest.get("base_commit") != "e5b93c1b49268e02f64a1ec8271055d9c8fc916b":
        raise ValueError("Unexpected frozen dataset base commit")
    actual_commit = (
        await asyncio.to_thread(
            subprocess.check_output,
            ["git", "-C", str(resolver_root), "rev-parse", "HEAD"],
            text=True,
        )
    ).strip()
    if str(resolver_root.resolve()) not in sys.path:
        sys.path.insert(0, str(resolver_root.resolve()))
    from src import yandex_market_adapter as adapter

    observations = [await resolve_card(card, ground_truth[card["id"]], adapter) for card in cards]
    return {
        "dataset_version": manifest["dataset_version"],
        "dataset_base_commit": manifest["base_commit"],
        "implementation_commit": actual_commit,
        "benchmark_timestamp": datetime.now(UTC)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "execution_method": {
            "adapter": "src.yandex_market_adapter.resolve_yandex_product_url_with_diagnostics",
            "resolver_root": str(resolver_root.resolve()),
            "network": "direct fixed-profile HTTP; no browser cookies, proxy, session, account state, or arbitrary endpoint",
            "runtime_behavior_changed": True,
            "request_profile": _jsonable(adapter.YANDEX_REQUEST_HEADERS),
            "body_limit_bytes": 2 * 1024 * 1024,
            "secondary_request": True,
        },
        "observations": observations,
        "metrics": calculate_metrics(observations),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path(__file__).with_name("manifest.yaml"))
    parser.add_argument(
        "--ground-truth", type=Path, default=Path(__file__).with_name("ground_truth.yaml")
    )
    parser.add_argument("--resolver-root", type=Path, required=True)
    parser.add_argument(
        "--output", type=Path, default=Path(__file__).with_name("results_after.json")
    )
    args = parser.parse_args()
    result = asyncio.run(run(args.manifest, args.ground_truth, args.resolver_root))
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(result["metrics"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
