# Dream Wheels AI — Auth V1.1 Slice 6B Handoff

Status: acceptance closeout PASS in the Draft PR. The application runtime is
deployed to canonical staging and the live protected-API/browser evidence is
complete. Production was not touched.

## Scope

Slice 6B adds one central asynchronous `authenticatedFetch` boundary to the
main WebApp. It is provider-aware and does not redesign the Slice 6A login UI,
Turnstile flow, `/auth/me` probe, provider precedence, or Telegram login.

```text
PR                                  = 162 (Draft)
BRANCH                              = feature/auth-v11-integration
BASE                                = staging
PRODUCTION                          = NOT_TOUCHED
PRE_AUTH_BASELINE                   = PASS (78f4efd578a5bd0c6a648b92f2d6c7f2c4b807ad)
03B_MARKETPLACE_PARSER              = CLOSED
AUTH_STAGING_BARRIER                = RELEASED
AUTHENTICATED_FETCH                 = IMPLEMENTED
PROTECTED_APPLICATION_CUTOVER       = IMPLEMENTED
AUTH_6B_ACCEPTANCE_SHA              = 67ddc37a5c74bc38fd0602188b6038e940dde682
AUTH_6B_RUNTIME_SHA                 = 7b469c37fc05cc0a6a4b9e81c73386c8c255f9da
AUTH_6B_RUNTIME_EQUIVALENT           = PASS (PR tail is docs-only after runtime SHA)
AUTH_6B_PREVIEW_DEPLOYMENT          = PASS (historical preview; READY)
AUTH_6B_CANONICAL_STAGING           = PASS (READY; dpl_5vEuL6fwe2WGCorKDVcAke1yhkLn)
AUTH_6B_CANONICAL_STAGING_URL       = https://dream-wheels-ai-webapp-staging.vercel.app/
LIVE_BROWSER_PROTECTED_API_SMOKE    = PASS (MANUAL_USER_BROWSER)
ACCEPTANCE_RUNTIME_CHANGED          = NO (acceptance evidence only; docs-only closeout)
```

## Authority routing contract

| Runtime authority | Credential behavior |
| --- | --- |
| `supabase / email_otp` | Gets the current Supabase access token on demand and sends only that bearer. |
| `telegram / website_telegram` | Gets the existing website Telegram bearer and sends only that bearer. |
| `telegram / mini_app` | Sends no Supabase or website bearer; existing init-data URL/body semantics remain unchanged. |
| none, protected request | Fails locally with normalized `AUTH_REQUIRED`; no anonymous protected request is sent. |

Caller headers are cloned from either a plain object or `Headers`. Only
`Authorization` is replaced. JSON, `FormData`, `Blob`, `ArrayBuffer`, empty
bodies, GET and HEAD are preserved; `Content-Type` is never synthesized for
`FormData`.

## Supabase retry contract

Only a Supabase-authorized request can refresh after a `401`. The boundary
performs at most one refresh and one replay, using the existing SDK controller
`refreshSession()` and a newly obtained access token. Concurrent `401`s share a
single-flight refresh promise. A second `401` changes the safe frontend state to
`SESSION_EXPIRED` and returns that response. There is no third business request.

There is no refresh for `403`, `5xx`, network failure, legacy Telegram `401`, or
Mini App `401`. Non-replayable stream bodies are not blindly retried. Payment
creation passes `retryOnAuth401: false` because it is a financial mutation.

The narrow `/api/backend/auth/me` probe remains a direct request and is not
routed through the wrapper, preventing bootstrap recursion. A verified
Supabase principal now opens `protectedApiReady` for the application boundary.

## Protected request inventory

