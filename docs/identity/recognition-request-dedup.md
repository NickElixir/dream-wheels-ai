# Recognition duplicate protection

A keyed fitment vehicle proposal claims a Redis operation before calling the provider.
The key is scoped to the authenticated user; the fingerprint includes job, vehicle
revision and normalized image bytes. Different inputs with the same key return 409.
Completed proposals are reused only after the route's ownership/revision checks.
Concurrent requests return 409 recognition_pending_or_uncertain. Provider failure,
cancellation or process termination leaves the marker: no automatic provider retry.
Retention is 15 minutes, after which protection expires. Clients must not replay an
old operation after that window. A fresh explicit click uses a new key. Legacy
clients without a request ID retain their existing behavior and are not deduplicated.
Redis unavailable returns 503 before a provider call. Results contain recognition
metadata, not image bytes or authentication credentials.

Model default timeout: 60 seconds. Vercel backend-gateway duration: 90 seconds.
Explicit Render VEHICLE_IDENTITY_TIMEOUT_SEC must be changed to 60 during rollout;
keep VEHICLE_IDENTITY_MAX_RETRIES=0. Do not change production settings before staging
acceptance. The browser does not impose a separate recognition timeout.

Production evidence 2026-10-30 10:11 UTC: same click hash reached the API twice about
30 seconds apart. First provider attempt timed out after 30.9 seconds, duplicate
returned 200. The auth wrapper retries only after 401 and the gateway has no explicit
retry. The originating layer is not established. Correlate browser Network and Vercel
request logs with server_call_id/click_hash on staging; do not claim the dedup guard
proves the cause. No raw keys, model response bodies or signed image URLs in logs.

Acceptance: concurrent duplicate -> one provider call; changed fingerprint ->409;
completed replay ->same result; unavailable Redis ->no call; process interruption
marker survives; new explicit key ->new attempt. Then cold/warm live staging tests,
RU/EN error states and Telegram. Local controlled tests do not replace this E2E.

Pending UI offers Check result using the same click ID and recovery header. Recovery requests are existing-only: an expired/missing key returns 503 and never claims or calls the provider. A completed operation returns its result; pending stays pending. Unavailable recovery exposes a manual/new-attempt path.

UX update: no manual Check result button. Pending/timeouts trigger existing-only polls every 10 seconds with the same ID and photo, bounded by a 120-second overall abort deadline. After 15 seconds a slow-response message appears. Abort on leaving uses the existing controller/token cleanup. No polling call can start the provider. Deadline ends in explicit manual/new-attempt recovery. Polls still consume the existing endpoint rate limit; 429 ends this attempt rather than bypassing it.
