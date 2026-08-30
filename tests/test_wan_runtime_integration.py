import asyncio
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from src import main, storage
from src.generation.base import GenerationProviderError, GenerationResult, ProviderDiagnostics

JOB_ID = "11111111-1111-4111-8111-111111111111"


def image_bytes(*, size=(1600, 1000), image_format="JPEG", color="navy") -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color).save(buffer, format=image_format)
    return buffer.getvalue()


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False


class FakeConnection:
    def __init__(self):
        self.executed: list[tuple[str, tuple[object, ...]]] = []

    def transaction(self):
        return FakeTransaction()

    async def execute(self, query: str, *args):
        self.executed.append((query, args))

    async def fetchrow(self, *_args, **_kwargs):
        return {"car_asset_id": "car", "rim_asset_id": "rim"}


class FakeAcquire:
    def __init__(self, connection: FakeConnection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, *_):
        return False


class FakePool:
    def __init__(self):
        self.connection = FakeConnection()

    def acquire(self):
        return FakeAcquire(self.connection)


class FakeProvider:
    name = "alibaba_model_studio"

    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    async def edit(self, request):
        self.calls.append(request)
        if self.error:
            raise self.error
        return self.result


def successful_result() -> GenerationResult:
    return GenerationResult(
        image_bytes=image_bytes(size=(1200, 750), image_format="PNG", color="silver"),
        content_type="image/png",
        provider="alibaba_model_studio",
        model="wan2.7-image",
        provider_request_id="request-1",
        provider_task_id="task-1",
        latency_ms=1234,
        billed_image_count=1,
        output_width=1200,
        output_height=750,
        generation_cost=0.035,
    )


def patch_webapp_inputs(monkeypatch):
    vehicle = image_bytes()
    rim = image_bytes(size=(600, 600), image_format="PNG", color="silver")

    async def fake_download_bytes(*, bucket, path):
        assert bucket == storage.RAW_BUCKET
        return vehicle if path == "car/path.jpg" else rim

    monkeypatch.setattr(main.storage, "download_bytes", fake_download_bytes)
    return vehicle, rim


def patch_completion_dependencies(monkeypatch, *, finalized, events):
    async def fake_save_render_output(_pool, _job_id, _user_id, data, content_type="image/jpeg"):
        assert data
        assert content_type == "image/png"
        return "https://results.example/render.png"

    async def fake_finalize(_conn, *, user_id, job_id):
        finalized.append((user_id, job_id))
        return 2

    async def fake_record(_conn, *, user_id, event_name, properties):
        events.append((user_id, event_name, properties))

    monkeypatch.setattr(main, "_save_render_output", fake_save_render_output)
    monkeypatch.setattr(main, "finalize_job_credit", fake_finalize)
    monkeypatch.setattr(main.analytics_api, "record_system_event", fake_record)


def job_data():
    return {
        "job_id": JOB_ID,
        "user_id": 77,
        "source": "webapp",
        "car_storage_path": "car/path.jpg",
        "wheel_storage_path": "rim/path.png",
    }


def test_successful_render_uses_wan_request_and_finalizes_once(monkeypatch):
    vehicle, rim = patch_webapp_inputs(monkeypatch)
    finalized = []
    events = []
    patch_completion_dependencies(monkeypatch, finalized=finalized, events=events)
    metadata_pools = []

    async def fake_persist(pool, job_id, result):
        metadata_pools.append((pool, job_id, result))

    monkeypatch.setattr(main, "_persist_generation_metadata", fake_persist)
    provider = FakeProvider(result=successful_result())
    pool = FakePool()

    asyncio.run(
        main.process_render_job(
            pool,
            job_id=JOB_ID,
            user_id=77,
            job_data=job_data(),
            provider=provider,
        )
    )

    assert len(provider.calls) == 1
    request = provider.calls[0]
    assert request.vehicle_image == vehicle
    assert request.rim_reference_image == rim
    assert request.vehicle_content_type == "image/jpeg"
    assert request.rim_reference_content_type == "image/png"
    assert request.edit_regions is None
    assert request.prompt_version == "P0_API_SPIKE"
    assert request.output_width * request.output_height <= 2048 * 2048
    assert request.output_width / request.output_height == pytest.approx(1.6, rel=0.01)
    assert metadata_pools[0][1:] == (JOB_ID, provider.result)
    assert finalized == [(77, JOB_ID)]
    assert events == [(77, "render_completed", {"job_id": JOB_ID, "model": "wan2.7-image"})]
    assert any("status = 'processing'" in query for query, _ in pool.connection.executed)
    assert any("status = 'completed'" in query for query, _ in pool.connection.executed)


def test_successful_generation_metadata_is_persisted_in_jobs():
    pool = FakePool()

    asyncio.run(main._persist_generation_metadata(pool, JOB_ID, successful_result()))

    metadata_updates = [
        args for query, args in pool.connection.executed if "generation_provider" in query
    ]
    assert metadata_updates == [
        (
            "alibaba_model_studio",
            "request-1",
            "task-1",
            1234,
            0.035,
            JOB_ID,
        )
    ]


