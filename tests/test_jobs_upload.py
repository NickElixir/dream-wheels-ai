import asyncio
from io import BytesIO

from starlette.datastructures import Headers, UploadFile

from src import assets_service, jobs_api
from src.auth_principal import AuthPrincipal


def test_upload_job_inserts_job_before_assets_and_links_asset_ids(monkeypatch):
    calls: list[tuple[str, object]] = []

    class FakeRedis:
        def __init__(self):
            self.values: dict[str, str] = {}
            self.queue_payloads: list[tuple[str, str]] = []

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

        async def rpush(self, key: str, payload: str):
            self.queue_payloads.append((key, payload))

    class FakeTransaction:
        async def __aenter__(self):
            calls.append(("tx_enter", None))
            return self

        async def __aexit__(self, exc_type, exc, tb):
            calls.append(("tx_exit", exc_type))
            return False

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

        async def execute(self, query: str, *args):
            normalized = " ".join(query.split())
            if normalized.startswith("INSERT INTO jobs"):
                calls.append(("insert_job", args))
                return "INSERT 0 1"
            if normalized.startswith(
                "UPDATE jobs SET car_asset_id = $1::uuid, rim_asset_id = $2::uuid"
            ):
                calls.append(("link_job_assets", args))
                return "UPDATE 1"
            raise AssertionError(f"Unexpected query: {normalized}")

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    async def fake_enforce_rate_limit(**_kwargs):
        return None

    async def fake_require_auth_principal(_conn, **_kwargs):
        calls.append(("resolve_principal", None))
        return AuthPrincipal(
            user_id=77,
            authority="telegram",
            subject="123456",
            auth_channel="mini_app",
            telegram_username="staging_user",
        )

    async def fake_upload_render_asset(**kwargs):
        kind = kwargs["kind"]
        return assets_service.AssetUpload(
            id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
            if kind == "car_original"
            else "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            owner_user_id=kwargs["owner_user_id"],
            job_id=kwargs["job_id"],
            kind=kind,
            bucket="raw",
            storage_key=f"{kind}/{kwargs['job_id']}",
            content_type=kwargs["content_type"],
            size_bytes=len(kwargs["data"]),
            sha256="0" * 64,
            public_url=None,
        )

    async def fake_insert_asset(_conn, asset: assets_service.AssetUpload):
        calls.append((f"insert_asset:{asset.kind}", asset.id))

    async def fake_reserve_job_credit(_conn, *, user_id: int, job_id: str):
        calls.append(("reserve_job_credit", user_id, job_id))
        return 2

    fake_redis = FakeRedis()
    monkeypatch.setattr(jobs_api, "require_auth_principal", fake_require_auth_principal)
    monkeypatch.setattr(jobs_api, "_get_render_queue_client", lambda *_args, **_kwargs: fake_redis)
    monkeypatch.setattr(jobs_api, "enforce_rate_limit", fake_enforce_rate_limit)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool())
    monkeypatch.setattr(jobs_api.assets_service, "upload_render_asset", fake_upload_render_asset)
    monkeypatch.setattr(jobs_api.assets_service, "insert_asset", fake_insert_asset)
    monkeypatch.setattr(jobs_api, "reserve_job_credit", fake_reserve_job_credit)
    monkeypatch.setattr(jobs_api.redis_client, "key", lambda key: key)

    response = asyncio.run(
        jobs_api.upload_job(
            car_image=UploadFile(
                file=BytesIO(b"car-bytes"),
                filename="car.jpg",
                headers=Headers({"content-type": "image/jpeg"}),
            ),
            wheel_image=UploadFile(
                file=BytesIO(b"wheel-bytes"),
                filename="wheel.jpg",
                headers=Headers({"content-type": "image/jpeg"}),
            ),
            idempotency_key="idem-key-1",
            init_data="init-data",
            telegram_user_id=None,
            authorization=None,
        )
    )

    assert response.status == "queued"
    assert [item[0] for item in calls] == [
        "resolve_principal",
        "tx_enter",
        "insert_job",
        "insert_asset:car_original",
        "insert_asset:rim_original",
        "link_job_assets",
        "reserve_job_credit",
        "tx_exit",
    ]
    assert fake_redis.queue_payloads
