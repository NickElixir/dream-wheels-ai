import json
from contextlib import asynccontextmanager
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from src import jobs_api
from src import publications_api as api

JOB = "11111111-1111-4111-8111-111111111111"
IDENT = "a" * 32


def image_bytes():
    output = BytesIO()
    Image.new("RGB", (16, 10), "red").save(output, format="JPEG")
    return output.getvalue()


@pytest.fixture
def setup(monkeypatch):
    records = {}
    source = {
        "status": "completed",
        "output_image_url": "https://example.test/image.jpg",
        "vehicle_make": "Zeekr",
        "vehicle_model": "009",
        "rim_brand": "X-Trike",
        "rim_model": "X-132",
        "render_input_snapshot": {},
    }

    class Connection:
        def transaction(self):
            return self.acquire()

        @asynccontextmanager
        async def acquire(self):
            yield self

        async def fetchval(self, _query, owner, job, fingerprint):
            return next(
                (r["id"] for r in records.values() if r["fingerprint"] == fingerprint), None
            )

        async def fetchrow(self, query, *args):
            if "SELECT * FROM shared_result" in query:
                return records.get(args[0])
            return {"car_image_url": "raw/input.jpg", "display_path": "raw/display.jpg"}

        async def execute(self, query, ident, owner, job, fingerprint, snapshot, original, result):
            records[ident] = dict(
                id=ident,
                fingerprint=fingerprint,
                snapshot=snapshot,
                original_path=original,
                result_path=result,
            )

    conn = Connection()
    monkeypatch.setattr(api.db, "get_pool", lambda: conn)
    monkeypatch.setattr(
        api, "require_auth_principal", AsyncMock(return_value=SimpleNamespace(user_id=10))
    )
    monkeypatch.setattr(api, "enforce_rate_limit", AsyncMock())
    monkeypatch.setattr(
        jobs_api, "_fetch_fitment_job_row", AsyncMock(side_effect=lambda *a, **kw: source)
    )
    monkeypatch.setattr(api, "_fetch_original_bytes", AsyncMock(return_value=image_bytes()))
    monkeypatch.setattr(api, "_fetch_result_bytes", AsyncMock(return_value=image_bytes()))
    monkeypatch.setattr(api.storage, "upload_bytes", AsyncMock())
    monkeypatch.setattr(api.storage, "download_bytes", AsyncMock(return_value=image_bytes()))
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app), source, records


def publish(client):
    return client.post(f"/jobs/{JOB}/publications", headers={"Authorization": "Bearer test"})


def test_owner_snapshot_reuse_change_and_old_page(setup):
    client, source, records = setup
    first = publish(client)
    assert first.status_code == 200
    first_url = first.json()["url"]
    assert publish(client).json()["url"] == first_url
    source["rim_model"] = "New model"
    assert publish(client).json()["url"] != first_url
    assert len(records) == 2
    page = client.get("/p/" + first_url.rsplit("/", 1)[1])
    assert page.status_code == 200
    assert "X-132" in page.text and "New model" not in page.text
    assert "Скопировать ссылку" in page.text
    assert "noindex" in page.headers["X-Robots-Tag"]
    assert "localStorage" not in page.text


def test_missing_credentials_cannot_publish(setup):
    client, _, records = setup
    assert client.post(f"/jobs/{JOB}/publications").status_code == 401
    assert not records


def test_foreign_job_denied(setup, monkeypatch):
    client, _, records = setup
    lookup = AsyncMock(return_value=None)
    monkeypatch.setattr(jobs_api, "_fetch_fitment_job_row", lookup)
    assert publish(client).status_code == 404
    assert lookup.call_args.kwargs["user_id"] == 10
    assert not records


@pytest.mark.parametrize("status", ["queued", "processing", "failed"])
def test_only_completed_results_publish(setup, status):
    client, source, records = setup
    source["status"] = status
    assert publish(client).status_code == 409
    assert not records


def test_upload_failure_never_publishes(setup, monkeypatch):
    client, _, records = setup
    monkeypatch.setattr(
        api.storage, "upload_bytes", AsyncMock(side_effect=api.storage.StorageError("no"))
    )
    assert publish(client).status_code == 502
    assert not records


def test_public_assets_and_download_need_no_auth(setup):
    client, _, _ = setup
    ident = publish(client).json()["url"].rsplit("/", 1)[1]
    for asset in ["original.jpg", "result.jpg", "download"]:
        response = client.get(f"/p/{ident}/{asset}")
        assert response.status_code == 200
        assert response.headers["Content-Type"] == "image/jpeg"
    assert "attachment" in response.headers["Content-Disposition"]
    assert client.get(f"/p/{ident}/snapshot").status_code == 404
    assert client.get("/p/" + "z" * 32).status_code == 404
    assert client.get("/p/bad").status_code == 404


def test_snapshot_whitelists_fields_and_escapes_script(setup):
    client, source, _ = setup
    source["rim_model"] = "</script><script>alert(1)</script>"
    source["vehicle_provider_mappings"] = {"secret": "private"}
    source["render_input_snapshot"] = {"email": "private@test", "rim": {"product_url": "private"}}
    snapshot = api.publication_snapshot(source)
    assert "private" not in json.dumps(snapshot)
    ident = publish(client).json()["url"].rsplit("/", 1)[1]
    page = client.get("/p/" + ident)
    assert "</script><script>alert" not in page.text
    assert "og:image" in page.text


def test_public_jpeg_is_valid_and_strips_exif():
    result = api._public_jpeg(image_bytes())
    with Image.open(BytesIO(result)) as image:
        assert image.format == "JPEG"
        assert not image.getexif()


def test_account_linking_moves_publication_ownership(monkeypatch):
    from src import account_linking_service

    connection = SimpleNamespace(execute=AsyncMock())
    monkeypatch.setattr(
        account_linking_service,
        "_relation_exists",
        AsyncMock(side_effect=lambda conn, name: name == "shared_result_publications"),
    )
    import asyncio

    asyncio.run(
        account_linking_service._move_owned_rows(connection, survivor_user_id=1, source_user_id=2)
    )
    connection.execute.assert_awaited_once_with(
        "UPDATE shared_result_publications SET owner_user_id = $1 WHERE owner_user_id = $2", 1, 2
    )
