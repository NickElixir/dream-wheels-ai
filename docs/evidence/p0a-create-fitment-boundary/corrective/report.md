# P0-A corrective implementation report — PR #252

## Delivery

Starting reviewed HEAD: `655436d65bdc11b19ff78ebe0c548754c6716f5d`.

Branch: `feature/p0a-create-fitment-boundary`; base: `staging`. One focused corrective commit contains these changes and this report. Its delivery SHA is the PR HEAD returned with the implementation handoff. Independent review findings M-1…M-4 were supplied in the corrective specification; GitHub contained no separate review body. The architecture and LOW findings are outside this corrective pass.

## M-1 — upload quota

Asset uploads used the recognition scope `identity_resolve` (20/hour). They now use `create_assets` with the existing render upload policy `UPLOAD_RATE_LIMIT` / `UPLOAD_RATE_WINDOW_SEC` (10/hour). The separate scope provides upload abuse protection with no limit stricter than the existing render upload gate. Recognition retains `identity_resolve` at 20/hour; job creation retains `jobs_upload` at 10/hour.

Mock quota tests explicitly seed 21 recognition calls and verify a Create upload succeeds without changing that counter. The reverse test seeds an exhausted Create counter, then verifies recognition uses and increments only its own scope.

## M-2 — feature disabled before claim

The server now checks `RIM_URL_RESOLVER_ENABLED` before authentication, rate limiting, or database claim. Disabled returns the existing 503 response and writes no marker. When the feature becomes enabled, the unchanged atomic conditional UPDATE admits one automatic attempt. Actual resolver failures still consume the attempt; manual retry remains available.

The browser releases its session/storage guard only for that specific disabled response. A later entry can try after enablement. Other errors retain the guard. API tests exercise disabled → enabled, two concurrent automatic requests with one provider call, both provider success and failure, and explicit manual retry. A transition test verifies the browser guard is also released, then retained after a real failed attempt.

## M-3 — draft recovery and accepted job state

Before acceptance, local photos and the prepared draft/key remain available. A 402 preserves both, allowing immediate retry without upload. An ambiguous lost response preserves the same key so the backend can replay the accepted job. Only the exact `404 Asset draft not found` response discards the unusable draft/key and performs one fresh upload and one creation retry within that submission. A second unusable-draft response or recovery upload failure stops and exposes the existing error UI. An unrelated 404 does not recover.

After receiving `job_id`, the reusable draft/key are cleared. Polling is guarded by `createInputVersion` plus the accepted `jobId`, so clearing the draft cannot interrupt it. Photo replacement invalidates an in-flight upload/recovery before its response can submit or display a job in the new context.

Runtime tests cover immediate 402 retry, expired draft after 402, consumed draft recovery, failed recovery upload, a second 404, unrelated 404, lost response after commit with one simulated reservation, and photo replacement during recovery. Backend replay tests assert the same job ID, one job INSERT, one queue publication, and one reservation for repeated same-key requests.

## M-4 — optional URL validation

The editor trims surrounding whitespace. Empty saves as no URL. It accepts explicit HTTP(S) URLs with a host and a maximum length of 2048, and rejects whitespace inside the URL, backslashes, credentials, unsupported schemes, and malformed authority. Scheme-less text is rejected with field feedback; this pass does not add scheme normalization. The last valid saved URL survives invalid edits. The field exposes `aria-invalid`, an associated error, and the existing RU/EN copy mechanism.

Create readiness continues to depend only on the two photos and consent. A defensive payload check omits invalid optional URL state. Backend domain validation was not weakened; a malformed direct request still returns 422. Tests cover empty, valid, trimmed, invalid, unsupported, and previously saved URL cases, as well as an enabled Create action next to the field error.

## Files changed

- Runtime: `src/identity_api.py`, `src/jobs_api.py`, `webapp/app.js`, `webapp/vnext/views/create.js`.
- Tests: `tests/test_identity_api.py`, `tests/test_fitment_vehicle_proposal_api.py`, `tests/test_jobs_fitment_api.py`, `tests/test_fitment_transition_behavior.mjs`, `webapp/auth/vnext-create-runtime.test.js`, `webapp/auth/vnext-create-view.test.js`.
- Evidence: this report, correction note in the original implementation report, local screenshots and the two mocked network transcripts in this folder.

## Verification

| Command / check | Result |
| --- | --- |
| `python3 -m pytest -q` | 668 passed, 6 skipped |
| Focused identity, proposal, and jobs Fitment API suites | 90 passed |
| `npm --prefix webapp test` | 206 passed |
| `node --test tests/test_fitment_transition_behavior.mjs tests/test_webapp_boot_behavior.mjs` | 115 passed |
| `npm --prefix webapp run build` | Passed |
| Ruff check/format on changed Python files and tests | Passed |
| `git diff --check` | Passed |
| Local browser at desktop 1440px and mobile 390px | Passed |

Browser plugin was not available; local Playwright was used at `http://127.0.0.1:8780/` with mocked APIs and demo photos. Two browser runs exercised the required Create prerequisite states, invalid URL feedback with an enabled CTA, valid trimmed URL storage without pre-Fitment resolution, and exactly one automatic 404 recovery. The invalid editor run actually clicked Create and reached completed Result with `product_url: null`. No page/console errors or horizontal overflow were observed. The valid URL run also reopened Fitment and observed one failed resolver call with no automatic repeat. Screenshots and transcripts are local QA evidence, not live staging E2E.

## Regression and review gate

The full suites retain coverage for Create independence from Vehicle, NULL VehicleIdentity, missing-vehicle Fitment acquisition and first canonical save, Check readiness, neutral titles, recognition alternative clearing, first-entry URL behavior, and legacy request compatibility. No new BLOCKER/HIGH/MEDIUM/LOW issue was identified in the corrective paths. The seven original LOW findings remain out of scope. Live staging deployment/E2E and merge are later gates.

**READY FOR FOCUSED INDEPENDENT RE-REVIEW: YES.**
