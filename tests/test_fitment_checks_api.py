import hashlib
import json

from fastapi.testclient import TestClient

from src import fitment_checks_api
from src.auth import AuthContext
from src.fitment.providers.base import ProviderError
from src.fitment.schemas import AxleFitment, FitmentProfile, OffsetReference
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
        "provider_mappings": {
            "wheel_size": {
                "make_slug": "lexus",
                "model_slug": "rx",
                "region": "russia",
                "generation_slug": "al20",
                "modification_slug": "rx350",
            }
        },
        "vehicle_revision": 4,
        "provider_mapping_revision": 2,
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
        "rim_revision": 3,
        "owned_job_id": None,
    }


class FakeConn:
    def __init__(self, existing=None, *, race_winner=None):
        self.existing = existing
        self.race_winner = race_winner
        self.inserted = []

    async def fetchrow(self, query, *args):
        if "FROM fitment_checks WHERE owner_user_id" in query:
            if self.inserted and self.race_winner is not None:
                return self.race_winner
            return self.existing
        if "INSERT INTO fitment_checks" in query:
            self.inserted.append(args)
            if self.race_winner is not None:
                return None
            return {
                "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                "execution_status": args[6],
                "verdict": args[7],
                "is_preliminary": True,
                # asyncpg can return JSONB columns as strings; tests must use
                # the production representation rather than convenient dicts.
                "result": args[9],
                "error": args[10],
                "input_hash": args[5],
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
            allowed_wheels=[
                AxleFitment(axle="front", rim_diameter=20, rim_width=8.5, offset=45, is_stock=True)
            ],
            offset_references=[
                OffsetReference(
                    axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=45, et_max_mm=45
                ),
                OffsetReference(
                    axle="rear", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=45, et_max_mm=45
                ),
            ],
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


def _input_hash(row=None):
    _, _, snapshot = fitment_checks_api._snapshot(row or _row())
    snapshot["check_mode"] = "standard"
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()


def _check_record(*, input_hash=None):
    return {
        "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "execution_status": "completed",
        "verdict": "compatible",
        "is_preliminary": True,
        "result": json.dumps({"rule_results": []}),
        "error": None,
        "engine_version": "v1",
        "rules_version": "v1",
        "input_hash": input_hash or _input_hash(),
    }


def _post(key="test-key", *, render_job_id=None):
    payload = {"vehicle_identity_id": VEHICLE_ID, "rim_setup_id": RIM_SETUP_ID}
    if render_job_id:
        payload["render_job_id"] = render_job_id
    return client.post(
        "/fitment/checks",
        headers={"Idempotency-Key": key},
        json=payload,
    )


def test_create_check_rejects_unimplemented_extended_mode(monkeypatch):
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn)

    response = client.post(
        "/fitment/checks",
        headers={"Idempotency-Key": "extended-key"},
        json={
            "vehicle_identity_id": VEHICLE_ID,
            "rim_setup_id": RIM_SETUP_ID,
            "mode": "extended",
        },
    )

    assert response.status_code == 422
    assert not conn.inserted


def test_create_check_rejects_other_users_inputs(monkeypatch):
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn, loaded_row=False)

    response = _post()

    assert response.status_code == 404
    assert not conn.inserted


def test_create_check_requires_confirmed_provider_variant(monkeypatch):
    row = _row()
    row["provider_mappings"] = {}
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn, loaded_row=row)

    response = _post()

    assert response.status_code == 409
    assert "confirmed Wheel-Size vehicle variant" in response.json()["detail"]
    assert not conn.inserted


def test_create_check_reuses_idempotency_key(monkeypatch):
    existing = _check_record()
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
    assert body["mode"] == "standard"
    snapshot = json.loads(conn.inserted[0][8])
    assert snapshot["rim_setup"]["front"] == snapshot["rim_setup"]["rear"]
    evaluation = json.loads(conn.inserted[0][15])
    assert evaluation["vehicle_provider_mapping"]["modification_slug"] == "rx350"
    assert evaluation["vehicle_identity_revision"] == 4
    assert evaluation["rim_setup_revision"] == 3
    assert evaluation["provider_mapping_revision"] == 2


