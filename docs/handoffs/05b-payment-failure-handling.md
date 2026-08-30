# 05B — Payment Failure Handling Handoff

Updated: 2026-08-30

## Status

`PAYMENT_FAILURE_HANDLING = NOT_READY`

Implementation is merged into `staging` through PR #134 at commit `242a7ffa6463739bc4451f1db266376ee14994c9`. CI is green and the matching Render staging deployment `dep-daa92cjl550s73ahvlp0` is live with `/health` returning 200.

The remaining READY gate is the real Robokassa failure/cancel staging E2E after configuring staging `Fail URL` to the backend failure-return endpoint.

## Delivery

- implementation branch: `fix/05b-payment-failure-handling`
- PR: `#134 — 05B: handle failed Robokassa payments`
- branch commits before squash:
  - `5cce20d50cd2ddc8815d7d9680a8a58e2d9da3ce` — failure state transition
  - `86602ba6b9477afc7104a689e1f2bc20bd67a031` — Robokassa failure-return endpoint
  - `83a92eee98a2f5350a145325ce19786719f2eb07` — regression tests
  - `4e69e85735a940ce8c028b93c295244b8546900e` — initial handoff
- staging squash commit: `242a7ffa6463739bc4451f1db266376ee14994c9`
- schema changes: none
- CI run: `#187`, success
- staging deploy: `dep-daa92cjl550s73ahvlp0`, live
- production/main: unchanged

## Root cause

The payment schema already supported `status = failed` and `failed_at`, but the active Robokassa integration only handled the successful server callback at `/payments/robokassa/result`. Browser failure/cancel returns reached the webapp and changed only transient UI messaging; no backend transition moved the payment out of `pending`.

## State machine

Allowed:

```text
pending -> failed   Robokassa FailURL/browser return
pending -> paid     authoritative Robokassa ResultURL
failed  -> paid     late authoritative Robokassa ResultURL
```

Forbidden:

```text
paid -> failed
```

`mark_payment_failed` locks the payment row with `FOR UPDATE`. Failure is idempotent and performs no balance, credit-ledger or credit-package writes. If a successful ResultURL races with the failure return, row locking serializes the transitions:

- fail first: `pending -> failed -> paid`;
- ResultURL first: `pending -> paid`; subsequent fail is a no-op.

When `failed -> paid` occurs, `failed_at` is cleared because the final authoritative state is paid.

## Robokassa authority boundary

`/payments/robokassa/result` remains the only authoritative proof of successful payment. It still verifies the Password #2 signature and payment amount before granting credits.

`/payments/robokassa/fail` is deliberately non-authoritative. It is a browser-return handler used only to close the UX state. It requires the invoice id plus the `Shp_payment_id` generated for that payment, optionally validates `OutSum`, and may only move `pending -> failed`. It cannot debit or credit an account and cannot demote `paid`.

This matches Robokassa's documented split: ResultURL is the server notification used to confirm successful payment; SuccessURL/FailURL are user redirects.

## Staging Robokassa URLs

Keep:

```text
Result URL:
https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/result
```

For the 05B staging E2E set `Fail URL` to:

```text
https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/fail
```

GET and POST are both accepted. The handler redirects the browser back to:

```text
${WEBAPP_URL}/t/?payment=fail&invoice_id=<InvId>
```

If the payment has already become `paid` by the time the FailURL request acquires the lock, the browser is redirected with `payment=success` instead.

Success URL can remain the existing staging webapp success return. Successful balance changes still depend on ResultURL, not that redirect.

## Schema changes

None.

Existing migration `0009_payments_mvp.sql` already provides:

- `payments.status` with `failed` allowed;
- `payments.failed_at`;
- retained payment history rows.

## Code changes

- `src/payments_service.py`
  - added `mark_payment_failed`;
  - exposed `failed_at` in serialized payment payloads;
  - made paid transition clear a previous advisory `failed_at` on late success.
- `src/payments_api.py`
  - added GET/POST `/payments/robokassa/fail`;
  - redirects back to the webapp after persisting the terminal UX state.
- `tests/test_payment_failure_handling.py`
  - focused state-machine and retry regressions.

No pricing, promo-code, provider replacement, credit architecture or unrelated cabinet changes.

## Tests

GitHub Actions CI run `#187` completed successfully on the implementation head. It executed:

- `ruff check .` — passed;
- `ruff format --check .` — passed;
- `python -m compileall src/ tests/ -q` — passed;
- full `pytest -q` — passed.

Automated 05B coverage includes:

1. `pending -> failed`;
2. `failed_at` populated;
3. credits/balance unchanged on failure;
4. duplicate failure idempotent;
5. retry creates a new payment and invoice;
6. paid cannot become failed;
7. late authoritative success moves failed to paid and grants credits only once;
8. current webapp maps backend `failed` to a non-pending terminal status and has the existing `Платеж не завершен` return message;
9. existing successful payment tests remain green through the full test suite.

## Staging deployment

The staging Render service auto-deployed merge commit `242a7ffa6463739bc4451f1db266376ee14994c9` as deployment `dep-daa92cjl550s73ahvlp0`. The deploy reached `live`; Render health probes returned HTTP 200 during rollout.

## Staging E2E required before READY

Not executed in this workstream because the Robokassa merchant technical setting is external to the repository and must point staging Fail URL at the new endpoint before the browser flow can exercise it.

Required final smoke:

1. Point staging Robokassa Fail URL at `/payments/robokassa/fail`.
2. Create a new test payment from staging.
3. Choose Robokassa unsuccessful/cancel flow.
4. Confirm DB/payment API:
   - `status = failed`;
   - `failed_at IS NOT NULL`;
   - balance unchanged;
   - no `purchase_grant` for the invoice.
5. Reload cabinet and confirm the invoice does not return to `pending`.
6. Retry the same package and confirm a new `payments.id` and `invoice_id`.
7. Repeat/replay the failure return and confirm idempotency.
8. Run one successful payment and confirm the existing paid flow remains green.
9. If practical, simulate/observe a delayed valid ResultURL after failed and confirm final `paid` with one grant.

## Known limitations

- Primary FailURL is a browser redirect, not an authoritative financial event. 05B intentionally uses it only for the reversible failure UX state. Authoritative reconciliation remains ResultURL.
- The current cabinet already renders failed as a terminal warning (`Сбой`) and shows `Платеж не завершен` on the browser return. The longer explanatory copy `Средства не списаны, рендеры не начислены` is not added in this slice because the existing frontend bundle is unchanged; it can be added as a small follow-up UX copy change without payment-state impact.
- No production Robokassa settings or production rollout were changed by this workstream.
