import asyncio
import hashlib
import json
import logging

import pytest

from src import jobs_api, main, publications_api
from src.generation.diagnostics import (
    persist_generation_request,
    persist_generation_result,
    request_snapshot,
)
from src.generation.inputs import build_generation_request, inspect_image
from tests.test_wan_runtime_integration import (
    JOB_ID,
    FakePool,
    FakeProvider,
    image_bytes,
    job_data,
    patch_completion_dependencies,
    patch_webapp_inputs,
    successful_result,
)


def inputs():
    vehicle = inspect_image(image_bytes(size=(1440, 1920)), role="vehicle")
    rim = inspect_image(image_bytes(size=(750, 750)), role="rim reference")
    return vehicle, rim, build_generation_request(vehicle=vehicle, rim_reference=rim)


def test_snapshot_allowlist_preserves_input_identity_and_request(monkeypatch):
    monkeypatch.setenv("RENDER_GIT_COMMIT", "a" * 40)
    vehicle, rim, request = inputs()
    snapshot = request_snapshot(request, vehicle=vehicle, rim_reference=rim, model="wan2.7-image")
    assert snapshot["worker_commit_sha"] == "a" * 40
    assert snapshot["generation_prompt_version"] == "P1_WHEEL_IDENTITY"
    assert snapshot["generation_model"] == "wan2.7-image"
    assert snapshot["vehicle_input_width"] == 1440
    assert snapshot["vehicle_input_height"] == 1920
    assert snapshot["rim_input_width"] == snapshot["rim_input_height"] == 750
    assert snapshot["vehicle_input_sha256"] == hashlib.sha256(vehicle.data).hexdigest()
    assert snapshot["rim_input_sha256"] == hashlib.sha256(rim.data).hexdigest()
    assert snapshot["requested_output_width"] == request.output_width
    assert snapshot["requested_output_height"] == request.output_height
    assert snapshot["seed"] is None
    assert snapshot["bbox_enabled"] is False
    assert "instruction" not in snapshot and "vehicle_image" not in snapshot


def test_request_written_before_submission_and_without_sensitive_values(monkeypatch, caplog):
    from dataclasses import replace

    vehicle, rim, request = inputs()
    secret = "CANARY_API_KEY data:image/png;base64,CANARY https://signed.test/?token=CANARY"
    request = replace(request, instruction=secret)
    monkeypatch.setenv("RENDER_GIT_COMMIT", secret)
    pool = FakePool()
    with caplog.at_level(logging.INFO):
        asyncio.run(
            persist_generation_request(
                pool,
                job_id=JOB_ID,
                user_id=77,
                request=request,
                vehicle=vehicle,
                rim_reference=rim,
                model="wan2.7-image",
            )
        )
    query, args = pool.connection.executed[0]
    snapshot = json.loads(args[2])
    assert snapshot["worker_commit_sha"] is None
    assert snapshot["prompt_sha256"] == hashlib.sha256(secret.encode()).hexdigest()
    assert "NOT (COALESCE(render_input_snapshot, '{}'::jsonb) ? 'generation')" in query
    assert "status = 'processing'" in query and "credit_status = 'reserved'" in query
    assert secret not in caplog.text and secret not in args[2]
    assert "CANARY" not in caplog.text


def test_existing_intent_is_not_overwritten():
    vehicle, rim, request = inputs()
    pool = FakePool()

    async def no_update(*args):
        return None

    pool.connection.fetchval = no_update
    with pytest.raises(RuntimeError, match="intent cannot be recorded"):
        asyncio.run(
            persist_generation_request(
                pool,
                job_id=JOB_ID,
                user_id=77,
                request=request,
                vehicle=vehicle,
                rim_reference=rim,
                model="wan2.7-image",
            )
        )


def test_result_evidence_contains_measured_dimensions_and_mismatch(caplog):
    from src.assets_service import AssetUpload

    _, _, request = inputs()
    result = successful_result()
    candidate = AssetUpload(
        id=JOB_ID,
        owner_user_id=77,
        job_id=JOB_ID,
        kind="result",
        bucket="results",
        storage_key="not-logged",
        content_type="image/png",
        size_bytes=len(result.image_bytes),
        sha256=hashlib.sha256(result.image_bytes).hexdigest(),
        width=1200,
        height=750,
    )
    pool = FakePool()
    with caplog.at_level(logging.INFO):
        asyncio.run(
            persist_generation_result(
                pool,
                job_id=JOB_ID,
                user_id=77,
                request=request,
                result=result,
                candidate=candidate,
            )
        )
    query, args = pool.connection.executed[0]
    snapshot = json.loads(args[2])
    assert snapshot["provider_output_width"] == snapshot["stored_output_width"] == 1200
    assert snapshot["provider_output_height"] == snapshot["stored_output_height"] == 750
    assert snapshot["provider_output_sha256"] == snapshot["stored_output_sha256"]
    assert snapshot["output_size_mismatch"] is True
    assert "{generation,result}" in query and "? 'result'" in query
    assert "not-logged" not in caplog.text
    assert any(r.levelno == logging.WARNING for r in caplog.records)


@pytest.mark.parametrize("serialize", [False, True])
def test_generation_evidence_is_not_exposed_by_snapshot_readers(serialize):
    snapshot = {
        "version": "legacy-v1",
        "rim": {"brand": "Test"},
        "generation": {"request": {"worker_commit_sha": "private"}},
    }
    row = {"render_input_snapshot": json.dumps(snapshot) if serialize else snapshot}
    assert jobs_api._snapshot_from_row(row, job_id=JOB_ID) == {
        "version": "legacy-v1",
        "rim": {"brand": "Test"},
    }
    assert "private" not in json.dumps(publications_api.publication_snapshot(row))
    assert "generation" in snapshot  # Reader must not mutate the persisted source.
    assert jobs_api._snapshot_from_row({"render_input_snapshot": None}, job_id=JOB_ID) is None


def test_intent_failure_prevents_paid_submit(monkeypatch):
    patch_webapp_inputs(monkeypatch)
    provider = FakeProvider(result=successful_result())

    async def fail(*args, **kwargs):
        raise RuntimeError("intent unavailable")

    monkeypatch.setattr(main, "persist_generation_request", fail)
    with pytest.raises(RuntimeError, match="intent unavailable"):
        asyncio.run(
            main.process_render_job(
                FakePool(), job_id=JOB_ID, user_id=77, job_data=job_data(), provider=provider
            )
        )
    assert provider.calls == []


def test_result_telemetry_failure_cannot_undo_published_render(monkeypatch):
    patch_webapp_inputs(monkeypatch)
    finalized, events = [], []
    patch_completion_dependencies(monkeypatch, finalized=finalized, events=events)

    async def fail(*args, **kwargs):
        raise RuntimeError("diagnostics unavailable")

    monkeypatch.setattr(main, "persist_generation_result", fail)
    provider = FakeProvider(result=successful_result())
    asyncio.run(
        main.process_render_job(
            FakePool(), job_id=JOB_ID, user_id=77, job_data=job_data(), provider=provider
        )
    )
    assert finalized == [(77, JOB_ID)]
    assert len(provider.calls) == 1
    assert events[0][1] == "render_completed"
