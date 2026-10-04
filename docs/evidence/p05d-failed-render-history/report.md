# P0.5-D FAILED RENDER / HISTORY REPORT

- Audited base: `9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a`.
- Branch: `feature/p05d-failed-render-history`; target: `staging`.
- Owner decision: APPROVED; audit gate **UNBLOCKED — owner decision received**. See [accounting-audit.md](accounting-audit.md) and [normative contract](../../p05d-failed-render-history.md#owner-decision--state-machine-contract).
- PR / delivery HEAD / exact-HEAD CI: recorded in the delivery response and PR. This report travels with the implementation commit.

## Existing billing lifecycle and finality correction

Credit becomes unavailable at reservation commit: FIFO package allocation + account balance decrement + negative job_reserve ledger event + reserved job state. Successful completion writes a zero-delta job_finalize event and finalized credit. Failure compensation restores credit and marks failed in a single transaction; process death/DB failure can leave an active reserved job, so failure status is never a refund proof. Historical financial data are untouched.

Atomic UPDATE … WHERE queued/reserved RETURNING id claims a render. Replays for processing/failed/completed do not call provider. Result metadata is conditional on processing/reserved; output attachment locks and verifies active state and discards late uploads; completion uses conditional UPDATE RETURNING inside the finalize transaction. Failure and queue compensation lock only queued/processing rows before refund + failed. Completed cannot be failed by late exceptions; failed/refunded cannot become completed/finalized. Service reserve rejects refunded jobs. Refund idempotency remains job-row lock + credit state + durable ledger/package unique keys.

User retry keeps existing behavior: History retry navigates to Create; in-context generation retry resubmits current inputs after clearing the old draft/key, creates a new job_id/reservation. No automatic historical-input restoration, terminal-job recovery or provider retry change.

## Backend-authoritative public contract

Authenticated History and both status endpoints return `render_billing_status`: `reserved`, `charged`, `refunded`, `unknown`.

The same SQL statement reads row status/cost and per-job ledger evidence. A matching reserve is required; refunded requires one full-cost refund and no finalize; charged requires finalize and no refund. Missing, duplicate, inconsistent or partial evidence returns unknown. Legacy not_charged default does not prove never reserved and remains unknown. Rejected pre-reservation requests create no durable render job; no synthetic not_reserved historical jobs are introduced. Query failure does not become optimistic no-charge.

Public failed error text is fixed, including historical internal errors. No stack trace or raw provider/Storage exception reaches failed copy. Job generation state, result presence/load state and billing state remain separate concepts.

## UI and source security

History, Result/current failure and Home projection consume authoritative billing. The no-charge statement appears only for proved refunded jobs. Failed generation has one primary explanation and a status badge; no temporary asset-unavailable block. Completed missing/unloadable result has a separate asset-unavailable block and never a failed generation label. Failed previews use source photo or neutral placeholder; never a saved generated asset. New failure/billing/source/asset strings use current RU/EN i18n.

Existing ownership-checked signed-source routing and website auth headers are preserved. No public raw endpoint or bucket policy changes. Source absence is allowed for legacy jobs. Failure text is exposed through status semantics, source image has source alt text, retry is a labelled button; status is not color-only.

## Validation

- Local full backend suite before staging reconciliation: **693 passed, 17 skipped**. Optional integration tests skip without their explicit isolated DSNs.
- Isolated PostgreSQL render tests: **9 passed**. Scenarios: failed/refunded and completed/finalized replay, concurrent claim, in-flight late result, late completion after refund, completion winner + late failure, committed/rollback visibility, repeated refund/failure, refusal to reserve refunded job. No production/staging DB writes.
- API tests cover consistent billing on History and both owner-scoped status endpoints, unknown legacy, proved refund and safe public errors. Service tests cover inconsistent and partial ledger evidence.
- Node render behavior tests: **17 passed**; RU/EN, failed refunded/unknown/reserved/charged/no evidence, completed valid/missing, source absence, retry action, authoritative polling merge. Existing affected navigation/composition/focus/boot suite: **174 passed** (includes render tests). Gateway/catalogue suite also checked.
- Ruff lint/format, syntax and diff whitespace checks passed.
- Browser plugin not available; bundled Playwright Chromium used, without changing project dependencies. [QA fixture](../../../tests/browser-fixtures/failed-render-history.html) renders production views and production i18n/billing helpers with isolated transport/state doubles.
- Browser URL: `http://127.0.0.1:8765/tests/browser-fixtures/failed-render-history.html`. Viewports: **390 × 900**, **1440 × 900**. RU/EN × refunded/unknown/completed-missing/completed-valid/legacy-no-source: **20 checks**, no overflow or relevant console errors. Page identity/nonblank/no overlay confirmed; retry click produces the fixture action state. Screenshots inspected; [browser-checks.json](browser-checks.json) records scope.
- [390 refunded](browser-390-refunded.png), [390 unknown](browser-390-unknown.png), [390 missing asset](browser-390-missing.png); [1440 refunded](browser-1440-refunded.png), [1440 unknown](browser-1440-unknown.png), [1440 missing asset](browser-1440-missing.png).
- Live Telegram WebView, provider transport, real account History and deployed billing data were not exercised; fixture QA does not claim an end-to-end production run.

## Acceptance and deferred findings

All requested terminal-state, duplicate-delivery, late-completion, failure/refund atomicity and safe-legacy regressions are implemented and tested. No schema migration, pricing, payment lifecycle, Fitment runtime policy or historical credit mutation is introduced.

Deferred accounting/runtime findings from base audit: stuck processing recovery after destructive BLPOP/process death; partial FIFO refund for a multi-credit job with mixed expiry; replacement refund package TTL policy; ledger reconciliation/corruption if already present. Unknown projection avoids unsupported financial copy. These remain separate work; D does not rebuild wallets/refund old jobs. No new blocker identified in the scoped implementation; independent review remains required before merge.

P0.5-D0: CLOSED. Ready for independent review after exact delivery HEAD CI. Do not auto-merge.

## Staging reconciliation and final verification

Updated on `origin/staging` **e472b21** (P0.5-B/C and C0 evidence merged). Shared `jobs_api.py`, `main.py`, `app.js` merged cleanly; CI conflict resolved by retaining B/C PostgreSQL checks and adding D finality tests. Focused self-review checked guarded render mutations, authenticated SQL projections and current failure/polling/retry hooks against this base.

After reconciliation: full backend with the isolated render DSN **716 passed, 10 skipped** (includes all **9 render PostgreSQL regressions**); affected Node/gateway/catalogue suite **189 passed**; auth/frontend suite **213 passed**; dedicated render behavior suite **18 passed**, including no financial promise for network/queue ambiguity. Ruff lint/format and compileall pass. Frontend bundles build without a source diff. Browser fixtures rechecked on the reconciled source: 20 responsive RU/EN state checks, zero console errors/overflow; screenshots refreshed. Browser fixture transports and retry callback remain isolated doubles, while the runtime retry is separately exercised by the real frontend test harness and API reservation tests.

Removed the pre-existing unconditional “render will not be charged” availability warning: failed job state, queue exception and network ambiguity all remain insufficient refund evidence.

Exact delivery commit CI is checked on GitHub before the final handoff; results/URL belong to the PR and delivery response to avoid a self-referential report commit SHA. Independent review is still required, and merge is not performed.

## HIGH-1 corrective pass

Independent review found that the previous implementation committed the result asset and attachment before the separate completion/finalize transaction. The earlier finality paragraph did not prove result-publication atomicity. The corrective pass replaces that split commit with one locked transaction for asset insert + result attachment + completed + credit finalize, and moves completion analytics after commit. See [corrective-pass.md](corrective-pass.md) for the injected PostgreSQL rollback, API/share/download checks and updated validation results. The prior validation counts above describe the previous delivery; corrective validation supersedes them for this fix. Focused independent re-review remains required; no merge performed.