| Area | Method / endpoint | Body | Retry / authority | Status |
| --- | --- | --- | --- | --- |
| Fitment history | `GET /fitment/checks` | empty | standard | migrated |
| Fitment detail/history | `GET /fitment/checks/:id` | empty | standard | migrated |
| Fitment overview | `GET /jobs/:id/fitment` | empty | standard | migrated |
| Vehicle catalogue | `GET /jobs/:id/fitment/vehicle-catalogue/:kind` | empty | standard | migrated |
| Rim source resolve | `POST /jobs/:id/fitment/rim-source/resolve` | JSON | standard | migrated |
| Vehicle variants | `POST /jobs/:id/fitment/vehicle-variants` | empty | standard | migrated |
| Variant reselect | `POST /jobs/:id/fitment/vehicle-variants/reselect` | empty | standard | migrated |
| Variant replace | `POST /jobs/:id/fitment/vehicle-variants/replace` | JSON | standard | migrated |
| Variant apply | `POST /jobs/:id/fitment/vehicle-variants/apply` | JSON | standard | migrated |
| Fitment save | `PATCH /jobs/:id/fitment` | JSON | standard | migrated |
| Compatibility run | `POST /fitment/checks` | JSON + idempotency key | standard | migrated |
| Compatibility polling | `GET /fitment/checks/:id` | empty | standard | migrated |
| Render history | `GET /jobs` | empty | standard | migrated |
| Render status/detail | `GET /jobs/:id` | empty | standard | migrated |
| Render polling | `GET /jobs/:id` | empty | standard | migrated |
| Identity resolve | `POST /identity/resolve` | `FormData` | standard; no manual multipart header | migrated |
| Render submission | `POST /jobs/from-assets` | JSON + idempotency key | standard | migrated |
| Protected source assets | `GET` asset download URL | Blob response | standard for internal paths; signed external URLs stay ordinary | migrated |
| Render result download | `GET` result download URL | Blob response | standard for internal paths | migrated |
| Saved-photo repeat | `GET` car/rim asset URLs | Blob response | standard for internal paths | migrated |
| Feedback | `PUT/DELETE /jobs/:id/feedback` | JSON | standard | migrated |
| Payment cabinet | `GET /payments/cabinet` | empty | standard | migrated |
| Payment creation | `POST /payments/topups` | JSON | `retryOnAuth401: false` | migrated |

These remain intentionally outside the protected boundary: build/version
checking, website Telegram nonce and ID-token verification, and ordinary
analytics. They use their existing contracts and do not receive a Supabase
bearer automatically.

## Legacy and Telegram safety

Website Telegram login explicitly marks the legacy authority after successful
verification and logout clears it. Supabase authority remains primary when a
dual session exists; Telegram identity fields are not added to Supabase
requests. Mini App requests retain their existing `init_data` URL/body
semantics and never acquire a Supabase or website bearer.

## Verification performed

### Slice 6B.1 backend principal cutover

The Email OTP browser acceptance exposed a backend-only mismatch: `/auth/me`
accepted a verified Supabase principal, but business routes still invoked the
Telegram-only resolver and returned `401`. Slice 6B.1 removes that split.

```text
SLICE_6B1_BASE_SHA                   = 126961ad9259aba79116432db7c059d4d035ef75
STAGING_SHA_AT_START                 = 786170342ab64cc205775feb4090888b4126d5d7
AUTH_BACKEND_PRINCIPAL_CUTOVER       = IMPLEMENTED
PRODUCTION                           = NOT_TOUCHED
```

Protected user-facing handlers now call the provider-neutral
`require_auth_principal()` adapter and use its canonical `principal.user_id`
for ownership, rate limits, idempotency keys and business-service access.
Affected families are payments, authenticated analytics attribution, identity,
jobs/history/assets/feedback and Fitment.

The resolver verifies a JWT-shaped bearer only through Supabase validation, so
it cannot downgrade to a legacy Telegram bearer. Telegram Website and Mini App
credentials resolve through the same `AuthPrincipal` boundary to their
existing canonical user. Bot-only job creation and feedback guarded by the
internal token remain intentional Telegram/internal paths; no Supabase subject
is fabricated as a Telegram ID.

```text
AUTH_SUPABASE_TO_TELEGRAM_FALLBACK    = NONE
AUTH_REQUEST_CREDENTIAL_MIXING        = NONE
AUTH_CANONICAL_OWNERSHIP_LOOKUPS      = PASS (automated)
AUTH_TELEGRAM_ROUTE_COMPATIBILITY     = PASS (automated)
AUTH_6B1_STAGING_BACKEND_DEPLOYMENT   = PASS (dep-daephrvqj5pc73advaf0;
                                             exact commit 7b469c37fc05cc0a6a4b9e81c73386c8c255f9da)
AUTH_6B1_STAGING_BACKEND_HEALTH       = PASS (direct Render and canonical
                                             Vercel gateway: HTTP 200; db=alive; redis=alive)
AUTH_6B1_LIVE_STAGING                 = PASS (MANUAL_USER_BROWSER; real OTP)
```

