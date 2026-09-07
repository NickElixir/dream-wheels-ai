# Dream Wheels AI — Auth V1.1 Release 1 Scope

Status: reconciled against the merged `staging` tree on 2026-09-08. This
document is the canonical Release 1 scope. It supersedes the broader provider
target list in historical PR #157; PR #157 itself remains open and was not
merged.

## Release 1 decision

Release 1 web authentication has exactly two active authorities:

```ini
AUTH_RELEASE_1_AUTHORITIES = supabase, telegram
AUTH_RELEASE_1_WEB_FLOW    = Email OTP through Supabase
AUTH_RELEASE_1_TELEGRAM    = existing Telegram website / Mini App compatibility
AUTH_SOCIAL_OAUTH          = NONE
```

Email OTP is the primary ordinary-web login. The browser keeps the Supabase
session in the Supabase-managed persistent session store, obtains a bearer on
demand, verifies the canonical backend principal through `/auth/me`, and only
then enables protected application requests. The backend resolves the
verified Supabase subject or Telegram identity to canonical `users.id` through
`user_identities`.

Telegram remains a supported legacy website/Mini App authority. It is not a
new social-provider expansion and is not automatically linked to a Supabase
account. Existing Telegram routes, credits, history ownership, and the
provider-neutral principal boundary remain intact.

## Explicitly deferred

The following are not Release 1 login buttons, runtime authorities, or
acceptance blockers:

```ini
YANDEX_AUTH              = DEFERRED
VK_AUTH                  = DEFERRED
GOOGLE_AUTH              = DEFERRED
APPLE_AUTH               = DEFERRED
MICROSOFT_AUTH           = DEFERRED
MAX_EXTERNAL_WEB_LOGIN   = DEFERRED
AVITO_CONSUMER_LOGIN     = OUT_OF_SCOPE
```

MAX Mini App authentication may be considered as a separate future capability;
it must not be treated as ordinary external web login. Provider additions
require a separate capability, security, redirect, consent, identity-linking,
and staging-acceptance review.

## In-scope security and product invariants

- no password, SMS, custom Dream Wheels session, SSR/BFF session layer, or
  cross-domain SSO;
- no automatic account linking by email, username, display name, browser,
  IP, or payment data;
- authenticated API requests use the authority selected by the auth state
  machine; a failed Supabase JWT cannot fall back to legacy Telegram auth;
- app routes are guest-gated before protected data calls;
- reload, new-tab restore, logout, and account isolation preserve canonical
  ownership;
- auth telemetry is best-effort and excludes email, OTP, access/refresh
  tokens, JWTs, raw sessions, CAPTCHA tokens, and raw provider errors;
- the existing credits ledger remains authoritative and payment routing stays
  outside this release closeout.

## Reconciliation of historical PRs

| PR | State | Release 1 treatment |
| --- | --- | --- |
| #140 | Open | Gateway origin-control slice was extracted and merged separately as #165. OAuth/cookie-session work remains deferred. |
| #142 | Open, conflicting | Historical identity-foundation reference only. Current staging already contains the reconciled identity schema/service and no commit was cherry-picked from this branch. |
| #157 | Open | Historical scope proposal. Its future-provider target list is superseded by this Email OTP + Telegram-only Release 1 decision. |
| #163 | Open | Domain/landing/app routing planning input only; it is not merged by this closeout. |
| #164 | Open Draft | Payment Return Routing remains a separate workstream and was not modified. |
| #165 | Merged | Gateway host-control hardening is closed; post-merge health, protected, and deep-path smokes passed. |

PR #162 and the Auth V1.1 runtime work already integrated into `staging` are
the accepted application baseline. This closeout adds documentation only.

## Provider-leftover audit

The repository audit found no active Yandex, VK, Google, Apple, Microsoft,
MAX, or Avito consumer-auth implementation. The only active external auth
references are Supabase Email OTP and Telegram. `oauth.telegram.org` is an
intended Telegram authority, not deferred social-OAuth residue. Generic uses
of the word “provider” in image generation, fitment, and payment code are
unrelated service providers and do not implement authentication.

## Release 1 acceptance result

The accepted staging runtime passed the Email OTP browser flow, session
creation, reload/new-tab restore, protected API smoke, logout, canonical-user
isolation, privacy/storage review, and automated Telegram compatibility
coverage. Forced expiry/refresh and a safe live Telegram account smoke remain
non-blocking follow-ups because the automated coverage is passing and no
regression was observed.

```ini
AUTH_IDENTITY_FOUNDATION       = PASS
AUTH_SUPABASE_JWT_VERIFY       = PASS
AUTH_GENERIC_PRINCIPAL         = PASS
AUTH_EMAIL_OTP                 = PASS
AUTH_PERSISTENT_SESSION        = PASS
AUTH_BROWSER_STORAGE_XSS_REVIEW = PASS
AUTH_TOKEN_LEAK                = NONE
AUTH_POST_LOGIN_OPEN_REDIRECT  = NONE
AUTH_TELEGRAM_REGRESSION       = NONE
AUTH_CREDITS_REGRESSION        = NONE
AUTH_PAYMENTS_REGRESSION       = NONE
PRODUCTION                     = NOT_TOUCHED
```

Production SMTP/domain wiring, production redirects, and production Auth
smoke are intentionally outside this staging closeout.
