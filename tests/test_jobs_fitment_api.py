import json
from datetime import UTC, datetime
from decimal import Decimal

from fastapi.testclient import TestClient

from src import jobs_api
from src.auth import AuthContext
from src.fitment.providers.base import ProviderError
from src.main import app
from src.rim_url_resolver import RimUrlCandidate, RimUrlError, RimUrlResolution, RimUrlVariant

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


def _confirmed_vehicle_row(**overrides) -> dict:
    confirmed = {
        "source": "user_confirmed",
        "confidence": 1.0,
        "is_user_confirmed": True,
    }
    row = _fitment_row(
        vehicle_is_user_confirmed=True,
        vehicle_field_provenance={
            "make": dict(confirmed),
            "model": dict(confirmed),
            "year": dict(confirmed),
            "market": dict(confirmed),
        },
    )
    row.update(overrides)
    return row


def _confirmed_modification_mapping() -> dict:
    return {
        "wheel_size": {
            "make_slug": "bmw",
            "model_slug": "3-series",
            "region": "eu",
            "generation": "G20",
            "modification": "330i",
            "body": "Sedan",
            "market": "eudm",
            "generation_slug": "g20",
            "modification_slug": "330i",
            "modification_state": "confirmed",
            "selection_source": "user",
            "modification_vehicle_revision": 1,
            "selected_modification": {
                "make_slug": "bmw",
                "model_slug": "3-series",
                "region": "eu",
                "generation": "G20",
                "modification": "330i",
                "body": "Sedan",
                "market": "eudm",
                "generation_slug": "g20",
                "modification_slug": "330i",
            },
        }
    }


def test_rim_setup_state_distinguishes_empty_partial_unconfirmed_and_confirmed():
    confirmed = {"source": "user_confirmed", "is_user_confirmed": True}
    suggested = {"source": "resolver", "is_user_confirmed": False}
    empty = _fitment_row(
        **{f"rim_{field}": None for field in jobs_api._RIM_CRITICAL_FIELDS},
        rim_field_provenance={},
    )
    assert (
        jobs_api._rim_setup_state_from_states(
            jobs_api._rim_field_states_from_row(empty, "front_rim")
        )
        == "empty"
    )

    partial = _fitment_row(
        rim_center_bore_mm=None,
        rim_offset_et_mm=None,
        rim_field_provenance={"bolt_count": confirmed, "pcd_mm": confirmed},
    )
    assert (
        jobs_api._rim_setup_state_from_states(
            jobs_api._rim_field_states_from_row(partial, "front_rim")
        )
        == "partial"
    )

    unconfirmed = _fitment_row(
        rim_field_provenance={field: suggested for field in jobs_api._RIM_CRITICAL_FIELDS}
    )
    assert (
        jobs_api._rim_setup_state_from_states(
            jobs_api._rim_field_states_from_row(unconfirmed, "front_rim")
        )
        == "complete_unconfirmed"
    )

    ready = _fitment_row(
        rim_field_provenance={field: confirmed for field in jobs_api._RIM_CRITICAL_FIELDS}
    )
    states = jobs_api._rim_field_states_from_row(ready, "front_rim")
    assert jobs_api._rim_setup_state_from_states(states) == "confirmed_ready"
    assert states["pcd"].state == "confirmed"


def test_rim_field_state_manual_entry_is_not_confirmation():
    row = _fitment_row(
        rim_field_provenance={"offset_et_mm": {"source": "user_edited", "is_user_confirmed": False}}
    )
    state = jobs_api._rim_field_states_from_row(row, "front_rim")["offset_et_mm"]
    assert state.state == "entered"
    assert state.is_user_confirmed is False


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


async def _exact_catalogue_selection(_provider, *, make, model, region, year):
    return {
        "make": make,
        "model": model,
        "year": year,
        "region": region,
        "make_slug": make.casefold().replace(" ", "-"),
        "model_slug": model.casefold().replace(" ", "-"),
    }


