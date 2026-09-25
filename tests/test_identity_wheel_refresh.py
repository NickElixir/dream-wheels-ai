"""Draft-bound wheel URL refresh tests for the existing identity endpoint."""

import copy
import json
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src import assets_service, identity_api
from src.auth_principal import AuthPrincipal
from src.main import app
from src.rim_url_resolver import (
    RimProductImage,
    RimUrlCandidate,
    RimUrlConflict,
    RimUrlError,
    RimUrlVariant,
)

client = TestClient(app)
DRAFT_ID = "11111111-1111-4111-8111-111111111111"
CAR_ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OLD_RIM_ASSET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
NEW_RIM_ASSET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"


def _proposal() -> dict:
    return {
        "vehicle": {
            "status": "resolved",
            "primary": {
                "make": "Lexus",
                "model": "RX",
                "year": 2020,
                "confidence": 0.91,
                "source": "vlm_visual",
            },
            "alternatives": [],
            "metadata": {
                "provider": "vehicle-provider",
                "model": "vehicle-model",
                "prompt_version": "prompt-1",
                "resolver_version": "vehicle-resolver-v1",
                "normalized_input_sha256": "a" * 64,
                "captured_at": "2026-09-25T10:00:00Z",
            },
        },
        "rim": {
            "status": "manual_required",
            "product_url": "https://shop.example.test/old-wheel",
            "brand": "Old Brand",
            "revision": 3,
        },
        "resolver": "vehicle-resolver-v1",
    }


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Acquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _DraftConn:
    def __init__(self, *, available=True, concurrent_proposal=None):
        self.available = available
        self.proposal = _proposal()
        self.rim_asset_id = OLD_RIM_ASSET_ID
        self.car_asset_id = CAR_ASSET_ID
        self.asset_inserts = []
        self.draft_updates = []
        self.other_writes = []
        self.concurrent_proposal = concurrent_proposal
        self.fetchrow_calls = 0

    def transaction(self):
        return _Transaction()

    async def fetchrow(self, query: str, *_args):
        assert "FROM render_input_drafts" in query
        assert "status = 'resolved'" in query
        assert "expires_at > CURRENT_TIMESTAMP" in query
        if not self.available:
            return None
        self.fetchrow_calls += 1
        proposal = self.proposal
        if "FOR UPDATE" in query and self.concurrent_proposal is not None:
            proposal = self.concurrent_proposal
        return {
            "draft_id": DRAFT_ID,
            "car_asset_id": self.car_asset_id,
            "rim_asset_id": self.rim_asset_id,
            "identity_proposal": copy.deepcopy(proposal),
        }

    async def fetchval(self, query: str, *args):
        assert "UPDATE render_input_drafts" in query
        self.rim_asset_id = args[0]
        self.proposal = json.loads(args[1])
        self.draft_updates.append((args[0], self.proposal))
        return DRAFT_ID

    async def execute(self, query: str, *args):
        self.other_writes.append((query, args))
        return "UPDATE 1"


class _Pool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return _Acquire(self.conn)


def _png() -> bytes:
    image = Image.new("RGB", (320, 240), color=(24, 32, 40))
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _resolution(url: str, *, variants=(), selection_required=False, selected_sku=None, values=None):
    return type(
        "Resolution",
        (),
        {
            "requested_url": url,
            "final_url": url,
            "values": values
            or {
                "brand": "BBS",
                "model": "CH-R",
                "sku": "CHR-01",
                "wheel_diameter_in": 19.0,
                "wheel_width_j": 8.5,
                "bolt_count": 5,
                "pcd_mm": 112.0,
                "offset_et_mm": 35.0,
            },
            "candidates": (
                RimUrlCandidate("brand", "BBS", "json_ld", 0.95),
                RimUrlCandidate("model", "CH-R", "json_ld", 0.95),
                RimUrlCandidate("sku", "CHR-01", "json_ld", 0.95),
                RimUrlCandidate("wheel_diameter_in", 19.0, "html_specifications", 0.94),
                RimUrlCandidate("wheel_width_j", 8.5, "html_specifications", 0.94),
                RimUrlCandidate("bolt_count", 5, "html_specifications", 0.94),
                RimUrlCandidate("pcd_mm", 112.0, "html_specifications", 0.94),
                RimUrlCandidate("offset_et_mm", 35.0, "html_specifications", 0.94),
                RimUrlCandidate("center_bore_mm", 66.6, "json_ld", 0.95),
                RimUrlCandidate("center_bore_mm", 67.1, "html_specifications", 0.94),
            ),
            "conflicts": (
                RimUrlConflict(
                    "center_bore_mm",
                    (
                        RimUrlCandidate("center_bore_mm", 66.6, "json_ld", 0.95),
                        RimUrlCandidate("center_bore_mm", 67.1, "html_specifications", 0.94),
                    ),
                ),
            ),
            "image_urls": ("https://cdn.example.test/rim.png",),
            "source_fingerprint": "f" * 64,
            "variants": variants,
            "selection_required": selection_required,
            "selected_variant_sku": selected_sku,
        },
    )()


