# Backend Gateway Origin-Control Hardening

## Scope

This is the minimal Release 1 security slice extracted from AUTH-01 / PR #140.
It hardens the Vercel-side Generic Backend Gateway against a user-controlled
path changing the configured backend origin. It does not import the OAuth or
cookie-session work from PR #140.

Production was not touched. Payment Return Routing / PR #164 was not modified.
No database migration or Render runtime change is part of this slice.

## Baseline and branch

```ini
GATEWAY_SECURITY_BASE_SHA = 0dd3a92d35168b76f62c07559f85c3c3666223f5
BRANCH = fix/backend-gateway-origin-control
RUNTIME_ACCEPTANCE_SHA = a3d07e73496d4da7f752af7437b9ef4794ce8895
```

The branch was created from the freshly fetched `origin/staging` baseline.

## Original finding

Before the fix, a backend path such as `/\\evil.example` was accepted by the
gateway parser. WHATWG URL resolution then produced an external target:

```text
BACKEND_URL   = https://backend.example
backendPath   = /\\evil.example
resolved URL  = https://evil.example/
```

This violated the invariant that browser-controlled path input must not change
the server-controlled `BACKEND_URL` origin.

## Implemented defenses

1. `webapp/api/backend-gateway.js` rejects backslashes at the path boundary,
   while preserving the existing `?` and `#` validation and normal path
   semantics.
2. `webapp/lib/backend-proxy.js` catches malformed URL construction and returns
   HTTP 400 before network access.
3. The proxy independently requires `target.origin === backendUrl.origin`, so a
   direct internal caller cannot bypass the gateway parser to switch hosts.

No redirect, Cookie, Set-Cookie, `Vary: Cookie`, OAuth callback, provider, or
custom cookie-session behavior was added.

## Regression coverage

`tests/vercel_gateway.test.js` covers:

- decoded backslash paths and `foo\\bar` parser rejection;
- the `%5C` decoded-path equivalent;
- direct proxy rejection of protocol-relative, backslash, absolute-host, and
  malformed URL forms;
- the required proof that rejected paths never call `fetch`;
- positive deep-path routing with query preservation, body/method forwarding,
  Authorization forwarding, binary response forwarding, and `no-store` cache
  policy.

## Automated evidence

```ini
GATEWAY_BACKSLASH_PATH_REJECTION = PASS
GATEWAY_BACKEND_ORIGIN_LOCK = PASS
GATEWAY_HOST_OVERRIDE = NONE
GATEWAY_HOST_CONTROL_REGRESSION_TEST = PASS

NODE_GATEWAY_TESTS = PASS (3 passed)
AUTH_FRONTEND_TESTS = PASS (43 passed)
FULL_TEST_SUITE = PASS (502 passed, 5 skipped)
LINT = PASS
FORMAT = PASS (129 files already formatted)
COMPILEALL = PASS
DIFF_CHECK = PASS

GENERIC_GATEWAY_DEEP_ROUTING = PASS (mocked positive control)
GATEWAY_QUERY_PRESERVATION = PASS
GATEWAY_AUTHORIZATION_FORWARDING = PASS
GATEWAY_BINARY_RESPONSE_REGRESSION = NONE
AUTH_GATEWAY_REGRESSION = NONE
PAYMENT_RUNTIME_CHANGE = NONE
DATABASE_MIGRATION = NONE
GATEWAY_SECURITY_LOG_LEAK = NONE
```

## Vercel staging evidence

The canonical staging project is `dream-wheels-ai-webapp-staging`; the
deployment uses the exact runtime SHA above and is aliased to
`dream-wheels-ai-webapp-staging.vercel.app`.

```ini
VERCEL_STAGING_PROJECT = dream-wheels-ai-webapp-staging
VERCEL_STAGING_DEPLOYMENT_ID = dpl_ABt9ug2Da7R5saHDQSHeEhbNPUJE
VERCEL_STAGING_EXACT_HEAD = PASS
GATEWAY_SECURITY_ACCEPTANCE_SHA = a3d07e73496d4da7f752af7437b9ef4794ce8895
GATEWAY_HEALTH_SMOKE = PASS (Render /health 200; Vercel /api/backend/health 200)
GATEWAY_HOST_OVERRIDE_LIVE = NOT_REQUIRED_AUTOMATED_PROOF
```

The live malformed-path request was not sent to an uncontrolled host. The
host-control property is proven by mocked fetch tests, as required.

Protected browser smoke is still pending because the available Chrome staging
tab is currently anonymous and shows the Auth gate. No new OTP request was
initiated solely for this security slice.

```ini
GATEWAY_PROTECTED_REQUEST_SMOKE = PENDING_AUTH_SESSION
GATEWAY_DEEP_PATH_STAGING_SMOKE = PENDING_AUTH_SESSION
```

## PR #140 reconciliation

```ini
PR_140_HOST_CONTROL = EXTRACTED_AND_REIMPLEMENTED
PR_140_OAUTH_COOKIE_SCOPE = DEFERRED
```

PR #140 was not merged or cherry-picked. Its OAuth redirect, request Cookie,
Set-Cookie, multiple-cookie, `Vary: Cookie`, and provider-session changes remain
separately reviewable. PR #140 remains open.

## Current decision

```ini
GATEWAY_SECURITY_FIX_ACCEPTANCE = BLOCKED_PENDING_LIVE_AUTH_SMOKE
GATEWAY_HOST_CONTROL_HARDENING = NOT_READY
PR = DRAFT
MERGE = NO
PRODUCTION = NOT_TOUCHED
```

Once an existing safe authenticated staging session is available, repeat the
representative protected request and one deep-path read-only smoke against the
deployment above. If both pass, update this handoff and the PR without changing
runtime files; the exact-head Vercel evidence remains valid.
