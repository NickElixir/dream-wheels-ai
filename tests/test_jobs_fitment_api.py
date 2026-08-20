from datetime import UTC, datetime
from decimal import Decimal

from fastapi.testclient import TestClient

from src import jobs_api
from src.auth import AuthContext
from src.main import app
from src.rim_url_resolver import RimUrlCandidate, RimUrlResolution, RimUrlVariant

client = TestClient(app)


def _fitment_row(**overrides) -> dict:
    row = {
        "job_id": "11111111-1111-4111-8111-111111111111",
        "status": "completed",
        "completed_at": datetime(2026, 7, 1, tzinfo=UTC),
        "output_image_url": "https://example.test/result.jpg",
        "render_input_snapshot": {"vehicle": {"make": "BMW"}, "rim": {"pcd": "5x112"}},
        "fitment_available": True,
        "is_staggered": False,
        "vehicle_identity_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "rim_setup_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "owner_user_id": 10,
        "vehicle_make": "BMW",
        "vehicle_model": "3 Series",
        "vehicle_year": 2020,
        "vehicle_body": "G20",
        "vehicle_generation": "VII",
        "vehicle_modification": "330i",
        "vehicle_market": "EU",
        "vehicle_is_user_confirmed": False,
        "vehicle_field_provenance": {
            "make": {"source": "vlm_visual", "confidence": 0.9, "is_user_confirmed": False},
            "model": {"source": "vlm_visual", "confidence": 0.9, "is_user_confirmed": False},
            "year": {"source": "vlm_visual", "confidence": 0.9, "is_user_confirmed": False},
        },
        "vehicle_field_candidates": {
            "model": [
                {
                    "value": "3 Series",
                    "source": "vlm_visual",
                    "confidence": 0.9,
                    "resolver": "mock_visual_identity_v1",
                    "origin": "render_input_draft",
                    "captured_at": "2026-07-01T00:00:00+00:00",
                }
            ]
        },
        "vehicle_revision": 1,
        "front_rim_spec_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "rear_rim_spec_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "rim_field_provenance": {
            "bolt_count": {"source": "ocr", "confidence": 0.72, "is_user_confirmed": False},
            "pcd_mm": {"source": "ocr", "confidence": 0.72, "is_user_confirmed": False},
            "center_bore_mm": {"source": "ocr", "confidence": 0.72, "is_user_confirmed": False},
            "wheel_diameter_in": {"source": "ocr", "confidence": 0.72, "is_user_confirmed": False},
            "wheel_width_j": {"source": "ocr", "confidence": 0.72, "is_user_confirmed": False},
            "offset_et_mm": {"source": "ocr", "confidence": 0.72, "is_user_confirmed": False},
        },
        "rim_field_candidates": {
            "pcd_mm": [
                {
                    "value": 112,
                    "source": "ocr",
                    "confidence": 0.72,
                    "resolver": "mock_visual_identity_v1",
                    "origin": "render_input_draft",
                    "captured_at": "2026-07-01T00:00:00+00:00",
                }
            ]
        },
        "rim_revision": 1,
        "rim_brand": "BBS",
        "rim_model": "CH-R",
        "rim_sku": "CHR-001",
        "rim_product_url": None,
        "rim_bolt_count": 5,
        "rim_pcd_mm": Decimal("112"),
        "rim_center_bore_mm": Decimal("66.6"),
        "rim_wheel_diameter_in": Decimal("18"),
        "rim_wheel_width_j": Decimal("8.0"),
        "rim_offset_et_mm": Decimal("35"),
    }
    row.update(overrides)
    return row


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


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


def _patch_auth(monkeypatch, *, user_id: int = 10) -> None:
    monkeypatch.setattr(
        jobs_api,
        "_resolve_jobs_auth",
        lambda **_kwargs: AuthContext(
            telegram_user_id=123456789,
            username="dw-user",
            auth_channel="website",
        ),
    )

    async def fake_ensure_user(_conn, telegram_user_id: int, username: str | None):
        assert telegram_user_id == 123456789
        assert username == "dw-user"
        return user_id

    monkeypatch.setattr(jobs_api, "ensure_user", fake_ensure_user)


