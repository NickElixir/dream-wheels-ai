from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from src import auth, auth_api, auth_principal
from src.auth import AuthContext
from src.main import app

client = TestClient(app)


class _FakeConn:
    pass


class _FakeAcquire:
    async def __aenter__(self):
        return _FakeConn()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakePool:
    def acquire(self):
        return _FakeAcquire()


def _supabase_claims() -> auth.SupabaseTokenClaims:
    return auth.SupabaseTokenClaims(
        subject=UUID("00000000-0000-0000-0000-000000000001"),
        session_id=None,
        issuer="https://staging.example.supabase.co/auth/v1",
        audience=("authenticated",),
        role="authenticated",
        aal="aal1",
    )


def _jwt_looking_bearer() -> str:
    return "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature"


def test_auth_me_resolves_supabase_bearer_to_safe_principal(monkeypatch):
    calls = []

    async def fake_verify(token):
        assert token == _jwt_looking_bearer()
        return _supabase_claims()

    async def fake_ensure(_conn, **kwargs):
        calls.append(kwargs)
        return 42

    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(auth_principal, "verify_supabase_access_token", fake_verify)
    monkeypatch.setattr(auth_principal, "ensure_user_identity", fake_ensure)

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {_jwt_looking_bearer()}"})

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "authority": "supabase",
        "auth_channel": "supabase",
    }
    assert calls == [
        {
            "provider": "supabase",
            "provider_subject": "00000000-0000-0000-0000-000000000001",
        }
    ]


def test_auth_me_returning_supabase_identity_keeps_canonical_user(monkeypatch):
    canonical_user_ids = []

    async def fake_verify(_token):
        return _supabase_claims()

    async def fake_ensure(_conn, **_kwargs):
        canonical_user_ids.append(42)
        return 42

    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(auth_principal, "verify_supabase_access_token", fake_verify)
    monkeypatch.setattr(auth_principal, "ensure_user_identity", fake_ensure)

    headers = {"Authorization": f"Bearer {_jwt_looking_bearer()}"}
    assert client.get("/auth/me", headers=headers).status_code == 200
    assert client.get("/auth/me", headers=headers).status_code == 200
    assert canonical_user_ids == [42, 42]


def test_auth_me_keeps_legacy_telegram_bearer_compatible(monkeypatch):
    context = AuthContext(123456789, "dw-user", "website", 1_700_000_000)

    async def fake_ensure(_conn, **kwargs):
        assert kwargs == {
            "provider": "telegram",
            "provider_subject": "123456789",
            "username": "dw-user",
        }
        return 9

    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(auth_principal, "verify_website_auth_token", lambda _token: context)
    monkeypatch.setattr(auth_principal, "ensure_user_identity", fake_ensure)

    response = client.get("/auth/me", headers={"Authorization": "Bearer legacy-token"})

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "authority": "telegram",
        "auth_channel": "website",
    }


def test_auth_me_requires_credentials(monkeypatch):
    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())

    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


@pytest.mark.parametrize("code", ("INVALID_SUPABASE_TOKEN", "EXPIRED_CREDENTIALS"))
def test_auth_me_rejects_invalid_or_expired_supabase_bearer_without_legacy_fallback(
    monkeypatch, code
):
    async def reject_supabase(_token):
        raise auth.SupabaseAccessTokenInvalid("invalid", code=code)

    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(auth_principal, "verify_supabase_access_token", reject_supabase)
    monkeypatch.setattr(
        auth_principal,
        "verify_website_auth_token",
        lambda _token: (_ for _ in ()).throw(AssertionError("unexpected legacy fallback")),
    )

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {_jwt_looking_bearer()}"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


def test_auth_me_rejects_invalid_legacy_bearer(monkeypatch):
    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(
        auth_principal,
        "verify_website_auth_token",
        lambda _token: (_ for _ in ()).throw(auth.WebsiteAuthInvalid("invalid")),
    )

    response = client.get("/auth/me", headers={"Authorization": "Bearer legacy-token"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


def test_telegram_login_nonce_returns_nonce_and_nonce_token(monkeypatch):
    monkeypatch.setattr(auth_api, "TELEGRAM_LOGIN_CLIENT_ID", "123456789")
    monkeypatch.setattr(
        auth_api,
        "build_website_login_nonce",
        lambda: {"nonce": "nonce-123", "nonce_token": "nonce-token-123"},
    )

    response = client.get("/auth/telegram/nonce")

    assert response.status_code == 200
    assert response.json() == {
        "client_id": "123456789",
        "nonce": "nonce-123",
        "nonce_token": "nonce-token-123",
    }


def test_telegram_login_nonce_requires_client_id(monkeypatch):
    monkeypatch.setattr(auth_api, "TELEGRAM_LOGIN_CLIENT_ID", "")

    response = client.get("/auth/telegram/nonce")

    assert response.status_code == 503
    assert response.json() == {"detail": "Telegram website login is not configured"}


def test_verify_id_token_returns_backend_bearer_token(monkeypatch):
    class FakeTransaction:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    async def fake_verify(*, id_token: str, nonce_token: str | None):
        assert id_token == "telegram-id-token"
        assert nonce_token == "nonce-token-123"
        return AuthContext(
            telegram_user_id=123456789,
            username="dw-user",
            auth_channel="website",
            auth_date=1700000000,
        )

    async def fake_ensure_user(_conn, telegram_user_id: int, username: str | None):
        assert telegram_user_id == 123456789
        assert username == "dw-user"
        return 77

    monkeypatch.setattr(auth_api, "verify_telegram_login_id_token", fake_verify)
    monkeypatch.setattr(auth_api.db, "get_pool", lambda: FakePool())
    monkeypatch.setattr(auth_api, "ensure_user", fake_ensure_user)
    monkeypatch.setattr(auth_api, "issue_website_auth_token", lambda _ctx: "backend-token-123")
    monkeypatch.setattr(auth_api, "TELEGRAM_AUTH_TOKEN_TTL_SEC", 3600)

    response = client.post(
        "/auth/telegram/verify-id-token",
        json={
            "id_token": "telegram-id-token",
            "nonce_token": "nonce-token-123",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "access_token": "backend-token-123",
        "token_type": "Bearer",
        "expires_in": 3600,
        "telegram_user_id": 123456789,
        "username": "dw-user",
    }
