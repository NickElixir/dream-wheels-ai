"""Run realistic user-like fitment verdict demo scenarios.

Uses MockVehicleVLM / MockRimVLM as deterministic stand-ins for live VLM.
Writes JSON results and a markdown summary to fitment_verdict/demo_runs/.
"""

from __future__ import annotations

import asyncio
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

from fitment_verdict.config import FitmentConfig
from fitment_verdict.identification.rim_vlm import MockRimVLM
from fitment_verdict.identification.vehicle_vlm import MockVehicleVLM
from fitment_verdict.providers.wheel_size import normalize_vehicle_payload
from fitment_verdict.schemas import (
    FitmentVerdictRequest,
    RimSpec,
    Source,
    VehicleQuery,
)
from fitment_verdict.service import FitmentVerdictService

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "demo_assets"
RUNS = ROOT / "demo_runs"
FIXTURES = ROOT.parent / "tests" / "fitment_verdict" / "fixtures"


class StaticProfileProvider:
    def __init__(self, profile):
        self._profile = profile

    async def resolve_and_fetch_profile(self, vehicle, *, user_initiated: bool):
        if not user_initiated:
            return None
        return self._profile


def load_haval_profile() -> object:
    payload = json.loads((FIXTURES / "wheel_size_vehicle.json").read_text(encoding="utf-8"))
    vehicle = VehicleQuery(
        make="Haval",
        model="Chitu",
        year=2022,
        region="chdm",
        make_slug="haval",
        model_slug="chitu",
        is_user_confirmed=False,
        source=Source.vlm,
        confidence=0.9,
    )
    return normalize_vehicle_payload(
        payload,
        provider="wheel_size",
        vehicle_query=vehicle,
        raw_response_ref="demo:haval_chitu",
    )


