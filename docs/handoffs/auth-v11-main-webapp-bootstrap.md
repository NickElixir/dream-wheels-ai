# Dream Wheels AI — Auth V1.1 Slice 6A/6B Handoff

Status: Slice 6A/6B implementation complete, Draft PR only. Live protected API
browser evidence is still required before the integration PR can be reviewed.

## Baseline and boundary

```text
BASELINE_SHA                       = 786170342ab64cc205775feb4090888b4126d5d7
BRANCH                             = feature/auth-v11-integration
BASE                                = staging
HEAD                                = see PR #162 (current branch head)
PR                                  = 162 (Draft)
PRODUCTION                         = NOT_TOUCHED
INTEGRATION_PR                     = DRAFT
MERGE_INTEGRATION_PR               = NO
```

The accepted Supabase foundation remains the single source of truth for the
browser client, persistent session, OTP operations, Turnstile token handling,
refresh/sign-out behavior, and auth telemetry. Slice 6A adds the main WebApp
bridge and UI; Slice 6B adds the central provider-aware request boundary and
protected application cutover. See
`docs/handoffs/auth-v11-request-boundary.md` for the full inventory.

## Current legacy Auth audit

Before this slice, `webapp/app.js` used:

- `state.websiteAuth` backed by `sessionStorage` under
  `dreamWheelsWebsiteAuth` for website Telegram login;
- `getWebsiteAuthToken()` as the synchronous legacy bearer source;
- `withAuthHeaders()` as the synchronous legacy-only Authorization wrapper;
- `getIdentityPayload()` and `getIdentitySearchParams()` for Telegram Mini App
  and development website identity;
- `hasFrontendAuth()` as the gate for cabinet, history, fitment and other
  protected loaders;
- `DOMContentLoaded` bootstrap that called `loadDashboardData()` after basic
  rendering;
- existing Telegram Mini App and website Telegram login handlers.

The critical finding was that `hasFrontendAuth()` could not become a direct
alias for Supabase authentication while `withAuthHeaders()` remained legacy
only. That would create a UI/API split-brain state.

## Integration packaging

`webapp/auth/app-auth.js` is bundled as
`webapp/auth/app-auth.bundle.js` with the existing pinned esbuild toolchain.
The bundle exposes the narrow `window.DreamWheelsAuth` API:

```text
configure()
isIntegrationEnabled()
initialize()
getState()
subscribe(listener)
requestEmailOtp(email, captchaToken)
verifyEmailOtp(email, otp)
probeCurrentUser()
signOut()
```

The raw Supabase client, session object, access token, refresh token, OTP and
JWT claims are not exposed by this integration API. There remains one logical
Supabase browser client, supplied by `supabase-client.js`.

The existing `app.js` remains a module and was not converted to a new frontend
framework or whole-app ESM architecture.

## Frontend Auth state

The bridge owns this provider-neutral state shape:

```js
{
  status: "BOOTSTRAPPING" | "UNAUTHENTICATED" | "AUTHENTICATED"
    | "NETWORK_ERROR" | "SESSION_EXPIRED",
  authority: null | "telegram" | "supabase",
  authChannel: null | "mini_app" | "website_telegram" | "email_otp",
  principalVerified: boolean,
  protectedApiReady: boolean,
  sessionPresent: boolean,
  errorCode: null | string
}
```

No credential or raw session is stored in this state. The email and OTP fields
are transient login-form values, separate from the central Auth state, and are
never sent to telemetry.

Current application behavior:

```text
Supabase AUTHENTICATED       -> protectedApiReady = true after /auth/me probe
Legacy Telegram authenticated -> protectedApiReady = true
Telegram Mini App             -> protectedApiReady = true
```

## Authority precedence and dual sessions

1. A valid Telegram Mini App runtime keeps `telegram / mini_app` authority and
   Supabase initialization does not override it.
2. On a normal website, a persisted Supabase session is probed through the
   same-origin `/api/backend/auth/me` route. A verified 200 selects
   `supabase / email_otp`.
3. If no Supabase session exists, a valid existing website Telegram session
   remains the fallback as `telegram / website_telegram`.
4. If both sessions exist, Supabase wins for UI identity only; the legacy
   credential is not combined with it and protected loaders remain disabled
   until Slice 6B.
5. A Supabase `/auth/me` 401 becomes `SESSION_EXPIRED` without silently
   downgrading to Telegram. A temporary network failure becomes
   `NETWORK_ERROR` without destructive sign-out.

## Bootstrap and UI behavior

The main page now initializes the bridge after basic DOM setup and before the
dashboard data phase. The bridge restores persistent Supabase state, probes
`/api/backend/auth/me`, and publishes the central state before protected
loaders are allowed to run.

