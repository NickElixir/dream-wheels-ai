import asyncio
import base64
from uuid import UUID

import pytest

from src import auth, auth_principal

SUBJECT = UUID("00000000-0000-0000-0000-000000000001")
SESSION_ID = UUID("00000000-0000-0000-0000-000000000002")


def _supabase_claims() -> auth.SupabaseTokenClaims:
    return auth.SupabaseTokenClaims(
        subject=SUBJECT,
        session_id=SESSION_ID,
        issuer="https://staging.example.supabase.co/auth/v1",
        audience=("authenticated",),
        role="authenticated",
        aal="aal1",
    )


def _jwt_looking_bearer(*, algorithm="ES256") -> str:
    header = (
        base64.urlsafe_b64encode(f'{{"alg":"{algorithm}","typ":"JWT"}}'.encode())
        .rstrip(b"=")
        .decode()
    )
    return f"{header}.payload.signature"


def _telegram_context() -> auth.AuthContext:
    return auth.AuthContext(
        telegram_user_id=123456789,
        username="dw-user",
        auth_channel="mini_app",
        auth_date=1_700_000_000,
    )


def test_telegram_credentials_resolve_to_canonical_principal(monkeypatch):
    calls = []

    monkeypatch.setattr(auth_principal, "resolve_telegram_auth", lambda **_: _telegram_context())

    async def fake_ensure(_conn, **kwargs):
        calls.append(kwargs)
        return 17

    monkeypatch.setattr(auth_principal, "ensure_user_identity", fake_ensure)

    principal = asyncio.run(
        auth_principal.resolve_auth_principal(
            object(),
            init_data="verified-init-data",
            telegram_user_id=None,
            auth_name="test",
        )
    )

    assert principal == auth_principal.AuthPrincipal(
        user_id=17,
        authority="telegram",
        subject="123456789",
        auth_channel="mini_app",
        telegram_username="dw-user",
    )
    assert calls == [
        {"provider": "telegram", "provider_subject": "123456789", "username": "dw-user"}
    ]


def test_supabase_new_and_returning_identity_keep_same_canonical_user(monkeypatch):
    claims = _supabase_claims()
    token = _jwt_looking_bearer()
    calls = []

    async def fake_verify(_token):
        return claims

    async def fake_ensure(_conn, **kwargs):
        calls.append(kwargs)
        return 42

    monkeypatch.setattr(auth_principal, "verify_supabase_access_token", fake_verify)
    monkeypatch.setattr(auth_principal, "ensure_user_identity", fake_ensure)

    first = asyncio.run(
        auth_principal.resolve_auth_principal(
            object(),
            init_data=None,
            telegram_user_id=None,
            authorization=f"Bearer {token}",
            auth_name="test",
        )
    )
    second = asyncio.run(
        auth_principal.resolve_auth_principal(
            object(),
            init_data=None,
            telegram_user_id=None,
            authorization=f"Bearer {token}",
            auth_name="test",
        )
    )

    assert first.user_id == second.user_id == 42
    assert first.authority == second.authority == "supabase"
    assert first.subject == str(SUBJECT)
    assert calls == [
        {"provider": "supabase", "provider_subject": str(SUBJECT)},
        {"provider": "supabase", "provider_subject": str(SUBJECT)},
    ]


def test_existing_shared_user_can_resolve_from_both_authorities(monkeypatch):
    monkeypatch.setattr(auth_principal, "resolve_telegram_auth", lambda **_: _telegram_context())

    async def fake_verify(_token):
        return _supabase_claims()

    monkeypatch.setattr(auth_principal, "verify_supabase_access_token", fake_verify)

    async def fake_ensure(_conn, **_kwargs):
        return 17

    monkeypatch.setattr(auth_principal, "ensure_user_identity", fake_ensure)
    supabase_token = _jwt_looking_bearer()

    telegram = asyncio.run(
        auth_principal.resolve_auth_principal(
            object(), init_data="verified", telegram_user_id=None, auth_name="test"
        )
    )
    supabase = asyncio.run(
        auth_principal.resolve_auth_principal(
            object(),
            init_data=None,
            telegram_user_id=None,
            authorization=f"Bearer {supabase_token}",
            auth_name="test",
        )
    )

    assert telegram.user_id == supabase.user_id == 17
    assert telegram.authority == "telegram"
    assert supabase.authority == "supabase"