On 2026-09-06 the staging-only Render service
`dream-wheels-ai-staging` was manually deployed at the exact PR commit above.
Its linked branch remains `staging`; the release did not update `main`, the
production Render service, or any production configuration. The prior staging
runtime at `786170342ab64cc205775feb4090888b4126d5d7` was replaced only after
the new runtime became live.

The existing credit-account service remains the single starter-grant owner. It
is now reachable for an Email user through `payments/cabinet`, rather than
being skipped after the former Telegram-only `401`.

```text
FRONTEND_AUTH_TESTS                  = PASS (37 passed)
NODE_SYNTAX_CHECK                    = PASS (app.js, app-auth.js)
AUTH_BOUNDARY_UNIT_COVERAGE          = PASS (bearer, Headers, FormData,
                                             refresh/retry, second 401,
                                             concurrent single-flight,
                                             missing authority, legacy routing)
PREVIEW_DEPLOYMENT_6B                = PASS (exact acceptance SHA; READY)
LIVE_CANONICAL_STAGING_6B            = PASS (MANUAL_USER_BROWSER)
PRODUCTION                           = NOT_TOUCHED
```

The canonical staging deployment responds with the staging Supabase URL, public
non-secret configuration, `mainWebAppEnabled=true`, six-digit OTP settings,
and the Turnstile site-key configuration. The user-controlled Chrome session
confirmed both Auth resources with HTTP 200 and showed the main dashboard with
the generic login action; its Console contained no Auth bootstrap errors. No
OTP was sent again and no Supabase/admin mechanism was used to simulate live
evidence.

## Slice 6B.2 session restore / OTP / account bootstrap hardening

```text
SLICE_6B2_BASE_SHA                    = e2d672c29f5009020a447c70fbaf91f55db853f0
STAGING_SHA_AT_START                  = 786170342ab64cc205775feb4090888b4126d5d7
AUTH_OTP_REQUEST_DOES_NOT_AUTHENTICATE = PASS (automated)
AUTH_RESTORE_OTP_RACE                 = PASS (automated)
AUTH_DUPLICATE_OTP_REQUEST_ON_RESTORE = NONE (automated)
AUTH_MISSING_CREDENTIALS_STATUS       = PASS (401)
AUTH_STARTER_GRANT_ON_OTP_REQUEST     = NONE
AUTH_EMAIL_AS_IDENTITY_KEY            = NO
AUTH_AUTO_ACCOUNT_LINKING             = NONE
PRODUCTION                            = NOT_TOUCHED
```

The frontend now keeps session state separate from OTP interaction state. A
restored Supabase session is labelled `restored_session` and presents an
explicit “already signed in” action; it no longer closes an active OTP dialog
on a generic Supabase auth event. The controller rechecks the principal after
bootstrap/reconciliation and rejects a request-code action with an existing
verified session before calling `signInWithOtp`.

Authenticated Supabase reconciliation now calls the narrow `POST /auth/bootstrap`
operation after `/auth/me`. The backend resolves `AuthPrincipal` first, then
reuses `ensure_credit_account_state()` and returns only safe account
presentation data. The existing credit ledger remains authoritative and its
canonical idempotency key is unchanged. Telegram bootstrap continues to be
owned by `/start`; the new operation does not grant Telegram accounts.

Supabase email is exposed only through an in-memory safe presentation accessor
(`email`), with no custom storage or telemetry field. Website display precedence
is email, saved username, then `Dream Wheels`; Telegram display behavior is
unchanged. Missing credentials in protected user-route preflight now return
`401 Authentication required`, while business validation responses remain
unchanged.

```text
FRONTEND_AUTH_TESTS                   = PASS (40 passed)
FULL_TEST_SUITE                       = PASS (500 passed, 5 skipped)
RUFF / FORMAT / COMPILE / DIFF_CHECK  = PASS
STAGING_DEPLOYMENT_6B2                = PASS (Render live; exact SHA 7b469c37)
VERCEL_STAGING_DEPLOYMENT_6B2         = PASS (READY; canonical alias updated)
LIVE_TURNSTILE_CANONICAL_STAGING      = PASS (Managed challenge completed)
LIVE_CANONICAL_STAGING_6B2            = PASS (MANUAL_USER_BROWSER; real OTP)
```

## Auth V1.1 Foundation acceptance closeout