def _patch_vehicle_catalogue(monkeypatch) -> None:
    async def regions(_self):
        return [
            {"slug": "russia", "name": "Russia+"},
            {"slug": "eudm", "name": "Europe"},
            {"slug": "usdm", "name": "USA+"},
        ]

    async def makes(_self, *, region):
        return [{"slug": "porsche", "name": "Porsche"}] if region == "russia" else []

    async def models(_self, *, make, region):
        if (make, region) == ("porsche", "russia"):
            return [{"slug": "cayenne", "name": "Cayenne"}]
        return []

    async def years(_self, *, make, model, region):
        if (make, model, region) == ("porsche", "cayenne", "russia"):
            return [{"year": year} for year in range(2018, 2024)]
        return []

    monkeypatch.setattr(jobs_api.WheelSizeProvider, "catalogue_regions", regions)
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "catalogue_makes", makes)
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "catalogue_models", models)
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "catalogue_years", years)


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
    assert body["vehicle_state"] == "unconfirmed"
    assert body["next_action"]["kind"] == "complete_vehicle_details"
    assert body["readiness"]["unconfirmed_fields"] == [
        "vehicle.make",
        "vehicle.model",
        "vehicle.year",
        "vehicle.region",
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


def test_fitment_overview_is_not_gated_by_render_completion(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row(status="processing", completed_at=None, output_image_url=None)

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/fitment")

    assert response.status_code == 200
    assert response.json()["status"] == "processing"
    assert response.json()["fitment_available"] is True


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
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return _confirmed_vehicle_row()

        async def execute(self, *_args):
            return "UPDATE 1"

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


def test_fitment_source_resolver_returns_safe_error_code(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row()

    async def fake_resolve(*_args, **_kwargs):
        raise RimUrlError(
            "upstream hostname and path must not reach the client",
            reason_code="rim_source_fetch_failed",
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

    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "rim_source_fetch_failed"}}


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
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return _confirmed_vehicle_row()

        async def execute(self, *_args):
            return "UPDATE 1"

    async def fake_variants(self, identity):
        assert identity.make == "BMW"
        return [
            {
                "generation": "G20",
                "modification": "330i",
                "body": "Sedan",
                "market": "eudm",
                "make_slug": "bmw",
                "model_slug": "3-series",
                "region": "eu",
                "generation_slug": "g20",
                "modification_slug": "330i",
            }
        ]

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants", fake_variants)

    response = client.post("/jobs/11111111-1111-4111-8111-111111111111/fitment/vehicle-variants")

    assert response.status_code == 200
    assert response.json()["outcome"] == "single"
    assert response.json()["vehicle_revision"] == 1
    assert response.json()["total_count"] == 1
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
    monkeypatch.setattr(
        jobs_api,
        "_resolve_exact_vehicle_catalogue_selection",
        _exact_catalogue_selection,
    )

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
        "vehicle.region",
        "rim.bolt_count",
        "rim.pcd_mm",
        "rim.wheel_diameter_in",
        "rim.wheel_width_j",
    ]
    assert body["next_action"]["kind"] == "complete_vehicle_details"


def test_fitment_overview_returns_one_authoritative_next_action(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _confirmed_vehicle_row(
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
    assert response.json()["modification_state"] == "none"
    assert response.json()["next_action"]["kind"] == "select_vehicle_variant"

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
    monkeypatch.setattr(
        jobs_api,
        "_resolve_exact_vehicle_catalogue_selection",
        _exact_catalogue_selection,
    )

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


def test_rim_only_save_preserves_revision_bound_modification_from_stale_vehicle_form(monkeypatch):
    execute_calls: list[tuple[str, tuple]] = []
    confirmed_meta = {"source": "user_confirmed", "confidence": 1.0, "is_user_confirmed": True}
    mapping = _confirmed_modification_mapping()
    rows = [
        _confirmed_vehicle_row(
            vehicle_provider_mappings=mapping,
            vehicle_field_provenance={
                field: dict(confirmed_meta)
                for field in (
                    "make",
                    "model",
                    "year",
                    "body",
                    "generation",
                    "modification",
                    "market",
                )
            },
        ),
        _confirmed_vehicle_row(
            vehicle_provider_mappings=mapping,
            vehicle_field_provenance={
                field: dict(confirmed_meta)
                for field in (
                    "make",
                    "model",
                    "year",
                    "body",
                    "generation",
                    "modification",
                    "market",
                )
            },
            rim_center_bore_mm=Decimal("74.1"),
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
            "vehicle": {
                "make": "BMW",
                "model": "3 Series",
                "year": 2020,
                "body": "stale-body",
                "generation": "stale-generation",
                "modification": "stale-modification",
                "market": "EU",
            },
            "rim": {"center_bore_mm": 74.1},
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["vehicle_revision"] == 1
    assert body["rim_revision"] == 2
    assert body["modification_state"] == "confirmed"
    assert body["vehicle"]["modification"] == "330i"
    assert all("UPDATE vehicle_identities" not in query for query, _args in execute_calls)
    assert any("UPDATE rim_specs" in query for query, _args in execute_calls)


def test_rim_only_save_without_vehicle_payload_preserves_confirmed_modification(monkeypatch):
    execute_calls: list[tuple[str, tuple]] = []
    confirmed_meta = {"source": "user_confirmed", "confidence": 1.0, "is_user_confirmed": True}
    mapping = _confirmed_modification_mapping()
    rows = [
        _confirmed_vehicle_row(
            vehicle_provider_mappings=mapping,
            vehicle_field_provenance={
                field: dict(confirmed_meta)
                for field in (
                    "make",
                    "model",
                    "year",
                    "body",
                    "generation",
                    "modification",
                    "market",
                )
            },
        ),
        _confirmed_vehicle_row(
            vehicle_provider_mappings=mapping,
            vehicle_field_provenance={
                field: dict(confirmed_meta)
                for field in (
                    "make",
                    "model",
                    "year",
                    "body",
                    "generation",
                    "modification",
                    "market",
                )
            },
            rim_center_bore_mm=Decimal("74.1"),
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
            "rim": {"center_bore_mm": 74.1},
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["vehicle_revision"] == 1
    assert body["rim_revision"] == 2
    assert body["modification_state"] == "confirmed"
    assert body["vehicle"]["modification"] == "330i"
    assert all("UPDATE vehicle_identities" not in query for query, _args in execute_calls)
    assert any("UPDATE rim_specs" in query for query, _args in execute_calls)


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
    monkeypatch.setattr(
        jobs_api,
        "_resolve_exact_vehicle_catalogue_selection",
        _exact_catalogue_selection,
    )

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


def test_fitment_catalogue_exposes_exact_porsche_cayenne_russia_years(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row()

    _patch_auth(monkeypatch)
    _patch_vehicle_catalogue(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    base = "/jobs/11111111-1111-4111-8111-111111111111/fitment/catalogue"

    regions = client.get(f"{base}/regions")
    assert regions.status_code == 200
    assert regions.json()["outcome"] == "success"
    assert [item["label"] for item in regions.json()["items"][:2]] == ["Россия+", "Европа"]

    makes = client.get(f"{base}/makes?region=russia")
    assert makes.json() == {
        "outcome": "success",
        "items": [{"value": "porsche", "label": "Porsche", "provider_id": "porsche"}],
    }

    models = client.get(f"{base}/models?region=russia&make=porsche")
    assert models.json()["items"][0]["value"] == "cayenne"

    years = client.get(f"{base}/years?region=russia&make=porsche&model=cayenne")
    assert years.status_code == 200
    assert years.json()["outcome"] == "success"
    assert [item["value"] for item in years.json()["items"]] == [
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023",
    ]


def test_fitment_catalogue_distinguishes_no_data_and_provider_failure(monkeypatch):
    class FakeConn:
        async def fetchrow(self, *_args):
            return _fitment_row()

    _patch_auth(monkeypatch)
    _patch_vehicle_catalogue(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    base = "/jobs/11111111-1111-4111-8111-111111111111/fitment/catalogue"

    no_data = client.get(f"{base}/models?region=russia&make=unknown")
    assert no_data.status_code == 200
    assert no_data.json() == {"outcome": "no_data", "items": []}

    async def unavailable(_self):
        raise ProviderError("wheel-size HTTP 503 on /regions")

    monkeypatch.setattr(jobs_api.WheelSizeProvider, "catalogue_regions", unavailable)
    failed = client.get(f"{base}/regions")
    assert failed.status_code == 503
    assert failed.json() == {"detail": {"code": "provider_unavailable"}}


def test_vehicle_authoritative_states_cover_empty_to_confirmed_ready():
    assert (
        jobs_api._vehicle_state_from_row(
            _fitment_row(
                vehicle_make=None,
                vehicle_model=None,
                vehicle_year=None,
                vehicle_market=None,
                vehicle_field_provenance={},
            )
        )
        == "empty"
    )
    assert jobs_api._vehicle_state_from_row(_fitment_row()) == "unconfirmed"
    assert (
        jobs_api._vehicle_state_from_row(_confirmed_vehicle_row(vehicle_year=None))
        == "confirmed_incomplete"
    )
    assert jobs_api._vehicle_state_from_row(_confirmed_vehicle_row()) == "confirmed_ready"
    assert jobs_api._vehicle_state_from_row(_fitment_row()) != "confirmed_ready"


def test_vehicle_variants_return_no_match_single_and_multiple_without_selection(monkeypatch):
    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return _confirmed_vehicle_row()

        async def execute(self, *_args):
            return "UPDATE 1"

    outcomes: list[list[dict[str, str]]] = [
        [],
        [
            {
                "generation": "E3",
                "modification": "3.0 V6",
                "body": "SUV",
                "market": "russia",
                "make_slug": "porsche",
                "model_slug": "cayenne",
                "region": "russia",
                "generation_slug": "e3",
                "modification_slug": "v6",
            }
        ],
        [
            {
                "generation": "E3",
                "modification": "3.0 V6",
                "body": "SUV",
                "market": "russia",
                "make_slug": "porsche",
                "model_slug": "cayenne",
                "region": "russia",
                "generation_slug": "e3",
                "modification_slug": "v6",
            },
            {
                "generation": "E3",
                "modification": "4.0 V8",
                "body": "SUV",
                "market": "russia",
                "make_slug": "porsche",
                "model_slug": "cayenne",
                "region": "russia",
                "generation_slug": "e3",
                "modification_slug": "v8",
            },
        ],
    ]

    async def variants(_self, _identity):
        return outcomes.pop(0)

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants", variants)
    path = "/jobs/11111111-1111-4111-8111-111111111111/fitment/vehicle-variants"

    for outcome, total in (("no_match", 0), ("single", 1), ("multiple", 2)):
        response = client.post(path)
        assert response.status_code == 200
        body = response.json()
        assert body["outcome"] == outcome
        assert body["total_count"] == total
        assert body["has_more"] is False
        assert "selection_source" not in body


def test_vehicle_save_validates_exact_selection_then_lookup_uses_saved_revision(monkeypatch):
    execute_calls: list[tuple[str, tuple]] = []
    saved_row = _confirmed_vehicle_row(
        vehicle_make="Porsche",
        vehicle_model="Cayenne",
        vehicle_year=2021,
        vehicle_market="russia",
        vehicle_generation=None,
        vehicle_modification=None,
        vehicle_provider_mappings={
            "wheel_size": {
                "make_slug": "porsche",
                "model_slug": "cayenne",
                "region": "russia",
            }
        },
        vehicle_revision=2,
    )
    rows = [
        _confirmed_vehicle_row(vehicle_provider_mappings={"wheel_size": {"old": "x"}}),
        saved_row,
    ]

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return rows.pop(0)

        async def execute(self, query: str, *args):
            execute_calls.append((query, args))
            return "UPDATE 1"

    async def exact_selection(_provider, *, make, model, region, year):
        assert (make, model, region, year) == ("Porsche", "Cayenne", "russia", 2021)
        return {
            "make": "Porsche",
            "model": "Cayenne",
            "year": 2021,
            "region": "russia",
            "make_slug": "porsche",
            "model_slug": "cayenne",
        }

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api, "_resolve_exact_vehicle_catalogue_selection", exact_selection)
    path = "/jobs/11111111-1111-4111-8111-111111111111/fitment"
    saved = client.patch(
        path,
        json={
            "vehicle": {
                "make": "Porsche",
                "model": "Cayenne",
                "year": 2021,
                "market": "russia",
            },
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )

    assert saved.status_code == 200
    assert saved.json()["vehicle_revision"] == 2
    vehicle_update = execute_calls[0][1]
    assert vehicle_update[4:6] == (None, None)
    assert json.loads(vehicle_update[9])["wheel_size"] == {
        "make_slug": "porsche",
        "model_slug": "cayenne",
        "region": "russia",
    }
    assert vehicle_update[10] == 1

    async def exact_variants(_self, *, make_slug, model_slug, region, year):
        assert (make_slug, model_slug, region, year) == ("porsche", "cayenne", "russia", 2021)
        return []

    class LookupConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return saved_row

        async def execute(self, *_args):
            return "UPDATE 1"

    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants_exact", exact_variants)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(LookupConn()))
    lookup = client.post(f"{path}/vehicle-variants")
    assert lookup.status_code == 200
    assert lookup.json()["vehicle_revision"] == 2
    assert lookup.json()["outcome"] == "no_match"


def test_vehicle_save_failure_never_calls_modification_lookup(monkeypatch):
    execute_calls: list[tuple[str, tuple]] = []

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def fetchrow(self, *_args):
            return _fitment_row()

        async def execute(self, query: str, *args):
            execute_calls.append((query, args))
            return "UPDATE 1"

    calls = {"lookup": 0}

    async def lookup_called(*_args, **_kwargs):
        calls["lookup"] += 1
        return []

    async def no_data(*_args, **_kwargs):
        return None

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))
    monkeypatch.setattr(jobs_api, "_resolve_exact_vehicle_catalogue_selection", no_data)
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants", lookup_called)
    response = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "vehicle": {"make": "Porsche", "model": "Cayenne", "year": 2021, "market": "russia"},
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )
    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "validation_error", "reason": "no_data"}}
    assert execute_calls == []
    assert calls["lookup"] == 0

    async def unavailable_save(*_args, **_kwargs):
        raise ProviderError("wheel-size HTTP 503 on /regions")

    monkeypatch.setattr(jobs_api, "_resolve_exact_vehicle_catalogue_selection", unavailable_save)
    failed = client.patch(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment",
        json={
            "vehicle": {"make": "Porsche", "model": "Cayenne", "year": 2021, "market": "russia"},
            "expected_vehicle_revision": 1,
            "expected_rim_revision": 1,
        },
    )
    assert failed.status_code == 503
    assert failed.json() == {"detail": {"code": "provider_unavailable"}}
    assert execute_calls == []
    assert calls["lookup"] == 0


def _provider_variant(
    *, generation: str, modification: str, modification_slug: str
) -> dict[str, str]:
    return {
        "make_slug": "porsche",
        "model_slug": "cayenne",
        "region": "russia",
        "generation": generation,
        "modification": modification,
        "body": "SUV",
        "market": "russia",
        "generation_slug": generation.casefold(),
        "modification_slug": modification_slug,
    }


class MutableModificationConn:
    def __init__(self, row: dict):
        self.row = row
        self.events: list[tuple[str, tuple]] = []
        self.vehicle_updates = 0

    def transaction(self):
        return FakeTransaction()

    async def fetchrow(self, *_args):
        return self.row

    async def execute(self, query: str, *args):
        if "UPDATE vehicle_identities" in query:
            self.row["vehicle_generation"] = args[0]
            self.row["vehicle_modification"] = args[1]
            self.row["vehicle_body"] = args[2]
            self.row["vehicle_provider_mappings"] = json.loads(args[3])
            self.row["vehicle_provider_mapping_revision"] = (
                self.row.get("vehicle_provider_mapping_revision", 0) + 1
            )
            self.vehicle_updates += 1
            return "UPDATE 1"
        if "INSERT INTO fitment_change_events" in query:
            self.events.append((query, args))
            return "INSERT 0 1"
        raise AssertionError(query)


def _catalogued_vehicle_row(**overrides) -> dict:
    row = _confirmed_vehicle_row(
        vehicle_make="Porsche",
        vehicle_model="Cayenne",
        vehicle_year=2021,
        vehicle_market="russia",
        vehicle_generation=None,
        vehicle_modification=None,
        vehicle_body=None,
        vehicle_revision=10,
        vehicle_provider_mappings={
            "wheel_size": {
                "make_slug": "porsche",
                "model_slug": "cayenne",
                "region": "russia",
            }
        },
    )
    row.update(overrides)
    return row


def test_modification_multiple_never_selects_first_then_user_selection_confirms(monkeypatch):
    variants = [
        _provider_variant(generation="E3", modification="3.0 V6", modification_slug="v6"),
        _provider_variant(generation="E3", modification="4.0 V8", modification_slug="v8"),
        _provider_variant(generation="E3", modification="Turbo GT", modification_slug="turbo-gt"),
    ]
    conn = MutableModificationConn(_catalogued_vehicle_row())

    async def lookup(_self, *, make_slug, model_slug, region, year):
        assert (make_slug, model_slug, region, year) == ("porsche", "cayenne", "russia", 2021)
        return variants

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(conn))
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants_exact", lookup)
    path = "/jobs/11111111-1111-4111-8111-111111111111/fitment"

    listed = client.post(f"{path}/vehicle-variants")
    assert listed.status_code == 200
    assert listed.json()["outcome"] == "multiple"
    overview = client.get(path).json()
    assert overview["modification_state"] == "suggested"
    assert overview["selection_source"] is None
    assert overview["selected_modification"] is None
    assert conn.row["vehicle_generation"] is None
    assert conn.row["vehicle_modification"] is None
    assert "selected_modification" not in conn.row["vehicle_provider_mappings"]["wheel_size"]

    selected = client.post(
        f"{path}/vehicle-variants/apply",
        json={
            "expected_vehicle_revision": 10,
            "generation": "E3",
            "modification": "4.0 V8",
            "body": "SUV",
            "market": "russia",
        },
    )
    assert selected.status_code == 200
    body = selected.json()
    assert body["modification_state"] == "confirmed"
    assert body["selection_source"] == "user"
    assert body["modification_vehicle_revision"] == 10
    assert body["selected_modification"]["modification_slug"] == "v8"
    assert conn.row["vehicle_provider_mappings"]["wheel_size"]["selection_source"] == "user"


def test_single_auto_confirm_is_idempotent_and_no_match_clears_current_selection(monkeypatch):
    single = [_provider_variant(generation="E3", modification="3.0 V6", modification_slug="v6")]
    conn = MutableModificationConn(_catalogued_vehicle_row())
    provider_results = [single, single, []]

    async def lookup(_self, **_kwargs):
        return provider_results.pop(0)

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(conn))
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants_exact", lookup)
    path = "/jobs/11111111-1111-4111-8111-111111111111/fitment"

    first = client.post(f"{path}/vehicle-variants")
    assert first.status_code == 200
    assert client.get(path).json()["selection_source"] == "wheel_size_single"
    assert (
        conn.row["vehicle_provider_mappings"]["wheel_size"]["modification_vehicle_revision"] == 10
    )
    assert conn.vehicle_updates == 1

    repeated = client.post(f"{path}/vehicle-variants")
    assert repeated.status_code == 200
    assert conn.vehicle_updates == 1

    no_match = client.post(f"{path}/vehicle-variants")
    assert no_match.status_code == 200
    overview = client.get(path).json()
    assert overview["modification_state"] == "none"
    assert overview["selection_source"] is None
    assert overview["selected_modification"] is None


def test_modification_stale_revision_and_provider_failure_never_resurrect_selection(monkeypatch):
    single = [_provider_variant(generation="E3", modification="3.0 V6", modification_slug="v6")]
    old_row = _catalogued_vehicle_row()
    changed_row = _catalogued_vehicle_row(
        vehicle_year=2022,
        vehicle_revision=11,
        vehicle_provider_mappings={
            "wheel_size": {"make_slug": "porsche", "model_slug": "cayenne", "region": "russia"}
        },
    )

    class RaceConn(MutableModificationConn):
        def __init__(self):
            super().__init__(old_row)
            self.reads = 0

        async def fetchrow(self, *_args):
            self.reads += 1
            return old_row if self.reads == 1 else changed_row

    race_conn = RaceConn()

    async def lookup(_self, **_kwargs):
        return single

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(race_conn))
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants_exact", lookup)
    path = "/jobs/11111111-1111-4111-8111-111111111111/fitment"
    stale_lookup = client.post(f"{path}/vehicle-variants")
    assert stale_lookup.status_code == 409
    assert stale_lookup.json() == {"detail": {"code": "vehicle_revision_conflict"}}
    assert race_conn.vehicle_updates == 0
    assert jobs_api._modification_from_row(changed_row)[0] == "none"

    confirmed_mapping = {
        "make_slug": "porsche",
        "model_slug": "cayenne",
        "region": "russia",
        "generation_slug": "e3",
        "modification_slug": "v6",
        "modification_state": "confirmed",
        "selection_source": "user",
        "modification_vehicle_revision": 10,
        "selected_modification": single[0],
    }
    stable_row = _catalogued_vehicle_row(
        vehicle_provider_mappings={"wheel_size": confirmed_mapping},
        vehicle_generation="E3",
        vehicle_modification="3.0 V6",
        vehicle_body="SUV",
    )
    stable_conn = MutableModificationConn(stable_row)

    async def unavailable(_self, **_kwargs):
        raise ProviderError("wheel-size HTTP 503 on /years")

    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(stable_conn))
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants_exact", unavailable)
    failed = client.post(f"{path}/vehicle-variants")
    assert failed.status_code == 503
    assert jobs_api._modification_from_row(stable_row)[:2] == ("confirmed", "user")
    assert stable_conn.vehicle_updates == 0


def test_explicit_modification_apply_rejects_stale_candidate_revision(monkeypatch):
    candidate = _provider_variant(generation="E3", modification="4.0 V8", modification_slug="v8")
    suggested_row = _catalogued_vehicle_row(
        vehicle_provider_mappings={
            "wheel_size": {
                "make_slug": "porsche",
                "model_slug": "cayenne",
                "region": "russia",
                "modification_state": "suggested",
                "modification_vehicle_revision": 10,
            }
        }
    )
    changed_row = _catalogued_vehicle_row(
        vehicle_year=2022,
        vehicle_revision=11,
        vehicle_provider_mappings={
            "wheel_size": {"make_slug": "porsche", "model_slug": "cayenne", "region": "russia"}
        },
    )

    class ApplyRaceConn(MutableModificationConn):
        def __init__(self):
            super().__init__(suggested_row)
            self.reads = 0

        async def fetchrow(self, *_args):
            self.reads += 1
            return suggested_row if self.reads == 1 else changed_row

    conn = ApplyRaceConn()

    async def lookup(_self, **_kwargs):
        return [candidate]

    _patch_auth(monkeypatch)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(conn))
    monkeypatch.setattr(jobs_api.WheelSizeProvider, "find_vehicle_variants_exact", lookup)
    response = client.post(
        "/jobs/11111111-1111-4111-8111-111111111111/fitment/vehicle-variants/apply",
        json={
            "expected_vehicle_revision": 10,
            "generation": "E3",
            "modification": "4.0 V8",
            "body": "SUV",
            "market": "russia",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "vehicle_revision_conflict"}}
    assert conn.vehicle_updates == 0
    assert jobs_api._modification_from_row(changed_row)[0] == "none"