The normal website login surface is an accessible production-shaped dialog:

```text
Войти в Dream Wheels
  -> email
  -> Managed Turnstile
  -> Получить код
  -> six-digit code
  -> Войти
```

It also supports resend cooldown, change-email, paste/one-time-code input,
safe normalized errors, keyboard labels and status announcements. Telegram is
kept as an explicit secondary action. The generic website login button uses a
neutral account icon.

When the Supabase principal probe succeeds, dashboard, cabinet, history,
render, fitment, asset and payment requests use the central asynchronous
boundary. A missing authority fails locally; a Supabase `401` gets one
single-flight refresh/retry, while payment creation opts out of retry. Guest
and Telegram behavior remains available where it was already allowed.

## `/auth/me` boundary

`probeCurrentUser()` is the only Supabase-authenticated backend request added
in this slice. It obtains a token on demand from the existing session
controller, sends it only to `/api/backend/auth/me`, and discards the local
reference after the request. A successful response must identify an
authenticated Supabase principal. This is not a general authenticated fetch
wrapper.

`withAuthHeaders()` remains legacy-only by design, while
`authenticatedFetch()` selects the active provider and overwrites only the
Authorization header. `getIdentityPayload()` also returns no Telegram identity
when the current UI authority is Supabase, which prevents a simultaneous
local/development Telegram identity from leaking into protected requests.

## Rollout guard

`harness-config.js` carries the public, non-secret staging Auth configuration.
`app-auth.js` requires both `mainWebAppEnabled` and an allowlisted host:

- canonical staging host;
- the `feature-auth-v11-integration` Vercel preview host pattern;
- local development hosts.

This prevents the incomplete Supabase UI integration from becoming the public
production login path while Slice 6B is pending. Production was not deployed
or edited.

## Telemetry and security

The existing Auth telemetry owner remains `supabase-client.js` and
`telemetry.js`; the WebApp bridge does not emit duplicate Auth events. The
approved telemetry allowlist excludes email, OTP, CAPTCHA token, Supabase UUID,
canonical user ID, access/refresh tokens, raw session, JWT and raw provider
errors.

Auth-derived UI values use `textContent` or controlled form values. The new
dialog does not interpolate auth data into HTML. Focused XSS review of touched
Auth code passed; a full-app browser-storage XSS review is intentionally not
claimed in this slice.

No CSP broadening was added. Turnstile is loaded only from its documented
Cloudflare origin when the dialog is opened.

## Verification

```text
AUTH_CENTRAL_FRONTEND_STATE              = PASS (bridge unit tests)
AUTH_DUAL_SESSION_SPLIT_BRAIN_TEST       = PASS
AUTH_UI_API_SPLIT_BRAIN                   = NONE
AUTH_PROTECTED_API_READY_SUPABASE         = PASS (after principal probe)
AUTH_MASS_ENDPOINT_CUTOVER                = PASS (Slice 6B boundary)
AUTH_AUTHENTICATED_FETCH_WRAPPER          = PASS (automated)
AUTH_6A_PROTECTED_API_ACCIDENTAL_CUTOVER  = NONE (contract + guards)
AUTH_6A_WRONG_AUTHORITY_REQUEST           = NONE (contract + guards)
AUTH_6A_XSS_REVIEW                        = PASS (focused)
FULL_AUTOMATED_TESTS                       = PASS
GITHUB_CI                               = PASS (latest run for current head)
```

Automated Auth tests pass, the new app-auth bundle builds, and the main page
and static asset references are present. Rendered browser preview could not be
run in this environment: the Browser/CUA runtime timed out and no local
Browser CLI or Playwright installation is available. Therefore the following
remain pending direct browser evidence:

```text
VERCEL_PREVIEW                         = PASS (deployment status)
AUTH_EMAIL_LOGIN_SURFACE_BROWSER       = PENDING
AUTH_TURNSTILE_MAIN_UI_BROWSER         = PENDING
AUTH_TELEGRAM_WEBSITE_BROWSER          = PENDING
AUTH_TELEGRAM_MINI_APP_BROWSER         = PENDING
AUTH_6A_RESPONSIVE_BROWSER             = PENDING
```

## Deferred work

Live browser evidence on a preview built from the current PR is still needed
for the protected cabinet/history/render flows, and a safe live Telegram
context remains optional regression evidence. The canonical staging URL
currently points to an older deployment; production was not touched.

```text
AUTH_6A_READY                           = YES
AUTH_6B_IMPLEMENTATION                  = YES
AUTH_6B_LIVE_ACCEPTANCE                 = PENDING
MERGE_INTEGRATION_PR                    = NO
RECOMMENDATION                          = KEEP PR #162 DRAFT UNTIL LIVE GATES PASS
```
