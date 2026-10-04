import asyncio
import json
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src import assets_service, identity_api, identity_service, jobs_api
from src.auth_principal import AuthPrincipal
from src.main import app

client = TestClient(app)


def _image_bytes(*, size: tuple[int, int] = (320, 240), mode: str = "RGB") -> bytes:
    image = Image.new(mode, size, color=(20, 30, 40, 255) if mode == "RGBA" else (20, 30, 40))
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeAcquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakePool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return FakeAcquire(self.conn)


def _auth_principal() -> AuthPrincipal:
    return AuthPrincipal(
        user_id=77,
        authority="telegram",
        subject="123456",
        auth_channel="mini_app",
        telegram_username="dw-user",
    )


def test_identity_resolve_requires_both_images():
    response = client.post(
        "/identity/resolve",
        files={"car_image": ("car.jpg", BytesIO(b"car"), "image/jpeg")},
        data={"init_data": "unused"},
    )

    assert response.status_code == 422


@pytest.mark.parametrize("display_failure", [False, True])
def test_identity_resolve_returns_quick_proposal_without_job_or_queue(monkeypatch, display_failure):
    calls: list[tuple[str, object]] = []
    if display_failure:

        def fail_display(_data):
            raise OSError("Optional derivative unavailable")

        monkeypatch.setattr(assets_service, "create_car_display", fail_display)

    class FakeConn:
        async def fetchval(self, query: str, *args):
            assert "INSERT INTO render_input_drafts" in query
            calls.append(("insert_draft", args))
            return "11111111-1111-4111-8111-111111111111"

        def transaction(self):
            return FakeTransaction()

        async def execute(self, query: str, *args):
            calls.append(("execute", query, args))
            return "UPDATE 1"

    async def fake_enforce_rate_limit(**_kwargs):
        calls.append(("rate_limit", None))

    async def fake_require_auth_principal(_conn, **_kwargs):
        return _auth_principal()

    async def fake_upload_render_asset(**kwargs):
        kind = kwargs["kind"]
        return assets_service.AssetUpload(
            id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            if kind == "car_original"
            else "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            owner_user_id=kwargs["owner_user_id"],
            job_id=None,
            kind=kind,
            bucket="raw",
            storage_key=f"users/77/drafts/{kwargs['render_input_draft_id']}/{kind}/asset.jpg",
            content_type=kwargs["content_type"],
            size_bytes=len(kwargs["data"]),
            sha256="0" * 64,
            render_input_draft_id=kwargs["render_input_draft_id"],
        )

    async def fake_insert_asset(_conn, asset: assets_service.AssetUpload):
        calls.append((f"insert_asset:{asset.kind}", asset.render_input_draft_id))

    monkeypatch.setattr(identity_api, "require_auth_principal", fake_require_auth_principal)
    monkeypatch.setattr(identity_api, "enforce_rate_limit", fake_enforce_rate_limit)
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(
        identity_api.assets_service, "upload_render_asset", fake_upload_render_asset
    )
    monkeypatch.setattr(identity_api.assets_service, "insert_asset", fake_insert_asset)

    response = client.post(
        "/identity/resolve",
        data={"init_data": "unused", "rim_product_url": "https://shop.example.test/wheel-18"},
        files={
            "car_image": ("car.png", BytesIO(_image_bytes()), "image/png"),
            "wheel_image": ("wheel.png", BytesIO(_image_bytes()), "image/png"),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["draft_id"] == "11111111-1111-4111-8111-111111111111"
    assert body["vehicle"]["status"] == "unknown"
    assert body["vehicle"]["primary"] is None
    assert body["vehicle"]["alternatives"] == []
    assert body["rim"]["status"] == "manual_required"
    assert body["rim"]["product_url"] == "https://shop.example.test/wheel-18"
    assert body["pcd_display"] is None
    proposal_update = next(
        call for call in calls if call[0] == "execute" and "identity_proposal" in call[1]
    )
    assert "https://shop.example.test/wheel-18" in proposal_update[2][0]
    assert not any(call[0] == "reserve_job_credit" for call in calls)
    assert not any(call[0] == "queue" for call in calls)
    assert any(call[0] == "insert_asset:car_display" for call in calls) == (not display_failure)


def test_rim_proposal_allows_a_source_url_without_technical_values() -> None:
    rim = identity_service.RimProposal(
        product_url="https://shop.example.test/wheel-18",
        confidence=1,
        source="user_input",
    )

    snapshot = identity_service.render_input_snapshot(
        vehicle_identity_id="22222222-2222-4222-8222-222222222222",
        rim_setup_id="33333333-3333-4333-8333-333333333333",
        vehicle=identity_service.VehicleCandidate(
            make="Lexus",
            model="RX",
            year=2020,
            confidence=1,
            source="user_confirmed",
        ),
        rim=rim,
        rim_user_confirmed=False,
        car_asset_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        rim_asset_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    )

    assert snapshot["rim"]["product_url"] == "https://shop.example.test/wheel-18"
    assert snapshot["rim"]["pcd_display"] is None


def test_create_request_has_no_vehicle_prerequisite() -> None:
    request = jobs_api.JobFromAssetsRequest(draft_id="draft", idempotency_key="key")
    assert request.vehicle is None
    assert request.vehicle_user_confirmed is False


def _proposal_with_candidates() -> identity_service.IdentityProposal:
    proposal = identity_service.parse_identity_proposal(
        {
            "vehicle": {
                "primary": {
                    "make": "Zeer",
                    "model": "Zeer 1",
                    "year": 2023,
                    "confidence": 0.82,
                    "source": "vlm",
                },
                "alternatives": [
                    {
                        "make": "Acura",
                        "model": "ADX",
                        "year": 2025,
                        "confidence": 0.64,
                        "source": "vlm",
                    }
                ],
            }
        }
    )
    assert proposal is not None
    return proposal


def test_vehicle_confirmation_preserves_ai_provenance_and_matching_year() -> None:
    proposal = _proposal_with_candidates()
    selected = identity_service.canonical_vehicle_for_confirmation(
        identity_service.VehicleCandidate(
            make=" acura ",
            model="ADX",
            confidence=1,
            source="user_input",
        ),
        proposal,
    )

    assert selected.make == "Acura"
    assert selected.model == "ADX"
    assert selected.year == 2025
    assert selected.confidence == 0.64
    assert selected.source == "vlm_visual"


def test_manual_vehicle_mismatch_does_not_inherit_ai_year_or_provenance() -> None:
    proposal = _proposal_with_candidates()
    manual = identity_service.canonical_vehicle_for_confirmation(
        identity_service.VehicleCandidate(
            make="Acura",
            model="MDX",
            confidence=0.99,
            source="vlm_visual",
        ),
        proposal,
    )

    assert manual.make == "Acura"
    assert manual.model == "MDX"
    assert manual.year is None
    assert manual.confidence == 1
    assert manual.source == "user_input"


def test_insert_rim_spec_persists_only_source_url_when_specs_are_unknown() -> None:
    captured: list[object] = []

    class FakeConn:
        async def fetchval(self, _query: str, *args: object) -> str:
            captured.extend(args)
            return "33333333-3333-4333-8333-333333333333"

    rim = identity_service.RimProposal(
        product_url="https://shop.example.test/wheel-18",
        confidence=1,
        source="user_input",
    )
    rim_spec_id = asyncio.run(
        identity_service.insert_rim_spec(
            FakeConn(),
            owner_user_id=77,
            rim=rim,
            is_user_confirmed=False,
        )
    )

    assert rim_spec_id == "33333333-3333-4333-8333-333333333333"
    assert captured[4] == "https://shop.example.test/wheel-18"
    assert captured[5:9] == [None, None, None, None]


@pytest.mark.parametrize("legacy_vehicle", [False, True])
def test_create_job_from_assets_without_identity_and_queues(monkeypatch, legacy_vehicle):
    calls: list[tuple[str, object]] = []

    class FakeRedis:
        def __init__(self):
            self.values: dict[str, str] = {}
            self.queue_payloads: list[str] = []

        async def set(self, key: str, value: str, *, ex: int, nx: bool):
            assert ex == jobs_api.IDEMPOTENCY_TTL_SEC
            assert nx is True
            if key in self.values:
                return False
            self.values[key] = value
            return True

        async def get(self, key: str):
            return self.values.get(key)

        async def delete(self, key: str):
            self.values.pop(key, None)

        async def rpush(self, _key: str, payload: str):
            self.queue_payloads.append(payload)
            calls.append(("queue", payload))

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, query: str, *args):
            assert "FROM render_input_drafts AS draft" in query
            assert args[1] == 77
            return {
                "draft_id": "11111111-1111-4111-8111-111111111111",
                "car_asset_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "rim_asset_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                "identity_proposal": {
                    "vehicle": {
                        "primary": {
                            "make": "Lexus",
                            "model": "RX",
                            "year": 2020,
                            "confidence": 0.92,
                            "source": "vlm",
                        },
                        "alternatives": [
                            {
                                "make": "Lexus",
                                "model": "RX",
                                "year": 2021,
                                "confidence": 0.72,
                                "source": "vlm",
                            }
                        ],
                    },
                    "rim": {
                        "brand": "OZ",
                        "model": "Ultraleggera",
                        "sku": "OZ-18",
                        "product_url": "https://shop.example.test/oz-18",
                        "wheel_diameter_in": 20,
                        "wheel_width_j": 8.5,
                        "bolt_count": 5,
                        "pcd_mm": 114.3,
                        "center_bore_mm": 66.6,
                        "offset_et_mm": 35,
                        "confidence": 0.72,
                        "source": "ocr",
                    },
                    "resolver": "mock_visual_identity_v1",
                },
                "car_storage_key": "users/77/drafts/111/car_original/asset.jpg",
                "rim_storage_key": "users/77/drafts/111/rim_original/asset.jpg",
            }

        async def fetchval(self, query: str, *args):
            if "INSERT INTO vehicle_identities" in query:
                calls.append(("insert_vehicle_identity", args))
                return "22222222-2222-4222-8222-222222222222"
            if "INSERT INTO rim_specs" in query:
                calls.append(("insert_rim_spec", args))
                return "33333333-3333-4333-8333-333333333333"
            if "INSERT INTO rim_setups" in query:
                calls.append(("insert_rim_setup", args))
                return "44444444-4444-4444-8444-444444444444"
            raise AssertionError(f"Unexpected fetchval query: {query}")

        async def execute(self, query: str, *args):
            normalized = " ".join(query.split())
            calls.append(("execute", normalized, args))
            return "UPDATE 1"

    async def fake_enforce_rate_limit(**_kwargs):
        calls.append(("rate_limit", None))

    async def fake_require_auth_principal(_conn, **_kwargs):
        return _auth_principal()

    async def fake_reserve_job_credit(_conn, *, user_id: int, job_id: str):
        calls.append(("reserve_job_credit", user_id, job_id))
        return 2

    fake_redis = FakeRedis()
    monkeypatch.setattr(jobs_api, "require_auth_principal", fake_require_auth_principal)
    monkeypatch.setattr(jobs_api, "_get_render_queue_client", lambda *_args, **_kwargs: fake_redis)
    monkeypatch.setattr(jobs_api, "enforce_rate_limit", fake_enforce_rate_limit)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api, "reserve_job_credit", fake_reserve_job_credit)
    monkeypatch.setattr(jobs_api.redis_client, "key", lambda key: key)

    response = client.post(
        "/jobs/from-assets",
        json={
            key: value
            for key, value in {
                "draft_id": "11111111-1111-4111-8111-111111111111",
                "idempotency_key": "create-key",
                "init_data": "unused",
                "vehicle": {
                    "make": "Lexus",
                    "model": "RX",
                    "year": 2021,
                    "confidence": 0.72,
                    "source": "vlm",
                },
                "vehicle_user_confirmed": True,
                "rim": {
                    "product_url": "https://shop.example.test/selected-wheel-20",
                    "wheel_diameter_in": 20,
                    "wheel_width_j": 8.5,
                    "bolt_count": 5,
                    "pcd_mm": 114.3,
                    "confidence": 0.72,
                    "source": "ocr",
                },
                "rim_user_confirmed": False,
            }.items()
            if legacy_vehicle or key not in {"vehicle", "vehicle_user_confirmed"}
        },
    )

    assert response.status_code == 200
    replay = client.post("/jobs/from-assets", json=json.loads(response.request.content))
    assert replay.status_code == 200
    assert replay.json()["job_id"] == response.json()["job_id"]
    assert len(fake_redis.queue_payloads) == 1
    assert sum(call[0] == "reserve_job_credit" for call in calls) == 1
    assert (
        sum(call[0] == "execute" and call[1].startswith("INSERT INTO jobs") for call in calls) == 1
    )
    assert response.json()["status"] == "queued"
    assert any(call[0] == "reserve_job_credit" for call in calls)
    assert len(fake_redis.queue_payloads) == 1
    assert "fitment" not in fake_redis.queue_payloads[0].lower()

    assert not any(call[0] == "insert_vehicle_identity" for call in calls)
    rim_insert = next(call for call in calls if call[0] == "insert_rim_spec")
    assert rim_insert[1][1] is None  # No AI draft prefill in Create.
    assert rim_insert[1][4] == "https://shop.example.test/selected-wheel-20"
    assert json.loads(rim_insert[1][12]) == {}
    job_insert = next(
        call for call in calls if call[0] == "execute" and call[1].startswith("INSERT INTO jobs")
    )
    snapshot = json.loads(job_insert[2][8])
    assert job_insert[2][6] is None
    assert snapshot["vehicle_identity_id"] is None
    assert snapshot["vehicle"] is None
    assert snapshot["fitment_verdict"] is None
    assert snapshot["rim"]["product_url"] == "https://shop.example.test/selected-wheel-20"
    assert snapshot["rim"]["is_user_confirmed"] is False
    event = next(
        call
        for call in calls
        if call[0] == "execute" and "INSERT INTO fitment_change_events" in call[1]
    )
    assert event[2][1] is None
    assert event[2][7] == 0
    assert "vehicle" not in json.loads(event[2][10])
    assert json.loads(fake_redis.queue_payloads[0])["vehicle_identity_id"] is None
    display_promotions = [
        call for call in calls if call[0] == "execute" and "kind = 'car_display'" in call[1]
    ]
    assert len(display_promotions) == 1
    assert display_promotions[0][2][1:] == ("11111111-1111-4111-8111-111111111111", 77)

    retry_payload = json.loads(response.request.content)
    retry_payload["idempotency_key"] = "new-render-after-failure"
    new_render = client.post("/jobs/from-assets", json=retry_payload)
    assert new_render.status_code == 200
    assert new_render.json()["job_id"] != response.json()["job_id"]
    assert sum(call[0] == "reserve_job_credit" for call in calls) == 2
    assert len(fake_redis.queue_payloads) == 2
    assert not any(call[0] == "execute" and "UPDATE jobs SET status" in call[1] for call in calls)


