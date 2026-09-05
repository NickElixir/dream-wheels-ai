# Auth V1.1 Slice 4 — Email OTP core

## Scope

This slice adds the first non-Telegram authentication flow to the isolated auth
harness only. The main Dream Wheels WebApp, `webapp/app.js`, protected routes,
and canonical authenticated request path remain unchanged behind the 03B
barrier.

## Staging source-of-truth audit

Project: `Dream Wheels AI Staging` (`hnawojlnfoaccinlgjyn`), active and healthy.

The public Auth settings response confirms:

```text
SUPABASE_EMAIL_AUTH_ENABLED = PASS (email auth available; disable_signup=false)
SUPABASE_EMAIL_TEMPLATE_MODE = PENDING (Dashboard requires manual sign-in)
SUPABASE_OTP_LENGTH          = PENDING (Dashboard requires manual sign-in)
SUPABASE_OTP_EXPIRY          = PENDING (Dashboard requires manual sign-in)
SUPABASE_OTP_RESEND_WINDOW   = PENDING (Dashboard requires manual sign-in)
SUPABASE_OTP_RATE_LIMIT      = PENDING (Dashboard/private config)
SUPABASE_SMTP_MODE           = PENDING (Dashboard/private config)
SUPABASE_CAPTCHA_STATUS      = PENDING (Dashboard/private config)
```

Confirmed public values: `disable_signup=false`, `mailer_autoconfirm=false`,
and `passkeys_enabled=false`. The first two mean that a new email may create a
Supabase user and that verification is required. The public endpoint does not
expose the email template, SMTP, CAPTCHA, or project-specific rate limits.
The Dashboard redirected to Supabase sign-in, so no credentials or OTPs were
entered and no configuration was guessed from defaults.

Supabase's current documentation describes Email OTP as a six-digit code and
documents a default one-request-per-60-seconds window and one-hour expiry, but
these remain fallback/documentation values until the staging Dashboard is
confirmed. The harness accepts optional trusted deployment config:

```js
globalThis.__DREAM_WHEELS_AUTH_CONFIG__ = {
  site: "ru",
  otpLength: 6,
  resendWindowSeconds: 60,
  analyticsEndpoint: "/api/backend/analytics/events",
};
```

The fallback countdown is UX guidance only; Supabase remains authoritative.

## Dependency and client contract

The official pinned `@supabase/supabase-js@2.115.0` client from Slice 3 is
reused. No CDN SDK or second auth client was introduced. The client continues
to use:

```text
persistSession: true
autoRefreshToken: true
detectSessionInUrl: false
```

The isolated module exposes:

```js
requestEmailOtp(email, captchaToken?)
verifyEmailOtp(email, otp)
```

`requestEmailOtp` calls `signInWithOtp` with `shouldCreateUser: true`; success
means Supabase accepted the request and returns no session yet. It returns only
`{ accepted: true }` to the harness. `verifyEmailOtp` calls
`verifyOtp({ email, token, type: "email" })`, requires a returned session, lets
the Slice 3 controller restore it, and returns only `{ authenticated: true }`.
No tokens are copied, logged, placed in URLs, or rendered.

The Email OTP flow intentionally does not use `emailRedirectTo`, magic-link
handling, password auth, or OAuth providers. The staging Magic Link/OTP email
template must contain `{{ .Token }}` rather than a confirmation URL before a
live OTP run can be marked PASS.

## Error normalization

The module maps provider failures to the safe allowlist:

| Provider condition | Normalized code |
| --- | --- |
| empty/invalid OTP | `invalid_otp` |
| `otp_expired`, expired token | `expired_otp` |
| HTTP 429, email-send rate limit | `rate_limited` |
| fetch timeout/offline/retryable fetch | `network_error` |
| no session after successful verification | `session_missing` |
| other Auth/provider failure | `provider_error` |
| invalid local input without a more specific code | `unknown` |

Raw Supabase messages are not sent to the UI or analytics. A 429 is a generic
retry-later message. The UI does not distinguish whether an email already has
an account, preserving anti-enumeration behavior.

## Harness behavior

The harness now supports:

```text
Email → Send code → OTP input → Verify → authenticated session
       ↘ Resend with cooldown
authenticated session → Refresh session → Sign out
```

The OTP input uses numeric input mode, one-time-code autocomplete, whitespace
trimming, empty-submit prevention, and paste-compatible normal browser input.
The resend countdown is configurable and cannot be used as a security control.

## Telemetry contract

Telemetry uses the existing `POST /analytics/events` endpoint and
`analytics_events` table. No second telemetry backend was created. The
backend allowlist and migration `0032_auth_v11_telemetry_allowlist.sql` add:

