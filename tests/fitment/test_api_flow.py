from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.auth import AuthContext
from src.fitment import api as fitment_api
from src.fitment import config as fitment_config
from src.fitment.identification.rim_url import RimProductUrlResolver
from src.fitment.identification.rim_url_fetch import FetchedPage, UrlAllowlistPolicy
from src.fitment.providers.base import FitmentProvider
from src.fitment.repository import InMemoryFitmentRepository
from src.fitment.schemas import AxleFitment, FitmentProfile
from src.fitment.service import FitmentService


class ApiFlowVlm:
    is_configured = True
    model_name = "api-flow-vlm"

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
                "year_to": 2020,
                "body_type": "SUV",
                "market_guess": "eudm",
                "confidence": 0.9,
                "notes": None,
                "expected_oem": {
                    "bolt_count": 5,
                    "pcd_mm": 108,
                    "center_bore_mm": 63.4,
                    "rim_diameter_min": 19,
                    "rim_diameter_max": 19,
                    "rim_width_min": 8,
                    "rim_width_max": 8,
                    "offset_min": 43,
                    "offset_max": 43,
                },
            }
        return {
            "brand": "Rial",
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
            "confidence": 0.75,
            "notes": None,
        }


class ApiFlowProvider(FitmentProvider):
    @property
    def name(self) -> str:
        return "api-flow-provider"

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
            fastener_type="Lug bolts",
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


async def _fetch_rim_fixture(url: str, **kwargs) -> FetchedPage:
    del url, kwargs
    body = Path("tests/fitment/fixtures/rim_url/complex_model/model_page.html").read_bytes()
    return FetchedPage(
        final_url="https://shop.example/model-x",
        body=body,
        content_type="text/html",
        charset="utf-8",
    )


@pytest.fixture
def client(monkeypatch) -> TestClient:
    repository = InMemoryFitmentRepository()
    service = FitmentService(
        repository=repository,
        provider=ApiFlowProvider(),
        vlm=ApiFlowVlm(),
        rim_url_resolver=RimProductUrlResolver(
            UrlAllowlistPolicy.from_values(allowed_hosts={"shop.example"}),
            fetcher=_fetch_rim_fixture,
        ),
    )
    monkeypatch.setattr(fitment_config, "FITMENT_VERDICT_ENABLED", True)
    monkeypatch.setattr(
        fitment_api,
        "resolve_telegram_auth",
        lambda **kwargs: AuthContext(
            telegram_user_id=42,
            username="fitment-test",
            auth_channel="dev_fallback",
        ),
    )
    fitment_api.set_service(service)
    app = FastAPI()
    app.include_router(fitment_api.router)
    with TestClient(app) as test_client:
        yield test_client
    fitment_api.set_service(None)


def test_two_stage_http_flow(client: TestClient) -> None:
    car_path = Path("fitment_verdict/demo_assets/cars/suv_white_side.jpg")
    rim_path = Path("fitment_verdict/demo_assets/rims/rim.jpg")
    with car_path.open("rb") as car_file, rim_path.open("rb") as rim_file:
        preliminary_response = client.post(
            "/fitment/preliminary",
            data={"init_data": "test"},
            files={
                "car_image": ("car.jpg", car_file, "image/jpeg"),
                "rim_image": ("rim.jpg", rim_file, "image/jpeg"),
            },
        )

    assert preliminary_response.status_code == 200
    preliminary = preliminary_response.json()
    assert preliminary["status"] == "completed"
    assert preliminary["prediction"]["vehicle"]["selected"]["make"] == "Land Rover"
    assert preliminary["prediction"]["suggested_rim_setup"]["front"]["pcd_mm"]["value"] is None

    identity_response = client.post(
        "/fitment/vehicle-identities",
        json={
            "init_data": "test",
            "make": "Land Rover",
            "model": "Range Rover Evoque",
            "year": 2020,
            "generation": "L551",
            "market": "eudm",
            "is_confirmed": True,
        },
    )
    assert identity_response.status_code == 200

    rim_setup_response = client.post(
        "/fitment/rim-setups",
        json={
            "init_data": "test",
            "front": {
                "brand": "Rial",
                "bolt_count": 5,
                "pcd_mm": 108,
                "center_bore_mm": 63.4,
                "wheel_diameter_in": 19,
                "wheel_width_j": 8,
                "offset_et_mm": 43,
                "fastener_system": "Lug bolts",
                "seat_type": "ball",
                "thread_diameter_mm": 14,
                "thread_pitch_mm": 1.5,
                "bolt_length_mm": 28,
            },
            "rear": None,
            "is_confirmed": True,
        },
    )
    assert rim_setup_response.status_code == 200

    check_payload = {
        "init_data": "test",
        "vehicle_identity_id": identity_response.json()["id"],
        "rim_setup_id": rim_setup_response.json()["id"],
        "preliminary_run_id": preliminary["run_id"],
        "trigger": "user_requested",
        "mode": "detailed",
    }
    check_response = client.post(
        "/fitment/checks",
        json=check_payload,
        headers={"Idempotency-Key": "api-flow-check"},
    )
    assert check_response.status_code == 200
    check = check_response.json()
    assert check["status"] == "completed"
    assert check["verdict"]["status"] == "compatible"
    assert check["risk"]["level"] == "low"

    replay_response = client.post(
        "/fitment/checks",
        json=check_payload,
        headers={"Idempotency-Key": "api-flow-check"},
    )
    assert replay_response.status_code == 200
    assert replay_response.json()["check_id"] == check["check_id"]


def test_rim_url_endpoint_returns_variants_and_selects_requested_sku(client: TestClient) -> None:
    unresolved = client.post(
        "/fitment/rim-url/resolve",
        json={
            "init_data": "test",
            "rim": {"product_url": "https://shop.example/model-x"},
        },
    )

    assert unresolved.status_code == 200
    payload = unresolved.json()
    assert payload["selection_required"] is True
    assert {variant["rim"]["sku"] for variant in payload["variants"]} == {
        "EX-MX-17",
        "EX-MX-18",
        "EX-MX-19",
    }

    selected = client.post(
        "/fitment/rim-url/resolve",
        json={
            "init_data": "test",
            "rim": {
                "product_url": "https://shop.example/model-x",
                "sku": "EX-MX-18",
            },
        },
    )

    assert selected.status_code == 200
    assert selected.json()["selection_required"] is False
    assert selected.json()["selected_variant_sku"] == "EX-MX-18"
    assert selected.json()["selected"]["wheel_diameter_in"]["value"] == 18
