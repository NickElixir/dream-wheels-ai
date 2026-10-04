# P0.5-D corrective pass — HIGH-1 result publication atomicity

PR: [#260](https://github.com/NickElixir/dream-wheels-ai/pull/260). Reviewed previous HEAD: `73ef57197a2da1130e34fa02a0a4febd473daba4`. Base: `staging`. HIGH-1: **FIXED**, pending focused independent re-review. Delivery HEAD and exact-HEAD CI are recorded in the PR/delivery response.

## Runtime contract and code paths

- [`_upload_render_output_candidate`](../../../src/main.py) uploads storage bytes and returns `AssetUpload`; it receives no DB connection/pool and does not insert an asset or attach job result references.
- `_publish_render_output` locks the expected owner's `processing/reserved` job. In one transaction it inserts the result asset, attaches `result_asset_id/output_image_url`, changes the job to completed, and calls `finalize_job_credit`. All DB writes share one commit boundary; any exception rolls back asset, attachment, completion and finalize ledger changes.
- An inactive job rejects publication before the asset insert. `process_render_job` cleans up the candidate after transaction exit/rollback; cleanup failure is logged with job/owner context and does not mutate state or credits. Publication exceptions continue to the existing worker failure handler.
- `_mark_render_failed` retains its locked active-state refund + failed + failure analytics transaction. A completion winner makes a racing failure a no-op; a failure winner makes later publication a no-op.
- Completion analytics now runs after publication commit, best-effort. Its exception is logged independently and does not escape into the worker failure path.
- LOW-1: the billing projection comment documents why `job_finalize.credits_delta = 0`: reservation already debited the credit. Projection behavior is unchanged.

## Regression evidence

[`tests/test_render_finality_postgres.py`](../../../tests/test_render_finality_postgres.py) uses an isolated real PostgreSQL schema; provider/storage transport are test doubles.

`test_finalize_failure_rolls_back_publication_and_api` injects an exception **after real asset/job SQL and real credit finalization**. Inside the transaction it verifies asset, result references, completed/finalized state. A second connection still observes processing/reserved, null references and zero assets before commit. After rollback and repeated failure handling it verifies failed/refunded, null references/completion timestamp, no result asset, no finalize ledger event, exactly one refund, and account/package balance restored once. Both successful cleanup and throwing cleanup run through this scenario; cleanup sees the rollback before executing.

For that same failed/refunded DB state, real ASGI requests and real projection SQL verify:

- `GET /jobs`: result URL null, no result asset, failed/refunded.
- `GET /jobs/{id}`: no output URL/result asset, failed/refunded.
- `GET /jobs/{id}/status`: no result/share URL or result asset, failed/refunded.
- Result download: 409; result asset download: 404; public share: 404.

`test_completion_lock_wins_over_failure_and_analytics_error` holds the completion transaction through finalize while a failure races. After commit the failure is a no-op; the analytics double reads the committed completed/finalized result from a second connection, then throws. The job remains completed/finalized with one asset/finalize and no refund or cleanup.

The failure-winning late-provider test checks one provider call, no asset/attachment/finalize and candidate cleanup. Existing queued claim, terminal replay, refund atomic visibility/idempotency, failure rollback and refunded-credit reservation rejection remain covered.

## Validation

- Full backend with isolated render DSN: **719 passed, 10 skipped** (other optional integrations need their explicit DSNs).
- Real PostgreSQL render suite: **12 passed**.
- Frontend/auth: **213 passed**; dedicated failed-render behavior: **18 passed**.
- Affected Node gateway/catalogue/navigation/composition/focus/boot/render suite: **190 passed**.
- Ruff lint/format, diff whitespace and frontend build: PASS; build produced no tracked bundle changes.
- Exact corrective HEAD CI: checked after push; URL/status recorded in delivery response and PR.

No UI, retry, payment runtime, billing projection behavior, migrations, historical jobs, Fitment policy, recovery or FIFO refund changes. No production/staging DB operations. Storage orphans remain possible when best-effort deletion fails; no unpublished candidate reference is committed to jobs/API. No merge performed; ready for focused independent re-review of HIGH-1 publication failure, API exposure and terminal-state/credit regressions.
