from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from src.fitment import api as fitment_api
from src.fitment.api import CheckCreateRequest, RimSpecInput
from src.fitment.schemas import Source


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class FakeRenderOwnershipConnection:
    def __init__(self, owned: bool) -> None:
        self.owned = owned

    async def fetchval(self, query: str, render_job_id: str, telegram_user_id: int) -> bool:
        assert "JOIN users" in query
        assert render_job_id
        assert telegram_user_id == 42
        return self.owned


class FakeAcquire:
    def __init__(self, connection: FakeRenderOwnershipConnection) -> None:
        self.connection = connection

    async def __aenter__(self) -> FakeRenderOwnershipConnection:
        return self.connection

    async def __aexit__(self, exc_type, exc, traceback) -> None:
        return None


class FakePool:
    def __init__(self, owned: bool) -> None:
        self.connection = FakeRenderOwnershipConnection(owned)

    def acquire(self) -> FakeAcquire:
        return FakeAcquire(self.connection)


def test_confirmed_rim_input_preserves_full_fastener_spec() -> None:
    rim = RimSpecInput(
        bolt_count=5,
        pcd_mm=112,
        center_bore_mm=66.6,
        wheel_diameter_in=19,
        wheel_width_j=8.5,
        offset_et_mm=42,
        fastener_system="Lug bolts",
        seat_type="ball",
        thread_diameter_mm=14,
        thread_pitch_mm=1.5,
        bolt_length_mm=28,
    ).to_spec(is_confirmed=True)

    assert rim.fastener_system.value == "Lug bolts"
    assert rim.seat_type.value == "ball"
    assert rim.thread_diameter_mm.value == 14
    assert rim.thread_pitch_mm.value == 1.5
    assert rim.bolt_length_mm.value == 28
    assert rim.seat_type.source == Source.user_confirmed
    assert rim.seat_type.is_user_confirmed is True


def test_check_contract_accepts_only_user_requested_detailed_mode() -> None:
    payload = {
        "vehicle_identity_id": uuid4(),
        "rim_setup_id": uuid4(),
    }

    request = CheckCreateRequest(**payload)
    assert request.trigger == "user_requested"
    assert request.mode == "detailed"

    with pytest.raises(ValidationError):
        CheckCreateRequest(**payload, trigger="automatic")

    with pytest.raises(ValidationError):
        CheckCreateRequest(**payload, mode="bulk")


@pytest.mark.anyio
async def test_render_job_link_requires_same_telegram_owner(monkeypatch) -> None:
    render_job_id = uuid4()
    monkeypatch.setattr(fitment_api.db, "get_pool", lambda: FakePool(owned=True))
    await fitment_api._ensure_render_job_owned(
        render_job_id=render_job_id,
        telegram_user_id=42,
    )

    monkeypatch.setattr(fitment_api.db, "get_pool", lambda: FakePool(owned=False))
    with pytest.raises(HTTPException) as exc_info:
        await fitment_api._ensure_render_job_owned(
            render_job_id=render_job_id,
            telegram_user_id=42,
        )
    assert exc_info.value.status_code == 404
