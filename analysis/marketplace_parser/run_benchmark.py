"""Run the frozen 03B-A0 dataset against an explicitly pinned resolver tree."""

from __future__ import annotations

import argparse
import asyncio
import importlib
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
except ImportError:  # Direct execution: python analysis/marketplace_parser/run_benchmark.py
    from metrics import calculate_metrics, classify_failure, compare_case, variant_comparison

EXPECTED_FAILURE_CLASSES = {
    "SUPPORTED",
    "FETCH_BLOCKED",
    "PARSER_UNSUPPORTED",
    "DATA_MISSING",
    "JS_ONLY",
    "ANTI_BOT",
    "SESSION_OR_REGION_DEPENDENT",
    "VARIANT_AMBIGUITY",
    "RATE_LIMITED",
}


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        document = yaml.safe_load(handle)
    if not isinstance(document, dict):
        raise ValueError(f"Expected a mapping in {path}")
    return document


def validate_manifest(manifest: dict[str, Any], ground_truth: dict[str, Any]) -> None:
    cards = manifest.get("cards")
    if not isinstance(cards, list) or not cards:
        raise ValueError("manifest.cards must contain at least one frozen product card")
    ids = [card.get("id") for card in cards]
    urls = [card.get("canonical_url") for card in cards]
    if any(not value for value in ids + urls):
        raise ValueError("Every manifest card needs id and canonical_url")
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate dataset ID")
    if len(urls) != len(set(urls)):
        raise ValueError("Duplicate canonical URL")
    if manifest.get("dataset_version") != ground_truth.get("dataset_version"):
        raise ValueError("manifest and ground_truth dataset_version differ")
    if manifest.get("base_commit") != manifest.get("resolver_commit"):
        raise ValueError("base_commit and resolver_commit must be identical")
    missing = [card["id"] for card in cards if card["id"] not in ground_truth]
    if missing:
        raise ValueError(f"Ground truth missing for: {', '.join(missing)}")


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


def import_resolver(resolver_root: Path) -> Any:
    resolver_root = resolver_root.resolve()
    if str(resolver_root) not in sys.path:
        sys.path.insert(0, str(resolver_root))
    return importlib.import_module("src.rim_url_resolver")


def verify_resolver_checkout(resolver_root: Path, expected_commit: str) -> str:
    """Require a clean checkout whose HEAD is the frozen resolver commit."""
    actual_commit = subprocess.check_output(
        ["git", "-C", str(resolver_root), "rev-parse", "HEAD"], text=True
    ).strip()
    if actual_commit != expected_commit:
        raise ValueError(
            f"Resolver checkout mismatch: expected {expected_commit}, got {actual_commit}"
        )
    dirty = subprocess.check_output(
        ["git", "-C", str(resolver_root), "status", "--porcelain"], text=True
    ).strip()
    if dirty:
        raise ValueError("Resolver checkout must be clean for a frozen baseline")
    return actual_commit


async def resolve_card(
    card: dict[str, Any], ground_truth: dict[str, Any], resolver: Any
) -> dict[str, Any]:
    started = time.perf_counter()
    base = {
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
    try:
        resolution = await resolver.resolve_rim_product_url(card["canonical_url"])
    except (
        Exception
    ) as exc:  # Resolver contract exposes only typed errors, preserve diagnostics safely.
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

    resolver_observation = _jsonable(resolution)
    base["fetch"].update(
        {
            "outcome": "success",
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        }
    )
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
    manifest = load_yaml(manifest_path)
    ground_truth_document = load_yaml(ground_truth_path)
    ground_truth = {
        key: value
        for key, value in ground_truth_document.items()
        if key.startswith("ym-") or key.startswith("wb-") or key.startswith("ozon-")
    }
    validate_manifest(manifest, ground_truth_document)
    if manifest["base_commit"] != manifest["resolver_commit"]:
        raise ValueError("Resolver commit pin mismatch")
    verified_commit = verify_resolver_checkout(resolver_root, manifest["resolver_commit"])
    resolver = import_resolver(resolver_root)
    cards = manifest["cards"]
    observations = [await resolve_card(card, ground_truth[card["id"]], resolver) for card in cards]
    return {
        "dataset_version": manifest["dataset_version"],
        "dataset_base_commit": manifest["base_commit"],
        "resolver_commit": manifest["resolver_commit"],
        "benchmark_timestamp": datetime.now(UTC)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "execution_method": {
            "resolver": "src.rim_url_resolver.resolve_rim_product_url",
            "resolver_root": str(resolver_root.resolve()),
            "network": "direct resolver HTTP; no browser cookies, proxy, session, or account state",
            "runtime_behavior_changed": False,
            "resolver_commit_verified": verified_commit,
        },
        "observations": observations,
        "metrics": calculate_metrics(observations),
        "failure_classes": sorted(EXPECTED_FAILURE_CLASSES),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path(__file__).with_name("manifest.yaml"))
    parser.add_argument(
        "--ground-truth", type=Path, default=Path(__file__).with_name("ground_truth.yaml")
    )
    parser.add_argument(
        "--resolver-root",
        type=Path,
        required=True,
        help="Checked-out repository root at manifest.base_commit.",
    )
    parser.add_argument(
        "--output", type=Path, default=Path(__file__).with_name("results_before.json")
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
