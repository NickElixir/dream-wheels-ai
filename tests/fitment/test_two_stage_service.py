from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from src.fitment.identification.rim_url import RimProductUrlResolver
from src.fitment.identification.rim_url_fetch import FetchedPage, UrlAllowlistPolicy
from src.fitment.identification.vlm_client import VlmError
from src.fitment.providers.base import FitmentProvider
from src.fitment.repository import InMemoryFitmentRepository
from src.fitment.schemas import (
    AxleFitment,
    FieldValue,
    FitmentProfile,
    RimSetup,
    RimSpec,
    RiskLevel,
    Source,
    VehicleIdentity,
    VerdictStatus,
)
from src.fitment.service import FitmentService


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class StubVlm:
    is_configured = True
    model_name = "test-vlm"

    async def complete_json(
        self,
        *,
        prompt,
        image_b64,
        image_mime,
        schema_name,
        json_schema,
    ):
        del prompt, image_b64, image_mime, json_schema
        if schema_name == "vehicle_identification":
            return {
                "make": "Land Rover",
                "model": "Range Rover Evoque",
                "year_from": 2020,
                "year_to": 2021,
                "body_type": "SUV",
                "market_guess": "eudm",
                "confidence": 0.88,
                "notes": None,
                "expected_oem": {
                    "bolt_count": 5,
                    "pcd_mm": 108,
                    "center_bore_mm": 63.4,
                    "rim_diameter_min": 18,
                    "rim_diameter_max": 20,
                    "rim_width_min": 8,
                    "rim_width_max": 8.5,
                    "offset_min": 40,
                    "offset_max": 45,
                },
            }
        return {
            "brand": "Unknown",
            "model": None,
            "style": "multi-spoke",
            "spoke_count": 10,
            "primary_color": "silver",
            "finish": "machined",
            "suggested_diameter_in": 19,
            "suggested_width_j": 8,
            "suggested_offset_et_mm": None,
            "suggested_bolt_count": 5,
            "suggested_pcd_mm": None,
            "visible_marking_text": None,
            "confidence": 0.7,
            "notes": "Visual estimate",
        }


class FailingVlm(StubVlm):
    async def complete_json(self, **kwargs):
        del kwargs
        raise VlmError("temporary upstream failure")


class StaticProvider(FitmentProvider):
    @property
    def name(self) -> str:
        return "test_catalog"

    async def resolve_vehicle(self, identity):
        return identity

    async def get_fitment_profile(self, identity, *, user_initiated):
        assert identity.make == "Land Rover"
        assert user_initiated is True
        return FitmentProfile(
            provider=self.name,
            fetched_at=datetime.now(UTC).isoformat(),
            bolt_count=5,
            pcd_mm=108,
            center_bore_mm=63.4,
            allowed_wheels=[
                AxleFitment(
                    axle=axle,
                    rim_diameter=19,
                    rim_width=8,
                    offset=43,
                    is_stock=True,
                )
                for axle in ("front", "rear")
            ],
        )


async def _fetch_complex_rim_page(url: str, **kwargs) -> FetchedPage:
    del url, kwargs
    return FetchedPage(
        final_url="https://shop.example/model-x",
        body=Path("tests/fitment/fixtures/rim_url/complex_model/model_page.html").read_bytes(),
        content_type="text/html",
        charset="utf-8",
    )


@pytest.mark.anyio
async def test_url_enrichment_does_not_choose_random_variant_or_override_confirmation() -> None:
    service = FitmentService(
        repository=InMemoryFitmentRepository(),
        provider=StaticProvider(),
        rim_url_resolver=RimProductUrlResolver(
            UrlAllowlistPolicy.from_values(allowed_hosts={"shop.example"}),
            fetcher=_fetch_complex_rim_page,
        ),
    )

    unresolved = await service.enrich_rim_spec(RimSpec(product_url="https://shop.example/model-x"))
    assert unresolved.model == "Model X"
    assert unresolved.sku is None
    assert unresolved.wheel_diameter_in.value is None

    selected = await service.enrich_rim_spec(
        RimSpec(
            sku="EX-MX-18",
            product_url="https://shop.example/model-x",
            pcd_mm=FieldValue(
                value=112,
                source=Source.user_confirmed,
                confidence=1,
                is_user_confirmed=True,
            ),
        )
    )
    assert selected.wheel_diameter_in.value == 18
    assert selected.wheel_diameter_in.source == Source.product_page
    assert selected.pcd_mm.value == 112
    assert selected.pcd_mm.source == Source.user_confirmed