def test_legacy_bot_render_reads_durable_raw_assets(monkeypatch):
    vehicle = image_bytes()
    rim = image_bytes(size=(600, 600), image_format="PNG", color="silver")
    pool = FakePool()
    reads = []

    async def fake_fetch(*_args, **_kwargs):
        raise AssertionError("legacy Telegram URLs must not be used after asset persistence")

    async def fake_download_bytes(*, bucket, path):
        reads.append((bucket, path))
        return vehicle if path == "durable/car.jpg" else rim

    async def fake_fetchrow(*_args, **_kwargs):
        return {"car_storage_path": "durable/car.jpg", "rim_storage_path": "durable/rim.png"}

    monkeypatch.setattr(main, "fetch_image_bytes", fake_fetch)
    monkeypatch.setattr(main.storage, "download_bytes", fake_download_bytes)
    pool.connection.fetchrow = fake_fetchrow

    loaded_vehicle, loaded_rim = asyncio.run(
        main._load_generation_inputs(
            pool,
            JOB_ID,
            {
                "source": "bot",
                "car_url": "https://telegram/car",
                "wheel_url": "https://telegram/rim",
            },
        )
    )

    assert loaded_vehicle.data == vehicle
    assert loaded_rim.data == rim
    assert reads == [
        (storage.RAW_BUCKET, "durable/car.jpg"),
        (storage.RAW_BUCKET, "durable/rim.png"),
    ]


def test_provider_failure_is_safe_and_refunded_once(monkeypatch, caplog):
    patch_webapp_inputs(monkeypatch)
    provider_error = GenerationProviderError(
        "provider_task_failed",
        "provider-secret https://signed.aliyuncs.com/result?sig=secret",
        diagnostics=ProviderDiagnostics(
            http_status=200,
            request_id="request-2",
            task_id="task-2",
            raw_task_status="FAILED",
            provider_error_code="TaskFailed",
            provider_message="redacted provider error [url-redacted]",
            poll_attempts=2,
        ),
    )
    provider = FakeProvider(error=provider_error)
    pool = FakePool()
    refunded = []
    events = []

    async def fake_refund(_conn, *, user_id, job_id):
        refunded.append((user_id, job_id))
        return 3

    async def fake_record(_conn, *, user_id, event_name, properties):
        events.append((user_id, event_name, properties))

    monkeypatch.setattr(main, "refund_job_credit", fake_refund)
    monkeypatch.setattr(main.analytics_api, "record_system_event", fake_record)

    with pytest.raises(GenerationProviderError):
        asyncio.run(
            main.process_render_job(
                pool,
                job_id=JOB_ID,
                user_id=77,
                job_data=job_data(),
                provider=provider,
            )
        )
    asyncio.run(main._mark_render_failed(pool, job_id=JOB_ID, user_id=77, error=provider_error))

    assert len(provider.calls) == 1
    assert refunded == [(77, JOB_ID)]
    assert events == [
        (77, "render_failed", {"job_id": JOB_ID, "error_code": "provider_task_failed"})
    ]
    assert "https://signed.aliyuncs.com" not in caplog.text
    assert "provider-secret" not in caplog.text
    failure_update = [
        args for query, args in pool.connection.executed if "status = 'failed'" in query
    ]
    assert failure_update == [
        ("provider_task_failed", "Image generation failed. Please try again.", JOB_ID)
    ]


def test_storage_failure_does_not_regenerate_and_refunds(monkeypatch):
    patch_webapp_inputs(monkeypatch)
    provider = FakeProvider(result=successful_result())
    pool = FakePool()
    refunded = []

    async def fake_persist(*_args):
        return None

    async def fake_save(*_args, **_kwargs):
        raise storage.StorageError("result upload failed")

    async def fake_refund(_conn, *, user_id, job_id):
        refunded.append((user_id, job_id))
        return 3

    monkeypatch.setattr(main, "_persist_generation_metadata", fake_persist)
    monkeypatch.setattr(main, "_save_render_output", fake_save)
    monkeypatch.setattr(main, "refund_job_credit", fake_refund)
    monkeypatch.setattr(main.analytics_api, "record_system_event", _noop_record)

    with pytest.raises(storage.StorageError):
        asyncio.run(
            main.process_render_job(
                pool,
                job_id=JOB_ID,
                user_id=77,
                job_data=job_data(),
                provider=provider,
            )
        )
    asyncio.run(
        main._mark_render_failed(
            pool,
            job_id=JOB_ID,
            user_id=77,
            error=storage.StorageError("result upload failed"),
        )
    )

    assert len(provider.calls) == 1
    assert refunded == [(77, JOB_ID)]


async def _noop_record(*_args, **_kwargs):
    return None


def test_provider_config_error_never_builds_reve_fallback(monkeypatch):
    error = GenerationProviderError("provider_config_error", "WAN_API_KEY is required")

    def raise_config_error(cls):
        del cls
        raise error

    monkeypatch.setattr(main.WanImageConfig, "from_env", classmethod(raise_config_error))

    with pytest.raises(GenerationProviderError) as raised:
        main.build_generation_provider()

    assert raised.value.code == "provider_config_error"
    assert "reve" not in main.build_generation_provider.__code__.co_names


def test_provider_task_metadata_migration_is_minimal_and_idempotent():
    root = Path(__file__).parents[1]
    migration = (root / "migrations" / "0029_wan_provider_task_metadata.sql").read_text()
    assert "ALTER TABLE jobs" in migration
    assert "ADD COLUMN IF NOT EXISTS provider_task_id TEXT" in migration
    assert "generation_attempts" not in migration
    assert "CREATE TABLE" not in migration
