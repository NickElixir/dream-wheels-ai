# Bounded session finalization

Local change on `fix/auth-finalization-timeout`, based on staging `b432eb7`.

After the SDK has established a session, frontend principal verification has a shared
20-second deadline covering access-token retrieval, GET `/auth/me`, POST
`/auth/bootstrap`, and response-body parsing. OTP delivery/verification and initial
SDK initialization are outside this deadline. Browser background timer throttling
can delay the visible deadline.

Timeout preserves the SDK session but locks protected APIs, reports a localized
retry message, and releases the existing dialog busy state. The existing Retry
button probes the saved session; it does not request or verify OTP again. Both
backend requests share one captured token and an AbortSignal. SDK operations or
fetch implementations that ignore abort may finish later, but cannot update auth
state after timeout, retry, sign-out or an observed identity change.

Diagnostics contain only fixed stage/outcome and elapsed milliseconds, written to
the browser console. No token, email, OTP, account identifier or backend payload is
recorded. This does not add remote analytics or retrospectively identify the cause
of the Android incident.

## Local verification

- `npm run build --prefix webapp`
- `node --test webapp/auth/*.test.js tests/test_new_application_route.mjs deploy/timeweb-static/build.test.mjs`
- `git diff --check`

316 tests pass, including 11 new finalization cases: hanging token, both requests,
both success bodies, error body; retry without OTP; late 401; identity switch;
sign-out; deadline cleanup; accepted OTP followed by timeout; superseding a pending
probe. Some cases verify multiple properties.

## Staging acceptance before release

1. Real Android browser: cold `/new`, OTP, saved-session retry and reload; normal
   sign-in should complete without showing the timeout message.
2. With a local proxy/mock, hold `/auth/me`, then `/auth/bootstrap` beyond 20 seconds.
   Confirm the localized error, enabled Retry and locked Create/protected APIs.
3. Release the delay and Retry without requesting another OTP. Confirm Create opens
   and the old response cannot close/reopen the dialog or expire the fresh session.
4. Switch account/sign out during finalization and verify old account data never
   appears. Check RU and EN copy and absence of secrets in diagnostics.
5. Confirm no upload/render is triggered by finalization or Retry.

No backend/schema/hosting changes. No push, merge, deploy or production changes.
