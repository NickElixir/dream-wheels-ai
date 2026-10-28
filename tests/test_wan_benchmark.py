import asyncio
import json
from io import BytesIO
from pathlib import Path

from PIL import Image

import scripts.wan_benchmark as benchmark
from scripts.wan_api_spike import (
    BASELINE_PROMPT,
    MODEL,
    MODEL_PRO,
    build_payload,
    inspect_image,
    vehicle_output_size,
)


def image_bytes(size=(320, 240), fmt="PNG"):
    buffer = BytesIO()
    Image.new("RGB", size, "navy").save(buffer, format=fmt)
    return buffer.getvalue()


def local_manifest(tmp_path: Path) -> dict:
    cases = []
    for index in range(5):
        vehicle = tmp_path / f"vehicle-{index}.png"
        rim = tmp_path / f"rim-{index}.png"
        vehicle.write_bytes(image_bytes((800 + index, 600)))
        rim.write_bytes(image_bytes((400, 400), "JPEG"))
        cases.append(
            {
                "case_id": f"case-{index}",
                "vehicle_image": str(vehicle),
                "rim_reference_image": str(rim),
            }
        )
    return {
        "manifest_version": "phase-08c-v1",
        "provider": "alibaba_model_studio",
        "region": "ap-southeast-1",
        "prompt_version": "P0_API_SPIKE",
        "prompt": BASELINE_PROMPT,
        "models": [MODEL, MODEL_PRO],
        "parameters": {
            "n": 1,
            "watermark": False,
            "bbox": "off",
            "output_size": "vehicle-derived-explicit",
        },
        "estimated_cost_usd": {MODEL: 0.03, MODEL_PRO: 0.075},
        "cases": cases,
    }


def test_manifest_requires_exactly_five_valid_cases(tmp_path):
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(local_manifest(tmp_path)))
    manifest = benchmark.load_manifest(path)
    assert len(manifest["_cases"]) == 5


def test_both_models_use_identical_prompt_and_explicit_vehicle_size():
    vehicle = inspect_image(image_bytes((1001, 777)), role="vehicle")
    rim = inspect_image(image_bytes((500, 500), "JPEG"), role="rim")
    size = vehicle_output_size(vehicle.width, vehicle.height)
    baseline = build_payload(vehicle, rim, size, model=MODEL)
    pro = build_payload(vehicle, rim, size, model=MODEL_PRO)
    assert baseline["input"] == pro["input"]
    assert baseline["parameters"] == {"size": size.value, "n": 1, "watermark": False}
    assert pro["parameters"] == baseline["parameters"]
    assert baseline["model"] == MODEL
    assert pro["model"] == MODEL_PRO
    assert "bbox_list" not in baseline["parameters"]


def test_benchmark_is_sequential_and_does_not_regenerate_successes(tmp_path, monkeypatch):
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(local_manifest(tmp_path)))
    manifest = benchmark.load_manifest(manifest_path)
    scores_path = tmp_path / "scores.json"
    calls = []

    class FakeProvider:
        def __init__(self, config):
            self.config = config

        async def run(self, vehicle, rim, output_dir, **kwargs):
            calls.append((kwargs["case_id"], self.config.model))
            output_dir.mkdir(parents=True, exist_ok=True)
            result_path = output_dir / "wan-result.png"
            result_path.write_bytes(image_bytes((640, 480)))
            report = {
                "case_id": kwargs["case_id"],
                "provider": "alibaba_model_studio",
                "model": self.config.model,
                "region": self.config.region,
                "prompt_version": kwargs["prompt_version"],
                "actual_output_width": 640,
                "actual_output_height": 480,
                "output_bytes": result_path.stat().st_size,
                "latency_ms": 100,
                "status": "SUCCEEDED",
                "task_status": "SUCCEEDED",
                "local_result_path": str(result_path),
            }
            (output_dir / "wan-evidence.json").write_text(json.dumps(report))
            return report

    monkeypatch.setattr(benchmark, "WanApiSpike", FakeProvider)
    monkeypatch.setenv("WAN_API_KEY", "test-key")
    monkeypatch.setenv("WAN_REGION", "ap-southeast-1")
    monkeypatch.setenv("WAN_WORKSPACE_ID", "workspace")
    monkeypatch.setenv("WAN_MODEL", MODEL)

    output_dir = tmp_path / "output"
    first = asyncio.run(
        benchmark.run_benchmark(manifest, output_dir=output_dir, scores_path=scores_path)
    )
    assert len(calls) == 10
    assert calls[:2] == [("case-0", MODEL), ("case-0", MODEL_PRO)]
    assert first["successful_runs"] == 10
    assert first["total_cost_usd"] == 0.525

    second = asyncio.run(
        benchmark.run_benchmark(manifest, output_dir=output_dir, scores_path=scores_path)
    )
    assert len(calls) == 10
    assert second["attempted_runs"] == 0
    comparison = json.loads((output_dir / "comparison.json").read_text())
    assert {record["status"] for record in comparison["records"]} == {"SKIPPED_EXISTING"}


def test_summary_calculates_scores_latency_failures_and_cost():
    records = [
        {
            "status": "SUCCEEDED",
            "latency_ms": 100,
            "estimated_cost_usd": 0.03,
        },
        {
            "status": "SUCCEEDED",
            "latency_ms": 200,
            "estimated_cost_usd": 0.075,
        },
        {
            "status": "FAILED",
            "latency_ms": 30,
            "estimated_cost_usd": 0.0,
        },
    ]
    scores = {
        "scores": [
            {
                "rim_fidelity": 5,
                "vehicle_preservation": 4,
                "wheel_geometry": 3,
                "two_wheel_consistency": 4,
                "overall_realism": 4,
                "accepted": "yes",
            },
            {
                "rim_fidelity": 3,
                "vehicle_preservation": 3,
                "wheel_geometry": 2,
                "two_wheel_consistency": 3,
                "overall_realism": 3,
                "accepted": "no",
            },
        ]
    }
    summary = benchmark.calculate_summary(records, scores)
    assert summary["acceptance_rate"] == 0.5
    assert summary["mean_scores"]["rim_fidelity"] == 4.0
    assert summary["mean_latency_ms"] == 150
    assert summary["p50_latency_ms"] == 150
    assert summary["provider_failure_rate"] == 0.3333
    assert summary["total_cost_usd"] == 0.105
    assert summary["cost_per_accepted_result_usd"] == 0.105
