# Auth V1.1 — Final Closeout

Recorded: 2026-09-08. This is the final staging handoff for Release 1. It
supersedes earlier pre-acceptance handoffs whose statuses still describe PR
#162 as Draft or the gateway fix as pending. No production configuration was
changed.

## Canonical staging state

```ini
BASE                                = staging
POST_MERGE_STAGING_SHA              = a3d79ea38eb770a73d6f16c9c6a571192435e8cb
PR_165                              = MERGED
ACCEPTED_RUNTIME_SHA                = a3d07e73496d4da7f752af7437b9ef4794ce8895
RUNTIME_EQUIVALENCE                 = PASS (only docs differ after accepted runtime)
CANONICAL_VERCEL_STAGING            = https://dream-wheels-ai-webapp-staging.vercel.app
CANONICAL_VERCEL_DEPLOYMENT         = dpl_ABt9ug2Da7R5saHDQSHeEhbNPUJE
PRODUCTION                          = NOT_TOUCHED
```

The accepted application runtime remains the deployed Vercel staging runtime;
the #165 merge added the gateway handoff documentation without changing
`src/`, `webapp/`, tests, migrations, or payment code. Render staging and the
canonical Vercel gateway both passed the post-merge smoke.

## Live and automated acceptance

```ini
RENDER_HEALTH                       = PASS (/health 200)
VERCEL_GATEWAY_HEALTH               = PASS (/api/backend/health 200)
GATEWAY_DEEP_PATH                   = PASS (/api/backend/auth/telegram/nonce 200)
PROTECTED_API_SMOKE                 = PASS (/auth/me, /payments/cabinet, /jobs 200)
APP_NEW_AUTH_ENTRY                 = PASS
SESSION_RELOAD_RESTORE              = PASS
SESSION_NEW_TAB_RESTORE             = PASS
LOGOUT_AND_POST_LOGOUT_GUARD        = PASS
CANONICAL_HISTORY_ISOLATION         = PASS
AUTH_BROWSER_STORAGE_XSS_REVIEW     = PASS
AUTH_TOKEN_LEAK                     = NONE
AUTH_POST_LOGIN_OPEN_REDIRECT       = NONE
```

The deep-path smoke used the existing read-only Telegram nonce route because
the current account had no owned job asset URL. No job, payment, or generation
operation was created. The gateway rejected host-switching path forms in unit
coverage and preserved method, query, headers, body, and response bytes for a
valid deep path.

`/auth/bootstrap` remains an informational account-provisioning endpoint, not
a separate gateway-security blocker. The representative protected request
smoke already proves the gateway-to-Render authenticated path required for
this slice. Forced live expiry/refresh and a safe Telegram live account smoke
remain non-blocking; automated refresh and Telegram regression coverage pass.

## Repository verification

Executed from a clean worktree based on the post-merge staging tree:

```ini
FULL_PYTEST                         = PASS (502 passed, 5 skipped)
AUTH_FOCUSED_PYTEST                 = PASS (51 passed, 2 skipped)
FRONTEND_AUTH_TESTS                 = PASS (43 passed)
FRONTEND_BUILD                      = PASS
GATEWAY_NODE_TESTS                  = PASS (3 passed)
RUFF_CHECK                          = PASS
RUFF_FORMAT                         = PASS
COMPILEALL                          = PASS
GIT_DIFF_CHECK                      = PASS
```

No source or runtime files are changed by this closeout branch. The only
changes are this handoff, the reconciled Release 1 scope, and the corrected
post-merge gateway handoff status.

## Auth V1.1 final decision

```ini
AUTH_V1_1_CORE                      = CLOSED
AUTH_V1_1                          = CLOSED
AUTH_V1_1_CLOSEOUT                 = PASS
AUTH_GATEWAY_REGRESSION            = NONE
GATEWAY_HOST_CONTROL_HARDENING     = CLOSED
AUTH_TELEGRAM_LIVE_SMOKE           = NON_BLOCKING_PENDING_SAFE_CONTEXT
AUTH_FORCED_REFRESH_LIVE           = NON_BLOCKING_PENDING_FORCED_EXPIRY
PRODUCTION_AUTH_WIRING             = PENDING
PRODUCTION                         = NOT_TOUCHED
```

The next product work is the separately scoped `05B.1 Payment Return Routing`
workstream. Its PR #164 was not edited, merged, or included in this closeout.
Production Auth wiring requires a separate owner-approved release and is not
implied by the staging closeout.
