# 05B — Payment Failure Handling Handoff

Updated: 2026-08-30

## Status

`PAYMENT_FAILURE_HANDLING = NOT_READY`

Code is implemented on `fix/05b-payment-failure-handling`. Final READY requires green CI plus a staging Robokassa failure/cancel E2E after configuring staging `Fail URL` to the backend failure-return endpoint.

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

`/payments/robokassa/fail` is deliberately non-authoritative. It is a browser-return handler used only to close the UX state. It requires the invoice id plus the `Shp_payment_id` that was generated for that payment, optionally validates `OutSum`, and may only move `pending -> failed`. It cannot debit or credit an account and cannot demote `paid`.

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

## Acceptance coverage

Automated coverage added for:

1. `pending -> failed`;
2. `failed_at` populated;
3. credits/balance unchanged on failure;
4. duplicate failure idempotent;
5. retry creates a new payment and invoice;
6. paid cannot become failed;
7. late authoritative success moves failed to paid and grants credits only once;
8. current webapp already maps backend `failed` to a non-pending terminal status and has the existing `Платеж не завершен` return message.

Existing successful Robokassa/payment tests must remain green in CI.

## Staging E2E required before READY

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
- No production Robokassa settings or production rollout are changed by this workstream.
