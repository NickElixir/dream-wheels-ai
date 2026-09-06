# Dream Wheels AI — Auth V1.1 Slice 6C App-Gate Handoff

Status: implementation complete locally; automated verification PASS; live
browser and exact-head staging acceptance are still pending. PR #162 remains
Draft. Production was not touched.

```text
PR                                  = 162 (Draft)
BRANCH                              = feature/auth-v11-integration
BASE                                = staging
CURRENT_BASE_SHA                    = 052acb3740ddfd14d6b5a94f5cbabcdcc3580317
STAGING_SHA_AT_START                = 786170342ab64cc205775feb4090888b4126d5d7
PRODUCTION                          = NOT_TOUCHED
SLICE_6B2_STATE_MACHINE              = PRESERVED
APPLICATION_AUTH_WALL                = IMPLEMENTED (local)
AUTOMATED_VERIFICATION               = PASS
LIVE_BROWSER_ACCEPTANCE              = PENDING (Mac locked; browser CLI unavailable)
STAGING_EXACT_HEAD_ACCEPTANCE        = PENDING
MERGE_PR_162                         = NO
```

## Scope delivered

The browser App namespace is now an authenticated shell. `/app`, `/app/`,
`/app/new`, `/app/history`, and the supported application views are rewritten
to the shared entrypoint and reconciled through the existing Auth V1.1
controller before the application shell is shown.

Public landing/legal/static/health/version routes and the Telegram Mini App
`/t/**` namespace remain outside this wall. The existing Slice 6B.2 session
states and the separate OTP interaction state were not redesigned.

Before the wall opens, the browser does not hydrate draft files, load the
dashboard, fetch Balance/History, or render guest/sample application state.
After a verified session is ready, data bootstrap is deduplicated and the
requested view is restored.

## Route and return-path contract

Supported application views are mapped in `webapp/app-route.js`. A safe return
path is same-origin and limited to the known `/app` views. Only `market` and
the supported UTM keys are preserved. Unknown query keys and unsafe targets
such as external URLs, `javascript:`, `data:`, `/admin`, `/api/**`, and `/t/**`
are discarded. Unknown `/app/**` paths are normalized to `/app`.

No payment `return_to`, `client_channel`, arbitrary external redirect, or
cross-domain SSO behavior was added.

## Session and identity behavior

The gate displays a restoring state while the existing controller reconciles a
stored session. An unauthenticated browser App gets the existing Email OTP
dialog; if the integration is unavailable, the existing Telegram fallback is
used. Successful authentication bootstraps the protected application data.

Logout clears Balance, payments, starter-grant presentation, History, expanded
job state, draft files, and identity presentation. An invalidated bootstrap
generation cannot mark the application as ready after logout or account
switching.

No custom token or refresh-token storage was introduced. Supabase credentials
remain owned by the existing SDK/controller boundary; they are not placed in
the URL, DOM, analytics, or application state presentation.

## Verification performed

```text
WEBAPP_NODE_TESTS                    = PASS (43 passed)
WEBAPP_BUILD                         = PASS
NODE_SYNTAX_CHECK                    = PASS (app.js, app-route.js, app-auth.js)
FULL_PYTEST                          = PASS (502 passed, 5 skipped)
RUFF / FORMAT / COMPILE / DIFF_CHECK = PASS
ROUTE UNIT COVERAGE                  = PASS (known views, UTM/market allowlist,
                                             unsafe/non-App target rejection)
STATIC APP-GATE COVERAGE             = PASS
```

The remaining acceptance matrix must be run against a deployment whose runtime
SHA exactly matches the final PR head:

```text
AUTH_APPLICATION_AUTH_REQUIRED       = PENDING (live)
AUTH_UNAUTHENTICATED_APP_GATE        = PENDING (live)
AUTH_DIRECT_APP_ROUTE_GUARD          = PENDING (live)
AUTH_ANONYMOUS_PROTECTED_REQUESTS    = PENDING (live)
AUTH_INTENDED_ROUTE_UTM_MARKET       = PENDING (live)
AUTH_EMAIL_APP_ENTRY                 = PENDING (live; real OTP)
AUTH_RELOAD_TAB_RESTORE              = PENDING (live)
AUTH_LOGOUT_DIRECT_GUARD             = PENDING (live)
AUTH_HISTORY_ACCOUNT_ISOLATION        = PENDING (live)
AUTH_REFRESH_RETRY                   = PENDING (live)
AUTH_TELEGRAM_COMPATIBILITY           = PENDING (live)
AUTH_XSS_STORAGE_PRIVACY              = PENDING (live)
STAGING_DEPLOYMENT_EXACT_HEAD        = PENDING
PRODUCTION                          = NOT_TOUCHED
```

The browser path is currently blocked because the built-in computer-use
session reported a locked Mac and the repository's `agent-browser` executable
is not installed. No live OTP, CAPTCHA, or production action was simulated.

## Final recommendation

Do not merge PR #162 yet. Once the Mac is unlocked, deploy the final exact
head to staging, run the live browser matrix above, record the evidence here,
and only then change the PR from Draft if every gate passes. Production must
remain untouched throughout Slice 6C acceptance.
