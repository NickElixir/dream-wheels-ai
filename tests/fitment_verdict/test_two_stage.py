"""Two-stage flow tests: preliminary VLM guess, then confirmed Wheel-Size check."""

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
    CheckStage,
    ConfirmedCheckRequest,
    ExecutionStatus,
    PreliminaryCheckRequest,
    RimUserInput,
    RiskLevel,
    Source,
    VehicleQuery,
    VehicleUserInput,
    VerdictStatus,
)
from fitment_verdict.service import FitmentVerdictService

FIXTURES = Path(__file__).parent / "fixtures"
ASSETS = Path(__file__).resolve().parents[2] / "fitment_verdict" / "demo_assets"
SNAPSHOTS = json.loads((FIXTURES / "agent_vlm_snapshots.json").read_text(encoding="utf-8"))

CAR_IMAGE = "cars/suv_white_side.jpg"
RIM_IMAGE = "rims/rim.jpg"


class EvoqueProfileProvider:
    def __init__(self, profile):
        self._profile = profile
        self.calls = 0

    async def resolve_and_fetch_profile(self, vehicle, *, user_initiated: bool):
        self.calls += 1
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
        source=Source.user_confirmed,
        is_user_confirmed=True,
    )
    return normalize_vehicle_payload(
        payload,
        provider="wheel_size",
        vehicle_query=vehicle,
        raw_response_ref="fixture:evoque",
    )


@pytest.fixture(scope="module")
def photos() -> tuple[Path, Path]:
    car = ASSETS / CAR_IMAGE
    rim = ASSETS / RIM_IMAGE
    if not car.is_file() or not rim.is_file():
        pytest.skip("demo_assets photos missing")
    return car, rim


@pytest.fixture()
def service(tmp_path):
    profile = _load_evoque_profile()
    config = FitmentConfig(wheel_size_api_key="test", cache_dir=str(tmp_path / "cache"))
    return FitmentVerdictService(
        config,
        vehicle_vlm=MockVehicleVLM(SNAPSHOTS[CAR_IMAGE], model_used="agent-vision-snapshot"),
        rim_vlm=MockRimVLM(SNAPSHOTS[RIM_IMAGE]),
        provider=EvoqueProfileProvider(profile),
    )


def test_stage1_preliminary_guess_from_photos_only(service, photos):
    car, rim = photos
    result = asyncio.run(
        service.run_preliminary(
            PreliminaryCheckRequest(car_image_path=str(car), rim_image_path=str(rim))
        )
    )

    assert result.execution_status == ExecutionStatus.completed, result.error_message
    assert result.stage == CheckStage.preliminary

    prediction = result.prediction
    assert prediction is not None
    assert prediction.vehicle.make == "Land Rover"
    assert prediction.rim.brand == "RIAL"
    assert prediction.expected_oem is not None
    assert prediction.expected_oem.pcd_mm == 108.0

    assert result.verdict is not None
    assert result.verdict.is_preliminary is True
    # VLM prior: PCD hypothesis + size in typical range, ET unverified -> conditions
    assert result.verdict.status == VerdictStatus.compatible_with_conditions
    assert result.fit_likelihood is not None
    assert 0.0 < result.fit_likelihood < 1.0

    draft = result.draft
    assert draft is not None
    assert draft.vehicle.make == "Land Rover"
    assert draft.rim.diameter == 18
    assert draft.rim.pcd_mm == 108.0

    assert result.presentation["disclaimer_code"] == "PRELIMINARY_VLM_GUESS_ONLY"
    assert result.presentation["next_step_code"] == "CONFIRM_DATA_FOR_FULL_CHECK"

    stage_names = [s.stage for s in result.stages]
    assert "P1_vlm_prior_profile" in stage_names
    assert "P2_preliminary_verdict" in stage_names
    # Stage 1 never touches the provider.
    assert "G2_provider" not in stage_names


