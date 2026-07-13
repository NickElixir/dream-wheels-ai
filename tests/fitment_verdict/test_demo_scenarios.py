"""Integration tests with real demo photos (car + rim JPEGs from demo_assets)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from fitment_verdict.config import FitmentConfig
from fitment_verdict.identification.rim_vlm import MockRimVLM
from fitment_verdict.identification.vehicle_vlm import MockVehicleVLM
from fitment_verdict.providers.wheel_size import normalize_vehicle_payload
from fitment_verdict.run_demo_scenarios import SCENARIOS, StaticProfileProvider
from fitment_verdict.schemas import (
    ExecutionStatus,
    FitmentVerdictRequest,
    RimSpec,
    Source,
    VehicleQuery,
    VerdictStatus,
)
from fitment_verdict.service import FitmentVerdictService

FIXTURES = Path(__file__).parent / "fixtures"
ASSETS = Path(__file__).resolve().parents[2] / "fitment_verdict" / "demo_assets"


def _load_haval_profile():
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
        raw_response_ref="test:haval_chitu",
    )


def _build_user_rim(data: dict | None) -> RimSpec | None:
    if not data:
        return None
    return RimSpec(
        diameter=data.get("diameter"),
        width=data.get("width"),
        offset=data.get("offset"),
        source=Source.user_input,
        confidence=0.55,
        is_user_confirmed=False,
    ).sync_bolt_fields()


@pytest.fixture(scope="module")
def demo_assets_ready() -> Path:
    if not ASSETS.is_dir():
        pytest.skip("demo_assets missing — run: python -m fitment_verdict.prepare_demo_assets")
    for scenario in SCENARIOS:
        car = ASSETS / scenario["car_image"]
        rim = ASSETS / scenario["rim_image"]
        if not car.is_file() or not rim.is_file():
            pytest.skip(f"missing asset for {scenario['id']}: {car.name}, {rim.name}")
        if car.stat().st_size < 10_000 or rim.stat().st_size < 10_000:
            pytest.skip(f"demo asset looks synthetic/empty for {scenario['id']}")
    return ASSETS


@pytest.fixture(scope="module")
def haval_profile():
    return _load_haval_profile()


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s["id"] for s in SCENARIOS])
def test_demo_scenario_with_real_photos(
    scenario: dict,
    demo_assets_ready: Path,
    haval_profile,
    tmp_path_factory,
):
    car_path = demo_assets_ready / scenario["car_image"]
    rim_path = demo_assets_ready / scenario["rim_image"]

    async def _run():
        cache_dir = tmp_path_factory.mktemp("cache")
        config = FitmentConfig(wheel_size_api_key="test", cache_dir=str(cache_dir))
        service = FitmentVerdictService(
            config,
            vehicle_vlm=MockVehicleVLM(
                scenario["simulated_vlm_vehicle"],
                model_used="test-mock-vlm",
            ),
            rim_vlm=MockRimVLM(scenario["simulated_vlm_rim"]),
            provider=StaticProfileProvider(haval_profile),
        )
        request = FitmentVerdictRequest(
            car_image_path=str(car_path),
            rim_image_path=str(rim_path),
            vehicle=None,
            rim=_build_user_rim(scenario.get("user_rim")),
            user_initiated=True,
            trigger="user_requested",
            mode="detailed",
        )
        return await service.run(request)

    result = asyncio.run(_run())

    assert result.execution_status == ExecutionStatus.completed, result.error_message
    assert result.verdict is not None
    assert result.verdict.status == VerdictStatus(scenario["expected_verdict"])

    stage_names = [s.stage for s in result.stages]
    assert "G0_intake_car" in stage_names
    assert "G0_intake_rim" in stage_names
    assert "G1_vehicle_vlm" in stage_names
    assert "G3_rim_vlm" in stage_names

    car_meta = next(s for s in result.stages if s.stage == "G0_intake_car").detail
    rim_meta = next(s for s in result.stages if s.stage == "G0_intake_rim").detail
    assert car_meta["width"] >= 400
    assert rim_meta["width"] >= 400


def test_real_rim_photo_normalizes(demo_assets_ready: Path, config):
    from fitment_verdict.images import load_normalized_image

    rim_path = demo_assets_ready / "rims" / "rim_oem_match.jpg"
    normalized, meta = load_normalized_image(rim_path, config)
    assert len(normalized) > 20_000
    assert meta["format"] == "jpeg"
    assert meta["width"] >= 400