```text
auth_started
otp_requested
otp_verified
session_restored
session_refresh_failed
auth_failed
auth_signed_out
```

`auth_completed` remains in the existing allowlist and is emitted after the
session is actually established. The expected successful sequence is:

```text
auth_started → otp_requested → otp_verified → auth_completed
```

Session restoration emits one `session_restored` event for
`INITIAL_SESSION + session`. Successful token refresh emits no telemetry.
Final refresh failure emits `session_refresh_failed`; completed logout emits
`auth_signed_out`.

Every auth event is sent with only:

```json
{
  "provider": "email",
  "authority": "supabase",
  "flow": "otp",
  "site": "ru",
  "outcome": "success"
}
```

Failure events may additionally contain one allowlisted `error_code`. The site
is derived from trusted auth/deployment configuration and defaults to the
current staging convention `ru`; URL query parameters are not trusted for it.
Visitor/UTM attribution reuses the existing analytics storage identifiers.

The telemetry adapter filters all other fields. It never sends email, OTP,
access token, refresh token, authorization code, raw session, user metadata, or
raw provider error. Telemetry is best-effort and catches both rejected and
synchronous failures, so analytics cannot block OTP verification, session
restore, refresh, or logout.

## Database rollout

The new allowlist migration was applied to canonical staging analytics schema
and verified read-only. The existing constraint
`analytics_events_event_name_check` now includes all seven new auth events plus
the existing product events. No Auth runtime deployment, route cutover, or
production change was made.

## Verification

```text
AUTH_OTP_UNIT_TESTS               = PASS (18)
AUTH_OTP_REQUEST                  = PASS (valid, invalid, 429, network)
AUTH_OTP_VERIFY                   = PASS (success, invalid, expired, missing session)
AUTH_NEW_SUPABASE_SESSION         = PASS (mocked)
AUTH_RATE_LIMIT_NORMALIZATION     = PASS
AUTH_NETWORK_ERROR_NORMALIZATION  = PASS
AUTH_TELEMETRY_SAFE_FIELDS        = PASS
AUTH_ANALYTICS_NON_BLOCKING       = PASS
AUTH_SESSION_RESTORED_EVENT       = PASS (exactly once)
AUTH_REFRESH_FAILURE_EVENT        = PASS
AUTH_SIGNOUT_EVENT                = PASS
AUTH_OTP_MODULE_XSS_REVIEW        = PASS
```

Live email delivery and browser session proof remain pending. No safe staging
test email was available, and Dashboard access requires user authentication.
The available browser tooling cannot complete that external credential/OTP
step without user participation.

## Security review

New OTP/harness code uses `textContent`, never `innerHTML` with auth data. It
does not log or render OTPs, tokens, raw sessions, email, JWTs, or raw errors.
Analytics is allowlisted and has no auth secrets in its payload. The full
`AUTH_BROWSER_STORAGE_XSS_REVIEW` remains deferred until production Auth UI and
provider flows exist.

## DoD status

```text
AUTH_EMAIL_OTP_CORE            = PASS
AUTH_OTP_REQUEST               = PASS
AUTH_OTP_VERIFY                = PASS
AUTH_NEW_SUPABASE_SESSION      = PASS (mocked; live PENDING)
AUTH_MAGIC_LINK                = NONE
AUTH_PASSWORD                  = NONE
AUTH_TELEMETRY                 = PASS
AUTH_ANALYTICS_NON_BLOCKING    = PASS
AUTH_STAGING_OTP_DELIVERY      = PENDING
AUTH_SMTP_PRODUCTION_READY     = NO / PENDING audit
AUTH_ABUSE_PROTECTION          = PENDING
AUTH_LIVE_EMAIL_OTP            = PENDING
AUTH_LIVE_SESSION_CREATED      = PENDING
AUTH_LIVE_RELOAD_RESTORE       = PENDING
AUTH_LIVE_TAB_REOPEN_RESTORE   = PENDING
AUTH_LIVE_LOGOUT               = PENDING
AUTH_APP_BOOTSTRAP_INTEGRATION = NONE
AUTH_ENDPOINT_CUTOVER          = NONE
AUTH_OAUTH_PROVIDERS           = NONE
TELEGRAM_AUTH_REGRESSION       = NONE
PRODUCTION                     = NOT_TOUCHED
```

## Next slice

Slice 5A: production-readiness preparation for custom SMTP and Turnstile,
including staging configuration audit and abuse-protection verification. Main
WebApp integration and the central authenticated request wrapper remain behind
the 03B barrier.

References: [Supabase passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits), [Supabase CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha).
