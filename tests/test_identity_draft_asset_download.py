"""Protected current identity-draft asset download tests."""

from fastapi.testclient import TestClient

from src import identity_api
from src.auth_principal import AuthPrincipal
from src.main import app

client = TestClient(app)
DRAFT_ID = "11111111-1111-4111-8111-111111111111"


class _Acquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Conn:
    def __init__(self, row):
        self.row = row
        self.calls = []

    async def fetchrow(self, query, *args):
        self.calls.append((query, args))
        return self.row


class _Pool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return _Acquire(self.conn)


def _install_auth(monkeypatch, conn, *, user_id=77):
    monkeypatch.setattr(identity_api, "preflight_auth_credentials", lambda **_kwargs: None)

    async def require(_conn, **_kwargs):
        return AuthPrincipal(
            user_id=user_id,
            authority="supabase",
            subject="test-subject",
            auth_channel="website",
        )

    monkeypatch.setattr(identity_api, "require_auth_principal", require)
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: _Pool(conn))


def test_current_rim_asset_download_is_private_and_owner_scoped(monkeypatch):
    conn = _Conn(
        {
            "bucket": "raw",
            "storage_key": "users/77/drafts/example/rim_original/rim.jpg",
            "content_type": "image/jpeg",
        }
    )
    _install_auth(monkeypatch, conn)
    downloaded = []

    async def download_bytes(*, bucket, path):
        downloaded.append((bucket, path))
        return b"rim-image"

    monkeypatch.setattr(identity_api.storage, "download_bytes", download_bytes)

    response = client.get(
        f"/identity/drafts/{DRAFT_ID}/assets/rim_original/download",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    assert response.content == b"rim-image"
    assert response.headers["content-type"].startswith("image/jpeg")
    assert response.headers["cache-control"] == "private, max-age=300"
    assert downloaded == [("raw", "users/77/drafts/example/rim_original/rim.jpg")]

    query, args = conn.calls[0]
    assert "draft.owner_user_id = $2" in query
    assert "draft.status = 'resolved'" in query
    assert "draft.expires_at > CURRENT_TIMESTAMP" in query
    assert "asset.render_input_draft_id = draft.id" in query
    assert args == (DRAFT_ID, 77, "rim_original")


def test_draft_asset_download_hides_missing_or_foreign_asset(monkeypatch):
    conn = _Conn(None)
    _install_auth(monkeypatch, conn, user_id=88)

    response = client.get(
        f"/identity/drafts/{DRAFT_ID}/assets/rim_original/download",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Asset not found"


def test_draft_asset_download_rejects_unsupported_kind_before_storage(monkeypatch):
    conn = _Conn(None)
    _install_auth(monkeypatch, conn)

    response = client.get(
        f"/identity/drafts/{DRAFT_ID}/assets/result/download",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 404
    assert conn.calls == []