SCENARIOS: list[dict] = [
    {
        "id": "01_compatible_photos_only",
        "title": "Photos only — matching OEM-style rim",
        "description": "User uploads car + rim photos. No manual specs.",
        "car_image": "cars/suv_white_side.jpg",
        "rim_image": "rims/rim_oem_match.jpg",
        "user_vehicle": None,
        "user_rim": None,
        "simulated_vlm_vehicle": {
            "make": "Haval",
            "model": "Chitu",
            "year_from": 2022,
            "year_to": 2022,
            "body_type": "SUV",
            "market_guess": "chdm",
            "confidence": 0.88,
            "notes": "Compact crossover, likely Haval family",
        },
        "simulated_vlm_rim": {
            "diameter": 18,
            "width": 7,
            "offset": 40,
            "bolt_count": 5,
            "pcd_mm": 114.3,
            "center_bore_mm": 66.6,
            "style": "multi-spoke",
            "finish": "silver",
            "confidence": 0.62,
        },
        "expected_verdict": "compatible",
    },
    {
        "id": "02_incompatible_wrong_pcd",
        "title": "Photos only — wrong bolt pattern",
        "description": "User uploads photos. VLM reads 5x108 marking on rim.",
        "car_image": "cars/suv_white_side.jpg",
        "rim_image": "rims/rim_wrong_pcd.jpg",
        "user_vehicle": None,
        "user_rim": None,
        "simulated_vlm_vehicle": {
            "make": "Haval",
            "model": "Chitu",
            "year_from": 2022,
            "year_to": 2022,
            "body_type": "SUV",
            "market_guess": "chdm",
            "confidence": 0.86,
            "notes": "Same vehicle as case 01",
        },
        "simulated_vlm_rim": {
            "diameter": 18,
            "width": 7,
            "offset": 40,
            "bolt_count": 5,
            "pcd_mm": 108.0,
            "center_bore_mm": 65.1,
            "style": "5-spoke",
            "finish": "matte black",
            "confidence": 0.58,
        },
        "expected_verdict": "incompatible",
    },
    {
        "id": "03_conditions_hub_rings",
        "title": "Photos only — hub rings required",
        "description": "Correct PCD, but center bore larger than hub.",
        "car_image": "cars/crossover_dark.jpg",
        "rim_image": "rims/rim_needs_rings.jpg",
        "user_vehicle": None,
        "user_rim": None,
        "simulated_vlm_vehicle": {
            "make": "Haval",
            "model": "Chitu",
            "year_from": 2022,
            "year_to": 2022,
            "body_type": "SUV",
            "market_guess": "chdm",
            "confidence": 0.81,
            "notes": "Dark SUV, generation uncertain",
        },
        "simulated_vlm_rim": {
            "diameter": 18,
            "width": 7,
            "offset": 40,
            "bolt_count": 5,
            "pcd_mm": 114.3,
            "center_bore_mm": 67.1,
            "confidence": 0.55,
        },
        "expected_verdict": "compatible_with_conditions",
    },
    {
        "id": "04_conditions_oversize",
        "title": "Minimal text — user typed only diameter",
        "description": "User adds only '18' inch hint, rest from photos + VLM.",
        "car_image": "cars/suv_white_side.jpg",
        "rim_image": "rims/rim_oversize.jpg",
        "user_vehicle": None,
        "user_rim": {"diameter": 18},
        "simulated_vlm_vehicle": {
            "make": "Haval",
            "model": "Chitu",
            "year_from": 2022,
            "year_to": 2022,
            "body_type": "SUV",
            "market_guess": "chdm",
            "confidence": 0.84,
            "notes": "User only confirmed diameter verbally",
        },
        "simulated_vlm_rim": {
            "diameter": 20,
            "width": 10,
            "offset": 15,
            "bolt_count": 5,
            "pcd_mm": 114.3,
            "center_bore_mm": 66.6,
            "style": "deep dish",
            "confidence": 0.51,
        },
        "expected_verdict": "compatible_with_conditions",
    },
    {
        "id": "05_unknown_no_marking",
        "title": "Photos only — no readable rim marking",
        "description": "VLM sees style/color only, cannot read stamped specs.",
        "car_image": "cars/crossover_dark.jpg",
        "rim_image": "rims/rim_no_marking.jpg",
        "user_vehicle": None,
        "user_rim": None,
        "simulated_vlm_vehicle": {
            "make": "Haval",
            "model": "Chitu",
            "year_from": 2021,
            "year_to": 2023,
            "body_type": "SUV",
            "market_guess": "chdm",
            "confidence": 0.72,
            "notes": "Year range widened due to uncertainty",
        },
        "simulated_vlm_rim": {
            "style": "mesh",
            "finish": "gloss red",
            "confidence": 0.33,
        },
        "expected_verdict": "unknown",
    },
]


def _build_user_rim(data: dict | None) -> RimSpec | None:
    if not data:
        return None
    spec = RimSpec(
        diameter=data.get("diameter"),
        width=data.get("width"),
        offset=data.get("offset"),
        source=Source.user_input,
        confidence=0.55 if data else 0.0,
        is_user_confirmed=False,
    )
    return spec.sync_bolt_fields()


