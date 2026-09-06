# Dream Wheels AI — Auth V1.1 Slice 6B Handoff

Status: implementation complete in the Draft PR. The application is deployed
to canonical staging; live protected-API browser evidence remains pending until
the user-controlled Chrome flow is completed. Production was not touched.

## Scope

Slice 6B adds one central asynchronous `authenticatedFetch` boundary to the
main WebApp. It is provider-aware and does not redesign the Slice 6A login UI,
Turnstile flow, `/auth/me` probe, provider precedence, or Telegram login.

```text
PR                                  = 162 (Draft)
BRANCH                              = feature/auth-v11-integration
BASE                                = staging
PRODUCTION                          = NOT_TOUCHED
AUTHENTICATED_FETCH                 = IMPLEMENTED
PROTECTED_APPLICATION_CUTOVER       = IMPLEMENTED
AUTH_6B_ACCEPTANCE_SHA              = df5f1896638756f298cd0b99d3cb053e513d0ecc
AUTH_6B_PREVIEW_DEPLOYMENT          = PASS (READY; dpl_GYhXyRYr2QJNmJK1dz1BZeC57G5L)
AUTH_6B_PREVIEW_URL                 = https://dream-wheels-ai-webapp-staging-cnzz1qm0g.vercel.app/
AUTH_6B_CANONICAL_STAGING           = PASS (READY; dpl_BieXaWSVhdJKRNBo487nH2Pt1xBx)
AUTH_6B_CANONICAL_STAGING_URL       = https://dream-wheels-ai-webapp-staging.vercel.app/
LIVE_BROWSER_PROTECTED_API_SMOKE    = PENDING_BROWSER_ENVIRONMENT
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
AUTH_6B1_STAGING_BACKEND_DEPLOYMENT   = PASS (dep-daenmmlg1s2s73d4380g;
                                             exact commit 9c50fc161f0f0651bb529a827d88353b83549277)
AUTH_6B1_STAGING_BACKEND_HEALTH       = PASS (direct Render and canonical
                                             Vercel gateway: HTTP 200; db=alive; redis=alive)
AUTH_6B1_LIVE_STAGING                 = PENDING_USER_CONTROLLED_EMAIL_OTP_SMOKE
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
LIVE_CANONICAL_STAGING_6B            = PENDING (deployment PASS; user browser flow remains)
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
STAGING_DEPLOYMENT_6B2                = PASS (Render live; exact SHA 7b469c3)
VERCEL_STAGING_DEPLOYMENT_6B2         = PASS (READY; canonical alias updated)
LIVE_TURNSTILE_CANONICAL_STAGING      = PASS (Managed challenge completed)
LIVE_CANONICAL_STAGING_6B2            = PENDING (fresh OTP requires user code)
```

## Remaining acceptance gates

The following require live browser/API evidence on the current WebApp build:

```text
AUTH_6B_BROWSER_PROTECTED_API       = PENDING_USER_BROWSER_FLOW
AUTH_6B_SUPABASE_REFRESH_RETRY      = PENDING_LIVE_401_SCENARIO
AUTH_6B_BALANCE_HISTORY_RENDER      = PENDING_USER_BROWSER_FLOW
AUTH_6B_TELEGRAM_REGRESSION         = PENDING_SAFE_LIVE_CONTEXT
CI                                  = PASS (GitHub Actions for the pushed PR head; see PR checks)
```

Post-deploy user-controlled browser evidence on 2026-09-06: canonical staging
accepted the real email OTP flow and the WebApp cabinet rendered the authenticated
email presentation with the reconciled starter balance. A reload restored the
authenticated state, and a newly opened staging tab restored the same session;
the Balance route loaded without the former protected-route `401`. No OTP,
session credential, or token is recorded here.

```text
AUTH_6B_BROWSER_PROTECTED_API       = PASS (authenticated balance route)
AUTH_6B_BALANCE_HISTORY_RENDER      = PASS (balance and starter package visible)
AUTH_6B_RELOAD_RESTORE              = PASS (user browser)
AUTH_6B_TAB_REOPEN_RESTORE          = PASS (user browser)
AUTH_6B_SUPABASE_REFRESH_RETRY      = PENDING (not forced in this smoke)
AUTH_6B_TELEGRAM_REGRESSION         = PENDING_SAFE_LIVE_CONTEXT
```

Keep PR #162 Draft until these blocking gates are either evidenced or
explicitly accepted by the project owner. Do not add main WebApp integration
beyond this request boundary slice and do not merge automatically.

```text
AUTH_REQUEST_BOUNDARY               = PASS (automated)
AUTH_6B_IMPLEMENTATION              = PASS
AUTH_6B_LIVE_ACCEPTANCE             = PASS (user-controlled OTP/session smoke)
MERGE_PR_162                        = NO (until live blocking gates pass)
```
