import json
from io import BytesIO

from fastapi.testclient import TestClient

from src import assets_service, identity_api, jobs_api
from src.auth import AuthContext
from src.main import app

client = TestClient(app)


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


def _auth_context() -> AuthContext:
    return AuthContext(
        telegram_user_id=123456,
        username="dw-user",
        auth_channel="mini_app",
    )


def test_identity_resolve_requires_both_images():
    response = client.post(
        "/identity/resolve",
        files={"car_image": ("car.jpg", BytesIO(b"car"), "image/jpeg")},
        data={"init_data": "unused"},
    )

    assert response.status_code == 422


def test_identity_resolve_returns_quick_proposal_without_job_or_queue(monkeypatch):
    calls: list[tuple[str, object]] = []

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

    async def fake_ensure_user(_conn, telegram_user_id: int, username: str | None):
        assert telegram_user_id == 123456
        assert username == "dw-user"
        return 77

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

    monkeypatch.setattr(identity_api, "resolve_telegram_auth", lambda **_kwargs: _auth_context())
    monkeypatch.setattr(identity_api, "enforce_rate_limit", fake_enforce_rate_limit)
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(identity_api, "ensure_user", fake_ensure_user)
    monkeypatch.setattr(
        identity_api.assets_service, "upload_render_asset", fake_upload_render_asset
    )
    monkeypatch.setattr(identity_api.assets_service, "insert_asset", fake_insert_asset)

    response = client.post(
        "/identity/resolve",
        data={"init_data": "unused"},
        files={
            "car_image": ("car.jpg", BytesIO(b"car-bytes"), "image/jpeg"),
            "wheel_image": ("wheel.jpg", BytesIO(b"rim-bytes"), "image/jpeg"),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["draft_id"] == "11111111-1111-4111-8111-111111111111"
    assert body["vehicle"]["primary"]["make"] == "Lexus"
    assert len(body["vehicle"]["alternatives"]) <= 2
    assert body["rim"]["wheel_diameter_in"] == 20
    assert body["rim"]["wheel_width_j"] == 8.5
    assert body["rim"]["bolt_count"] == 5
    assert body["rim"]["pcd_mm"] == 114.3
    assert body["pcd_display"] == "5×114.3"
    assert not any(call[0] == "reserve_job_credit" for call in calls)
    assert not any(call[0] == "queue" for call in calls)


def test_create_job_from_assets_persists_confirmed_identity_snapshot_and_queues(monkeypatch):
    calls: list[tuple[str, object]] = []

    class FakeRedis:
        def __init__(self):
            self.values: dict[str, str] = {}
            self.queue_payloads: list[str] = []

        async def set(self, key: str, value: str, *, ex: int, nx: bool):
            assert ex == jobs_api.IDEMPOTENCY_TTL_SEC
            assert nx is True
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

    async def fake_ensure_user(_conn, telegram_user_id: int, username: str | None):
        assert telegram_user_id == 123456
        assert username == "dw-user"
        return 77

    async def fake_reserve_job_credit(_conn, *, user_id: int, job_id: str):
        calls.append(("reserve_job_credit", user_id, job_id))
        return 2

    fake_redis = FakeRedis()
    monkeypatch.setattr(jobs_api, "resolve_telegram_auth", lambda **_kwargs: _auth_context())
    monkeypatch.setattr(jobs_api, "_get_render_queue_client", lambda *_args, **_kwargs: fake_redis)
    monkeypatch.setattr(jobs_api, "enforce_rate_limit", fake_enforce_rate_limit)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api, "ensure_user", fake_ensure_user)
    monkeypatch.setattr(jobs_api, "reserve_job_credit", fake_reserve_job_credit)
    monkeypatch.setattr(jobs_api.redis_client, "key", lambda key: key)

    response = client.post(
        "/jobs/from-assets",
        json={
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
            "rim": {
                "wheel_diameter_in": 20,
                "wheel_width_j": 8.5,
                "bolt_count": 5,
                "pcd_mm": 114.3,
                "confidence": 0.72,
                "source": "ocr",
            },
            "rim_user_confirmed": False,
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "queued"
    assert any(call[0] == "reserve_job_credit" for call in calls)
    assert len(fake_redis.queue_payloads) == 1
    assert "fitment" not in fake_redis.queue_payloads[0].lower()

    job_insert = next(
        call for call in calls if call[0] == "execute" and call[1].startswith("INSERT INTO jobs")
    )
    snapshot = json.loads(job_insert[2][8])
    assert snapshot["fitment_verdict"] is None
    assert snapshot["purpose"] == "visual_render"
    assert snapshot["vehicle"]["year"] == 2021
    assert snapshot["rim"]["pcd_display"] == "5×114.3"
    assert snapshot["rim"]["is_user_confirmed"] is False
