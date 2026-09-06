# Dream Wheels AI — Auth V1.1 Slice 6B Handoff

Status: implementation complete in the Draft PR, awaiting a deployable WebApp
preview for live protected-API browser evidence. Production was not touched.

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
LIVE_BROWSER_PROTECTED_API_SMOKE    = PENDING_PREVIEW_DEPLOYMENT
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

```text
FRONTEND_AUTH_TESTS                  = PASS (37 passed)
NODE_SYNTAX_CHECK                    = PASS (app.js, app-auth.js)
AUTH_BOUNDARY_UNIT_COVERAGE          = PASS (bearer, Headers, FormData,
                                             refresh/retry, second 401,
                                             concurrent single-flight,
                                             missing authority, legacy routing)
LIVE_CANONICAL_STAGING_6B            = PENDING (canonical deployment predates PR #162)
PRODUCTION                           = NOT_TOUCHED
```

The currently reachable canonical staging WebApp is the older staging
deployment and still shows the pre-6B Telegram-first surface. No OTP was sent
again and no Supabase/admin mechanism was used to simulate the missing live
preview. Browser Turnstile and protected API evidence must be collected on a
preview built from the current PR (or after an explicit staging deployment).

## Remaining acceptance gates

The following require live browser/API evidence on the current WebApp build:

```text
AUTH_6B_BROWSER_PROTECTED_API       = PENDING_PREVIEW_DEPLOYMENT
AUTH_6B_SUPABASE_REFRESH_RETRY      = PENDING_LIVE_401_SCENARIO
AUTH_6B_BALANCE_HISTORY_RENDER      = PENDING_PREVIEW_DEPLOYMENT
AUTH_6B_TELEGRAM_REGRESSION         = PENDING_SAFE_LIVE_CONTEXT
CI                                  = PASS (GitHub Actions run #300)
```

Keep PR #162 Draft until these blocking gates are either evidenced or
explicitly accepted by the project owner. Do not add main WebApp integration
beyond this request boundary slice and do not merge automatically.

```text
AUTH_REQUEST_BOUNDARY               = PASS (automated)
AUTH_6B_IMPLEMENTATION              = PASS
AUTH_6B_LIVE_ACCEPTANCE             = PENDING
MERGE_PR_162                        = NO (until live blocking gates pass)
```
