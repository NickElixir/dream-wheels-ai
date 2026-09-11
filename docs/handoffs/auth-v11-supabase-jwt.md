# Auth V1.1 Slice 1 — Supabase JWT verification contract

## Scope

This slice adds an isolated server primitive for a future Supabase access-token
boundary. It does not alter Telegram authentication, API routes, browser
sessions, login UI, database ownership, or the 03B Marketplace Parser work.

## Canonical staging discovery

Read-only inspection on 2026-09-05 identified the canonical staging project as
`https://hnawojlnfoaccinlgjyn.supabase.co`.

```text
SUPABASE_PROJECT_URL       = https://hnawojlnfoaccinlgjyn.supabase.co
SUPABASE_AUTH_ISSUER       = https://hnawojlnfoaccinlgjyn.supabase.co/auth/v1
SUPABASE_JWKS_URL          = https://hnawojlnfoaccinlgjyn.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_SIGNING_MODE      = asymmetric ES256
SUPABASE_EXPECTED_AUDIENCE = authenticated
CURRENT_SERVER_JWT_LIB     = joserfc==1.7.5
```

The public JWKS exposed one EC signing key with `alg=ES256` and a `kid`; no
secret or service-role key was read or recorded. Local verification is therefore
the selected strategy. A legacy HS256 fallback is not implemented.

## Configuration

```text
SUPABASE_URL                    required at runtime for this verifier
SUPABASE_AUTH_AUDIENCE          optional; defaults to authenticated
SUPABASE_AUTH_ISSUER            derived as <SUPABASE_URL>/auth/v1
SUPABASE_AUTH_JWKS_URL          derived as <issuer>/.well-known/jwks.json
SUPABASE_SERVICE_ROLE_KEY        not used by this verifier
```

If asymmetric signing is ever disabled, stop the local verifier rollout. Do not
add a Supabase JWT secret to application configuration. Re-enable an asymmetric
ES256 or RS256 signing key in Supabase Dashboard before continuing.

## Verification contract

`verify_supabase_access_token(token)` verifies locally through the public JWKS
and returns `SupabaseTokenClaims`, never the raw token or profile data.

Required claims:

- signature with `ES256` or `RS256`, selected by `kid` from JWKS;
- `iss` exactly equal to the derived issuer;
- `aud` as a string or list containing the configured audience;
- future integer `exp`;
- `sub` as a UUID; and
- `role=authenticated`.

Optional typed claims are `session_id` (UUID) and `aal` (string). Email, name,
and user metadata are intentionally excluded from canonical identity handling.
Anonymous, service-role, malformed, expired, wrong-audience, wrong-issuer,
unsupported-algorithm, and invalid-signature tokens fail closed.

## JWKS cache and rotation

The verifier caches the imported public key set for five minutes. A token whose
`kid` is absent triggers exactly one forced JWKS refresh, then verification is
retried. Any later failure is rejected. It does not call Supabase Auth `/user`
per request.

## Tests

`tests/test_supabase_auth.py` covers valid ES256 verification, invalid
signature, unsupported algorithm, wrong issuer/audience, expiry, missing or
invalid UUID subject, anonymous role, malformed tokens, and a rotated `kid`.

## Gates

```text
AUTH_SUPABASE_SIGNING_MODE_KNOWN = YES
AUTH_SUPABASE_JWKS               = READY
AUTH_SUPABASE_ISSUER             = KNOWN
AUTH_SUPABASE_AUDIENCE           = KNOWN
AUTH_SUPABASE_JWT_SIGNATURE      = PASS
AUTH_SUPABASE_JWT_ISSUER         = PASS
AUTH_SUPABASE_JWT_AUDIENCE       = PASS
AUTH_SUPABASE_JWT_EXPIRY         = PASS
AUTH_SUPABASE_JWT_SUBJECT        = PASS
AUTH_SUPABASE_VERIFIER           = READY
TELEGRAM_AUTH_REGRESSION         = NONE
CANONICAL_STAGING_AUTH_DEPLOY    = NO
PRODUCTION                       = NOT_TOUCHED
```

The branch remains `feature/auth-v11-foundation`; PR #159 stays Draft and the
03B integration barrier remains active.