async def run_scenario(scenario: dict, profile, run_dir: Path) -> dict:
    car_path = ASSETS / scenario["car_image"]
    rim_path = ASSETS / scenario["rim_image"]

    vehicle_vlm = MockVehicleVLM(
        scenario["simulated_vlm_vehicle"], model_used="simulated-vlm-agent"
    )
    rim_vlm = MockRimVLM(scenario["simulated_vlm_rim"])

    config = FitmentConfig(
        wheel_size_api_key="demo",
        cache_dir=str(run_dir / ".cache"),
    )
    service = FitmentVerdictService(
        config,
        vehicle_vlm=vehicle_vlm,
        rim_vlm=rim_vlm,
        provider=StaticProfileProvider(profile),
    )

    request = FitmentVerdictRequest(
        car_image_path=str(car_path),
        rim_image_path=str(rim_path),
        vehicle=_build_user_vehicle(scenario.get("user_vehicle")),
        rim=_build_user_rim(scenario.get("user_rim")),
        user_initiated=True,
        trigger="user_requested",
        mode="detailed",
    )

    result = await service.run(request)

    case_dir = run_dir / scenario["id"]
    case_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(car_path, case_dir / Path(scenario["car_image"]).name)
    shutil.copy2(rim_path, case_dir / Path(scenario["rim_image"]).name)

    payload = {
        "scenario": {
            "id": scenario["id"],
            "title": scenario["title"],
            "description": scenario["description"],
            "expected_verdict": scenario["expected_verdict"],
            "user_input": {
                "vehicle": scenario.get("user_vehicle"),
                "rim": scenario.get("user_rim"),
            },
            "simulated_vlm_vehicle": scenario["simulated_vlm_vehicle"],
            "simulated_vlm_rim": scenario["simulated_vlm_rim"],
        },
        "result": result.model_dump(mode="json"),
        "match_expected": (
            result.verdict.status.value == scenario["expected_verdict"] if result.verdict else False
        ),
    }

    (case_dir / "verdict.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return payload


def _build_user_vehicle(data: dict | None) -> VehicleQuery | None:
    if not data:
        return None
    return VehicleQuery(**data)


def write_summary(run_dir: Path, results: list[dict]) -> None:
    lines = [
        "# Fitment Verdict Demo Runs",
        "",
        f"Generated: {datetime.now(UTC).isoformat()}",
        "",
        "VLM was simulated (deterministic mock outputs). Wheel-Size profile: Haval Chitu 2022 CHDM fixture.",
        "",
        "| Case | Expected | Actual | Match | Reasons |",
        "|---|---|---|---|---|",
    ]
    for item in results:
        verdict = item["result"].get("verdict") or {}
        status = verdict.get("status", item["result"].get("execution_status"))
        reasons = verdict.get("reason_codes") or verdict.get("missing_data") or []
        reason_text = ", ".join(reasons[:3]) if reasons else "—"
        lines.append(
            f"| {item['scenario']['id']} | {item['scenario']['expected_verdict']} | "
            f"{status} | {'yes' if item['match_expected'] else 'no'} | {reason_text} |"
        )

    lines.extend(["", "## Cases", ""])
    for item in results:
        sc = item["scenario"]
        lines.append(f"### {sc['id']} — {sc['title']}")
        lines.append(sc["description"])
        lines.append("")
        if item["result"].get("presentation"):
            pres = item["result"]["presentation"]
            lines.append(f"- Presentation headline: `{pres.get('headline_code')}`")
        if item["result"].get("verdict"):
            v = item["result"]["verdict"]
            lines.append(f"- Verdict: **{v.get('status')}**")
            if v.get("conditions"):
                lines.append(f"- Conditions: {v['conditions']}")
            if v.get("reasons"):
                lines.append(f"- Reasons: {v['reasons']}")
            if v.get("missing_data"):
                lines.append(f"- Missing: {v['missing_data']}")
        lines.append("")

    (run_dir / "SUMMARY.md").write_text("\n".join(lines), encoding="utf-8")


async def main() -> None:
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    run_dir = RUNS / stamp
    run_dir.mkdir(parents=True, exist_ok=True)

    profile = load_haval_profile()
    results: list[dict] = []
    for scenario in SCENARIOS:
        print(f"Running {scenario['id']}...")
        payload = await run_scenario(scenario, profile, run_dir)
        actual = payload["result"].get("verdict", {}) or {}
        status = actual.get("status", payload["result"].get("execution_status"))
        mark = "OK" if payload["match_expected"] else "MISMATCH"
        print(f"{mark} {scenario['id']}: expected={scenario['expected_verdict']} actual={status}")
        results.append(payload)

    write_summary(run_dir, results)
    (run_dir / "all_results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nResults saved to {run_dir}")


if __name__ == "__main__":
    asyncio.run(main())