Evidence below was collected on canonical staging on 2026-09-06. Evidence
classes are explicit: `AUTOMATED` means repository or HTTP verification,
`MANUAL_USER_BROWSER` means the user-controlled Chrome session, and
`READ_ONLY_DB` means aggregate-only staging database inspection. The real test
address, OTP, access token, refresh token, JWT and raw session are intentionally
not recorded.

### Live staging flow and protected application routes

The real Turnstile Managed challenge passed before the code request. The real
email OTP was delivered through the configured SMTP provider and verified by
Supabase; the WebApp then established a session and rendered the authenticated
dashboard. The authenticated Balance and History routes loaded without the
former Telegram-only `401`. Empty History is valid for this account because it
has no owned jobs; the UI showed the authenticated empty-history state rather
than the guest/sample history.

```text
AUTH_6B1_LIVE_STAGING                 = PASS (MANUAL_USER_BROWSER)
AUTH_6B2_LIVE_STAGING                 = PASS (MANUAL_USER_BROWSER)
AUTH_LIVE_TURNSTILE                   = PASS (MANUAL_USER_BROWSER)
AUTH_LIVE_EMAIL_OTP                   = PASS (MANUAL_USER_BROWSER)
AUTH_LIVE_SESSION_CREATED             = PASS (MANUAL_USER_BROWSER)
AUTH_LIVE_BALANCE_ROUTE               = PASS (MANUAL_USER_BROWSER)
AUTH_LIVE_HISTORY_ROUTE               = PASS (MANUAL_USER_BROWSER; valid empty state)
AUTH_6B_BROWSER_PROTECTED_API         = PASS (MANUAL_USER_BROWSER + AUTOMATED)
AUTH_REQUEST_CREDENTIAL_MIXING        = NONE
AUTH_SUPABASE_TO_TELEGRAM_FALLBACK    = NONE
```

The source contract and live result agree: authenticated user requests use the
Supabase bearer supplied by `authenticatedFetch`; the protected History request
does not add Telegram identity parameters, and the backend resolves the
provider-neutral principal before applying `jobs.user_id` ownership filtering.
The no-credential `/auth/me` and `/jobs` probes both returned `401
Authentication required`.

```text
AUTH_MISSING_CREDENTIALS_STATUS        = PASS (AUTOMATED; 401)
AUTH_PROTECTED_ROUTE_CREDENTIAL_PATH   = PASS (AUTOMATED + MANUAL_USER_BROWSER)
AUTH_LIVE_401_TELEGRAM_LEGACY_MIX      = NONE
AUTH_SUPABASE_REFRESH_RETRY            = PASS_AUTOMATED/LIVE_NOT_FORCED
```

### Canonical identity isolation and starter grant

The read-only aggregate check for the live subject returned, both before and
after the harmless reload:

```text
canonical_user_row_count               = 1
supabase_identity_count                = 1
linked_telegram_identity_count        = 0
credit_account_count                   = 1
starter_package_count                  = 1
starter_ledger_count                   = 1
starter_idempotency_key_count          = 1
total_ledger_count                     = 1
owned_job_count                        = 0
correctly_owned_job_count              = 0 (initial ownership audit)
```

This proves one canonical user, one Supabase identity, no automatic Telegram
link, one credit account, one starter package/ledger/idempotency record and no
duplicate user or grant after reload. No matching identity was inferred from
email, username, display name, IP, browser or payment data. The existing
ledger remains authoritative.

```text
AUTH_LIVE_CANONICAL_USER_RESOLUTION   = PASS (READ_ONLY_DB + live route)
AUTH_RETURNING_USER_ID_STABLE         = PASS (READ_ONLY_DB; unchanged aggregate)
AUTH_AUTO_ACCOUNT_LINKING             = NONE
AUTH_IDENTITY_CROSS_LEAK              = NONE
AUTH_STARTER_GRANT_FIRST_LOGIN        = PASS (READ_ONLY_DB)
AUTH_STARTER_GRANT_IDEMPOTENT         = PASS (READ_ONLY_DB; before/after unchanged)
AUTH_STARTER_DUPLICATE_GRANT          = NONE
AUTH_LEDGER_AUTHORITY                 = PASS (READ_ONLY_DB)
```

### Reload, tab reopen, logout and account switch

