# P0.5-B PAYMENT LIFECYCLE REPORT

Date: 2026-10-04. Scope: W-02 pending checkout lifecycle. No staging payment mutations or live provider calls.

## 1. Base SHA

`9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a` (staging, P0.5-A merged).

## 2. Branch

Implementation: `feature/p05b-payment-lifecycle`. Delivery uses the existing PR #256 head branch `docs/p05c0-wheel-size-live-spike` to correct its mistaken contents without rewriting published history.

## 3. PR

https://github.com/NickElixir/dream-wheels-ai/pull/256 — retargeted in content/title to P0.5-B, base staging. C0 report is removed from the final PR diff; its historical commit remains available. No C implementation included.

## 4. HEAD

The final delivery HEAD is the GitHub PR head SHA. This report is committed with the implementation, so it does not embed its own commit hash. Inspect `gh pr view 256 --json headRefOid`; CI and independent review must use that exact final SHA.

## 5. Existing payment state machine

Existing status constraint/model: pending, paid, failed, refunded. Checkout creates a new order; ResultURL verifies signature/order/amount and settles through the current transaction/credit machinery. Paid replay returns without another grant. Existing verified success handling can settle non-paid states, including failed; refunded handling is inherited, not redesigned here. No provider-failure callback architecture was added.

## 6. New cancelled state

Local pending checkout timeout only. It is not proof of refund and does not grant credits. Old statuses remain valid; unknown status fails the database constraint.

## 7. Timeout mechanism

Single config source `PAYMENT_PENDING_TIMEOUT_SECONDS`, default 3600. Authoritative age is `payments.created_at`; payment rows are not recycled into new pending checkouts. Processor uses a transaction, pending predicate, age predicate, ordered batch and FOR UPDATE SKIP LOCKED. Batch default 100, accepted range 1–1000. Repeat run is a no-op for cancelled/settled rows.

## 8. Scheduler mechanism

Existing FastAPI process lifespan hosts a periodic task; no additional service. `PAYMENT_TIMEOUT_ENABLED` defaults true, scan interval 60 seconds. Failures are logged and retried at next scan; cancellation is awaited before pool shutdown. Multiple API replicas use database locking. Safe per-payment logs include ID, old/new status, timeout reason and age; no signatures/secrets.

## 9. Callback transitions

pending → paid; pending → cancelled by local timeout; cancelled → paid through the same verified ResultURL; paid → paid idempotent replay. Existing failed → paid is preserved and tested. Refund policies and provider failure semantics are unchanged. No timeout transition from paid/failed/refunded/cancelled.

## 10. Timeout/callback race

Both orders are safe: settlement first leaves timeout affecting zero rows; timeout first permits later verified paid settlement. Real PostgreSQL concurrency test asserts final paid and one grant. No blind update overwrites paid.

## 11. Exactly-once credit model

Existing callback transaction locks the credit account/payment and keeps status, ledger and package updates atomic. Durable payment-linked purchase-grant and credit-package idempotency prevent duplicate grants. Added real database test checks counts, balance, uniqueness and forced package-insert rollback. This PR does not redesign credits.

## 12. Late callback

Real signed local HTTP ResultURL on cancelled order settles paid and grants once. Validation bypasses are not added. Bad signature, wrong amount and wrong/nonexistent order grant nothing.

## 13. Duplicate callback

Concurrent successes and replay converge on one ledger purchase grant and one package; real PostgreSQL evidence covers this.

## 14. Refund semantics

cancelled ≠ refunded. No timeout refund, capture or reversal. Frontend uses separate status labels. Existing refunded callback behavior remains outside this corrective scope and should be considered in independent review.

## 15. API/UI

Payment status enum now admits cancelled. Existing history/status API carries the status. RU: В ожидании / Оплачен / Отменён / Ошибка / Возвращён. EN: Pending / Paid / Cancelled / Error / Refunded. Uses existing i18n. No checkout redesign or optional supporting-copy expansion.

## 16. Migration

`0039_payment_cancelled_status.sql` only widens payments_status_check. No data rewrite. Real test applies migration twice, verifies old/new states and rejects invalid status. Apply migration before deploying the processor. Env example documents timeout and enable switch.

## 17. Old pending rollout impact

Existing pending older than configured timeout become cancelled in bounded scans after deployment. Valid late success remains acceptable. **Deployment gate:** read-only staging pending total, pending >60m and oldest age must be collected before rollout; this task did not access staging credentials or deploy. Disable processor with PAYMENT_TIMEOUT_ENABLED=false until migration/count review is complete when needed. No cancelled rows are backfilled to pending by disabling the task.

## 18. Tests

Re-executed during delivery:
- Full backend without DB env: 679 passed / 9 skipped.
- Full backend with isolated local payment/provenance PostgreSQL URLs: 682 passed / 6 skipped.
- Focused real-PostgreSQL payment lifecycle + scheduler: 5 passed.
- Frontend: 209 passed / 0 failed.
- Fitment transition + webapp boot: 133 passed / 0 failed.
- Build: PASS. Ruff check/format changed Python: PASS. Diff check and commit hooks required for delivery.

Browser fixture uses production app projection and wallet view with deterministic local state; no external checkout. Playwright used because Browser plugin skill was unavailable. 390/1440 RU screenshots and transcript are in this evidence directory; English labels also observed in browser. This is local presentation QA, not authenticated staging E2E or real-provider payment verification. No checkout is initiated by browser QA. External bootstrap requests are intercepted with empty local JSON responses for deterministic presentation QA; an initial unmocked bootstrap connection refusal was isolated from the Wallet status flow.

## 19. Real DB concurrency evidence

Local loopback PostgreSQL at port 55438, isolated random schema. Migrations applied inside test schema, cleaned up afterward. Test forbids remote database hosts. `database-evidence.json` records late callback, replay/races, bounded batch, migration repeatability, atomic rollback and reconciliation. CI now has an explicit real-PostgreSQL step; its final-HEAD result must be verified independently.

## 20. Accounting reconciliation

`reconciliation.sql` is read-only. Test executes it on local scenario data and asserts zero discrepancies, one package/ledger per paid order, no grants for unpaid orders. Verified balance 42 in the local scenario. No staging accounting assertions made.

## 21. Findings

W-02 implementation and local validation are complete. Remaining release gates: full independent review, green CI on final head, staging read-only backlog count, migration rollout and deployment verification. Historical refunded transitions are preserved; not claimed corrected. No F-06/F-17/H-01 work included.

## 22. READY FOR INDEPENDENT REVIEW

**YES.** Ready for full independent review, not auto-merge or deployment. P0.5 overall is not closed; C0 remains blocked and C/D are incomplete. Do not start P1.
