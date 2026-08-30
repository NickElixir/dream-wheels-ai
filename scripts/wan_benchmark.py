"""Developer-only Phase 08C Wan model comparison harness.

This harness is deliberately isolated from the Dream Wheels runtime. It calls
the same 08B provider spike, writes local evidence, and never touches jobs,
credits, queues, storage, Supabase, Fitment, or deployment configuration.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from statistics import mean
from typing import Any

try:
    from scripts.wan_api_spike import (
        BASELINE_PROMPT,
        MODEL,
        MODEL_PRO,
        PROMPT_VERSION,
        SUPPORTED_MODELS,
        SpikeConfig,
        SpikeError,
        WanApiSpike,
        inspect_image,
        load_local_env,
        vehicle_output_size,
    )
except ModuleNotFoundError:  # Direct execution as `python scripts/wan_benchmark.py`.
    from wan_api_spike import (
        BASELINE_PROMPT,
        MODEL,
        MODEL_PRO,
        PROMPT_VERSION,
        SUPPORTED_MODELS,
        SpikeConfig,
        SpikeError,
        WanApiSpike,
        inspect_image,
        load_local_env,
        vehicle_output_size,
    )

MODELS = (MODEL, MODEL_PRO)
SCORE_FIELDS = (
    "rim_fidelity",
    "vehicle_preservation",
    "wheel_geometry",
    "two_wheel_consistency",
    "overall_realism",
)
CSV_FIELDS = (
    "case_id",
    "model",
    "latency_ms",
    "requested_output_dimensions",
    "output_width",
    "output_height",
    "output_dimensions",
    "output_bytes",
    "status",
    "estimated_cost_usd",
    "error_code",
    "local_result_path",
)


@dataclass(frozen=True, slots=True)
class BenchmarkCase:
    case_id: str
    vehicle_image: Path
    rim_reference_image: Path


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read JSON manifest: {path}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"JSON manifest must be an object: {path}")
    return value


def load_manifest(path: Path) -> dict[str, Any]:
    manifest = _read_json(path)
    if manifest.get("region") != "ap-southeast-1":
        raise ValueError("Phase 08C manifest region must be ap-southeast-1")
    if manifest.get("prompt_version") != PROMPT_VERSION:
        raise ValueError("Phase 08C manifest prompt version is not the approved baseline")
    if manifest.get("prompt") != BASELINE_PROMPT:
        raise ValueError("Phase 08C requires one fixed approved prompt")
    if manifest.get("models") != list(MODELS):
        raise ValueError("Phase 08C models must be wan2.7-image then wan2.7-image-pro")
    parameters = manifest.get("parameters")
    if parameters != {
        "n": 1,
        "watermark": False,
        "bbox": "off",
        "output_size": "vehicle-derived-explicit",
    }:
        raise ValueError("Phase 08C parameters must use n=1, watermark=false, bbox=off")
    prices = manifest.get("estimated_cost_usd")
    if not isinstance(prices, dict) or not all(model in prices for model in MODELS):
        raise ValueError("Manifest must contain estimated cost for both models")
    raw_cases = manifest.get("cases")
    if not isinstance(raw_cases, list) or len(raw_cases) != 5:
        raise ValueError("Phase 08C requires exactly five fixed cases")
    cases: list[BenchmarkCase] = []
    seen: set[str] = set()
    for raw in raw_cases:
        if not isinstance(raw, dict):
            raise ValueError("Each benchmark case must be an object")
        case_id = raw.get("case_id")
        vehicle = raw.get("vehicle_image")
        rim = raw.get("rim_reference_image")
        if (
            not isinstance(case_id, str)
            or not case_id
            or Path(case_id).name != case_id
            or case_id in seen
            or not isinstance(vehicle, str)
            or not isinstance(rim, str)
        ):
            raise ValueError("Each case needs a unique safe case_id and two image paths")
        vehicle_path = Path(vehicle)
        rim_path = Path(rim)
        if not vehicle_path.is_file() or not rim_path.is_file():
            raise ValueError(f"Input image is missing for {case_id}")
        try:
            inspect_image(vehicle_path.read_bytes(), role="vehicle")
            inspect_image(rim_path.read_bytes(), role="rim reference")
        except (OSError, SpikeError) as exc:
            raise ValueError(f"Input image is invalid for {case_id}") from exc
        seen.add(case_id)
        cases.append(BenchmarkCase(case_id, vehicle_path, rim_path))
    manifest["_cases"] = cases
    return manifest


def scoring_template(manifest: dict[str, Any]) -> dict[str, Any]:
    return {
        "manifest_version": manifest["manifest_version"],
        "scale": "1-5",
        "instructions": (
            "Fill the five numeric scores, HF1/HF2/HF3, and accepted (yes/no) "
            "after reviewing each local result. Leave null when not yet scored."
        ),
        "scores": [
            {
                "case_id": case.case_id,
                "model": model,
                **{field: None for field in SCORE_FIELDS},
                "HF1": None,
                "HF2": None,
                "HF3": None,
                "accepted": None,
            }
            for case in manifest["_cases"]
            for model in MODELS
        ],
    }


def ensure_scores_file(path: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(scoring_template(manifest), indent=2) + "\n")
    scores = _read_json(path)
    if not isinstance(scores.get("scores"), list):
        raise ValueError("Scoring manifest must contain a scores list")
    return scores


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def _result_exists(report: dict[str, Any]) -> bool:
    result_path = report.get("local_result_path")
    return isinstance(result_path, str) and Path(result_path).is_file()


def _model_dir_name(model: str) -> str:
    return model.replace(".", "_")


def _requested_size(case: BenchmarkCase) -> str:
    vehicle = inspect_image(case.vehicle_image.read_bytes(), role="vehicle")
    return vehicle_output_size(vehicle.width, vehicle.height).value


def _record_from_report(
    report: dict[str, Any],
    *,
    status: str | None = None,
    estimated_cost_usd: float | None = None,
    error_code: str | None = None,
) -> dict[str, Any]:
    width = report.get("actual_output_width")
    height = report.get("actual_output_height")
    return {
        "case_id": report.get("case_id"),
        "model": report.get("model"),
        "latency_ms": report.get("latency_ms"),
        "output_width": width,
        "output_height": height,
        "output_dimensions": f"{width}*{height}" if width and height else None,
        "output_bytes": report.get("output_bytes"),
        "status": status or report.get("status") or report.get("task_status"),
        "estimated_cost_usd": (
            estimated_cost_usd
            if estimated_cost_usd is not None
            else report.get("estimated_cost_usd")
        ),
        "error_code": error_code or report.get("error_code"),
        "local_result_path": report.get("local_result_path"),
    }


def _existing_success(evidence_path: Path) -> dict[str, Any] | None:
    if not evidence_path.is_file():
        return None
    try:
        report = json.loads(evidence_path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    if isinstance(report, dict) and report.get("status") == "SUCCEEDED" and _result_exists(report):
        return report
    return None


def load_existing_records(manifest: dict[str, Any], output_dir: Path) -> list[dict[str, Any]]:
    """Rebuild aggregate records from local evidence without making API calls."""
    records: list[dict[str, Any]] = []
    for case in manifest["_cases"]:
        requested_dimensions = _requested_size(case)
        for model in MODELS:
            evidence_path = output_dir / case.case_id / _model_dir_name(model) / "wan-evidence.json"
            if not evidence_path.is_file():
                raise ValueError(f"Missing local evidence for {case.case_id}/{model}")
            try:
                report = json.loads(evidence_path.read_text())
            except (OSError, json.JSONDecodeError) as exc:
                raise ValueError(f"Invalid local evidence for {case.case_id}/{model}") from exc
            if not isinstance(report, dict):
                raise ValueError(f"Invalid local evidence for {case.case_id}/{model}")
            record = _record_from_report(report)
            record["requested_output_dimensions"] = requested_dimensions
            records.append(record)
    return records


async def _run_one(
    case: BenchmarkCase,
    model: str,
    manifest: dict[str, Any],
    output_dir: Path,
    config: SpikeConfig,
) -> dict[str, Any]:
    run_dir = output_dir / case.case_id / _model_dir_name(model)
    evidence_path = run_dir / "wan-evidence.json"
    existing = _existing_success(evidence_path)
    if existing is not None:
        return _record_from_report(existing, status="SKIPPED_EXISTING")

    started = time.monotonic()
    try:
        report = await WanApiSpike(config).run(
            case.vehicle_image,
            case.rim_reference_image,
            run_dir,
            case_id=case.case_id,
            prompt=manifest["prompt"],
            prompt_version=manifest["prompt_version"],
        )
        estimated_cost = float(manifest["estimated_cost_usd"][model])
        report["estimated_cost_usd"] = estimated_cost
        report["benchmark_status"] = "SUCCEEDED"
        _write_json(evidence_path, report)
        return _record_from_report(report, estimated_cost_usd=estimated_cost)
    except SpikeError as exc:
        elapsed_ms = round((time.monotonic() - started) * 1000)
        failure = {
            "case_id": case.case_id,
            "provider": "alibaba_model_studio",
            "model": model,
            "region": manifest["region"],
            "prompt_version": manifest["prompt_version"],
            "status": "FAILED",
            "error_code": exc.code,
            "latency_ms": elapsed_ms,
            "estimated_cost_usd": 0.0,
            "evidence_timestamp": _iso_now(),
        }
        run_dir.mkdir(parents=True, exist_ok=True)
        _write_json(evidence_path, failure)
        return _record_from_report(failure, estimated_cost_usd=0.0)


def _percentile_50(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return round((ordered[middle - 1] + ordered[middle]) / 2, 2)


def _numeric_mean(values: list[Any]) -> float | None:
    numeric = [float(value) for value in values if isinstance(value, int | float)]
    return round(mean(numeric), 3) if numeric else None


def calculate_summary(records: list[dict[str, Any]], scores: dict[str, Any]) -> dict[str, Any]:
    attempted = [record for record in records if record.get("status") != "SKIPPED_EXISTING"]
    successes = [record for record in records if record.get("status") == "SUCCEEDED"]
    failures = [record for record in attempted if record.get("status") == "FAILED"]
    latencies = [
        record["latency_ms"]
        for record in successes
        if isinstance(record.get("latency_ms"), int | float)
    ]
    score_rows = [row for row in scores.get("scores", []) if isinstance(row, dict)]
    accepted = [
        row.get("accepted")
        for row in score_rows
        if str(row.get("accepted", "")).lower() in {"yes", "no"}
    ]
    accepted_yes = sum(str(value).lower() == "yes" for value in accepted)
    total_cost = round(sum(float(record.get("estimated_cost_usd") or 0) for record in records), 6)
    return {
        "total_runs": len(records),
        "attempted_runs": len(attempted),
        "successful_runs": len(successes),
        "failed_runs": len(failures),
        "acceptance_rate": round(accepted_yes / len(accepted), 4) if accepted else None,
        "scored_runs": len(accepted),
        "mean_scores": {
            field: _numeric_mean([row.get(field) for row in score_rows]) for field in SCORE_FIELDS
        },
        "mean_latency_ms": round(mean(latencies), 2) if latencies else None,
        "p50_latency_ms": _percentile_50(latencies),
        "provider_failure_rate": round(len(failures) / len(attempted), 4) if attempted else None,
        "total_cost_usd": total_cost,
        "cost_per_accepted_result_usd": (
            round(total_cost / accepted_yes, 6) if accepted_yes else None
        ),
    }


def write_aggregate(
    output_dir: Path, records: list[dict[str, Any]], scores: dict[str, Any]
) -> dict[str, Any]:
    summary = calculate_summary(records, scores)
    aggregate = {
        "manifest_version": "phase-08c-v1",
        "generated_at": _iso_now(),
        "records": records,
        "summary": summary,
    }
    _write_json(output_dir / "comparison.json", aggregate)
    with (output_dir / "comparison.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows({field: record.get(field) for field in CSV_FIELDS} for record in records)
    _write_json(output_dir / "comparison_summary.json", summary)
    return summary


async def run_benchmark(
    manifest: dict[str, Any],
    *,
    output_dir: Path,
    scores_path: Path,
) -> dict[str, Any]:
    await asyncio.to_thread(output_dir.mkdir, parents=True, exist_ok=True)
    scores = ensure_scores_file(scores_path, manifest)
    configs: dict[str, SpikeConfig] = {}
    records: list[dict[str, Any]] = []
    for case in manifest["_cases"]:
        vehicle_info = inspect_image(case.vehicle_image.read_bytes(), role="vehicle")
        size = vehicle_output_size(vehicle_info.width, vehicle_info.height)
        for model in MODELS:
            if model not in SUPPORTED_MODELS:
                raise ValueError(f"Unsupported benchmark model: {model}")
            if model not in configs:
                configs[model] = SpikeConfig.from_env(model_override=model)
            record = await _run_one(case, model, manifest, output_dir, configs[model])
            record["requested_output_dimensions"] = size.value
            records.append(record)
    return write_aggregate(output_dir, records, scores)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the isolated Phase 08C Wan comparison")
    parser.add_argument(
        "--manifest", type=Path, default=Path(__file__).with_name("wan_benchmark_cases.json")
    )
    parser.add_argument("--output-dir", type=Path, default=Path("/tmp/dream-wheels-wan-08c"))
    parser.add_argument(
        "--scores", type=Path, default=Path(__file__).with_name("wan_benchmark_scores.json")
    )
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the 10-run plan")
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="Rebuild aggregate from local evidence and scores without live API calls",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    load_local_env(args.env_file)
    manifest = load_manifest(args.manifest)
    if args.dry_run and args.summary_only:
        raise SystemExit("--dry-run and --summary-only cannot be combined")
    if args.dry_run:
        plan = [
            {
                "case_id": case.case_id,
                "model": model,
                "requested_output_dimensions": _requested_size(case),
            }
            for case in manifest["_cases"]
            for model in MODELS
        ]
        print(json.dumps({"runs": plan, "execution": "sequential"}, indent=2))
        return
    if args.summary_only:
        scores = ensure_scores_file(args.scores, manifest)
        records = load_existing_records(manifest, args.output_dir)
        print(json.dumps(write_aggregate(args.output_dir, records, scores), indent=2))
        return
    summary = asyncio.run(
        run_benchmark(manifest, output_dir=args.output_dir, scores_path=args.scores)
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