@pytest.mark.parametrize("recognition_count", [0, 21])
def test_create_asset_upload_never_calls_vehicle_or_url_resolver(monkeypatch, recognition_count):
    calls = []
    quotas = {"identity_resolve": recognition_count, "create_assets": 0}

    class Conn:
        def transaction(self):
            return FakeTransaction()

        async def fetchval(self, query, *args):
            assert "INSERT INTO render_input_drafts" in query
            return "11111111-1111-4111-8111-111111111111"

        async def execute(self, query, *args):
            calls.append(query)
            return "UPDATE 1"

    async def auth(*args, **kwargs):
        return _auth_principal()

    async def limit(*args, **kwargs):
        assert kwargs["scope"] == "create_assets"
        assert kwargs["limit"] == jobs_api.UPLOAD_RATE_LIMIT
        assert kwargs["window_sec"] == jobs_api.UPLOAD_RATE_WINDOW_SEC
        quotas[kwargs["scope"]] += 1
        assert quotas[kwargs["scope"]] <= kwargs["limit"]

    async def upload(**kwargs):
        return assets_service.AssetUpload(
            id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            owner_user_id=77,
            job_id=None,
            kind=kwargs["kind"],
            bucket="raw",
            storage_key="draft/photo.png",
            content_type=kwargs["content_type"],
            size_bytes=len(kwargs["data"]),
            sha256="0" * 64,
            render_input_draft_id=kwargs["render_input_draft_id"],
        )

    async def insert(conn, asset):
        calls.append(asset.kind)

    def forbidden(*args, **kwargs):
        raise AssertionError("Create must not recognize vehicle or resolve URL")

    monkeypatch.setattr(identity_api, "require_auth_principal", auth)
    monkeypatch.setattr(identity_api, "enforce_rate_limit", limit)
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: FakePool(Conn()))
    monkeypatch.setattr(identity_api.assets_service, "upload_render_asset", upload)
    monkeypatch.setattr(identity_api.assets_service, "insert_asset", insert)
    monkeypatch.setattr(identity_api, "get_vehicle_identity_resolver", forbidden)
    monkeypatch.setattr(identity_api, "resolve_rim_product_url", forbidden)
    response = client.post(
        "/identity/assets",
        data={"consent": "true", "init_data": "unused"},
        files={
            "car_image": ("car.png", _image_bytes(), "image/png"),
            "wheel_image": ("wheel.png", _image_bytes(), "image/png"),
        },
    )
    assert response.status_code == 200, response.text
    assert quotas == {"identity_resolve": recognition_count, "create_assets": 1}
    assert "vehicle" not in response.json()
    assert any("status = 'resolved'" in query for query in calls)
    assert "car_original" in calls and "rim_original" in calls
    assert not any("INSERT INTO jobs" in query or "vehicle_identities" in query for query in calls)


def test_create_asset_upload_requires_consent():
    response = client.post(
        "/identity/assets",
        data={"consent": "false"},
        files={
            "car_image": ("car.png", _image_bytes(), "image/png"),
            "wheel_image": ("wheel.png", _image_bytes(), "image/png"),
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "photo_consent_required"


def test_direct_create_request_rejects_malformed_optional_url():
    response = client.post(
        "/jobs/from-assets",
        json={"draft_id": "draft", "idempotency_key": "key", "rim": {"product_url": "garbage URL"}},
    )
    assert response.status_code == 422
    assert any(item["loc"][-1] == "product_url" for item in response.json()["detail"])