def test_each_core_vehicle_change_invalidates_current_modification(monkeypatch):
    selected = _provider_variant(generation="E3", modification="3.0 V6", modification_slug="v6")
    confirmed_mapping = {
        "make_slug": "porsche",
        "model_slug": "cayenne",
        "region": "russia",
        "generation_slug": "e3",
        "modification_slug": "v6",
        "modification_state": "confirmed",
        "selection_source": "user",
        "modification_vehicle_revision": 1,
        "selected_modification": selected,
    }

    for field, value in (
        ("make", "Porsche AG"),
        ("model", "Cayenne Coupe"),
        ("year", 2022),
        ("market", "eudm"),
    ):
        before = _catalogued_vehicle_row(
            vehicle_revision=1,
            vehicle_provider_mappings={"wheel_size": confirmed_mapping},
            vehicle_generation="E3",
            vehicle_modification="3.0 V6",
            vehicle_body="SUV",
        )
        after = _catalogued_vehicle_row(
            vehicle_revision=2,
            vehicle_make=value if field == "make" else before["vehicle_make"],
            vehicle_model=value if field == "model" else before["vehicle_model"],
            vehicle_year=value if field == "year" else before["vehicle_year"],
            vehicle_market=value if field == "market" else before["vehicle_market"],
            vehicle_provider_mappings={
                "wheel_size": {
                    "make_slug": "porsche",
                    "model_slug": "cayenne",
                    "region": str(value) if field == "market" else "russia",
                }
            },
            vehicle_generation=None,
            vehicle_modification=None,
            vehicle_body=None,
        )

        class SaveConn:
            def __init__(self, result_rows: list[dict]):
                self.rows = result_rows
                self.execute_calls: list[tuple[str, tuple]] = []

            def transaction(self):
                return FakeTransaction()

            async def fetchrow(self, *_args):
                return self.rows.pop(0)

            async def execute(self, query: str, *args):
                self.execute_calls.append((query, args))
                return "UPDATE 1"

        async def exact_selection(_provider, *, make, model, region, year):
            return {
                "make": make,
                "model": model,
                "year": year,
                "region": region,
                "make_slug": "porsche",
                "model_slug": "cayenne",
            }

        _patch_auth(monkeypatch)
        conn = SaveConn([before, after])
        monkeypatch.setattr(jobs_api.db, "get_pool", lambda conn=conn: FakePool(conn))
        monkeypatch.setattr(jobs_api, "_resolve_exact_vehicle_catalogue_selection", exact_selection)
        response = client.patch(
            "/jobs/11111111-1111-4111-8111-111111111111/fitment",
            json={
                "vehicle": {field: value},
                "expected_vehicle_revision": 1,
                "expected_rim_revision": 1,
            },
        )

        assert response.status_code == 200
        assert response.json()["modification_state"] == "none"
        mapping = json.loads(conn.execute_calls[0][1][9])["wheel_size"]
        assert "selection_source" not in mapping
        assert "selected_modification" not in mapping
        assert conn.execute_calls[0][1][3:6] == (None, None, None)