def test_fitment_overview_returns_completed_owner_job(monkeypatch):
    class FakeConn:
        async def fetchrow(self, query: str, *args):
            assert "AND jobs.user_id = $2" in query
            assert args == ("11111111-1111-4111-8111-111111111111", 10)
            return _fitment_row()

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/fitment")

    assert response.status_code == 200
    body = response.json()
    assert body["fitment_available"] is True
    assert body["vehicle_revision"] == 1
    assert body["rim_revision"] == 1
    assert body["vehicle_candidates"]["model"][0]["value"] == "3 Series"
    assert body["rim_candidates"]["pcd_mm"][0]["source"] == "ocr"
    assert body["readiness"]["ready"] is True
    assert body["next_action"]["kind"] == "select_vehicle_variant"
    assert body["readiness"]["unconfirmed_fields"] == [
        "vehicle.make",
        "vehicle.model",
        "vehicle.year",
        "rim.bolt_count",
        "rim.pcd_mm",
        "rim.center_bore_mm",
        "rim.wheel_diameter_in",
        "rim.wheel_width_j",
        "rim.offset_et_mm",
    ]
    assert body["vehicle"]["title"] == "BMW 3 Series · 2020 · VII"
    assert body["vehicle"]["is_user_confirmed"] is False
    assert body["rim"]["pcd_display"] == "5×112"
    assert body["rim"]["product_url"] is None
    assert body["rim"]["has_product_url"] is False


