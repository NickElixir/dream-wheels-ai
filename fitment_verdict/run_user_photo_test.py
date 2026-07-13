"""Run photo-only user flow: VLM snapshots + Wheel-Size vehicle profile + rules."""

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
from fitment_verdict.schemas import FitmentVerdictRequest, Source, VehicleQuery
from fitment_verdict.service import FitmentVerdictService

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "demo_assets"
RUNS = ROOT / "demo_runs"
FIXTURES = ROOT.parent / "tests" / "fitment_verdict" / "fixtures"

SNAPSHOTS = json.loads((FIXTURES / "agent_vlm_snapshots.json").read_text(encoding="utf-8"))


class EvoqueProfileProvider:
    def __init__(self, profile):
        self._profile = profile

    async def resolve_and_fetch_profile(self, vehicle, *, user_initiated: bool):
        if not user_initiated:
            return None
        return self._profile


def load_evoque_profile():
    payload = json.loads((FIXTURES / "wheel_size_evoque.json").read_text(encoding="utf-8"))
    vehicle = VehicleQuery(
        make="Land Rover",
        model="Range Rover Evoque",
        year=2014,
        region="eudm",
        make_slug="land-rover",
        model_slug="range-rover-evoque",
        is_user_confirmed=False,
        source=Source.vlm,
        confidence=0.76,
    )
    return normalize_vehicle_payload(
        payload,
        provider="wheel_size",
        vehicle_query=vehicle,
        raw_response_ref="demo:evoque",
    )


CASES = [
    {
        "id": "user_konig_disc",
        "title": "Photos only — Konig Dekagram (disc_1.webp) on Evoque",
        "car_image": "cars/suv_white_side.jpg",
        "rim_image": "rims/disc_1.webp",
    },
    {
        "id": "user_rial_rim",
        "title": "Photos only — RIAL mesh (rim.jpg) on Evoque",
        "car_image": "cars/suv_white_side.jpg",
        "rim_image": "rims/rim.jpg",
    },
]


async def run_case(case: dict, profile, run_dir: Path) -> dict:
    car_path = ASSETS / case["car_image"]
    rim_path = ASSETS / case["rim_image"]
    vehicle_hints = SNAPSHOTS[case["car_image"]]
    rim_hints = SNAPSHOTS[case["rim_image"]]

    config = FitmentConfig(wheel_size_api_key="demo", cache_dir=str(run_dir / ".cache"))
    service = FitmentVerdictService(
        config,
        vehicle_vlm=MockVehicleVLM(vehicle_hints, model_used="agent-vision-snapshot"),
        rim_vlm=MockRimVLM(rim_hints),
        provider=EvoqueProfileProvider(profile),
    )

    result = await service.run(
        FitmentVerdictRequest(
            car_image_path=str(car_path),
            rim_image_path=str(rim_path),
            user_initiated=True,
        )
    )

    case_dir = run_dir / case["id"]
    case_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(car_path, case_dir / car_path.name)
    shutil.copy2(rim_path, case_dir / rim_path.name)

    payload = {
        "case": case,
        "user_input": {"note": "photos only — no manual vehicle/rim fields"},
        "agent_vlm_vehicle": vehicle_hints,
        "agent_vlm_rim": rim_hints,
        "result": result.model_dump(mode="json"),
    }
    (case_dir / "verdict.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return payload


def write_summary(run_dir: Path, results: list[dict]) -> None:
    lines = [
        "# User Photo Test — VLM + Wheel-Size flow",
        "",
        f"Generated: {datetime.now(UTC).isoformat()}",
        "",
        "User submits car photo + rim photo only. Pipeline:",
        "1. VLM identifies car and rim (brand/model/estimated size)",
        "2. Wheel-Size profile for identified vehicle (Evoque fixture)",
        "3. PCD hypothesis from vehicle hub when lug count matches",
        "4. Deterministic rules engine → verdict",
        "",
        "| Case | Rim (VLM) | Size est. | Verdict | Conditions |",
        "|---|---|---|---|---|",
    ]
    for item in results:
        r = item["agent_vlm_rim"]
        v = item["result"]["verdict"]
        rim = v["rim"]
        cond = ", ".join(v.get("condition_codes") or []) or "-"
        size = f"{rim.get('diameter')}x{rim.get('width')}"
        lines.append(
            f"| {item['case']['id']} | {r.get('brand')} {r.get('model')} | {size} | "
            f"{v['status']} | {cond} |"
        )

    lines.extend(["", "## Details", ""])
    for item in results:
        v = item["result"]["verdict"]
        lines.append(f"### {item['case']['id']}")
        lines.append(item["case"]["title"])
        r = item["agent_vlm_rim"]
        lines.append(
            f"- VLM rim: **{r.get('brand')} {r.get('model')}**, "
            f'est. {r.get("diameter_estimate")}x{r.get("width_estimate")}", '
            f"{r.get('bolt_count')} lug, conf={r['confidence']}"
        )
        lines.append(
            f"- Resolved: bolt={v['rim'].get('bolt_pattern')}, "
            f"size={v['rim'].get('diameter')}x{v['rim'].get('width')}, "
            f"CB={v['rim'].get('center_bore_mm')}"
        )
        lines.append(f"- **Verdict: {v['status']}**")
        if v.get("conditions"):
            lines.append(f"- Conditions: {v['conditions']}")
        if v.get("missing_data"):
            lines.append(f"- Missing: {v['missing_data']}")
        lines.append("")

    (run_dir / "SUMMARY.md").write_text("\n".join(lines), encoding="utf-8")


async def main() -> None:
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    run_dir = RUNS / f"user_photos_{stamp}"
    run_dir.mkdir(parents=True, exist_ok=True)

    profile = load_evoque_profile()
    results = []
    for case in CASES:
        print(f"Running {case['id']}...")
        payload = await run_case(case, profile, run_dir)
        status = payload["result"]["verdict"]["status"]
        print(f"  verdict={status}")
        results.append(payload)

    write_summary(run_dir, results)
    (run_dir / "all_results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nResults saved to {run_dir}")


if __name__ == "__main__":
    asyncio.run(main())
