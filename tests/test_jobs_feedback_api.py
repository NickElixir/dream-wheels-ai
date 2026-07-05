from datetime import UTC, datetime

from fastapi.testclient import TestClient

from src import jobs_api
from src.auth import AuthContext
from src.main import app

client = TestClient(app)


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

    async def fake_ensure_user(_conn, telegram_user_id: int, username: str | None = None):
        assert telegram_user_id == 123456789
        assert username in ("dw-user", None)
        return user_id

    monkeypatch.setattr(jobs_api, "ensure_user", fake_ensure_user)
    monkeypatch.setattr(
        jobs_api,
        "_telegram_user_id_from_feedback_request",
        lambda *_args, **_kwargs: 123456789,
    )


def _feedback_row(
    *,
    job_id: str = "11111111-1111-4111-8111-111111111111",
    sentiment: str = "disliked",
    reason: str | None = "image_quality",
) -> dict:
    return {
        "job_id": job_id,
        "render_job_id": job_id,
        "feedback_sentiment": sentiment,
        "feedback_reason": reason,
        "feedback_created_at": datetime(2026, 6, 29, tzinfo=UTC),
        "feedback_updated_at": datetime(2026, 6, 30, tzinfo=UTC),
    }


def test_get_feedback_returns_structured_record(monkeypatch):
    class FakeConn:
        async def fetchrow(self, query: str, *_args):
            if "SELECT user_id, status" in query:
                return {"user_id": 10, "status": "completed"}
            return _feedback_row()

    _patch_auth(monkeypatch, user_id=10)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.get("/jobs/11111111-1111-4111-8111-111111111111/feedback")

    assert response.status_code == 200
    assert response.json() == {
        "feedback": {
            "render_job_id": "11111111-1111-4111-8111-111111111111",
            "sentiment": "disliked",
            "reason": "image_quality",
            "created_at": "2026-06-29T00:00:00Z",
            "updated_at": "2026-06-30T00:00:00Z",
        }
    }


def test_put_feedback_returns_canonical_record(monkeypatch):
    class FakeConn:
        async def fetchrow(self, query: str, *_args):
            if "SELECT user_id, status" in query:
                return {"user_id": 10, "status": "completed"}
            return _feedback_row(sentiment="liked", reason=None)

    _patch_auth(monkeypatch, user_id=10)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.put(
        "/jobs/11111111-1111-4111-8111-111111111111/feedback",
        json={"sentiment": "liked", "telegram_user_id": 123456789},
    )

    assert response.status_code == 200
    assert response.json()["feedback"] == {
        "render_job_id": "11111111-1111-4111-8111-111111111111",
        "sentiment": "liked",
        "reason": None,
        "created_at": "2026-06-29T00:00:00Z",
        "updated_at": "2026-06-30T00:00:00Z",
    }


def test_put_feedback_returns_403_for_non_owner(monkeypatch):
    class FakeConn:
        async def fetchrow(self, query: str, *_args):
            if "SELECT user_id, status" in query:
                return {"user_id": 99, "status": "completed"}
            raise AssertionError("unexpected query")

    _patch_auth(monkeypatch, user_id=10)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.put(
        "/jobs/11111111-1111-4111-8111-111111111111/feedback",
        json={"sentiment": "liked", "telegram_user_id": 123456789},
    )

    assert response.status_code == 403


def test_put_feedback_returns_409_for_processing_job(monkeypatch):
    class FakeConn:
        async def fetchrow(self, query: str, *_args):
            if "SELECT user_id, status" in query:
                return {"user_id": 10, "status": "processing"}
            raise AssertionError("unexpected query")

    _patch_auth(monkeypatch, user_id=10)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.put(
        "/jobs/11111111-1111-4111-8111-111111111111/feedback",
        json={"sentiment": "disliked", "telegram_user_id": 123456789},
    )

    assert response.status_code == 409


def test_delete_feedback_is_idempotent(monkeypatch):
    class FakeConn:
        async def fetchrow(self, query: str, *_args):
            if "SELECT user_id, status" in query:
                return {"user_id": 10, "status": "completed"}
            raise AssertionError("unexpected query")

        async def execute(self, query: str, *_args):
            assert "DELETE FROM render_feedback" in query
            return "DELETE 0"

    _patch_auth(monkeypatch, user_id=10)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.request(
        "DELETE",
        "/jobs/11111111-1111-4111-8111-111111111111/feedback",
        json={"telegram_user_id": 123456789},
    )

    assert response.status_code == 204


def test_legacy_feedback_alias_maps_vote_to_liked(monkeypatch):
    calls: list[tuple[str | None, str | None]] = []

    class FakeConn:
        async def fetchrow(self, query: str, *_args):
            if "SELECT user_id, status" in query:
                return {"user_id": 10, "status": "completed"}
            if "INSERT INTO render_feedback" in query:
                calls.append((_args[2], _args[3]))
                return _feedback_row(sentiment="liked", reason=None)
            raise AssertionError("unexpected query")

    _patch_auth(monkeypatch, user_id=10)
    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: FakePool(FakeConn()))

    response = client.post(
        "/jobs/11111111-1111-4111-8111-111111111111/feedback",
        json={"vote": "like", "telegram_user_id": 123456789},
    )

    assert response.status_code == 204
    assert calls == [("liked", None)]