Reload restored the same authenticated session. A newly opened staging tab
restored that session as well. After the real logout, both open staging tabs
showed the guest state, the email presentation disappeared, and the old
session did not resurrect after reload. The live switch-account path therefore
cleared the persisted session before returning to the login action.

```text
AUTH_LIVE_RELOAD_RESTORE              = PASS (MANUAL_USER_BROWSER)
AUTH_LIVE_TAB_REOPEN_RESTORE          = PASS (MANUAL_USER_BROWSER)
AUTH_LIVE_LOGOUT                      = PASS (MANUAL_USER_BROWSER)
AUTH_LIVE_SWITCH_ACCOUNT              = PASS (MANUAL_USER_BROWSER)
AUTH_POST_LOGOUT_SESSION_RESURRECTION = NONE
AUTH_OLD_BEARER_REUSE                 = NONE
AUTH_PROTECTED_READY_AFTER_LOGOUT     = NO
```

### Telemetry and privacy

The implemented event contract covers `auth_started`, `otp_requested`,
`otp_verified`, `auth_completed`, `session_restored` and `auth_signed_out` as
applicable. Staging telemetry inspection and the source audit found no email,
OTP, access token, refresh token, raw session, JWT or raw Supabase error fields
in the event payload contract.

```text
AUTH_LIVE_TELEMETRY                   = PASS (AUTOMATED + READ_ONLY_DB)
AUTH_LIVE_TELEMETRY_PII_LEAK         = NONE
```

### Telegram compatibility and full verification

The repository regression suite and route-compatibility tests remain passing;
no Telegram runtime cutover was performed. A safe live Telegram context was
not available for this acceptance, so the live Telegram smoke remains pending
and does not block this foundation closeout.

```text
AUTH_TELEGRAM_ROUTE_COMPATIBILITY     = PASS (AUTOMATED)
AUTH_TELEGRAM_LIVE_SMOKE              = PENDING_SAFE_LIVE_CONTEXT
TELEGRAM_AUTH_REGRESSION              = NONE
FULL_TEST_SUITE                       = PASS (500 passed, 5 skipped)
FRONTEND_AUTH_TESTS                   = PASS (40 passed)
CI                                    = PASS (GitHub Actions)
```

The accepted runtime is the exact staging SHA
`7b469c37fc05cc0a6a4b9e81c73386c8c255f9da`, deployed live by Render and the
READY Vercel staging deployment listed above. The current PR tail is docs-only
after that runtime, so acceptance documentation does not change the deployed
application behavior. Production Render and production Vercel configuration
were not touched.

## Final gates

```text
AUTH_IDENTITY_FOUNDATION             = PASS
AUTH_SUPABASE_JWT_VERIFY             = PASS (ES256/JWKS, issuer, audience, expiry,
                                             UUID subject, role=authenticated)
AUTH_GENERIC_PRINCIPAL               = PASS
AUTH_EMAIL_OTP_CORE                  = PASS
AUTH_LIVE_EMAIL_OTP                  = PASS
AUTH_LIVE_SESSION_CREATED            = PASS
AUTH_LIVE_RELOAD_RESTORE             = PASS
AUTH_LIVE_TAB_REOPEN_RESTORE         = PASS
AUTH_LIVE_LOGOUT                     = PASS
AUTH_LIVE_RELOGIN                    = PASS
AUTH_LIVE_BACKEND_JWT_VERIFY         = PASS (AUTOMATED; token not printed or persisted)
AUTH_LIVE_CANONICAL_USER_RESOLUTION  = PASS
AUTH_RETURNING_USER_ID_STABLE        = PASS
AUTH_LIVE_TELEMETRY                  = PASS
AUTH_LIVE_TELEMETRY_PII_LEAK         = NONE
AUTH_AUTO_ACCOUNT_LINKING            = NONE
TELEGRAM_AUTH_REGRESSION             = NONE
FULL_TEST_SUITE                      = PASS
CI                                   = PASS
03B_MARKETPLACE_PARSER               = CLOSED
AUTH_STAGING_BARRIER                 = RELEASED
AUTH_FOUNDATION_ACCEPTANCE           = PASS
PRODUCTION                           = NOT_TOUCHED
SLICE_6C_START_ALLOWED               = YES
MERGE_PR_162                         = NO (PR remains Draft; merge only after owner review)
```

This is an acceptance-only closeout. It does not add main WebApp integration,
does not start Slice 6C automatically and does not authorize a production
deployment.
