import asyncio
import logging
from io import BytesIO

import pytest
from PIL import Image

from src import assets_service, main, storage


def test_upload_render_asset_uses_durable_user_job_path(monkeypatch):
    uploads: list[dict] = []

    async def fake_upload_bytes(**kwargs):
        uploads.append(kwargs)

    monkeypatch.setattr(storage, "upload_bytes", fake_upload_bytes)

    asset = asyncio.run(
        assets_service.upload_render_asset(
            owner_user_id=77,
            job_id="11111111-1111-1111-1111-111111111111",
            kind="car_original",
            data=b"car-bytes",
            content_type="image/jpeg",
        )
    )

    assert asset.bucket == storage.RAW_BUCKET
    assert asset.storage_key.startswith(
        "users/77/jobs/11111111-1111-1111-1111-111111111111/car_original/"
    )
    assert asset.storage_key.endswith(".jpg")
    assert asset.size_bytes == len(b"car-bytes")
    assert asset.public_url is None
    assert uploads[0]["bucket"] == storage.RAW_BUCKET
    assert uploads[0]["path"] == asset.storage_key


def test_result_asset_gets_public_url(monkeypatch):
    async def fake_upload_bytes(**_kwargs):
        return None

    monkeypatch.setattr(storage, "upload_bytes", fake_upload_bytes)
    asset = asyncio.run(
        assets_service.upload_render_asset(
            owner_user_id=77,
            job_id="11111111-1111-1111-1111-111111111111",
            kind="result",
            data=b"result",
            content_type="image/png",
        )
    )

    assert asset.bucket == storage.RESULTS_BUCKET
    assert asset.public_url == storage.public_url(storage.RESULTS_BUCKET, asset.storage_key)


def test_result_storage_failure_does_not_write_success(monkeypatch):
    class PoolShouldNotBeUsed:
        def acquire(self):
            raise AssertionError("DB must not be touched when result upload fails")

    async def fake_upload_render_asset(**_kwargs):
        raise storage.StorageError("upload failed")

    monkeypatch.setattr(assets_service, "upload_render_asset", fake_upload_render_asset)

    with pytest.raises(storage.StorageError):
        asyncio.run(
            main._save_render_output(
                PoolShouldNotBeUsed(),
                "11111111-1111-1111-1111-111111111111",
                77,
                b"result",
            )
        )


def test_pre_upload_telemetry_logs_size_and_dimensions_without_transforming(monkeypatch, caplog):
    image_buffer = BytesIO()
    Image.new("RGB", (13, 7), color=(12, 34, 56)).save(image_buffer, format="PNG")
    image_bytes = image_buffer.getvalue()
    uploads: list[dict] = []

    async def fake_upload_bytes(**kwargs):
        uploads.append(kwargs)

    monkeypatch.setattr(storage, "upload_bytes", fake_upload_bytes)

    with caplog.at_level(logging.INFO, logger="src.assets_service"):
        asyncio.run(
            assets_service.upload_render_asset(
                owner_user_id=77,
                job_id="11111111-1111-1111-1111-111111111111",
                kind="result",
                data=image_bytes,
                content_type="image/png",
            )
        )

    assert "target_bucket=results" in caplog.text
    assert "content_type=image/png" in caplog.text
    assert "size_bytes=" + str(len(image_bytes)) in caplog.text
    assert "width=13" in caplog.text
    assert "height=7" in caplog.text
    assert uploads[0]["data"] == image_bytes
