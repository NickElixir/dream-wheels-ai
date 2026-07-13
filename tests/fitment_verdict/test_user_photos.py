"""Functional test: photos only — VLM identifies car/rim, Wheel-Size profile + rules decide fit."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from fitment_verdict.config import FitmentConfig
from fitment_verdict.identification.rim_vlm import MockRimVLM
from fitment_verdict.identification.vehicle_vlm import MockVehicleVLM
from fitment_verdict.providers.wheel_size import normalize_vehicle_payload
from fitment_verdict.schemas import (
    ExecutionStatus,
    FitmentVerdictRequest,
    Source,
    VehicleQuery,
    VerdictStatus,
)
from fitment_verdict.service import FitmentVerdictService

FIXTURES = Path(__file__).parent / "fixtures"
ASSETS = Path(__file__).resolve().parents[2] / "fitment_verdict" / "demo_assets"
SNAPSHOTS = json.loads((FIXTURES / "agent_vlm_snapshots.json").read_text(encoding="utf-8"))


class EvoqueProfileProvider:
    """Simulates Wheel-Size /search/by_model/ for the car visible in suv_white_side.jpg."""

    def __init__(self, profile):
        self._profile = profile

    async def resolve_and_fetch_profile(self, vehicle, *, user_initiated: bool):
        if not user_initiated:
            return None
        return self._profile


def _load_evoque_profile():
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
        raw_response_ref="fixture:evoque",
    )


USER_CASES = [
    {
        "id": "user_konig_disc",
        "car_image": "cars/suv_white_side.jpg",
        "rim_image": "rims/disc_1.webp",
        "expected_verdict": VerdictStatus.compatible_with_conditions,
        "expected_brand": "Konig",
    },
    {
        "id": "user_rial_rim",
        "car_image": "cars/suv_white_side.jpg",
        "rim_image": "rims/rim.jpg",
        "expected_verdict": VerdictStatus.compatible_with_conditions,
        "expected_brand": "RIAL",
    },
]


@pytest.fixture(scope="module")
def user_assets() -> Path:
    if not ASSETS.is_dir():
        pytest.skip("demo_assets missing")
    for case in USER_CASES:
        for key in ("car_image", "rim_image"):
            if not (ASSETS / case[key]).is_file():
                pytest.skip(f"missing {case[key]}")
    return ASSETS


@pytest.fixture(scope="module")
def evoque_profile():
    return _load_evoque_profile()


@pytest.mark.parametrize("case", USER_CASES, ids=[c["id"] for c in USER_CASES])
def test_photos_only_vlm_plus_wheel_size_rules(
    case: dict,
    user_assets: Path,
    evoque_profile,
    tmp_path_factory,
):
    car_path = user_assets / case["car_image"]
    rim_path = user_assets / case["rim_image"]
    vehicle_hints = SNAPSHOTS[case["car_image"]]
    rim_hints = SNAPSHOTS[case["rim_image"]]

    async def _run():
        cache_dir = tmp_path_factory.mktemp("cache")
        config = FitmentConfig(wheel_size_api_key="test", cache_dir=str(cache_dir))
        service = FitmentVerdictService(
            config,
            vehicle_vlm=MockVehicleVLM(vehicle_hints, model_used="agent-vision-snapshot"),
            rim_vlm=MockRimVLM(rim_hints),
            provider=EvoqueProfileProvider(evoque_profile),
        )
        return await service.run(
            FitmentVerdictRequest(
                car_image_path=str(car_path),
                rim_image_path=str(rim_path),
                user_initiated=True,
            )
        )

    result = asyncio.run(_run())

    assert result.execution_status == ExecutionStatus.completed, result.error_message
    assert result.verdict is not None
    assert result.verdict.status == case["expected_verdict"]

    assert result.verdict.vehicle.make == "Land Rover"
    assert result.verdict.rim.brand == case["expected_brand"]
    assert result.verdict.rim.diameter is not None
    assert result.verdict.rim.bolt_pattern == "5x108"

    stage_names = [s.stage for s in result.stages]
    assert "G1_vehicle_vlm" in stage_names
    assert "G3_rim_vlm" in stage_names
    assert "G3_rim_profile_hypothesis" in stage_names
    assert "G2_provider" in stage_names

    assert result.verdict.rim.pcd_mm == 108.0
    assert result.presentation is not None
    assert result.presentation["headline_code"] == "requires_conditions"
