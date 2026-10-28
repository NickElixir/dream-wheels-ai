"""Run the versioned deterministic Fitment Verdict V1 benchmark offline.

The fixture deliberately contains normalized Wheel-Size references, never API
keys or raw provider responses. Its primary safety metric is false-compatible
rate: a case labelled non-compatible must not receive ``compatible``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.fitment.rules.engine import CompatibilityEngine
from src.fitment.rules.verdict import assemble_verdict
from src.fitment.schemas import (
    AxleFitment,
    FieldValue,
    FitmentProfile,
    OffsetReference,
    RimSetup,
    RimSpec,
    Source,
)

DEFAULT_FIXTURE = Path("tests/fixtures/fitment/benchmark_v1.json")


def _field(value: object, trusted: bool = True) -> FieldValue:
    return FieldValue(
        value=value,
        source=Source.user_confirmed if trusted else Source.product_page,
        confidence=1.0 if trusted else 0.7,
        is_user_confirmed=trusted,
    )


def _profile(case: dict) -> FitmentProfile:
    config = case.get("profile", {})
    allowed = [
        AxleFitment(axle=axle, rim_diameter=20, rim_width=8.5, offset=40, is_stock=True)
        for axle in ("front", "rear")
    ]
    if config.get("allowed") == "empty":
        allowed = []
    elif config.get("allowed") == "19x8":
        allowed = [
            AxleFitment(axle=axle, rim_diameter=19, rim_width=8, offset=40, is_stock=True)
            for axle in ("front", "rear")
        ]
    references = [
        OffsetReference(axle=axle, rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45)
        for axle in ("front", "rear")
    ]
    if config.get("offset_reference") == "missing":
        references = []
    return FitmentProfile(
        provider="wheel_size",
        bolt_count=config.get("bolt_count", 5),
        pcd_mm=config.get("pcd_mm", 114.3),
        center_bore_mm=config.get("center_bore_mm", 60.1),
        fastener_type=config.get("fastener_type"),
        allowed_wheels=allowed,
        offset_references=references,
    )


def _rim(values: dict) -> RimSpec:
    trusted = not values.pop("untrusted", False)
    return RimSpec(
        bolt_count=_field(values.get("bolt_count", 5), trusted),
        pcd_mm=_field(values.get("pcd_mm", 114.3), trusted),
        center_bore_mm=_field(values.get("center_bore_mm", 60.1), trusted),
        wheel_diameter_in=_field(values.get("wheel_diameter_in", 20), trusted),
        wheel_width_j=_field(values.get("wheel_width_j", 8.5), trusted),
        offset_et_mm=_field(values.get("offset_et_mm", 40), trusted),
        fastener_system=_field(values["fastener_system"], trusted)
        if "fastener_system" in values
        else FieldValue(),
        load_rating_kg=_field(values["load_rating_kg"], trusted)
        if "load_rating_kg" in values
        else FieldValue(),
    )


def run_benchmark(fixture: Path = DEFAULT_FIXTURE) -> dict[str, object]:
    payload = json.loads(fixture.read_text())
    cases = payload["cases"]
    engine = CompatibilityEngine()
    results: list[dict[str, str]] = []
    false_compatible = 0
    expected_mismatches = 0
    for case in cases:
        front = _rim(dict(case.get("front", {})))
        rear = _rim(dict(case.get("rear", case.get("front", {}))))
        verdict = assemble_verdict(
            engine.evaluate(
                _profile(case), RimSetup(front=front, rear=rear, is_staggered="rear" in case)
            ),
            provider="wheel_size",
            is_preliminary=True,
        )
        actual = verdict.status.value
        expected = case["expected"]
        if actual != expected:
            expected_mismatches += 1
        if expected != "compatible" and actual == "compatible":
            false_compatible += 1
        results.append({"id": case["id"], "expected": expected, "actual": actual})
    total = len(cases)
    return {
        "benchmark_version": payload["benchmark_version"],
        "engine_version": engine.version,
        "case_count": total,
        "expected_status_mismatches": expected_mismatches,
        "false_compatible_count": false_compatible,
        "false_compatible_rate": false_compatible / total if total else 0.0,
        "cases": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    args = parser.parse_args()
    print(json.dumps(run_benchmark(args.fixture), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
