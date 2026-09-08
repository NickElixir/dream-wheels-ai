# 05B.1 Payment Return Routing Hardening

## Scope

Payment browser returns are now channel-aware and environment-neutral. New
top-ups persist:

- `client_channel`: `web` or `telegram`;
- `return_to`: a validated internal route.

The web allowlist is `/app`, `/app/new`, `/app/history`, and the existing
`/app/wallet` route used by the current payment UI. Telegram allows `/t` and
`/t/`, normalized to `/t/`. Only approved attribution query keys are retained
on web routes: `market` and the UTM keys.

`source_screen` remains analytics context. `delivery_channel` remains the
legacy/provider-neutral delivery field and is not used for browser routing.

## Legacy data decision

The staging audit found 44 existing payments. All had `delivery_channel =
website`, `source_screen = cabinet`, and a Telegram identity/user mapping.
This confirms the legacy Telegram-first flow and supports the deterministic
backfill:

```text
client_channel = telegram
return_to = /t/
```

Invalid stored routing data is validated again on browser return. An invalid
channel uses the global safe fallback `web` + `/app`; an invalid route falls
back to `/app` or `/t/` according to its stored valid channel. No raw route,
provider signature, token, receipt email, or user id is reflected in a
redirect or log.

## Browser-return authority

Both backend handlers accept GET and POST:

```text
GET/POST /payments/robokassa/success
GET/POST /payments/robokassa/fail
```

They resolve the payment using `InvId`, `Shp_payment_id`, and (when present)
`OutSum`, then build a same-origin `303` redirect from persisted routing
context. SuccessURL does not settle or grant credits. FailURL retains the
05B state machine: `pending -> failed`, while a later authoritative ResultURL
may still settle `failed -> paid`. ResultURL signature verification and credit
idempotency are unchanged.

Required staging merchant settings:

```text
Result URL:  https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/result
Success URL: https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/success
Fail URL:    https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/fail
```

These merchant settings are external state and must be verified separately;
production must not be changed as part of this slice.

## Rollout gates

1. Apply `migrations/0033_payment_return_routing.sql` to staging only.
2. Verify row count, backfill, constraints, balances, and ledger invariants.
3. Deploy the exact feature SHA to Render staging and canonical Vercel staging.
4. Run automated tests and browser/API staging smoke for web and Telegram
   return paths, including malformed stored routes, already-paid FailURL, and
   late ResultURL.
5. Keep the PR Draft until external Robokassa settings and live staging
   browser returns are verified.

## Current staging rebase and acceptance state

Recorded: 2026-09-08. The existing PR #164 branch was rebased onto the
canonical staging tree after Auth V1.1 closeout and gateway hardening. No
second payment PR was created.

```ini
PAYMENT_05B1_OLD_BASE_SHA              = 0dd3a92d35168b76f62c07559f85c3c3666223f5
PAYMENT_05B1_PRE_REBASE_HEAD          = ee50abd96607108df5f66e7b92d6cc252294be8c
PAYMENT_05B1_CURRENT_STAGING_SHA      = 9ff620a1fc19806717aff5d98999240e78375b3c
PAYMENT_05B1_REBASED_HEAD             = b01adae5d3bced34d275eba9cabe01157b593fa7
PAYMENT_05B1_REBASE_METHOD             = git rebase origin/staging
PR_164                                = OPEN / DRAFT
PRODUCTION                            = NOT_TOUCHED
```

The post-rebase diff remains limited to payment return routing, payment
service/API code, migration 0033, payment/UI tests, and this workstream's
handoff. It does not change Auth V1.1, gateway origin-control hardening,
fitment, generation, vehicle recognition, unrelated migrations, or production
configuration.

## Staging migration audit

The staging database was queried read-only through the Supabase management
connection. Migration `payment_return_routing` is present exactly once in the
remote migration inventory (`20260906202357`). The migration was not reapplied
by this closeout.

```ini
PAYMENT_RETURN_STAGING_MIGRATION       = PASS
PAYMENTS_TOTAL                         = 44
PAYMENTS_DISTINCT_INVOICES             = 44
LEGACY_TELEGRAM_BACKFILL               = 44 / 44 (`telegram`, `/t/`)
INVALID_CLIENT_CHANNELS                = 0
EMPTY_RETURN_ROUTES                    = 0
ROUTING_COLUMNS                        = PASS (`client_channel`, `return_to`)
ROUTING_CONSTRAINTS                    = PASS (channel, non-empty route)
PAYMENT_STATES_OUTSIDE_CONTRACT        = 0
CREDIT_LEDGER_IDEMPOTENCY_DUPLICATES   = 0
```

The snapshot contained 1 failed, 15 paid, and 28 pending payments. The SQL
migration only backfills the two routing columns on `payments`; it does not
write balances or the credit ledger. No payment row was created or reset by
this acceptance.

## Automated and exact-head staging verification

