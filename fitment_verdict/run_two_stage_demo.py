"""Demo of the full two-stage user journey.

Stage 1: user uploads two photos -> VLM guess + preliminary verdict + draft.
Stage 2: user reviews the draft, corrects rim specs -> Wheel-Size check + risk.

VLM outputs are frozen agent-vision snapshots; the Wheel-Size profile is the
Evoque fixture, so the run is deterministic and offline.
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
    PreliminaryCheckRequest,
    RimUserInput,
    Source,
    VehicleQuery,
)
from fitment_verdict.service import FitmentVerdictService

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "demo_assets"
RUNS = ROOT / "demo_runs"
FIXTURES = ROOT.parent / "tests" / "fitment_verdict" / "fixtures"

SNAPSHOTS = json.loads((FIXTURES / "agent_vlm_snapshots.json").read_text(encoding="utf-8"))

CAR_IMAGE = "cars/suv_white_side.jpg"

# What the user "types in" at stage 2 after checking the product page.
USER_CORRECTIONS = {
    "rims/disc_1.webp": RimUserInput(
        brand="Konig",
        model="Dekagram",
        sku="DK89508455",
        diameter=18,
        width=8.5,
        bolt_count=5,
        pcd_mm=114.3,
        offset=45,
        center_bore_mm=73.1,
        fastener_seat="conical",
        load_rating=690,
    ),
    "rims/rim.jpg": RimUserInput(
        brand="RIAL",
        model="X10",
        sku="X10-80845V31-0",
        diameter=19,
        width=8,
        bolt_count=5,
        pcd_mm=108.0,
        offset=45,
        center_bore_mm=63.4,
        fastener_seat="conical",
        load_rating=690,
    ),
}


class EvoqueProfileProvider:
    def __init__(self, profile):
        self._profile = profile

    async def resolve_and_fetch_profile(self, vehicle, *, user_initiated: bool):
        return self._profile if user_initiated else None


def load_evoque_profile():
    payload = json.loads((FIXTURES / "wheel_size_evoque.json").read_text(encoding="utf-8"))
    vehicle = VehicleQuery(
        make="Land Rover",
        model="Range Rover Evoque",
        year=2014,
        region="eudm",
        source=Source.user_confirmed,
        is_user_confirmed=True,
    )
    return normalize_vehicle_payload(
        payload,
        provider="wheel_size",
        vehicle_query=vehicle,
        raw_response_ref="demo:evoque",
    )


async def run_case(rim_image: str, profile, run_dir: Path) -> dict:
    case_id = Path(rim_image).stem
    case_dir = run_dir / case_id
    case_dir.mkdir(parents=True, exist_ok=True)

    config = FitmentConfig(wheel_size_api_key="demo", cache_dir=str(run_dir / ".cache"))
    service = FitmentVerdictService(
        config,
        vehicle_vlm=MockVehicleVLM(SNAPSHOTS[CAR_IMAGE], model_used="agent-vision-snapshot"),
        rim_vlm=MockRimVLM(SNAPSHOTS[rim_image]),
        provider=EvoqueProfileProvider(profile),
    )

    car_path = ASSETS / CAR_IMAGE
    rim_path = ASSETS / rim_image
    shutil.copy2(car_path, case_dir / car_path.name)
    shutil.copy2(rim_path, case_dir / rim_path.name)

    print(f"[{case_id}] stage 1: photos only...")
    stage1 = await service.run_preliminary(
        PreliminaryCheckRequest(car_image_path=str(car_path), rim_image_path=str(rim_path))
    )
    print(f"  guess: {stage1.verdict.status.value}, fit_likelihood={stage1.fit_likelihood}")

    draft = stage1.draft
    draft.vehicle.year = 2014
    draft.rim = USER_CORRECTIONS[rim_image]

    print(f"[{case_id}] stage 2: user confirmed data, full check...")
    stage2 = await service.run_confirmed(draft)
    print(
        f"  verdict: {stage2.verdict.status.value}, "
        f"risk={stage2.risk.level.value} ({stage2.risk.score})"
    )

    payload = {
        "case": case_id,
        "stage1": stage1.model_dump(mode="json"),
        "user_corrections": USER_CORRECTIONS[rim_image].model_dump(mode="json"),
        "stage2": stage2.model_dump(mode="json"),
    }
    (case_dir / "two_stage.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return payload


def write_summary(run_dir: Path, results: list[dict]) -> None:
    lines = [
        "# Two-Stage Fitment Demo",
        "",
        f"Generated: {datetime.now(UTC).isoformat()}",
        "",
        "| Case | Stage 1 guess | Likelihood | Stage 2 verdict | Risk | Recommendations |",
        "|---|---|---|---|---|---|",
    ]
    for item in results:
        s1 = item["stage1"]
        s2 = item["stage2"]
        recs = ", ".join(s2["risk"]["recommendation_codes"]) or "-"
        lines.append(
            f"| {item['case']} | {s1['verdict']['status']} | {s1['fit_likelihood']} | "
            f"{s2['verdict']['status']} | {s2['risk']['level']} ({s2['risk']['score']}) | {recs} |"
        )
    (run_dir / "SUMMARY.md").write_text("\n".join(lines), encoding="utf-8")


async def main() -> None:
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    run_dir = RUNS / f"two_stage_{stamp}"
    run_dir.mkdir(parents=True, exist_ok=True)

    profile = load_evoque_profile()
    results = []
    for rim_image in USER_CORRECTIONS:
        results.append(await run_case(rim_image, profile, run_dir))

    write_summary(run_dir, results)
    print(f"\nResults saved to {run_dir}")


if __name__ == "__main__":
    asyncio.run(main())
