# Auth V1.1 Slice 3 — Persistent Supabase browser session

## Source-of-truth audit

```text
CURRENT_FRONTEND_DEPENDENCY_MODEL = no existing webapp package/build system
CURRENT_WEBAPP_BUILD_MODEL         = static index.html + app.js served by Vercel
CURRENT_WEBSITE_AUTH_STORAGE       = sessionStorage[dreamWheelsWebsiteAuth]
CURRENT_BOOTSTRAP_MODEL            = app.js module loaded from index.html
CURRENT_CSP                        = frame-ancestors only; no script-src restriction
CURRENT_BROWSER_TEST_INFRA         = no repository browser runner; static HTTP smoke available
```

The existing `webapp/app.js` and `dreamWheelsWebsiteAuth` storage were not
modified. The harness is a separate static page and is not linked from the
production WebApp.

## Dependency strategy

The WebApp had no package system, so this slice adds the smallest isolated npm
package under `webapp/` and bundles only the harness entrypoint with esbuild.
The production dependency is the pinned official `@supabase/supabase-js`
package; no CDN script is used. The generated bundle is served as a static
asset, so the existing WebApp deployment model remains intact.

Browser configuration is supplied through the optional global
`window.__DREAM_WHEELS_SUPABASE_CONFIG__`:

```js
{ url: "https://<project-ref>.supabase.co", publishableKey: "<publishable-key>" }
```

Only the Supabase URL and publishable key are browser-safe. The service-role
key, JWT signing secret and database password are not accepted by this module.

## Client configuration

`webapp/auth/supabase-client.js` creates one logical default Supabase client:

```text
persistSession       = true
autoRefreshToken     = true
detectSessionInUrl   = false
```

`detectSessionInUrl=false` is deliberate for this non-OAuth harness: it avoids
consuming URL fragments or treating arbitrary harness URLs as auth callbacks.
An explicit OAuth callback module can opt into URL detection in a later slice.

## Session API and state

The module exposes `initializeAuthSession`, `authSessionReady`, `getSession`,
`getAccessToken`, `refreshSession`, `signOut`,
`subscribeToAuthChanges` and `getAuthSessionState`.

State is intentionally metadata-only:

```text
status: BOOTSTRAPPING | UNAUTHENTICATED | AUTHENTICATED | REFRESHING
        | SESSION_EXPIRED | NETWORK_ERROR
sessionPresent: boolean
accessTokenExpiresAt: number | null
lastEvent: event name | null
errorCode: normalized code | null
```

The module does not copy access tokens, refresh tokens or raw session objects
into application state. `getAccessToken()` obtains the current token on demand
from the SDK. The SDK alone owns persistence, rotation, storage and cross-tab
coordination; no custom storage key, cookie, IndexedDB store, BroadcastChannel
or refresh loop was added.

## Lifecycle behavior

- initialization waits for SDK `getSession()` and resolves `authSessionReady`;
- `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED` and
  `USER_UPDATED` update only the isolated state model;
- successful refresh remains authenticated and emits `TOKEN_REFRESHED`;
- temporary refresh/network errors become `NETWORK_ERROR` without calling
  `signOut()` or clearing persisted SDK state;
- invalid/revoked refresh errors become `SESSION_EXPIRED`, still without a
  custom destructive cleanup path;
- logout delegates to `supabase.auth.signOut()` and clears only SDK-owned auth
  storage; unrelated Dream Wheels storage is untouched.

## Multi-tab and harness

`webapp/auth/harness.html` is a minimal non-production-facing surface with
safe diagnostics only: state, authority, session presence and access-token
expiry timestamp. It provides read, controlled refresh and sign-out actions.
It never displays tokens, raw session JSON, email, JWT payloads or raw SDK
errors. It is not imported by `webapp/index.html` or `webapp/app.js`.

The SDK is expected to coordinate the same persisted session across tabs. No
custom cross-tab mechanism was introduced.

## Tests and live status

`npm test` passes 9 deterministic mocked lifecycle tests. They cover no stored
session, stored-session restore, on-demand token access, auth events, refresh,
temporary failure and recovery, permanent expiry, logout, and a second tab
restoring the same shared session.

The harness bundle builds with `npm run build`. A static HTTP smoke confirmed
the harness assets are served. Real authenticated browser persistence,
tab-close/reopen and browser-restart behavior remain `PENDING`: no safe
developer Supabase session was available, the repository `agent-browser` CLI is
not installed, and the available browser surface rejected localhost because
its admin security check was unavailable. No credentials were entered.

## Security review

The module has no token logging, raw session logging, `innerHTML` usage, token
URL/DOM/analytics/error-reporting path, custom token copy or unrelated storage
cleanup. `AUTH_SESSION_MODULE_XSS_REVIEW` is PASS for this isolated module;
the final production Auth UI review remains deferred until provider flows exist.

## Scope boundaries

No Email OTP, `app.js` bootstrap integration, authenticated fetch wrapper,
jobs/history/wallet/Fitment/payment integration, endpoint cutover, Telegram
storage migration or production deployment was performed.

## Gates

```text
AUTH_SUPABASE_BROWSER_CLIENT             = PASS
AUTH_PERSIST_SESSION                     = PASS (SDK configuration)
AUTH_AUTO_REFRESH                        = PASS (SDK configuration)
AUTH_INITIAL_SESSION_RESTORE             = PASS (mocked; live PENDING)
AUTH_SESSION_READY_BOUNDARY              = PASS
AUTH_ACCESS_TOKEN_ON_DEMAND              = PASS
AUTH_CUSTOM_TOKEN_COPY                   = NONE
AUTH_CUSTOM_REFRESH_IMPLEMENTATION       = NONE
AUTH_SESSION_RELOAD_RESTORE              = PASS (mocked; live PENDING)
AUTH_TAB_REOPEN_RESTORE                  = PENDING (live browser)
AUTH_BROWSER_RESTART_RESTORE             = PENDING (live browser)
AUTH_REFRESH_EVENT                       = PASS
AUTH_TEMP_NETWORK_FAILURE_NONDESTRUCTIVE = PASS
AUTH_SESSION_RECOVERY                    = PASS
AUTH_LOGOUT                              = PASS (mocked; live PENDING)
AUTH_MULTI_TAB_BASIC                     = PASS (mocked; live PENDING)
AUTH_SESSION_MODULE_XSS_REVIEW           = PASS
AUTH_EMAIL_OTP                           = NOT_STARTED
AUTH_APP_BOOTSTRAP_INTEGRATION           = NONE
AUTH_ENDPOINT_CUTOVER                    = NONE
TELEGRAM_AUTH_REGRESSION                 = NONE
FULL_TEST_SUITE                          = PASS
CI                                       = PENDING (after push)
PR_159                                   = DRAFT
CANONICAL_STAGING_AUTH_DEPLOY            = NO
PRODUCTION                               = NOT_TOUCHED
AUTH_SLICE_3_READY                       = YES
```

Next slice: Email OTP core, isolated OTP harness, normalized OTP errors and
approved Auth telemetry events. Broad `app.js` and endpoint integration remain
blocked by the 03B barrier.