@pytest.mark.anyio
async def test_preliminary_keeps_unknown_pcd_instead_of_vehicle_inference() -> None:
    repository = InMemoryFitmentRepository()
    service = FitmentService(
        repository=repository,
        provider=StaticProvider(),
        vlm=StubVlm(),
    )

    run = await service.run_preliminary(
        owner_telegram_user_id=42,
        car_image_bytes=b"car",
        rim_image_bytes=b"rim",
        car_image_sha256="a" * 64,
        rim_image_sha256="b" * 64,
    )

    assert run.status.value == "completed"
    assert run.prediction is not None
    assert run.prediction.vehicle.selected is not None
    rim = run.prediction.suggested_rim_setup.front
    assert rim.bolt_count.value == 5
    assert rim.pcd_mm.value is None
    assert run.verdict is not None
    assert run.verdict.status == VerdictStatus.unknown
    assert 0 <= run.fit_likelihood <= 1
    stored = await repository.get_preliminary_run(
        run.id,
        owner_telegram_user_id=42,
    )
    assert stored == run
    assert await repository.get_preliminary_run(run.id, owner_telegram_user_id=7) is None


@pytest.mark.anyio
async def test_confirmed_wrong_pcd_produces_critical_risk() -> None:
    repository = InMemoryFitmentRepository()
    service = FitmentService(repository=repository, provider=StaticProvider())
    identity_id = await repository.save_vehicle_identity(
        VehicleIdentity(
            make="Land Rover",
            model="Range Rover Evoque",
            year=2020,
            source=Source.user_confirmed,
            confidence=1,
            is_user_confirmed=True,
        ),
        owner_telegram_user_id=42,
    )
    rim = RimSpec(
        bolt_count=FieldValue(
            value=5,
            source=Source.user_confirmed,
            confidence=1,
            is_user_confirmed=True,
        ),
        pcd_mm=FieldValue(
            value=114.3,
            source=Source.user_confirmed,
            confidence=1,
            is_user_confirmed=True,
        ),
        center_bore_mm=FieldValue(
            value=66.6,
            source=Source.user_confirmed,
            confidence=1,
            is_user_confirmed=True,
        ),
        wheel_diameter_in=FieldValue(
            value=19,
            source=Source.user_confirmed,
            confidence=1,
            is_user_confirmed=True,
        ),
        wheel_width_j=FieldValue(
            value=8,
            source=Source.user_confirmed,
            confidence=1,
            is_user_confirmed=True,
        ),
        offset_et_mm=FieldValue(
            value=43,
            source=Source.user_confirmed,
            confidence=1,
            is_user_confirmed=True,
        ),
    )
    setup_id = await repository.save_rim_setup(
        RimSetup(front=rim, rear=rim.model_copy(deep=True)),
        owner_telegram_user_id=42,
    )

    check = await service.create_check(
        owner_telegram_user_id=42,
        vehicle_identity_id=identity_id,
        rim_setup_id=setup_id,
        render_job_id=None,
        idempotency_key="confirmed-wrong-pcd",
    )
    check = await service.execute_check(check)

    assert check.verdict is not None
    assert check.verdict.status == VerdictStatus.incompatible
    assert check.verdict.is_preliminary is False
    assert check.risk is not None
    assert check.risk.level == RiskLevel.critical
    assert "choose_correct_pcd" in check.risk.recommendation_codes


@pytest.mark.anyio
async def test_preliminary_vlm_outage_is_operational_failure() -> None:
    repository = InMemoryFitmentRepository()
    service = FitmentService(
        repository=repository,
        provider=StaticProvider(),
        vlm=FailingVlm(),
    )

    run = await service.run_preliminary(
        owner_telegram_user_id=42,
        car_image_bytes=b"car",
        rim_image_bytes=b"rim",
        car_image_sha256="a" * 64,
        rim_image_sha256="b" * 64,
    )

    assert run.status.value == "failed"
    assert run.error_code == "vlm_error"
    assert run.verdict is None