def test_stage2_confirmed_check_with_user_corrected_draft(service, photos):
    car, rim = photos
    preliminary = asyncio.run(
        service.run_preliminary(
            PreliminaryCheckRequest(car_image_path=str(car), rim_image_path=str(rim))
        )
    )
    draft = preliminary.draft

    # User confirms the vehicle and corrects rim specs from the product page.
    draft.vehicle.year = 2014
    draft.rim = RimUserInput(
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
    )

    result = asyncio.run(service.run_confirmed(draft))

    assert result.execution_status == ExecutionStatus.completed, result.error_message
    assert result.stage == CheckStage.confirmed
    assert result.verdict is not None
    assert result.verdict.is_preliminary is False
    assert result.verdict.status == VerdictStatus.compatible

    assert result.risk is not None
    assert result.risk.level == RiskLevel.low
    assert not result.risk.blocking_parameters

    assert result.presentation["stage"] == "confirmed"
    assert result.presentation["risk_level"] == "low"

    stage_names = [s.stage for s in result.stages]
    assert "G2_provider" in stage_names
    assert "R1_risk_assessment" in stage_names


def test_stage2_wrong_pcd_is_critical_with_recommendation(service):
    request = ConfirmedCheckRequest(
        vehicle=VehicleUserInput(
            make="Land Rover",
            model="Range Rover Evoque",
            year=2014,
            region="eudm",
        ),
        rim=RimUserInput(
            diameter=19,
            width=8,
            bolt_count=5,
            pcd_mm=114.3,
            offset=45,
            center_bore_mm=63.4,
        ),
    )
    result = asyncio.run(service.run_confirmed(request))

    assert result.execution_status == ExecutionStatus.completed
    assert result.verdict.status == VerdictStatus.incompatible
    assert result.risk.level == RiskLevel.critical
    assert "bolt_pattern" in result.risk.blocking_parameters
    assert {"REC_WRONG_PCD", "REC_WRONG_BOLT_PATTERN"} & set(result.risk.recommendation_codes)


def test_stage2_staggered_rear_axle_worst_of(service):
    request = ConfirmedCheckRequest(
        vehicle=VehicleUserInput(
            make="Land Rover",
            model="Range Rover Evoque",
            year=2014,
            region="eudm",
        ),
        rim=RimUserInput(
            diameter=19, width=8, bolt_count=5, pcd_mm=108.0, offset=45, center_bore_mm=63.4
        ),
        rim_rear=RimUserInput(
            diameter=19, width=8, bolt_count=5, pcd_mm=108.0, offset=45, center_bore_mm=66.6
        ),
    )
    result = asyncio.run(service.run_confirmed(request))

    assert result.execution_status == ExecutionStatus.completed
    # Rear rim needs hub rings -> combined verdict degrades to conditions.
    assert result.verdict.status == VerdictStatus.compatible_with_conditions
    assert "REC_USE_HUB_RINGS" in result.risk.recommendation_codes
    axles = {r.detail.get("axle") for r in result.verdict.rule_results}
    assert axles == {"front", "rear"}


def test_stage2_rejects_incomplete_vehicle(service):
    request = ConfirmedCheckRequest(
        vehicle=VehicleUserInput(make="Land Rover"),
        rim=RimUserInput(diameter=19, width=8),
    )
    result = asyncio.run(service.run_confirmed(request))
    assert result.execution_status == ExecutionStatus.failed
    assert result.error_code == "VEHICLE_INPUT_INCOMPLETE"


def test_stage1_bolt_count_conflict_predicts_incompatible(service, photos, tmp_path):
    car, rim = photos
    rim_hints = dict(SNAPSHOTS[RIM_IMAGE])
    rim_hints["bolt_count"] = 4  # e.g. rim photo clearly shows 4 holes

    profile = _load_evoque_profile()
    config = FitmentConfig(wheel_size_api_key="test", cache_dir=str(tmp_path / "cache2"))
    svc = FitmentVerdictService(
        config,
        vehicle_vlm=MockVehicleVLM(SNAPSHOTS[CAR_IMAGE]),
        rim_vlm=MockRimVLM(rim_hints),
        provider=EvoqueProfileProvider(profile),
    )
    result = asyncio.run(
        svc.run_preliminary(
            PreliminaryCheckRequest(car_image_path=str(car), rim_image_path=str(rim))
        )
    )
    assert result.verdict.status == VerdictStatus.incompatible
    assert "MOUNTING_BOLT_COUNT_MISMATCH" in result.verdict.reason_codes
    assert result.fit_likelihood < 0.15
