# Auth V1.1 Slice 5A — staging Auth configuration

## Scope and boundary

This record covers the canonical staging Supabase project, `Dream Wheels AI
Staging` (`hnawojlnfoaccinlgjyn`). It does not change production, the main
`webapp/app.js` bootstrap, protected routes, authenticated request handling,
or the 03B gate.

## Verified Dashboard configuration

Dashboard values were read again before changing any setting. On 2026-09-05,
the following approved Email-provider settings were saved and then verified by
reopening the provider panel:

```text
AUTH_EMAIL_PROVIDER             = ENABLED
AUTH_NEW_USER_SIGNUP            = ENABLED
AUTH_EMAIL_OTP_LENGTH           = 6 digits
AUTH_EMAIL_OTP_EXPIRY           = 600 seconds
AUTH_OTP_RESEND_WINDOW          = 60 seconds (Supabase documented default; no project override is exposed)
AUTH_VERIFY_LIMIT               = 30 requests / 5 minutes / IP
AUTH_SIGNIN_LIMIT               = 30 requests / 5 minutes / IP
```

Supabase's email OTP controls also govern the validity of email links. The
separate resend interval is not a visible Dashboard setting. The harness uses
60 seconds only as client-side cooldown guidance; Supabase remains authoritative.

## Email delivery

```text
AUTH_EMAIL_TEMPLATE_MODE        = OTP TOKEN (saved and read back)
AUTH_MAGIC_LINK_PRIMARY_FLOW    = NO
AUTH_CUSTOM_SMTP                = ON (saved and read back)
AUTH_DEFAULT_SUPABASE_SMTP      = NOT IN USE
SMTP_PROVIDER                   = Resend (smtp.resend.com:465; staging readback)
SMTP_SENDER                     = Dream Wheels <no-reply@auth.dreamwheels.pro>
SMTP_DOMAIN                     = auth.dreamwheels.pro
SMTP_VERIFIED                   = CONFIGURED; live delivery pending
SPF_STATUS                      = PENDING
DKIM_STATUS                     = PENDING
DMARC_STATUS                    = PENDING
```

The staging SMTP readback showed custom SMTP enabled, Resend host
`smtp.resend.com`, port `465`, minimum per-user interval `60` seconds, and the
approved sender above. Credentials remain masked by Supabase and are not
recorded here.

The staging `Magic link or OTP` template readback showed `{{ .Token }}` as the
only sign-in value in the body and no `{{ .ConfirmationURL }}`. The real
message must not contain a literal example OTP.

## Live staging E2E checkpoint

The canonical staging alias was deployed only in the staging Vercel project on
2026-09-05. Deployment `dpl_6bB1rRyfSsHiDv5Hb1H4Tf5EB3FS` reached `READY` and
was aliased to `https://dream-wheels-ai-webapp-staging.vercel.app` after the
staging backend guard passed. The live static checks returned `200` for
`/auth/harness.html`, `/auth/harness-config.js`, and `/auth/harness.bundle.js`.

The browser showed the isolated harness in an unauthenticated state and the
real Managed Turnstile challenge completed with a visible success result.
No OTP request has been sent yet because the external test inbox has not been
identified in this run. The remaining evidence is therefore intentionally
pending: Supabase OTP request, Resend delivery and `Delivered` status, exact
message inspection, `verifyOtp`, session creation, and reload persistence.

## CAPTCHA and isolated harness

```text
AUTH_CAPTCHA_PROVIDER           = TURNSTILE (Cloudflare)
AUTH_CAPTCHA_STAGING            = PASS (saved and re-verified in Supabase)
AUTH_CAPTCHA_HOSTNAMES          = dream-wheels-ai-webapp-staging.vercel.app only
AUTH_HARNESS_CAPTCHA_INTEGRATION = PASS (configuration-ready, no key committed)
```

The harness accepts a public `turnstileSiteKey` from the existing trusted
runtime configuration. With that key it renders Cloudflare's explicit
Turnstile widget, requires a fresh completion token before `signInWithOtp`,
passes the token as `captchaToken`, and resets it after each request. The
Turnstile secret is never read by the harness or bundled into the browser.

The approved staging hostname strategy is the explicit staging alias
`dream-wheels-ai-webapp-staging.vercel.app`; do not use a wildcard or grant
arbitrary preview hostnames. Add other hostnames only when a specifically
approved isolated-harness deployment requires one.

The deployment-time public configuration shape is:

```js
globalThis.__DREAM_WHEELS_AUTH_CONFIG__ = {
  site: "ru",
  otpLength: 6,
  resendWindowSeconds: 60,
  turnstileSiteKey: "public-site-key-only",
  analyticsEndpoint: "/api/backend/analytics/events",
};
```

## Security audit

The isolated code sends no email address, OTP, CAPTCHA token, session, access
token, refresh token, or raw provider error to telemetry. The CAPTCHA token is
sent only to Supabase as the documented `captchaToken` option. No SMTP
credential, Turnstile secret, Supabase service-role key, or JWT secret is in
the committed changes.

## Slice 5A readiness

```text
AUTH_EMAIL_TEMPLATE_MODE          = PASS (OTP token; no ConfirmationURL)
AUTH_MAGIC_LINK_PRIMARY_FLOW      = NO (blocked by template edit prerequisite)
AUTH_OTP_LENGTH                   = PASS (6)
AUTH_OTP_EXPIRY                   = PASS (600)
AUTH_OTP_RESEND_WINDOW            = DOCUMENTED_DEFAULT (60; no Dashboard override)
AUTH_CUSTOM_SMTP                  = PASS (Resend)
AUTH_DEFAULT_SUPABASE_SMTP        = NOT IN USE
AUTH_CAPTCHA_PROVIDER             = PASS (Turnstile)
AUTH_CAPTCHA_STAGING              = PASS
AUTH_HARNESS_CAPTCHA_INTEGRATION  = PASS
AUTH_HARNESS_LIVE_DEPLOY          = PASS (canonical staging)
AUTH_TURNSTILE_LIVE               = PASS (Managed challenge)
AUTH_EMAIL_OTP_LIVE_E2E           = PENDING (external test inbox required)
AUTH_SECRETS_IN_GIT               = NONE
AUTH_OTP_MODULE_XSS_REVIEW        = PASS
AUTH_SLICE_5A_READY               = PASS
CANONICAL_STAGING_AUTH_DEPLOY     = PASS (staging only)
PRODUCTION                        = NOT_TOUCHED
```

## External prerequisites for completion

1. Resend account, SMTP credential, approved sender, and `auth.dreamwheels.pro`
   domain: DONE (staging dashboard readback).
2. DNS verification for the sender domain: reported complete by the user;
   live delivery evidence is still pending.
3. Public Turnstile site key and Supabase secret configuration: DONE for the
   explicit staging alias. The secret is stored only in Supabase and is never
   supplied to the browser.
4. Public Supabase browser configuration and live harness deployment: DONE for
   canonical staging.

References: [Supabase Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha).
