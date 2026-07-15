import json

from fastapi.testclient import TestClient

from src import fitment_checks_api
from src.auth import AuthContext
from src.fitment.providers.base import ProviderError
from src.fitment.schemas import AxleFitment, FitmentProfile
from src.main import app

client = TestClient(app)
VEHICLE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
RIM_SETUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


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


def _row() -> dict:
    provenance = {
        name: {"source": "user_confirmed", "confidence": 1, "is_user_confirmed": True}
        for name in (
            "bolt_count",
            "pcd_mm",
            "center_bore_mm",
            "wheel_diameter_in",
            "wheel_width_j",
            "offset_et_mm",
        )
    }
    return {
        "make": "Lexus",
        "vehicle_model": "RX",
        "year": 2020,
        "body": None,
        "generation": None,
        "modification": None,
        "market": "russia",
        "is_user_confirmed": True,
        "provider_mappings": {},
        "is_staggered": False,
        "brand": "K&K",
        "rim_model": "Atlas",
        "sku": None,
        "product_url": None,
        "bolt_count": 5,
        "pcd_mm": 114.3,
        "center_bore_mm": 60.1,
        "wheel_diameter_in": 20,
        "wheel_width_j": 8.5,
        "offset_et_mm": 45,
        "load_rating_kg": None,
        "fastener_system": None,
        "seat_type": None,
        "rim_field_provenance": provenance,
        "owned_job_id": None,
    }


class FakeConn:
    def __init__(self, existing=None):
        self.existing = existing
        self.inserted = []

    async def fetchrow(self, query, *args):
        if "FROM fitment_checks WHERE owner_user_id" in query:
            return self.existing
        if "INSERT INTO fitment_checks" in query:
            self.inserted.append(args)
            return {
                "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                "execution_status": args[6],
                "verdict": args[7],
                "is_preliminary": True,
                "result": json.loads(args[9]) if args[9] else {},
                "error": json.loads(args[10]) if args[10] else None,
                "engine_version": args[12],
                "rules_version": args[13],
            }
        raise AssertionError(query)


class Provider:
    name = "wheel_size"

    async def resolve_vehicle(self, identity):
        return identity

    async def get_fitment_profile(self, identity, *, user_initiated):
        assert user_initiated is True
        return FitmentProfile(
            provider=self.name,
            bolt_count=5,
            pcd_mm=114.3,
            center_bore_mm=60.1,
            allowed_wheels=[AxleFitment(axle="front", rim_diameter=20, rim_width=8.5, offset=45)],
        )


def _patch_auth_and_inputs(monkeypatch, conn, *, loaded_row=None, provider=Provider):
    monkeypatch.setattr(fitment_checks_api.fitment_config, "FITMENT_VERDICT_ENABLED", True)
    monkeypatch.setattr(
        fitment_checks_api,
        "_auth",
        lambda *_args: AuthContext(telegram_user_id=1, username="test", auth_channel="website"),
    )

    async def ensure(_conn, telegram_user_id, username):
        assert (telegram_user_id, username) == (1, "test")
        return 7

    async def load(_conn, user_id, request):
        assert user_id == 7
        assert str(request.vehicle_identity_id) == VEHICLE_ID
        return _row() if loaded_row is None else loaded_row

    monkeypatch.setattr(fitment_checks_api, "ensure_user", ensure)
    monkeypatch.setattr(fitment_checks_api, "_load", load)
    monkeypatch.setattr(fitment_checks_api.db, "get_pool", lambda: FakePool(conn))
    monkeypatch.setattr(fitment_checks_api, "WheelSizeProvider", provider)


def _post(key="test-key"):
    return client.post(
        "/fitment/checks",
        headers={"Idempotency-Key": key},
        json={"vehicle_identity_id": VEHICLE_ID, "rim_setup_id": RIM_SETUP_ID},
    )


def test_create_check_rejects_other_users_inputs(monkeypatch):
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn, loaded_row=False)

    response = _post()

    assert response.status_code == 404
    assert not conn.inserted


def test_create_check_reuses_idempotency_key(monkeypatch):
    existing = {
        "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "execution_status": "completed",
        "verdict": "compatible",
        "is_preliminary": True,
        "result": {},
        "error": None,
        "engine_version": "v1",
        "rules_version": "v1",
    }
    conn = FakeConn(existing=existing)
    _patch_auth_and_inputs(monkeypatch, conn)

    response = _post("same-key")

    assert response.status_code == 200
    assert response.json()["id"] == existing["id"]
    assert not conn.inserted


def test_create_check_persists_completed_square_setup(monkeypatch):
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn)

    response = _post()

    assert response.status_code == 200
    body = response.json()
    assert body["execution_status"] == "completed"
    assert body["verdict"] == "compatible"
    snapshot = json.loads(conn.inserted[0][8])
    assert snapshot["rim_setup"]["front"] == snapshot["rim_setup"]["rear"]


def test_create_check_accepts_legacy_string_rim_provenance(monkeypatch):
    legacy_row = _row()
    legacy_row["rim_field_provenance"] = "user_confirmed"
    legacy_row["provider_mappings"] = json.dumps({"wheel_size": {"make_slug": "lexus"}})
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn, loaded_row=legacy_row)

    response = _post()

    assert response.status_code == 200
    snapshot = json.loads(conn.inserted[0][8])
    assert snapshot["rim_setup"]["front"]["bolt_count"]["source"] == "user_confirmed"
    assert snapshot["vehicle"]["provider_mappings"] == {"wheel_size": {"make_slug": "lexus"}}


def test_create_check_records_provider_failure(monkeypatch):
    class FailingProvider:
        name = "wheel_size"

        async def resolve_vehicle(self, identity):
            raise ProviderError("timeout")

    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn, provider=FailingProvider)

    response = _post()

    assert response.status_code == 200
    assert response.json()["execution_status"] == "failed"
    assert response.json()["error"]["code"] == "PROVIDER_UNAVAILABLE"