def test_fitment_overview_parses_stringified_json_fields(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row(
                vehicle_field_provenance=(
                    '{"make":{"source":"vlm_visual","confidence":0.9,"is_user_confirmed":false}}'
                ),
                vehicle_field_candidates=(
                    '{"model":[{"value":"3 Series","source":"vlm_visual","confidence":0.9}]}'
                ),
                rim_field_provenance=(
                    '{"bolt_count":{"source":"ocr","confidence":0.72,"is_user_confirmed":false}}'
                ),
                rim_field_candidates='{"pcd_mm":[{"value":112,"source":"ocr","confidence":0.72}]}',
            )

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/fitment")

    assert response.status_code == 200
    body = response.json()
    assert body["vehicle_provenance"]["make"]["source"] == "vlm_visual"
    assert body["vehicle_candidates"]["model"][0]["value"] == "3 Series"
    assert body["rim_provenance"]["bolt_count"]["source"] == "ocr"
    assert body["rim_candidates"]["pcd_mm"][0]["value"] == 112


def test_fitment_source_resolver_returns_unpersisted_draft(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row()

    async def fake_resolve(url, *, policy, limits):
        assert url == "https://shop.example/wheel"
        assert policy.permits("shop.example", 443)
        assert limits.max_redirects == jobs_api.RIM_URL_RESOLVER_MAX_REDIRECTS
        candidate = RimUrlCandidate("pcd_mm", 114.3, "json_ld", 0.95)
        return RimUrlResolution(
            requested_url=url,
            final_url=url,
            values={"pcd_mm": 114.3, "bolt_count": 5},
            candidates=(candidate,),
            conflicts=(),
        )

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api, "RIM_URL_RESOLVER_ENABLED", True)
    monkeypatch.setattr(jobs_api, "resolve_rim_product_url", fake_resolve)

    async def no_limit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(jobs_api, "enforce_rate_limit", no_limit)

    response = client.post(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment/rim-source/resolve",
        json={"product_url": "https://shop.example/wheel"},
    )

    assert response.status_code == 200
    assert response.json()["values"] == {"pcd_mm": 114.3, "bolt_count": 5}


def test_fitment_source_resolver_returns_variants_without_arbitrary_selection(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row()

    async def fake_resolve(url, *, policy, limits):
        del policy, limits
        candidate = RimUrlCandidate("sku", "ROAD-18", "json_ld_variant", 0.98)
        return RimUrlResolution(
            requested_url=url,
            final_url=url,
            values={"brand": "Example", "model": "Road"},
            candidates=(),
            conflicts=(),
            variants=(
                RimUrlVariant(
                    sku="ROAD-17",
                    values={"sku": "ROAD-17", "wheel_diameter_in": 17.0},
                    candidates=(candidate,),
                ),
                RimUrlVariant(
                    sku="ROAD-18",
                    values={"sku": "ROAD-18", "wheel_diameter_in": 18.0},
                    candidates=(candidate,),
                ),
            ),
            selection_required=True,
        )

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api, "RIM_URL_RESOLVER_ENABLED", True)
    monkeypatch.setattr(jobs_api, "resolve_rim_product_url", fake_resolve)

    async def no_limit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(jobs_api, "enforce_rate_limit", no_limit)

    response = client.post(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment/rim-source/resolve",
        json={"product_url": "https://shop.example/road"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["selection_required"] is True
    assert body["selected_variant_sku"] is None
    assert [variant["sku"] for variant in body["variants"]] == ["ROAD-17", "ROAD-18"]


def test_fitment_vehicle_variants_are_catalogue_server_side(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row()

    async def fake_variants(self, identity):
        assert identity.make == "BMW"
        return [
            {
                "generation": "G20",
                "modification": "330i",
                "body": "Sedan",
                "market": "eudm",
                "generation_slug": "g20",
                "modification_slug": "330i",
            }
        ]

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants", fake_variants)

    response = client.post("/jobs/11111111-1111-4111-8111-111111111111/fitment/vehicle-variants")

    assert response.status_code == 200
    assert response.json()["variants"] == [
        {"generation": "G20", "modification": "330i", "body": "Sedan", "market": "eudm"}
    ]


def test_fitment_overview_returns_404_for_non_owner(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return None

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/fitment")

    assert response.status_code == 404


def test_fitment_save_updates_canonical_entities_only(monkeypatch):
    execute_calls: list[tuple[str, tuple]] = []
    rows = [
        _fitment_row(),
        _fitment_row(
            vehicle_make="BMW",
            vehicle_model="M3",
            vehicle_year=2021,
            vehicle_generation="G80",
            vehicle_is_user_confirmed=True,
            vehicle_field_provenance={"model": {"source": "user_edited"}},
            vehicle_revision=2,
            rim_brand="OZ",
            rim_model="Ultraleggera",
            rim_sku="OZ-18",
            rim_product_url="https://shop.example.test/oz-18",
            rim_field_provenance={"product_url": {"source": "user_edited"}},
            rim_revision=2,
        ),
    ]

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, query: str, *args):
            assert "render_input_snapshot" in query
            assert args == ("11111111-1111-4111-8111-111111111111", 10)
            return rows.pop(0)

        async def execute(self, query: str, *args):
            execute_calls.append((query, args))
            return "UPDATE 1"

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "vehicle": {
                "model": "M3",
                "year": 2021,
                "generation": "G80",
            },
            "rim": {
                "brand": "OZ",
                "model": "Ultraleggera",
                "sku": "OZ-18",
                "product_url": "https://shop.example.test/oz-18",
            },
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["vehicle"]["model"] == "M3"
    assert body["vehicle_revision"] == 2
    assert body["rim"]["brand"] == "OZ"
    assert body["rim_revision"] == 2
    assert body["rim"]["product_url"] == "https://shop.example.test/oz-18"
    assert body["vehicle_candidates"]["model"][0]["value"] == "3 Series"
    assert body["rim_candidates"]["pcd_mm"][0]["value"] == 112
    assert len(execute_calls) == 3
    assert "UPDATE vehicle_identities" in execute_calls[0][0]
    assert "UPDATE rim_specs" in execute_calls[1][0]
    assert "INSERT INTO fitment_change_events" in execute_calls[2][0]
    assert "render_input_snapshot" not in execute_calls[0][0]
    assert "render_input_snapshot" not in execute_calls[1][0]
    assert execute_calls[0][1][1] == "M3"
    assert execute_calls[1][1][0] == "OZ"
    assert execute_calls[0][1][-1] == 1
    assert execute_calls[1][1][-1] == 1


def test_fitment_overview_reports_missing_fields_for_future_check(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row(rim_center_bore_mm=None, rim_offset_et_mm=None)

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/fitment")

    assert response.status_code == 200
    body = response.json()
    assert body["readiness"]["ready"] is False
    assert body["readiness"]["missing_fields"] == [
        "rim.center_bore_mm",
        "rim.offset_et_mm",
    ]
    assert body["readiness"]["unconfirmed_fields"] == [
        "vehicle.make",
        "vehicle.model",
        "vehicle.year",
        "rim.bolt_count",
        "rim.pcd_mm",
        "rim.wheel_diameter_in",
        "rim.wheel_width_j",
    ]
    assert body["next_action"]["kind"] == "complete_rim_specs"


def test_fitment_overview_returns_one_authoritative_next_action(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row(
                vehicle_provider_mappings={
                    "wheel_size": {
                        "make_slug": "bmw",
                        "model_slug": "3-series",
                        "region": "eu",
                        "generation_slug": "g20",
                        "modification_slug": "330i",
                    }
                }
            )

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/fitment")

    assert response.status_code == 200
    assert response.json()["next_action"]["kind"] == "run_standard_check"

    missing_vehicle = _fitment_row(vehicle_make=None)
    assert (
        jobs_api._fitment_next_action_from_row(missing_vehicle).kind == "complete_vehicle_details"
    )


def test_fitment_save_allows_clearing_optional_fields(monkeypatch):
    execute_calls: list[tuple[str, tuple]] = []
    rows = [
        _fitment_row(rim_product_url="https://shop.example.test/old"),
        _fitment_row(vehicle_body=None, rim_product_url=None, vehicle_revision=2, rim_revision=2),
    ]

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return rows.pop(0)

        async def execute(self, query: str, *args):
            execute_calls.append((query, args))
            return "UPDATE 1"

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "vehicle": {"body": None},
            "rim": {"product_url": None},
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 200
    assert response.json()["vehicle"]["body"] is None
    assert response.json()["rim"]["product_url"] is None
    assert execute_calls[0][1][3] is None
    assert execute_calls[1][1][3] is None


def test_fitment_save_preserves_revision_when_payload_is_unchanged(monkeypatch):
    execute_calls: list[tuple[str, tuple]] = []
    confirmed_meta = {"source": "user_confirmed", "confidence": 1.0, "is_user_confirmed": True}
    rows = [
        _fitment_row(
            vehicle_is_user_confirmed=True,
            vehicle_field_provenance={
                "make": confirmed_meta,
                "model": confirmed_meta,
                "year": confirmed_meta,
                "body": confirmed_meta,
                "generation": confirmed_meta,
                "modification": confirmed_meta,
                "market": confirmed_meta,
            },
            rim_field_provenance={
                "brand": confirmed_meta,
                "model": confirmed_meta,
                "sku": confirmed_meta,
                "bolt_count": confirmed_meta,
                "pcd_mm": confirmed_meta,
                "center_bore_mm": confirmed_meta,
                "wheel_diameter_in": confirmed_meta,
                "wheel_width_j": confirmed_meta,
                "offset_et_mm": confirmed_meta,
            },
        ),
        _fitment_row(
            vehicle_is_user_confirmed=True,
            vehicle_field_provenance={
                "make": confirmed_meta,
                "model": confirmed_meta,
                "year": confirmed_meta,
                "body": confirmed_meta,
                "generation": confirmed_meta,
                "modification": confirmed_meta,
                "market": confirmed_meta,
            },
            rim_field_provenance={
                "brand": confirmed_meta,
                "model": confirmed_meta,
                "sku": confirmed_meta,
                "bolt_count": confirmed_meta,
                "pcd_mm": confirmed_meta,
                "center_bore_mm": confirmed_meta,
                "wheel_diameter_in": confirmed_meta,
                "wheel_width_j": confirmed_meta,
                "offset_et_mm": confirmed_meta,
            },
        ),
    ]

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return rows.pop(0)

        async def execute(self, query: str, *args):
            execute_calls.append((query, args))
            return "UPDATE 1"

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "vehicle": {
                "make": "BMW",
                "model": "3 Series",
                "year": 2020,
                "body": "G20",
                "generation": "VII",
                "modification": "330i",
                "market": "EU",
            },
            "rim": {
                "brand": "BBS",
                "model": "CH-R",
                "sku": "CHR-001",
                "product_url": None,
                "bolt_count": 5,
                "pcd_mm": 112,
                "center_bore_mm": 66.6,
                "wheel_diameter_in": 18,
                "wheel_width_j": 8,
                "offset_et_mm": 35,
            },
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 200
    assert response.json()["vehicle_revision"] == 1
    assert response.json()["rim_revision"] == 1
    assert execute_calls == []


def test_fitment_save_confirms_prefilled_values_without_value_change(monkeypatch):
    execute_calls: list[tuple[str, tuple]] = []
    rows = [
        _fitment_row(),
        _fitment_row(
            vehicle_is_user_confirmed=True,
            vehicle_field_provenance={
                "make": {"source": "user_confirmed", "confidence": 1.0, "is_user_confirmed": True},
                "model": {"source": "user_confirmed", "confidence": 1.0, "is_user_confirmed": True},
                "year": {"source": "user_confirmed", "confidence": 1.0, "is_user_confirmed": True},
            },
            rim_field_provenance={
                "bolt_count": {
                    "source": "user_confirmed",
                    "confidence": 1.0,
                    "is_user_confirmed": True,
                },
                "pcd_mm": {
                    "source": "user_confirmed",
                    "confidence": 1.0,
                    "is_user_confirmed": True,
                },
                "center_bore_mm": {
                    "source": "user_confirmed",
                    "confidence": 1.0,
                    "is_user_confirmed": True,
                },
                "wheel_diameter_in": {
                    "source": "user_confirmed",
                    "confidence": 1.0,
                    "is_user_confirmed": True,
                },
                "wheel_width_j": {
                    "source": "user_confirmed",
                    "confidence": 1.0,
                    "is_user_confirmed": True,
                },
                "offset_et_mm": {
                    "source": "user_confirmed",
                    "confidence": 1.0,
                    "is_user_confirmed": True,
                },
            },
            vehicle_revision=2,
            rim_revision=2,
        ),
    ]

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return rows.pop(0)

        async def execute(self, query: str, *args):
            execute_calls.append((query, args))
            return "UPDATE 1"

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "vehicle": {"make": "BMW", "model": "3 Series", "year": 2020},
            "rim": {
                "bolt_count": 5,
                "pcd_mm": 112,
                "center_bore_mm": 66.6,
                "wheel_diameter_in": 18,
                "wheel_width_j": 8,
                "offset_et_mm": 35,
            },
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 200
    assert response.json()["vehicle_revision"] == 2
    assert response.json()["rim_revision"] == 2
    assert len(execute_calls) == 3
    assert "UPDATE vehicle_identities" in execute_calls[0][0]
    assert "UPDATE rim_specs" in execute_calls[1][0]
    assert "INSERT INTO fitment_change_events" in execute_calls[2][0]


def test_fitment_save_returns_409_for_stale_revision(monkeypatch):
    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return _fitment_row(vehicle_revision=2)

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "vehicle": {"model": "M3"},
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 409


def test_fitment_save_returns_404_for_non_owner(monkeypatch):
    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return None

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "vehicle": {"model": "M3"},
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 404


def test_fitment_save_rejects_invalid_product_url_before_db(monkeypatch):
    _patch_auth(monkeypatch)

    response = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "rim": {"product_url": "ftp://example.test/wheel"},
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 422


def test_fitment_history_returns_events_for_owner(monkeypatch):
    history_rows = [
        {
            "event_type": "user_confirm",
            "actor_type": "user",
            "actor_user_id": 10,
            "vehicle_revision_before": 1,
            "vehicle_revision_after": 2,
            "rim_revision_before": 1,
            "rim_revision_after": 2,
            "changes": {"vehicle": {"model": {"old": "3 Series", "new": "3 Series"}}},
            "created_at": datetime(2026, 7, 2, tzinfo=UTC),
        }
    ]

    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row()

        async def fetch(self, query: str, *args):
            assert "FROM fitment_change_events AS evt" in query
            assert args == ("11111111-1111-4111-8111-111111111111", 10)
            return history_rows

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/fitment/history")

    assert response.status_code == 200
    body = response.json()
    assert body["job_id"] == "11111111-1111-4111-8111-111111111111"
    assert body["events"][0]["event_type"] == "user_confirm"
    assert body["events"][0]["actor_type"] == "user"


def test_fitment_history_parses_stringified_changes(monkeypatch):
    history_rows = [
        {
            "event_type": "user_confirm",
            "actor_type": "user",
            "actor_user_id": 10,
            "vehicle_revision_before": 1,
            "vehicle_revision_after": 2,
            "rim_revision_before": 1,
            "rim_revision_after": 2,
            "changes": '{"vehicle":{"model":{"old":"3 Series","new":"3 Series"}}}',
            "created_at": datetime(2026, 7, 2, tzinfo=UTC),
        }
    ]

    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row()

        async def fetch(self, *_args):
            return history_rows

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/fitment/history")

    assert response.status_code == 200
    body = response.json()
    assert body["events"][0]["changes"]["vehicle"]["model"]["new"] == "3 Series"
