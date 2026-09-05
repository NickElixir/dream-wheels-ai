# Auth V1.1 — Release 1 Scope and Architecture Decisions

Status: approved product/architecture scope for Release 1 planning. This document records decisions only; it does not itself imply that the corresponding runtime implementation is present in `staging`.

## Goal

Auth V1.1 removes Telegram-only authentication as a Release 1 blocker while preserving all existing Telegram flows and the canonical Dream Wheels `users.id` ownership model for credits, payments, render jobs, history, Fitment, analytics and other user data.

Release gate:

```text
AUTH_NON_TELEGRAM_READY = YES
```

## Domain-specific provider presentation

The same Dream Wheels backend, canonical user model and auth core are used for both public sites. Domains differ primarily in which providers are presented to the user.

### RU site

Release 1 target:

```text
Email OTP        -> primary universal login
Yandex           -> target provider
VK               -> target after capability verification
Telegram         -> backup / existing compatibility path
```

Later candidates:

```text
Sber ID
T-ID
MAX external web login, if a suitable public OAuth/OIDC capability appears
```

### Global site

Release 1 target:

```text
Email OTP
Google
Apple
Microsoft
Telegram
```

Provider availability is a presentation/configuration decision, not a separate user database or business-account realm.

## Canonical identity model

Dream Wheels keeps one canonical internal account:

```text
external identity
        -> user_identities
        -> users.id
        -> credits / payments / jobs / history / Fitment / analytics
```

Existing Telegram users must keep their current `users.id` and business ownership.

For Supabase-managed web authentication, the preferred Dream Wheels identity boundary is:

```text
provider = "supabase"
provider_subject = <stable Supabase auth.users UUID>
```

Supabase may internally link multiple provider identities to the same Supabase user. Dream Wheels should not duplicate provider-specific business ownership when one stable Supabase identity can map to one `users.id`.

Telegram remains a separate supported auth authority and maps to the same canonical `users.id` through its own stable identity.

No automatic Dream Wheels account merge is allowed based on email, username, phone, display name, IP, device or payment data.

## Supabase Auth role

For Release 1, Supabase Auth is selected for browser-based authentication where supported, beginning with Email OTP and extending to compatible OAuth providers.

Supabase Auth should own:

- Email OTP generation and verification;
- persistent browser auth session;
- short-lived access tokens;
- refresh tokens;
- automatic access-token refresh;
- refresh-token rotation;
- logout/session lifecycle for Supabase-authenticated browser users.

Dream Wheels should not build a parallel custom session database for Release 1.

## Persistent browser session — approved Release 1 approach

Target client behavior:

```text
user signs in
-> closes tab
-> closes browser
-> returns later
-> session is normally restored automatically
```

Use the normal Supabase browser session model with persistent client storage and automatic token refresh.

Approved scope:

```text
Persistent session             YES
Automatic session restore      YES
Access-token refresh           YES
Refresh-token rotation         YES
Custom Dream Wheels DB session NO
Custom opaque session          NO
Supabase SSR/cookie/BFF auth    NO for Release 1
Cross-domain SSO               NO for Release 1
```

RU and Global top-level domains are allowed to have separate browser login state even when both map to the same canonical Dream Wheels user.

Expected reasons a user may need to authenticate again include cleared site data, private/incognito browsing, browser/OS storage cleanup, logout, revoked session, damaged/lost refresh state or security invalidation.

## Browser-storage security trade-off

The Release 1 persistent-session choice deliberately accepts that Supabase browser session material is available to JavaScript in the application origin. This makes XSS prevention and supply-chain hygiene an explicit release requirement.

Required security gate:

```text
AUTH_BROWSER_STORAGE_XSS_REVIEW = PASS
```

Audit at minimum:

- unsafe `innerHTML` / HTML injection paths;
- `insertAdjacentHTML` with untrusted values;
- `eval` / `new Function`;
- dynamic scripts;
- untrusted URLs and provider/API values rendered into markup;
- third-party script dependencies;
- CSP and allowed script/connect origins;
- accidental token/session logging.