```ini
PAYMENT_FOCUSED_TESTS                  = PASS (113 passed)
AUTH_FOCUSED_TESTS                     = PASS (51 passed, 2 skipped)
GATEWAY_NODE_TESTS                     = PASS (3 passed)
FULL_PYTEST                            = PASS (531 passed, 5 skipped)
FRONTEND_AUTH_TESTS                    = PASS (43 passed)
FRONTEND_BUILD                         = PASS
RUFF_CHECK                             = PASS
RUFF_FORMAT                            = PASS (131 files formatted)
COMPILEALL                             = PASS
GIT_DIFF_CHECK                         = PASS
PAYMENT_CLIENT_CHANNEL_CONTRACT        = PASS
PAYMENT_RETURN_OPEN_REDIRECT           = NONE (automated)
PAYMENT_CHANNEL_RETURN_MISMATCH        = REJECTED (automated)
PAYMENT_DB_RETURN_INJECTION            = NONE (automated)
PAYMENT_INVALID_STORED_RETURN_FALLBACK = PASS (automated)
PAYMENT_401_RETRY                      = DISABLED (financial POST)
PAYMENT_CREDIT_IDEMPOTENCY             = PASS (automated)
PAYMENT_DUPLICATE_CREDIT               = NONE (automated)
PAYMENT_RETRY_NEW_INVOICE              = PASS (automated)
AUTH_PAYMENT_REGRESSION                = NONE
GATEWAY_HOST_CONTROL_REGRESSION        = NONE
```

Exact staging deployments used the rebased runtime SHA:

```ini
PAYMENT_05B1_EXACT_HEAD_STAGING        = PASS
RENDER_SERVICE                         = dream-wheels-ai-robokassa-staging
RENDER_DEPLOYMENT_ID                   = dep-dafk7nv40ujc73blocsg
RENDER_DEPLOYMENT_STATUS               = live
VERCEL_PROJECT                         = dream-wheels-ai-webapp-staging
VERCEL_DEPLOYMENT_ID                   = dpl_626HQ9tKD3LerpLxq4VnF84vLEx3
VERCEL_DEPLOYMENT_STATUS               = READY
VERCEL_CANONICAL_ALIAS                 = https://dream-wheels-ai-webapp-staging.vercel.app
RENDER_HEALTH                          = PASS (200)
VERCEL_GATEWAY_HEALTH                  = PASS (200)
PAYMENT_05B1_VERCEL_STATIC_APP         = PASS
PAYMENT_05B1_EXACT_HEAD_STAGING        = PASS
```

The earlier deployment `dpl_9Y9LpcXHTJVgeHL3xtj96mNswxoe` was not accepted:
its prebuilt output omitted the normal static WebApp files. It was replaced by
the fresh exact-runtime deployment above. The new clean-worktree build
contained `static/index.html`, the SPA rewrite target, `app.js`, CSS, and Auth
bundles; Vercel metadata reports Git SHA
`b01adae5d3bced34d275eba9cabe01157b593fa7`.

Anonymous HTTP checks on the canonical alias returned 200 for `/`, `/app`,
`/app/new`, `/app/history`, `/index.html`, `/app.js`, `/style.css`,
`/auth/app-auth.bundle.js`, `/version.json`, and `/api/backend/health`.
The existing authenticated browser session also restored after reload and
opened `/app`, `/app/new`, and `/app/history` without an Auth/login flash.
Render was not redeployed or changed.

The direct Render SuccessURL handler was also exercised read-only with an
existing paid staging fixture: it returned `303` to the persisted legacy
Telegram route and did not settle or grant credits. This confirms the
callback classification and stored-route lookup without creating a payment.

```ini
ROBOKASSA_CALLBACK_CLASSIFICATION     = PASS (automated + direct staging SuccessURL)
PAYMENT_SUCCESS_RETURN_DIRECT         = PASS (read-only existing paid fixture)
```

## Auth return unblock and latest staging

The post-payment WebApp regression was isolated to the application gate: it
waited for cabinet/history data before revealing the already authenticated
application. The gate now opens after `/auth/me` principal verification and
`/auth/bootstrap` protected-API readiness; cabinet and history continue to
load behind their normal loading states.

```ini
PAYMENT_AUTH_APP_GATE_FIX              = PASS
PAYMENT_AUTH_APP_GATE_REGRESSION_TEST  = PASS
PAYMENT_AUTH_SUCCESS_RETURN_APP        = PASS (invoice 51 URL; reload opened cabinet)
PAYMENT_AUTH_FAIL_RETURN_APP           = PASS (invoice 52 URL; reload opened cabinet)
PAYMENT_FIX_COMMIT                     = a21332573b01235c97b75948d2787b08a5f26cb9
PAYMENT_FIX_VERCEL_DEPLOYMENT          = dpl_BuWBxSN4eSSbDQACmGESMNQhcfai
PAYMENT_FIX_VERCEL_STATUS              = READY / PROMOTED
PAYMENT_FIX_VERCEL_METADATA_SHA        = a21332573b01235c97b75948d2787b08a5f26cb9
PAYMENT_FIX_VERCEL_CANONICAL_ALIAS     = https://dream-wheels-ai-webapp-staging.vercel.app
PAYMENT_FIX_VERCEL_BUILD               = PASS (normal remote npm run build)
```

