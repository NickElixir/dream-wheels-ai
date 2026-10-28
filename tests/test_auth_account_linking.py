from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient

from src import auth_api, auth_principal
from src.account_linking_service import (
    AccountIdentity,
    AccountLinkResult,
    AccountMergeResult,
    AccountState,
)
from src.auth import AuthContext, SupabaseTokenClaims
from src.main import app

client = TestClient(app)


class _FakeAcquire:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakePool:
    def acquire(self):
        return _FakeAcquire()


def _principal(*, authority: str = "supabase") -> auth_principal.AuthPrincipal:
    return auth_principal.AuthPrincipal(
        user_id=42,
        authority=authority,
        subject="00000000-0000-0000-0000-000000000001" if authority == "supabase" else "123",
        auth_channel="supabase" if authority == "supabase" else "website",
        email="person@example.test" if authority == "supabase" else None,
    )


def test_account_state_only_returns_safe_provider_presentation(monkeypatch):
    async def fake_require(*_args, **_kwargs):
        return _principal()

    async def fake_state(*_args, **kwargs):
        assert kwargs["user_id"] == 42
        assert kwargs["current_email"] == "person@example.test"
        return AccountState(
            current_authority="supabase",
            email=AccountIdentity(linked=True, display="pe••••@example.test"),
            telegram=AccountIdentity(linked=True, display="@dw_user"),
        )

    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(auth_api, "require_auth_principal", fake_require)
    monkeypatch.setattr(auth_api, "get_account_state", fake_state)

    response = client.get("/auth/account", headers={"Authorization": "Bearer verified"})

    assert response.status_code == 200
    assert response.json() == {
        "current_authority": "supabase",
        "identities": {
            "email": {"linked": True, "display": "pe••••@example.test"},
            "telegram": {"linked": True, "display": "@dw_user"},
        },
    }


def test_account_link_uses_second_telegram_proof_without_switching_current_session(monkeypatch):
    linked = []

    async def fake_require(*_args, **_kwargs):
        return _principal()

    async def fake_verify(*, id_token, nonce_token):
        assert (id_token, nonce_token) == ("telegram-proof", "nonce-proof")
        return AuthContext(123, "dw_user", "website", 1_700_000_000)

    async def fake_link(_conn, **kwargs):
        linked.append(kwargs)
        return AccountLinkResult(status="merge_required", merge_token="opaque-token")

    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(auth_api, "require_auth_principal", fake_require)
    monkeypatch.setattr(auth_api, "verify_telegram_login_id_token", fake_verify)
    monkeypatch.setattr(auth_api, "link_verified_identity", fake_link)

    response = client.post(
        "/auth/account/link",
        headers={"Authorization": "Bearer existing-email-session"},
        json={
            "provider": "telegram",
            "proof": {"id_token": "telegram-proof", "nonce_token": "nonce-proof"},
        },
    )

    assert response.status_code == 200
    assert response.json() == {"status": "merge_required", "merge_token": "opaque-token"}
    assert linked == [
        {
            "current_user_id": 42,
            "provider": "telegram",
            "provider_subject": "123",
            "telegram_username": "dw_user",
        }
    ]


def test_account_link_rejects_client_supplied_user_ids_before_verification(monkeypatch):
    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())

    response = client.post(
        "/auth/account/link",
        headers={"Authorization": "Bearer existing-email-session"},
        json={
            "provider": "supabase",
            "current_user_id": 1,
            "target_user_id": 2,
            "proof": {"access_token": "second-proof"},
        },
    )

    assert response.status_code == 422


def test_account_link_verifies_supabase_second_proof(monkeypatch):
    calls = []

    async def fake_require(*_args, **_kwargs):
        return _principal(authority="telegram")

    async def fake_verify(token):
        assert token == "supabase-proof"
        return SupabaseTokenClaims(
            subject=UUID("00000000-0000-0000-0000-000000000002"),
            session_id=None,
            issuer="https://example.test/auth/v1",
            audience=("authenticated",),
            role="authenticated",
            aal="aal1",
        )

    async def fake_link(_conn, **kwargs):
        calls.append(kwargs)
        return AccountLinkResult(status="linked")

    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(auth_api, "require_auth_principal", fake_require)
    monkeypatch.setattr(auth_api, "verify_supabase_access_token", fake_verify)
    monkeypatch.setattr(auth_api, "link_verified_identity", fake_link)

    response = client.post(
        "/auth/account/link",
        headers={"Authorization": "Bearer existing-telegram-session"},
        json={"provider": "supabase", "proof": {"access_token": "supabase-proof"}},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "linked", "merge_token": None}
    assert calls[0]["current_user_id"] == 42
    assert calls[0]["provider_subject"] == "00000000-0000-0000-0000-000000000002"


def test_account_merge_requires_only_a_server_issued_token(monkeypatch):
    calls = []

    async def fake_require(*_args, **_kwargs):
        return _principal()

    async def fake_merge(_conn, **kwargs):
        calls.append(kwargs)
        return AccountMergeResult(status="merged", survivor_user_id=7)

    monkeypatch.setattr(auth_api.db, "get_pool", lambda: _FakePool())
    monkeypatch.setattr(auth_api, "require_auth_principal", fake_require)
    monkeypatch.setattr(auth_api, "confirm_account_merge", fake_merge)

    response = client.post(
        "/auth/account/merge",
        headers={"Authorization": "Bearer existing-email-session"},
        json={"merge_token": "server-issued-opaque-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "merged"}
    assert calls == [{"current_user_id": 42, "merge_token": "server-issued-opaque-token"}]


def test_account_linking_migration_preserves_render_feedback_ownership_contract():
    migration = (
        Path(__file__).resolve().parents[1] / "migrations" / "0034_auth_account_linking.sql"
    ).read_text(encoding="utf-8")

    assert "CREATE TABLE IF NOT EXISTS account_merges" in migration
    assert "merged_into_user_id" in migration
    assert "ON UPDATE CASCADE" in migration
    assert "REVOKE ALL ON TABLE account_merges FROM anon, authenticated" in migration