def _install_auth_and_rate_limit(monkeypatch, *, user_id=77):
    async def fake_require_auth_principal(_conn, **_kwargs):
        return AuthPrincipal(
            user_id=user_id,
            authority="telegram",
            subject=str(user_id),
            auth_channel="mini_app",
        )

    async def fake_rate_limit(**_kwargs):
        return None

    monkeypatch.setattr(identity_api, "require_auth_principal", fake_require_auth_principal)
    monkeypatch.setattr(identity_api, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(identity_api, "RIM_URL_RESOLVER_ENABLED", True)


def _install_successful_image(monkeypatch):
    uploaded = []

    async def fake_fetch_image(*_args, **_kwargs):
        return RimProductImage(data=_png(), content_type="image/png")

    async def fake_upload(**kwargs):
        uploaded.append(kwargs)
        return assets_service.AssetUpload(
            id=NEW_RIM_ASSET_ID,
            owner_user_id=kwargs["owner_user_id"],
            job_id=None,
            kind="rim_original",
            bucket="raw",
            storage_key=f"users/{kwargs['owner_user_id']}/drafts/{kwargs['render_input_draft_id']}/rim_original/new.jpg",
            content_type=kwargs["content_type"],
            size_bytes=len(kwargs["data"]),
            sha256="c" * 64,
            render_input_draft_id=kwargs["render_input_draft_id"],
        )

    async def fake_insert(_conn, asset):
        _conn.asset_inserts.append(asset)

    async def fake_delete(asset):
        raise AssertionError(f"successful refresh deleted asset {asset.id}")

    monkeypatch.setattr(identity_api, "fetch_public_rim_image", fake_fetch_image)
    monkeypatch.setattr(identity_api.assets_service, "upload_render_asset", fake_upload)
    monkeypatch.setattr(identity_api.assets_service, "insert_asset", fake_insert)
    monkeypatch.setattr(identity_api.assets_service, "delete_uploaded_asset", fake_delete)
    return uploaded


def test_wheel_url_refresh_reuses_draft_skips_vehicle_vlm_and_persists_asset(monkeypatch):
    _install_auth_and_rate_limit(monkeypatch)
    conn = _DraftConn()
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))
    uploaded = _install_successful_image(monkeypatch)
    resolver_calls = []

    async def fake_resolve(url, **_kwargs):
        return _resolution(url)

    def forbidden_vehicle_resolver():
        resolver_calls.append("called")
        raise AssertionError("wheel-only URL refresh must not resolve the vehicle")

    monkeypatch.setattr(identity_api, "resolve_rim_product_url", fake_resolve)
    monkeypatch.setattr(identity_api, "get_vehicle_identity_resolver", forbidden_vehicle_resolver)

    response = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "https://shop.example.test/new-wheel",
            "vehicle": json.dumps(
                {
                    "make": "Lexus",
                    "model": "RX 450h",
                    "year": 2020,
                    "confidence": 1.0,
                    "source": "user_edited",
                }
            ),
            "vehicle_user_confirmed": "true",
            "init_data": "unused",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["draft_id"] == DRAFT_ID
    assert body["car_asset_id"] == CAR_ASSET_ID
    assert body["rim_asset_id"] == NEW_RIM_ASSET_ID
    original_vehicle = identity_api.identity_service.parse_identity_proposal(
        _proposal()
    ).vehicle.model_dump(mode="json")
    assert body["vehicle"] == original_vehicle
    assert body["confirmed_vehicle"]["model"] == "RX 450h"
    assert body["resolver"] == "vehicle-resolver-v1"
    assert body["rim"]["revision"] == 4
    assert body["rim"]["product_url"] == "https://shop.example.test/new-wheel"
    assert body["rim"]["brand"] == "BBS"
    assert body["rim"]["model"] == "CH-R"
    assert body["rim"]["sku"] == "CHR-01"
    assert body["rim"]["wheel_diameter_in"] == 19
    assert body["rim"]["wheel_width_j"] == 8.5
    assert body["rim"]["pcd_mm"] == 112
    assert body["rim"]["offset_et_mm"] == 35
    assert body["rim"]["center_bore_mm"] is None
    assert body["rim"]["conflicts"][0]["field"] == "center_bore_mm"
    assert len(body["rim"]["conflicts"][0]["candidates"]) == 2
    assert body["rim"]["field_candidates"]["brand"][0]["source"] == "json_ld"
    assert body["rim"]["variant_state"] == "none"
    assert body["rim"]["selected_variant_sku"] is None
    assert uploaded[0]["kind"] == "rim_original"
    assert uploaded[0]["content_type"] == "image/jpeg"
    assert uploaded[0]["data"].startswith(b"\xff\xd8")
    assert conn.rim_asset_id == NEW_RIM_ASSET_ID
    assert conn.proposal["vehicle"] == original_vehicle
    assert conn.proposal["confirmed_vehicle"]["model"] == "RX 450h"
    assert conn.proposal["rim"]["revision"] == 4
    assert len(conn.asset_inserts) == 1
    assert resolver_calls == []
    assert not conn.other_writes  # no render snapshots, jobs, or Fitment history touched


