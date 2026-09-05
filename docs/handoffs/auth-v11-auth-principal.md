# Auth V1.1 Slice 2 — AuthPrincipal and identity resolution

## Initial audit

```text
CURRENT_TELEGRAM_AUTH_BOUNDARY  = src.auth.resolve_telegram_auth()
CURRENT_WEBSITE_BEARER_BOUNDARY = src.auth.verify_website_auth_token()
CURRENT_USER_RESOLUTION_BOUNDARY = route-local ensure_user() calls
CURRENT_AUTH_CONTEXT_FIELDS      = telegram_user_id, username, auth_channel, auth_date
SUPABASE_VERIFIER_BOUNDARY       = src.auth.verify_supabase_access_token()
IDENTITY_HELPERS_AVAILABLE       = get_user_by_identity(), ensure_user_identity(), ensure_user()
```

The existing application callers remain on the Telegram boundary. This slice
adds a callable provider-neutral boundary without replacing those callers.

## Architecture

```text
credential verification
        ↓
verified external identity
        ↓
user_identities(provider, provider_subject)
        ↓
canonical users.id
        ↓
AuthPrincipal
```

`AuthPrincipal.user_id` is always the canonical Dream Wheels `users.id`.
`subject` is the verified external subject and is never used as a canonical
database user ID.

```python
@dataclass(frozen=True, slots=True)
class AuthPrincipal:
    user_id: int
    authority: Literal["telegram", "supabase"]
    subject: str
    auth_channel: str
    session_id: UUID | None = None
    aal: str | None = None
    telegram_username: str | None = None
```

The resolver is `src.auth_principal.resolve_auth_principal(...)`. It is async
because identity resolution may create a canonical user and identity atomically.

## Resolution behavior

Telegram credentials are verified by the existing `resolve_telegram_auth()`
boundary, including Mini App initData, the existing signed website token and
the existing guarded dev fallback. The verified Telegram ID is normalized to
`provider=telegram`, `provider_subject=str(telegram_user_id)` and passed to
`ensure_user_identity()`.

Supabase bearer credentials are verified by Slice 1's local ES256/RS256 JWKS
verifier. The verified UUID `sub` becomes
`provider=supabase`, `provider_subject=str(sub)`, with no username/profile data.

For a new Supabase subject, the existing identity helper creates a `users` row
with `telegram_user_id=NULL` and the corresponding `user_identities` row. A
returning subject resolves to the same `users.id`; no ownership tables are
modified.

## Bearer-token coexistence

The two bearer families are handled explicitly:

1. A bearer whose untrusted header contains an algorithm field is routed as a
   JWT candidate and must pass Supabase verification. This header is only a
   routing hint; it never selects a user.
2. A bearer without that JWT hint is verified as the existing signed website
   token.
3. A failed Supabase candidate never falls through to legacy verification.
4. Invalid, expired, malformed, random and unsupported bearer tokens fail with
   normalized `AuthPrincipalError` codes and reveal no token details.

The resolver's normalized codes are `MISSING_CREDENTIALS`,
`INVALID_CREDENTIALS`, `EXPIRED_CREDENTIALS`, `INVALID_SUPABASE_TOKEN`,
`INVALID_LEGACY_TOKEN` and `IDENTITY_RESOLUTION_FAILED`.

## Linking and ownership rules

No automatic account linking is performed. Email, name, username, phone, IP,
browser, UTM and payment email are not identity-linking inputs. Two verified
identities remain separate users unless an explicit database link already
exists. If both identities already point to one `users.id`, the resolver
naturally returns that shared canonical ID.

No jobs, credits, payments, history, Fitment or analytics rows are migrated.

## Security and scope

The resolver never logs bearer tokens, Telegram initData, refresh tokens or raw
JWT payloads. It does not expose a new public endpoint. Existing API routes,
Telegram behavior, browser/session work and frontend code remain unchanged.

## Tests

`tests/test_auth_principal.py` covers Telegram resolution, new and returning
Supabase identities, a shared canonical user, valid legacy bearer coexistence,
invalid-signature and expired Supabase no-downgrade behavior, malformed JWT-like
bearers and random bearers. Slice 1 tests continue to cover the cryptographic
Supabase verifier and JWKS rotation.

## Gates

```text
AUTH_PRINCIPAL_MODEL                = PASS
AUTH_TELEGRAM_PRINCIPAL             = PASS
AUTH_SUPABASE_PRINCIPAL             = PASS
AUTH_TELEGRAM_IDENTITY_RESOLUTION   = PASS
AUTH_SUPABASE_IDENTITY_RESOLUTION   = PASS
AUTH_NEW_SUPABASE_USER_CREATE       = PASS
AUTH_RETURNING_SUPABASE_USER        = PASS
AUTH_SHARED_USER_MULTI_IDENTITY     = PASS
AUTH_BEARER_DISAMBIGUATION          = PASS
AUTH_INVALID_TOKEN_FAIL_CLOSED      = PASS
AUTH_AUTO_ACCOUNT_LINKING           = NONE
AUTH_ENDPOINT_CUTOVER               = NONE
AUTH_FRONTEND_CHANGES               = NONE
TELEGRAM_AUTH_REGRESSION            = NONE
CANONICAL_STAGING_AUTH_DEPLOY       = NO
PRODUCTION                          = NOT_TOUCHED
DO_NOT_MERGE_BEFORE_03B_GATE        = YES
AUTH_SLICE_2_READY                  = YES
```

Next slice: persistent Supabase browser session module plus a minimal isolated
auth harness, still without broad `app.js` or endpoint cutover until the 03B
integration barrier is released.
