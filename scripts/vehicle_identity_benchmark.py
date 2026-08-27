"""Run a consented offline vehicle-identity benchmark from a JSON manifest."""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
from datetime import UTC, datetime
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from src.identity.service import get_vehicle_identity_resolver  # noqa: E402
from src.vision.image_normalization import normalize_image  # noqa: E402


async def run(
    manifest_path: Path,
    output_path: Path,
    *,
    max_cases: int | None = None,
) -> None:
    manifest = json.loads(await asyncio.to_thread(manifest_path.read_text))
    resolver = get_vehicle_identity_resolver()
    results = []
    errors = 0
    cases = manifest["cases"][:max_cases]
    for case in cases:
        try:
            image_path = manifest_path.parent / case["image_path"]
            image = normalize_image(
                image_path.read_bytes(), max_image_edge=1536, max_pixels=12_000_000
            )
            resolution = await resolver.resolve(image)
            results.append(
                {
                    "case_id": case["case_id"],
                    "ground_truth": case["ground_truth"],
                    "recognizable": case["recognizable"],
                    "result": resolution.model_dump(mode="json"),
                }
            )
        except Exception as exc:
            errors += 1
            results.append(
                {
                    "case_id": case["case_id"],
                    "ground_truth": case["ground_truth"],
                    "recognizable": case["recognizable"],
                    "error": {
                        "type": type(exc).__name__,
                        "message": str(exc),
                    },
                }
            )
    metrics = _metrics(results, errors)
    first_result = next((item.get("result") for item in results if item.get("result")), {})
    await asyncio.to_thread(
        output_path.write_text,
        json.dumps(
            {
                "dataset_version": manifest["dataset_version"],
                "timestamp": datetime.now(UTC).isoformat(),
                "provider": first_result.get("metadata", {}).get("provider"),
                "model": first_result.get("metadata", {}).get("model"),
                "prompt_version": first_result.get("metadata", {}).get("prompt_version"),
                "aggregate_metrics": metrics,
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def _metrics(results: list[dict], errors: int) -> dict[str, float | int | None]:
    completed = [item for item in results if "result" in item]
    recognizable = [item for item in completed if item["recognizable"]]
    make_hits = 0
    model_hits = 0
    model_top3_hits = 0
    year_exact_hits = 0
    year_overlap_hits = 0
    unknown_tp = unknown_fp = unknown_fn = 0
    latencies: list[int] = []
    costs: list[float] = []
    for item in completed:
        result = item["result"]
        candidates = [candidate for candidate in [result.get("primary")] if candidate]
        candidates.extend(result.get("alternatives", []))
        primary = result.get("primary")
        expected_unknown = not item["recognizable"]
        is_unknown = result["status"] == "unknown"
        if is_unknown and expected_unknown:
            unknown_tp += 1
        elif is_unknown:
            unknown_fp += 1
        elif expected_unknown:
            unknown_fn += 1
        if primary and item["recognizable"]:
            truth = item["ground_truth"]
            make_hits += primary["make"].casefold() == truth["make"].casefold()
            model_hits += primary["model"].casefold() == truth["model"].casefold()
            model_top3_hits += any(
                candidate["model"].casefold() == truth["model"].casefold()
                for candidate in candidates
            )
            if primary.get("year") is not None:
                year_exact_hits += (
                    truth.get("year_start") == truth.get("year_end") == primary["year"]
                )
                year_overlap_hits += (
                    truth.get("year_start", primary["year"])
                    <= primary["year"]
                    <= truth.get("year_end", primary["year"])
                )
            elif primary.get("year_start") is not None:
                year_overlap_hits += primary["year_start"] <= truth.get("year_end", -1) and primary[
                    "year_end"
                ] >= truth.get("year_start", 9999)
        metadata = result.get("metadata", {})
        if metadata.get("latency_ms") is not None:
            latencies.append(metadata["latency_ms"])
        if metadata.get("estimated_cost") is not None:
            costs.append(metadata["estimated_cost"])
    count = len(recognizable)
    return {
        "make_top1_accuracy": _ratio(make_hits, count),
        "model_top1_accuracy": _ratio(model_hits, count),
        "model_top3_accuracy": _ratio(model_top3_hits, count),
        "year_exact_accuracy": _ratio(year_exact_hits, count),
        "year_range_overlap_accuracy": _ratio(year_overlap_hits, count),
        "unknown_precision": _ratio(unknown_tp, unknown_tp + unknown_fp),
        "unknown_recall": _ratio(unknown_tp, unknown_tp + unknown_fn),
        "schema_validation_rate": _ratio(len(completed), len(results)),
        "latency_p50_ms": _percentile(latencies, 50),
        "latency_p95_ms": _percentile(latencies, 95),
        "average_cost": statistics.mean(costs) if costs else None,
        "provider_error_rate": _ratio(errors, len(results)),
    }


def _ratio(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def _percentile(values: list[int], percentile: int) -> float | None:
    if not values:
        return None
    values = sorted(values)
    index = (len(values) - 1) * percentile / 100
    lower = int(index)
    upper = min(lower + 1, len(values) - 1)
    return values[lower] + (values[upper] - values[lower]) * (index - lower)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--max-cases", type=int, default=None)
    args = parser.parse_args()
    asyncio.run(run(args.manifest, args.output, max_cases=args.max_cases))


if __name__ == "__main__":
    main()
