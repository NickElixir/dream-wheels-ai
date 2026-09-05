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
AUTH_EMAIL_TEMPLATE_MODE        = MAGIC LINK (not yet OTP)
AUTH_MAGIC_LINK_PRIMARY_FLOW    = YES (current state)
AUTH_CUSTOM_SMTP                = OFF
AUTH_DEFAULT_SUPABASE_SMTP      = IN_USE
SMTP_PROVIDER                   = PENDING (Resend is the approved default if no existing provider is supplied)
SMTP_SENDER                     = PENDING
SMTP_DOMAIN                     = PENDING
SMTP_VERIFIED                   = PENDING
SPF_STATUS                      = PENDING
DKIM_STATUS                     = PENDING
DMARC_STATUS                    = PENDING
```

The current default template has the subject `Your sign-in link` and its
primary action uses `{{ .ConfirmationURL }}`. The Dashboard prevents editing
the subject/body until custom SMTP is enabled. No sender domain was invented,
no DNS record was changed, and no email was sent.

When SMTP details and an approved sender are available, the template must use
`{{ .Token }}` as the primary content and must not make sign-in depend on
`{{ .ConfirmationURL }}`. The real message must not contain a literal example
OTP.

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
AUTH_EMAIL_TEMPLATE_MODE          = NO (external SMTP prerequisite)
AUTH_MAGIC_LINK_PRIMARY_FLOW      = NO (blocked by template edit prerequisite)
AUTH_OTP_LENGTH                   = PASS (6)
AUTH_OTP_EXPIRY                   = PASS (600)
AUTH_OTP_RESEND_WINDOW            = DOCUMENTED_DEFAULT (60; no Dashboard override)
AUTH_CUSTOM_SMTP                  = PENDING
AUTH_DEFAULT_SUPABASE_SMTP        = IN_USE
AUTH_CAPTCHA_PROVIDER             = PASS (Turnstile)
AUTH_CAPTCHA_STAGING              = PASS
AUTH_HARNESS_CAPTCHA_INTEGRATION  = PASS
AUTH_SECRETS_IN_GIT               = NONE
AUTH_OTP_MODULE_XSS_REVIEW        = PASS
AUTH_SLICE_5A_READY               = NO
CANONICAL_STAGING_AUTH_DEPLOY     = NO
PRODUCTION                        = NOT_TOUCHED
```

## External prerequisites for completion

1. An approved Resend (or already-approved alternative) account and SMTP/API
   credential, plus sender name and sender email on an already-owned Dream
   Wheels domain.
2. DNS access to add/verify the provider's SPF and DKIM records, and a DMARC
   policy decision without overwriting existing SPF records.
3. A deployment path for the already-created public Turnstile site key before
   the Slice 5B live OTP/session proof. The Turnstile secret is stored only in
   Supabase and is never supplied to the browser.
4. A deployment path for the public Supabase browser configuration before the
   Slice 5B live OTP/session proof.

References: [Supabase Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha).