def test_valid_legacy_bearer_uses_existing_telegram_path(monkeypatch):
    context = auth.AuthContext(123456789, "legacy-user", "website", 1_700_000_000)
    monkeypatch.setattr(auth_principal, "verify_website_auth_token", lambda token: context)

    async def fake_ensure(_conn, **kwargs):
        assert kwargs == {
            "provider": "telegram",
            "provider_subject": "123456789",
            "username": "legacy-user",
        }
        return 9

    monkeypatch.setattr(auth_principal, "ensure_user_identity", fake_ensure)

    principal = asyncio.run(
        auth_principal.resolve_auth_principal(
            object(),
            init_data=None,
            telegram_user_id=None,
            authorization="Bearer legacy-token",
            auth_name="test",
        )
    )

    assert principal.user_id == 9
    assert principal.authority == "telegram"
    assert principal.auth_channel == "website"


def test_invalid_supabase_signature_cannot_downgrade_to_legacy(monkeypatch):
    async def reject_supabase(_token):
        raise auth.SupabaseAccessTokenInvalid("Invalid Supabase access token signature")

    def legacy_must_not_run(_token):
        raise AssertionError("invalid Supabase token downgraded to legacy auth")

    monkeypatch.setattr(auth_principal, "verify_supabase_access_token", reject_supabase)
    monkeypatch.setattr(auth_principal, "verify_website_auth_token", legacy_must_not_run)

    with pytest.raises(auth_principal.AuthPrincipalError) as exc_info:
        asyncio.run(
            auth_principal.resolve_auth_principal(
                object(),
                init_data=None,
                telegram_user_id=None,
                authorization=f"Bearer {_jwt_looking_bearer()}",
                auth_name="test",
            )
        )

    assert exc_info.value.code == "INVALID_SUPABASE_TOKEN"


@pytest.mark.parametrize("token", [_jwt_looking_bearer(), _jwt_looking_bearer(algorithm="none")])
def test_jwt_looking_invalid_or_expired_bearer_fails_closed(monkeypatch, token):
    async def reject_supabase(_token):
        raise auth.SupabaseAccessTokenInvalid("Expired Supabase access token")

    monkeypatch.setattr(auth_principal, "verify_supabase_access_token", reject_supabase)
    monkeypatch.setattr(
        auth_principal,
        "verify_website_auth_token",
        lambda _token: pytest.fail("JWT bearer fell through to legacy verification"),
    )

    with pytest.raises(auth_principal.AuthPrincipalError, match="INVALID_SUPABASE_TOKEN"):
        asyncio.run(
            auth_principal.resolve_auth_principal(
                object(),
                init_data=None,
                telegram_user_id=None,
                authorization=f"Bearer {token}",
                auth_name="test",
            )
        )


def test_random_bearer_is_rejected_by_legacy_verifier(monkeypatch):
    monkeypatch.setattr(
        auth_principal,
        "verify_website_auth_token",
        lambda _token: (_ for _ in ()).throw(
            auth.WebsiteAuthInvalid("Invalid or expired auth token")
        ),
    )

    with pytest.raises(auth_principal.AuthPrincipalError) as exc_info:
        asyncio.run(
            auth_principal.resolve_auth_principal(
                object(),
                init_data=None,
                telegram_user_id=None,
                authorization="Bearer random",
                auth_name="test",
            )
        )

    assert exc_info.value.code == "INVALID_LEGACY_TOKEN"