def test_wheel_url_refresh_preserves_variant_selection_required_without_exact_specs(monkeypatch):
    _install_auth_and_rate_limit(monkeypatch)
    conn = _DraftConn()
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))
    _install_successful_image(monkeypatch)
    withheld = {"brand": "BBS", "model": "CH-R"}
    variants = (
        RimUrlVariant("CHR-01", {"sku": "CHR-01", "wheel_diameter_in": 19.0}, ()),
        RimUrlVariant("CHR-02", {"sku": "CHR-02", "wheel_diameter_in": 20.0}, ()),
    )

    async def resolve(url, **_kwargs):
        return _resolution(url, variants=variants, selection_required=True, values=withheld)

    monkeypatch.setattr(identity_api, "resolve_rim_product_url", resolve)
    response = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "https://shop.example.test/variants",
            "init_data": "unused",
        },
    )

    assert response.status_code == 200
    rim = response.json()["rim"]
    assert rim["status"] == "resolved"  # source parsed; exact commercial choice remains separate
    assert rim["variant_state"] == "selection_required"
    assert rim["selected_variant_sku"] is None
    for field in (
        "sku",
        "wheel_diameter_in",
        "wheel_width_j",
        "pcd_mm",
        "center_bore_mm",
        "offset_et_mm",
    ):
        assert rim[field] is None
    assert rim["brand"] == "BBS" and rim["model"] == "CH-R"


def test_wheel_url_refresh_marks_resolver_selected_variant(monkeypatch):
    _install_auth_and_rate_limit(monkeypatch)
    conn = _DraftConn()
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))
    _install_successful_image(monkeypatch)
    variants = (RimUrlVariant("CHR-01", {"sku": "CHR-01"}, ()),)

    async def resolve(url, **_kwargs):
        return _resolution(
            url,
            variants=variants,
            selection_required=False,
            selected_sku="CHR-01",
            values={"brand": "BBS", "model": "CH-R", "sku": "CHR-01", "wheel_diameter_in": 19.0},
        )

    monkeypatch.setattr(identity_api, "resolve_rim_product_url", resolve)
    response = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "https://shop.example.test/one",
            "init_data": "unused",
        },
    )
    assert response.status_code == 200
    rim = response.json()["rim"]
    assert rim["variant_state"] == "selected"
    assert rim["selected_variant_sku"] == "CHR-01"
    assert rim["sku"] == "CHR-01"
    assert rim["wheel_diameter_in"] == 19


def test_wheel_url_refresh_marks_single_variant_without_sku_as_selected(monkeypatch):
    _install_auth_and_rate_limit(monkeypatch)
    conn = _DraftConn()
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))
    _install_successful_image(monkeypatch)
    variants = (RimUrlVariant(None, {"wheel_diameter_in": 19.0}, ()),)

    async def resolve(url, **_kwargs):
        return _resolution(
            url,
            variants=variants,
            selection_required=False,
            selected_sku=None,
            values={"brand": "BBS", "model": "CH-R", "wheel_diameter_in": 19.0},
        )

    monkeypatch.setattr(identity_api, "resolve_rim_product_url", resolve)
    response = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "https://shop.example.test/one-no-sku",
            "init_data": "unused",
        },
    )

    assert response.status_code == 200
    rim = response.json()["rim"]
    assert rim["variant_state"] == "selected"
    assert rim["selected_variant_sku"] is None
    assert rim["wheel_diameter_in"] == 19