def test_create_check_accepts_legacy_string_rim_provenance(monkeypatch):
    legacy_row = _row()
    legacy_row["rim_field_provenance"] = "user_confirmed"
    legacy_row["provider_mappings"] = json.dumps(_row()["provider_mappings"])
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn, loaded_row=legacy_row)

    response = _post()

    assert response.status_code == 200
    snapshot = json.loads(conn.inserted[0][8])
    assert snapshot["rim_setup"]["front"]["bolt_count"]["source"] == "user_confirmed"
    assert snapshot["vehicle"]["provider_mappings"] == _row()["provider_mappings"]


def test_create_check_accepts_json_encoded_rim_provenance(monkeypatch):
    legacy_row = _row()
    legacy_row["rim_field_provenance"] = json.dumps(legacy_row["rim_field_provenance"])
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn, loaded_row=legacy_row)

    response = _post()

    assert response.status_code == 200
    snapshot = json.loads(conn.inserted[0][8])
    assert snapshot["rim_setup"]["front"]["pcd_mm"]["source"] == "user_confirmed"


def test_field_accepts_legacy_scalar_provenance():
    field = fitment_checks_api._field(5, "user_confirmed", "bolt_count")

    assert field.source.value == "user_confirmed"


def test_snapshot_keeps_confirmed_rear_rim_authoritative_for_staggered_setup():
    row = _row()
    rear_provenance = {
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
    row.update(
        {
            "is_staggered": True,
            "front_rim_brand": "Front",
            "front_rim_model": "F20",
            "front_rim_sku": "front-20",
            "front_rim_product_url": None,
            "front_rim_bolt_count": 5,
            "front_rim_pcd_mm": 114.3,
            "front_rim_center_bore_mm": 60.1,
            "front_rim_wheel_diameter_in": 20,
            "front_rim_wheel_width_j": 8.5,
            "front_rim_offset_et_mm": 40,
            "front_rim_load_rating_kg": None,
            "front_rim_fastener_system": None,
            "front_rim_seat_type": None,
            "front_rim_field_provenance": rear_provenance,
            "rear_rim_brand": "Rear",
            "rear_rim_model": "R20",
            "rear_rim_sku": "rear-20",
            "rear_rim_product_url": None,
            "rear_rim_bolt_count": 5,
            "rear_rim_pcd_mm": 114.3,
            "rear_rim_center_bore_mm": 60.1,
            "rear_rim_wheel_diameter_in": 20,
            "rear_rim_wheel_width_j": 9.5,
            "rear_rim_offset_et_mm": 45,
            "rear_rim_load_rating_kg": None,
            "rear_rim_fastener_system": None,
            "rear_rim_seat_type": None,
            "rear_rim_field_provenance": rear_provenance,
        }
    )

    _, setup, snapshot = fitment_checks_api._snapshot(row)

    assert setup.is_staggered is True
    assert setup.front.model == "F20"
    assert setup.rear.model == "R20"
    assert setup.rear.wheel_width_j.value == 9.5
    assert snapshot["rim_setup"]["rear"]["model"] == "R20"


def test_create_check_rejects_foreign_render_job(monkeypatch):
    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn)

    response = _post(render_job_id="dddddddd-dddd-4ddd-8ddd-dddddddddddd")

    assert response.status_code == 404
    assert not conn.inserted


def test_create_check_rejects_reused_key_for_other_inputs(monkeypatch):
    conn = FakeConn(existing=_check_record(input_hash="different-inputs"))
    _patch_auth_and_inputs(monkeypatch, conn)

    response = _post("same-key")

    assert response.status_code == 409
    assert not conn.inserted


def test_create_check_uses_race_winner_after_idempotency_conflict(monkeypatch):
    conn = FakeConn(race_winner=_check_record())
    _patch_auth_and_inputs(monkeypatch, conn)

    response = _post("same-key")

    assert response.status_code == 200
    assert response.json()["id"] == "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    assert len(conn.inserted) == 1


def test_create_check_records_provider_failure(monkeypatch):
    class FailingProvider:
        name = "wheel_size"

        async def get_fitment_profile(self, identity, *, user_initiated):
            raise ProviderError("timeout")

    conn = FakeConn()
    _patch_auth_and_inputs(monkeypatch, conn, provider=FailingProvider)

    response = _post()

    assert response.status_code == 200
    assert response.json()["execution_status"] == "failed"
    assert response.json()["error"]["code"] == "provider_unavailable"
