import asyncio
import hashlib
from datetime import UTC, datetime
from io import BytesIO

import asyncpg
import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src import assets_service, jobs_api, storage
from src.auth_principal import AuthPrincipal
from src.main import app

JOB = "11111111-1111-4111-8111-111111111111"


def image_bytes(size=(3200, 2400), orientation=None):
    output = BytesIO()
    image = Image.new("RGB", size, "#57936a")
    exif = Image.Exif()
    if orientation:
        exif[274] = orientation
        exif[34853] = {1: "N"}
    image.save(output, format="JPEG", exif=exif)
    return output.getvalue()


@pytest.mark.parametrize(
    "size,orientation,expected",
    [
        ((3200, 2400), None, (1600, 1200)),
        ((3200, 2400), 6, (1200, 1600)),
        ((640, 480), None, (640, 480)),
    ],
)
def test_display_geometry_format_metadata_original_immutable(size, orientation, expected):
    original = image_bytes(size, orientation)
    digest = hashlib.sha256(original).hexdigest()
    display = assets_service.create_car_display(original)
    with Image.open(BytesIO(display)) as image:
        assert image.format == "WEBP"
        assert image.size == expected
        assert not image.getexif()
    assert hashlib.sha256(original).hexdigest() == digest
    assert len(display) < len(original)


@pytest.mark.parametrize("scope", ["job", "draft"])
def test_original_and_display_are_persisted_privately_without_original_mutation(monkeypatch, scope):
    uploaded = []

    async def upload(**kwargs):
        uploaded.append(kwargs)

    monkeypatch.setattr(storage, "upload_bytes", upload)
    original = image_bytes()
    kwargs = {"job_id": JOB} if scope == "job" else {"render_input_draft_id": JOB}

    async def run():
        asset = await assets_service.upload_render_asset(
            owner_user_id=26,
            kind="car_original",
            data=original,
            content_type="image/jpeg",
            **kwargs,
        )
        display = await assets_service.upload_car_display(original=asset, data=original)
        assert display.kind == "car_display"
        assert display.bucket == "raw"
        assert display.public_url is None
        assert (display.width, display.height) == (1600, 1200)
        assert asset.sha256 == hashlib.sha256(original).hexdigest()

    asyncio.run(run())
    assert uploaded[0]["data"] == original
    assert uploaded[1]["content_type"] == "image/webp"
    assert uploaded[1]["bucket"] == "raw"


def test_derivative_failure_is_optional(monkeypatch, caplog):
    asset = assets_service.AssetUpload(
        "asset", 26, JOB, "car_original", "raw", "original.jpg", "image/jpeg", 4, "0" * 64
    )

    def fail(_data):
        raise OSError("decode failed")

    monkeypatch.setattr(assets_service, "create_car_display", fail)
    assert asyncio.run(assets_service.upload_car_display(original=asset, data=b"original")) is None
    assert "car_display_generation_failed" in caplog.text


def test_display_db_failure_savepoint_cleans_storage(monkeypatch):
    calls = []

    class Transaction:
        async def __aenter__(self):
            calls.append("savepoint")

        async def __aexit__(self, *_args):
            calls.append("rollback")

    class Conn:
        def transaction(self):
            return Transaction()

    async def insert(*_args):
        raise asyncpg.CheckViolationError("reject")

    async def delete(asset):
        calls.append(asset.storage_key)

    monkeypatch.setattr(assets_service, "insert_asset", insert)
    monkeypatch.setattr(assets_service, "delete_uploaded_asset", delete)
    asset = assets_service.AssetUpload(
        "asset", 26, JOB, "car_display", "raw", "display.webp", "image/webp", 4, "0" * 64
    )
    asyncio.run(assets_service.insert_optional_car_display(Conn(), asset))
    assert calls == ["savepoint", "rollback", "display.webp"]


class Acquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *_args):
        pass