def test_wheel_url_refresh_cleans_uploaded_asset_after_optimistic_conflict(monkeypatch):
    _install_auth_and_rate_limit(monkeypatch)
    stale = _proposal()
    newer = copy.deepcopy(stale)
    newer["rim"]["revision"] = 4
    conn = _DraftConn(concurrent_proposal=newer)
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))
    _install_successful_image(monkeypatch)
    deleted = []

    async def record_delete(asset):
        deleted.append(asset.id)

    async def resolve(url, **_kwargs):
        return _resolution(url)

    monkeypatch.setattr(identity_api, "resolve_rim_product_url", resolve)
    monkeypatch.setattr(identity_api.assets_service, "delete_uploaded_asset", record_delete)
    response = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "https://shop.example.test/race",
            "init_data": "unused",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "identity_draft_rim_revision_conflict"
    assert deleted == [NEW_RIM_ASSET_ID]
    assert conn.rim_asset_id == OLD_RIM_ASSET_ID
    assert conn.proposal == stale
    assert conn.asset_inserts == []
    assert conn.draft_updates == []
    assert conn.other_writes == []  # no render jobs/snapshots or Fitment history mutation


def test_wheel_url_failure_preserves_draft_and_a_different_url_can_retry(monkeypatch):
    _install_auth_and_rate_limit(monkeypatch)
    conn = _DraftConn()
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))
    _install_successful_image(monkeypatch)
    resolver_urls = []

    async def resolve(url, **_kwargs):
        resolver_urls.append(url)
        if url.endswith("unavailable"):
            raise RimUrlError("temporary provider failure", reason_code="rim_source_fetch_failed")
        return _resolution(url)

    monkeypatch.setattr(identity_api, "resolve_rim_product_url", resolve)

    failed = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "https://shop.example.test/unavailable",
            "init_data": "unused",
        },
    )
    assert failed.status_code == 503
    assert failed.json()["detail"]["error_code"] == "rim_source_fetch_failed"
    assert failed.json()["detail"]["manual_fallback"] is True
    assert conn.rim_asset_id == OLD_RIM_ASSET_ID
    assert conn.proposal == _proposal()

    retried = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "https://shop.example.test/retry",
            "init_data": "unused",
        },
    )
    assert retried.status_code == 200
    assert retried.json()["rim"]["product_url"] == "https://shop.example.test/retry"
    assert retried.json()["rim"]["revision"] == 4
    assert resolver_urls == [
        "https://shop.example.test/unavailable",
        "https://shop.example.test/retry",
    ]


@pytest.mark.parametrize(
    "user_id",
    [
        pytest.param(77, id="missing"),
        pytest.param(88, id="foreign-owner"),
        pytest.param(77, id="expired-or-not-resolved"),
    ],
)
def test_wheel_url_refresh_rejects_missing_foreign_or_expired_draft(monkeypatch, user_id):
    _install_auth_and_rate_limit(monkeypatch, user_id=user_id)
    conn = _DraftConn(available=False)
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))
    response = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "https://shop.example.test/rim",
            "init_data": "unused",
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"]["error_code"] == "identity_draft_unavailable"
    assert not conn.draft_updates


def test_wheel_url_refresh_rejects_invalid_source_as_operational_error(monkeypatch):
    _install_auth_and_rate_limit(monkeypatch)
    conn = _DraftConn()
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))

    async def reject_url(_url, **_kwargs):
        raise RimUrlError("not public HTTPS", reason_code="rim_source_url_rejected")

    monkeypatch.setattr(identity_api, "resolve_rim_product_url", reject_url)
    response = client.post(
        "/identity/resolve",
        data={
            "draft_id": DRAFT_ID,
            "rim_product_url": "http://127.0.0.1/rim",
            "init_data": "unused",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["error_code"] == "rim_source_url_rejected"
    assert response.json()["detail"]["manual_fallback"] is True
    assert "verdict" not in str(response.json()).lower()
    assert conn.proposal == _proposal()
