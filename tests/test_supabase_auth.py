import asyncio
from uuid import UUID

import pytest
from joserfc import jwt
from joserfc.jwk import ECKey, KeySet, OctKey

from src import auth

NOW = 1_700_000_000
ISSUER = "https://staging.example.supabase.co/auth/v1"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"
SUBJECT = "00000000-0000-0000-0000-000000000001"
SESSION_ID = "00000000-0000-0000-0000-000000000002"


def _configure_supabase(monkeypatch):
    monkeypatch.setattr(auth, "SUPABASE_AUTH_ISSUER", ISSUER)
    monkeypatch.setattr(auth, "SUPABASE_AUTH_JWKS_URL", JWKS_URL)
    monkeypatch.setattr(auth, "SUPABASE_AUTH_AUDIENCE", "authenticated")
    monkeypatch.setattr(auth.time, "time", lambda: NOW)


def _claims(**overrides):
    claims = {
        "iss": ISSUER,
        "aud": "authenticated",
        "exp": NOW + 3600,
        "sub": SUBJECT,
        "session_id": SESSION_ID,
        "role": "authenticated",
        "aal": "aal1",
    }
    claims.update(overrides)
    return claims


def _sign_es256(claims, *, key=None, kid=None):
    key = key or ECKey.generate_key("P-256", private=True, auto_kid=True)
    return jwt.encode(
        {"alg": "ES256", "kid": kid or key.kid},
        claims,
        key,
        algorithms=["ES256"],
    ), key


def _public_keyset(key):
    return KeySet([ECKey.import_key(key.as_dict(is_private=False))])


def _install_jwks(monkeypatch, key_set):
    async def fake_get_jwks(*, force_refresh=False):
        assert force_refresh is False
        return key_set

    monkeypatch.setattr(auth, "_get_supabase_jwks", fake_get_jwks)


def test_verify_supabase_access_token_accepts_verified_claims(monkeypatch):
    _configure_supabase(monkeypatch)
    token, key = _sign_es256(_claims(aud=["other", "authenticated"]))
    _install_jwks(monkeypatch, _public_keyset(key))

    verified = asyncio.run(auth.verify_supabase_access_token(token))

    assert verified == auth.SupabaseTokenClaims(
        subject=UUID(SUBJECT),
        session_id=UUID(SESSION_ID),
        issuer=ISSUER,
        audience=("other", "authenticated"),
        role="authenticated",
        aal="aal1",
    )


@pytest.mark.parametrize(
    ("claims", "error"),
    [
        (_claims(iss="https://evil.example/auth/v1"), "Invalid Supabase issuer"),
        (_claims(aud="anon"), "Invalid Supabase audience"),
        (_claims(exp=NOW), "Expired Supabase access token"),
        (_claims(sub=None), "Invalid Supabase subject"),
        (_claims(sub="not-a-uuid"), "Invalid Supabase subject"),
        (_claims(role="anon"), "not an authenticated user token"),
    ],
)
def test_verify_supabase_access_token_rejects_invalid_claims(monkeypatch, claims, error):
    _configure_supabase(monkeypatch)
    token, key = _sign_es256(claims)
    _install_jwks(monkeypatch, _public_keyset(key))

    with pytest.raises(auth.SupabaseAccessTokenInvalid, match=error):
        asyncio.run(auth.verify_supabase_access_token(token))


def test_verify_supabase_access_token_rejects_invalid_signature(monkeypatch):
    _configure_supabase(monkeypatch)
    trusted = ECKey.generate_key("P-256", private=True, auto_kid=True)
    attacker = ECKey.generate_key("P-256", private=True, auto_kid=True)
    token, _ = _sign_es256(_claims(), key=attacker, kid=trusted.kid)
    _install_jwks(monkeypatch, _public_keyset(trusted))

    with pytest.raises(auth.SupabaseAccessTokenInvalid, match="signature"):
        asyncio.run(auth.verify_supabase_access_token(token))


def test_verify_supabase_access_token_rejects_unknown_algorithm(monkeypatch):
    _configure_supabase(monkeypatch)
    token = jwt.encode(
        {"alg": "HS256", "kid": "symmetric-test-key"},
        _claims(),
        OctKey.import_key(b"test-secret-1234"),
        algorithms=["HS256"],
    )
    _install_jwks(monkeypatch, KeySet([]))

    with pytest.raises(auth.SupabaseAccessTokenInvalid, match="signature"):
        asyncio.run(auth.verify_supabase_access_token(token))


def test_verify_supabase_access_token_refreshes_jwks_for_rotated_kid(monkeypatch):
    _configure_supabase(monkeypatch)
    token, rotated_key = _sign_es256(_claims())
    calls = []

    async def fake_get_jwks(*, force_refresh=False):
        calls.append(force_refresh)
        return _public_keyset(rotated_key) if force_refresh else KeySet([])

    monkeypatch.setattr(auth, "_get_supabase_jwks", fake_get_jwks)

    verified = asyncio.run(auth.verify_supabase_access_token(token))

    assert verified.subject == UUID(SUBJECT)
    assert calls == [False, True]


@pytest.mark.parametrize("token", ["", "not-a-jwt", "one.two.three"])
def test_verify_supabase_access_token_rejects_malformed_token(monkeypatch, token):
    _configure_supabase(monkeypatch)
    _install_jwks(monkeypatch, KeySet([]))

    with pytest.raises(auth.SupabaseAccessTokenInvalid):
        asyncio.run(auth.verify_supabase_access_token(token))