The Render service was not redeployed. Canonical staging checks remained 200
for `/`, `/app`, `/app/new`, `/app/history`, static bundles, and
`/api/backend/health`.

## Live invoice audit

The two user-created staging invoices were checked read-only in Supabase. No
payment, balance, or ledger row was changed by this audit.

```ini
FAIL_INVOICE_50_STATUS                 = pending
FAIL_INVOICE_50_FAILED_AT              = NULL
FAIL_INVOICE_50_CLIENT_CHANNEL          = web
FAIL_INVOICE_50_RETURN_TO               = /app
FAIL_INVOICE_50_PURCHASE_GRANTS         = 0
FAIL_INVOICE_50_LEDGER_ROWS             = 0
FAIL_INVOICE_50_RESULT                  = NOT_PASS (FailURL state transition not evidenced)

SUCCESS_INVOICE_51_STATUS               = paid
SUCCESS_INVOICE_51_PAID_AT              = PRESENT
SUCCESS_INVOICE_51_CLIENT_CHANNEL       = web
SUCCESS_INVOICE_51_RETURN_TO            = /app
SUCCESS_INVOICE_51_PURCHASE_GRANTS      = 1 (3 credits)
SUCCESS_INVOICE_51_LEDGER_ROWS          = 1 (+3 credits)
SUCCESS_INVOICE_51_IDEMPOTENCY_ROWS     = 1
SUCCESS_INVOICE_51_BALANCE              = 3 -> 6
SUCCESS_INVOICE_51_RESULT               = PASS (ResultURL-backed settlement and one grant)

SUCCESS_BROWSER_RETURN_PATH             = /app?payment=success&invoice_id=51
PAYMENT_RETURN_TOKEN_LEAK               = NONE (observed URL)
PAYMENT_RETURN_PII_LEAK                 = NONE (observed URL)
```

The success URL contained only the expected `payment` and `invoice_id`
parameters. Invoice 50 remains a separate provider-demo observation: the
Robokassa demo error button did not call FailURL and left that invoice
`pending`. It is not treated as a Dream Wheels handler failure.

## Final live acceptance

Invoice 52 was created through the ordinary WebApp UI and used only for the
deterministic staging FailURL handler smoke. The provider payment page was not
completed.

```ini
FAIL_INVOICE_52_STATUS                 = failed
FAIL_INVOICE_52_FAILED_AT              = PRESENT
FAIL_INVOICE_52_CLIENT_CHANNEL          = web
FAIL_INVOICE_52_RETURN_TO               = /app
FAIL_INVOICE_52_BALANCE                 = 0 -> 0
FAIL_INVOICE_52_PURCHASE_GRANTS         = 0
FAIL_INVOICE_52_LEDGER_ROWS             = 0
FAIL_INVOICE_52_HANDLER                 = PASS (HTTP 303, no follow-redirect)
FAIL_INVOICE_52_LOCATION                = /app?payment=fail&invoice_id=52
FAIL_INVOICE_52_BROWSER_RETURN          = PASS (authenticated cabinet; Сбой #52)

ROBOKASSA_FAILURL_CONFIG                = OWNER_VERIFIED_BY_USER
ROBOKASSA_DEMO_FAIL_REDIRECT            = NOT_REPRODUCIBLE (provider-side demo error; invoice 50)
PAYMENT_FAIL_HANDLER_STAGING_DIRECT     = PASS
PAYMENT_WEB_FAIL_RETURN_LIVE            = PASS (direct staging handler, invoice 52)
PAYMENT_WEB_SUCCESS_RETURN_LIVE         = PASS (invoice 51)
PAYMENT_WEB_RESULT_UI                   = PASS (success and fail browser returns open App)
PAYMENT_RETURN_TOKEN_LEAK               = NONE
PAYMENT_RETURN_PII_LEAK                 = NONE
PAYMENT_TELEGRAM_RETURN                 = PASS_AUTOMATED_PENDING_SAFE_LIVE_CONTEXT
PAYMENT_05B1_LIVE_ACCEPTANCE            = PASS_WITH_PROVIDER_LIMITATION
PR_164                                  = READY
MERGE                                   = NO
PRODUCTION                              = NOT_TOUCHED
```

The external staging merchant handlers remain:

```text
https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/result
https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/success
https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/fail
```

The Robokassa demo UI limitation is documented separately and does not block
the deterministic handler acceptance. #164 is ready for owner review and must
not be merged automatically.