Never put access tokens, refresh tokens, OTP values, OAuth authorization codes or raw sessions into analytics, logs or error-reporting payloads.

## Email OTP

Email OTP is part of Release 1 and is expected to be the most universally understandable login method for the mass-market audience.

Target:

```text
Email
-> request numeric OTP
-> verify OTP
-> Supabase session
-> resolve Supabase UUID
-> Dream Wheels users.id
```

Password authentication is not part of Release 1.

Production email delivery requires a production-capable SMTP provider and sender-domain setup. Supabase's development mail path must not be treated as production delivery.

Rate limiting, resend handling, OTP expiry, invalid/expired OTP states, temporary provider/network errors and abuse controls must be covered before release.

## Telegram

Keep existing Telegram authentication paths.

Release 1 includes/retains conceptually:

```text
Telegram Mini App automatic auth  KEEP
Telegram website auth             KEEP
Telegram-based code flow          TARGET / separate capability
```

Telegram remains a backup on the RU site and a normal alternative on the Global site.

A Telegram user and a Supabase-authenticated user may be linked only through an explicit proof-of-control flow. Do not auto-link by mutable profile fields.

## Yandex

Yandex is a target RU provider.

Preferred path is Supabase-compatible OAuth/OIDC/custom OAuth so it can share the same Supabase persistent-session lifecycle as Email OTP.

Implementation still requires a capability/configuration verification against the current Yandex OAuth contract before runtime work.

## VK

VK remains a target RU provider but is capability-dependent.

Before implementation, verify that the actual VK ID flow can be represented through the selected Supabase OAuth/custom-provider mechanism, including authorization, token exchange, stable subject, user information and required PKCE/provider-specific parameters.

Do not create a second session architecture solely to support VK if a lightweight adapter is insufficient.

## Avito — explicitly deferred from consumer login

Avito is **not** a Release 1 consumer authentication provider.

Decision:

```text
AUTH_AVITO_RELEASE1 = NO
```

Reason: the known Avito OAuth/API model is primarily relevant to granting third-party access to Avito account/business/marketplace capabilities, while Dream Wheels consumer login must work for the broad user base and must not depend on a user's Avito seller/business usage.

Avito is moved to a future Marketplace / B2B Integration workstream.

That future integration should treat Avito as an external connection to an existing Dream Wheels user, for example:

```text
users.id
  -> external_connections
       -> avito account
       -> scopes
       -> encrypted access/refresh tokens
```

Possible future use cases:

- listings/catalog access;
- seller workflows;
- messages where permitted;
- marketplace data integration;
- B2B account workflows.

Avito API access/refresh tokens and API scopes must not be stored in `user_identities`.

## MAX — deferred for external website login

Current product decision:

```text
MAX_EXTERNAL_WEB_LOGIN = DEFERRED
MAX_MINI_APP_AUTH       = FUTURE CAPABILITY
```

Do not include MAX as a Release 1 website-login button unless a public, suitable external OAuth/OIDC-style sign-in capability is confirmed and passes compatibility review.

MAX Mini App authentication is a separate future possibility and should not be conflated with ordinary external web login.

## Auth observability — approved now

Authentication telemetry is part of the implementation plan and should reuse the existing Dream Wheels analytics ingestion/storage rather than create a new observability platform.

Approved event set:

```text
auth_started
otp_requested
otp_verified
auth_completed
session_restored
session_refresh_failed
auth_failed
auth_signed_out
```

Use a small normalized property contract such as:

```text
provider
  email | yandex | vk | telegram | google | apple | microsoft | ...
authority
  supabase | telegram
site
  ru | global
flow
  otp | oauth | restore | refresh | telegram | ...
outcome
  success | accepted | failed
error_code
  normalized safe error code when applicable
```

Suggested normalized failure codes:

```text
invalid_otp
expired_otp
rate_limited
network_error
session_missing
refresh_failed
provider_cancelled
provider_error
identity_conflict
backend_rejected
unknown
```

Never record in auth telemetry:

- full email address;
- OTP;
- access token;
- refresh token;
- OAuth authorization code;
- raw Supabase session;
- provider access/refresh token;
- raw exception payload containing credentials or PII.

Telemetry must be best-effort and must never block login, session restore, logout or other auth-critical flows.

Do not emit every successful background token refresh as an analytics event; keep `session_refresh_failed` as the high-signal operational event.

## Admin-panel integration — deferred, schema must support it

Admin UI work is not a Release 1 Auth blocker.

Current decision:

```text
AUTH_OBSERVABILITY_EVENTS = YES
AUTH_ADMIN_TELEMETRY      = DEFERRED
```

The event schema above must remain deliberately easy to aggregate later from `analytics_events` so the existing Dream Wheels admin panel can add read-only Auth analytics without changing the runtime auth protocol.

Future admin views may include:

- auth funnel by provider/site;
- OTP request -> verification -> successful-login conversion;
- session restore success volume/rate;
- auth failure rate;
- normalized error breakdown;
- provider share;
- RU vs Global comparison.

Do not build these admin aggregates/UI in the initial Auth implementation unless they become necessary for a release investigation.

## Release 1 non-goals

Do not add unless separately approved:

```text
password auth
SMS auth
custom Dream Wheels DB sessions
custom opaque-session rotation
Supabase SSR/BFF session layer
cross-domain SSO
account merge engine
enterprise SSO
Avito consumer login
MAX external web login without confirmed provider support
broad profile/account-settings redesign
```

## Implementation order

Preferred order:

```text
1. Reconcile identity foundation against current staging
2. Supabase Auth configuration + JWT verification strategy
3. Provider-neutral AuthPrincipal / backend resolution
4. Persistent Supabase browser session
5. Generic frontend auth state + authenticated request boundary
6. Auth observability event contract
7. Email OTP
8. Production SMTP + abuse protection
9. XSS/browser-storage security gate
10. Session restore/refresh/multi-tab/network/logout test matrix
11. Explicit Telegram <-> Supabase linking
12. Yandex integration
13. VK capability check + integration if compatible
14. Global Google / Apple / Microsoft
15. Full cross-product staging E2E
```

## Required staging gates

```text
AUTH_IDENTITY_FOUNDATION        = PASS
AUTH_SUPABASE_JWT_VERIFY        = PASS
AUTH_GENERIC_PRINCIPAL          = PASS
AUTH_EMAIL_OTP                  = PASS
AUTH_PERSISTENT_SESSION         = PASS
AUTH_BROWSER_RESTART_RESTORE    = PASS
AUTH_REFRESH_ROTATION           = PASS
AUTH_MULTI_TAB                  = PASS
AUTH_OFFLINE_RECOVERY           = PASS
AUTH_LOGOUT                     = PASS
AUTH_SMTP_PRODUCTION_READY      = PASS
AUTH_ABUSE_PROTECTION           = PASS
AUTH_BROWSER_STORAGE_XSS_REVIEW = PASS
AUTH_TELEMETRY                  = PASS
AUTH_TELEGRAM_REGRESSION        = NONE
AUTH_CREDITS_REGRESSION         = NONE
AUTH_PAYMENTS_REGRESSION        = NONE
AUTH_FITMENT_REGRESSION         = NONE
AUTH_RENDER_REGRESSION          = NONE
AUTH_HISTORY_REGRESSION         = NONE
AUTH_STAGING_E2E                = PASS
AUTH_NON_TELEGRAM_READY         = YES
```

Production remains untouched until the staging Auth gate passes, after which production-domain wiring, production OAuth redirects/environment and final production Auth smoke can proceed.

## Repository baseline note

At the time this decision document was created, current `staging` had advanced beyond the original AUTH-01 and AUTH-02 feature-branch baselines. Earlier PRs #140 (gateway OAuth/cookie readiness) and #142 (`user_identities`) therefore require explicit reconciliation/rebase/review before their runtime changes can be treated as canonical `staging` state. This document must not be read as silently merging either PR.
