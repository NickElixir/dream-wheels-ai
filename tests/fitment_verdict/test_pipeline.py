"""End-to-end pipeline tests with mocked VLM and provider."""

from __future__ import annotations

import asyncio

from fitment_verdict.schemas import (
    ExecutionStatus,
    FitmentVerdictRequest,
    RimSpec,
    Source,
    VehicleQuery,
    VerdictStatus,
)
from fitment_verdict.service import FitmentVerdictService


class StaticProvider:
    def __init__(self, profile):
        self.profile = profile
        self.calls = 0

    async def resolve_and_fetch_profile(self, vehicle, *, user_initiated: bool):
        self.calls += 1
        if not user_initiated:
            return None
        return self.profile


def test_pipeline_with_confirmed_inputs(
    config,
    sample_profile,
    mock_vehicle_vlm,
    mock_rim_vlm,
):
    async def _run():
        provider = StaticProvider(sample_profile)
        service = FitmentVerdictService(
            config,
            vehicle_vlm=mock_vehicle_vlm,
            rim_vlm=mock_rim_vlm,
            provider=provider,
        )
        request = FitmentVerdictRequest(
            vehicle=VehicleQuery(
                make="Haval",
                model="Chitu",
                year=2022,
                region="chdm",
                is_user_confirmed=True,
                source=Source.user_confirmed,
                confidence=1.0,
            ),
            rim=RimSpec(
                diameter=18,
                width=7,
                offset=40,
                bolt_pattern="5x114.3",
                pcd_mm=114.3,
                center_bore_mm=66.6,
                is_user_confirmed=True,
                source=Source.user_confirmed,
                confidence=1.0,
            ).sync_bolt_fields(),
            rim_ocr_text="18x7 ET40 5x114.3 CB66.6",
            user_initiated=True,
        )
        return await service.run(request), provider

    result, provider = asyncio.run(_run())
    assert result.execution_status == ExecutionStatus.completed
    assert result.verdict is not None
    assert result.verdict.status == VerdictStatus.compatible
    assert result.presentation is not None
    assert provider.calls == 1


def test_pipeline_uses_mock_vlm_when_vehicle_not_confirmed(
    config,
    sample_profile,
    mock_vehicle_vlm,
    tiny_jpeg,
):
    async def _run():
        provider = StaticProvider(sample_profile)
        service = FitmentVerdictService(
            config,
            vehicle_vlm=mock_vehicle_vlm,
            provider=provider,
        )
        request = FitmentVerdictRequest(
            car_image_path=tiny_jpeg,
            rim=RimSpec(
                diameter=18,
                width=7,
                offset=40,
                bolt_pattern="5x114.3",
                pcd_mm=114.3,
                center_bore_mm=66.6,
                is_user_confirmed=True,
                source=Source.user_confirmed,
            ).sync_bolt_fields(),
            user_initiated=True,
        )
        return await service.run(request)

    result = asyncio.run(_run())
    assert result.execution_status == ExecutionStatus.completed
    assert result.verdict is not None
    assert result.verdict.vehicle.make == "Haval"


def test_pipeline_provider_not_called_without_user_initiation(config, sample_profile):
    async def _run():
        provider = StaticProvider(sample_profile)
        service = FitmentVerdictService(config, provider=provider)
        request = FitmentVerdictRequest(
            vehicle=VehicleQuery(
                make="Haval",
                model="Chitu",
                year=2022,
                region="chdm",
                is_user_confirmed=True,
            ),
            rim=RimSpec(
                diameter=18,
                width=7,
                offset=40,
                bolt_pattern="5x114.3",
                pcd_mm=114.3,
                center_bore_mm=66.6,
                is_user_confirmed=True,
                source=Source.user_confirmed,
            ).sync_bolt_fields(),
            user_initiated=False,
        )
        return await service.run(request), provider

    result, provider = asyncio.run(_run())
    assert provider.calls == 0
    assert result.execution_status == ExecutionStatus.completed