@pytest.mark.parametrize(
    "owner,kind,exists,status",
    [
        (26, "car_display", True, 200),
        (27, "car_display", True, 404),
        (26, "car_original", True, 200),
        (26, "car_display", False, 404),
        (26, "result", True, 422),
    ],
)
def test_signed_endpoint_owner_kind_and_historical_fallback(
    monkeypatch, owner, kind, exists, status
):
    signed = []

    async def auth(**_kwargs):
        return AuthPrincipal(
            user_id=owner, authority="supabase", subject="test", auth_channel="website"
        )

    class Conn:
        async def fetchrow(self, query, *args):
            assert "assets.owner_user_id = jobs.user_id" in query
            assert "assets.id = jobs.car_asset_id" in query
            assert args == (JOB, owner, kind, "raw")
            return (
                {"bucket": "raw", "storage_key": f"users/26/jobs/{JOB}/{kind}/image.webp"}
                if owner == 26 and exists
                else None
            )

    class Pool:
        def acquire(self):
            return Acquire(Conn())

    async def sign(**kwargs):
        signed.append(kwargs)
        return (
            "https://project.supabase.co/storage/v1/object/sign/raw/image.webp?token=fixture-only"
        )

    monkeypatch.setattr(jobs_api, "_resolve_jobs_auth", auth)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: Pool())
    monkeypatch.setattr(storage, "create_signed_url", sign)
    response = TestClient(app).get(
        f"/jobs/{JOB}/assets/{kind}/signed-url", headers={"Authorization": "Bearer fixture-only"}
    )
    assert response.status_code == status
    if status == 200:
        assert signed[0]["expires_in"] == 600
        assert response.json()["kind"] == kind
        assert response.headers["cache-control"] == "private, no-store"
        assert (
            598
            <= (
                datetime.fromisoformat(response.json()["expires_at"]) - datetime.now(UTC)
            ).total_seconds()
            <= 600
        )
    else:
        assert signed == []


def test_signing_failure_has_safe_error(monkeypatch, caplog):
    async def auth(**_kwargs):
        return AuthPrincipal(
            user_id=26, authority="supabase", subject="test", auth_channel="website"
        )

    class Conn:
        async def fetchrow(self, *_args):
            return {"bucket": "raw", "storage_key": "private.webp"}

    class Pool:
        def acquire(self):
            return Acquire(Conn())

    async def fail(**_kwargs):
        raise storage.StorageError("secret-token-must-not-leak")

    monkeypatch.setattr(jobs_api, "_resolve_jobs_auth", auth)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: Pool())
    monkeypatch.setattr(storage, "create_signed_url", fail)
    response = TestClient(app).get(f"/jobs/{JOB}/assets/car_display/signed-url")
    assert response.status_code == 502
    assert "secret-token" not in response.text + caplog.text


@pytest.mark.parametrize(
    "status,body",
    [
        (200, {"signedURL": "/object/sign/raw/photo.webp?token=fixture-only"}),
        (503, {"error": "private-token"}),
        (200, {"signedURL": "https://foreign.test/?token=private-token"}),
    ],
)
def test_storage_rest_signing_contract_and_safe_failure(monkeypatch, status, body, caplog):
    calls = []

    class Client:
        def __init__(self, **kwargs):
            assert kwargs["timeout"] == 15.0

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            calls.append((url, kwargs))
            return httpx.Response(status, json=body)

    monkeypatch.setattr(storage.httpx, "AsyncClient", Client)
    monkeypatch.setattr(
        storage, "_auth_headers", lambda: {"Authorization": "Bearer service-fixture"}
    )
    monkeypatch.setattr(storage, "SUPABASE_STORAGE_URL", "https://project.supabase.co/storage/v1")
    if status == 200 and body["signedURL"].startswith("/"):
        assert (
            asyncio.run(storage.create_signed_url(bucket="raw", path="photo.webp", expires_in=600))
            == "https://project.supabase.co/storage/v1" + body["signedURL"]
        )
    else:
        with pytest.raises(storage.StorageError) as error:
            asyncio.run(storage.create_signed_url(bucket="raw", path="photo.webp", expires_in=600))
        assert "private-token" not in str(error.value)
    assert calls[0][1]["json"] == {"expiresIn": 600}
    assert "token=" not in caplog.text


def test_display_preserves_png_transparency():
    original = BytesIO()
    Image.new("RGBA", (32, 16), (10, 20, 30, 0)).save(original, format="PNG")
    with Image.open(BytesIO(assets_service.create_car_display(original.getvalue()))) as image:
        assert image.mode == "RGBA"
        assert image.getpixel((0, 0))[3] == 0


def test_display_upload_timeout_cleans_possible_object_and_falls_back(monkeypatch):
    deleted = []

    async def upload(**_kwargs):
        raise httpx.ReadTimeout("Upload acknowledgement timed out")

    async def delete(**kwargs):
        deleted.append(kwargs)

    monkeypatch.setattr(storage, "upload_bytes", upload)
    monkeypatch.setattr(storage, "delete_object", delete)
    original = assets_service.AssetUpload(
        "original", 26, JOB, "car_original", "raw", "original.jpg", "image/jpeg", 4, "0" * 64
    )
    assert (
        asyncio.run(assets_service.upload_car_display(original=original, data=image_bytes()))
        is None
    )
    assert len(deleted) == 1
    assert deleted[0]["bucket"] == "raw"
    assert "/car_display/" in deleted[0]["path"]
