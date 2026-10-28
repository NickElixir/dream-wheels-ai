# Commercial UX / Beta Warnings — final handoff

## Final status

`COMMERCIAL_UX_WARNINGS = READY`

**STATUS: FUNCTIONALLY DONE.** PR #80 was merged into `staging`; the deployed
staging flow was checked in Chrome and at mobile width. This workstream can be
archived after this documentation update is merged.

## Context

- Branch: `feature/commercial-ux-warnings`
- Base: `origin/staging @ 80cccd8093b2b8b313a29ed90601eca6d3040ac0`
- Commit: `843a35e feat: add commercial beta warning states`
- PR: https://github.com/NickElixir/dream-wheels-ai/pull/80
- Merged commit: `d97bf8e feat: add commercial beta warning states (#80)`

## Warnings implemented

- General beta: non-blocking notice in the virtual try-on create flow.
- Parser: shown only after the existing rim-source resolver detects parameter
  values; no parser backend integration was added.
- Fitment: shown with a non-failed preliminary compatibility verdict.
- Missing data: shown only when the fitment overview reports required missing
  fields; the UI does not infer a positive verdict.
- Generation unavailable: controlled approved message, retry, and support link
  for timeout/unavailable/network failures.

## Existing states reused

- `wallet-status-island` and `panel-note` warning components.
- Existing render error/retry screen and support Telegram destination.
- Existing fitment source, readiness, and verdict rendering.
- Existing backend reserve/refund lifecycle: queue-publish failure and failed
  worker jobs refund the reserved render credit.

## Screens and checks

- Create/upload, consent/legal links, beta notice, unavailable generation,
  insufficient balance, and recovery action.
- Fitment source detection, missing required data, completed preliminary
  verdict, and provider failure.
- Dashboard/wallet balance and top-up route, history terminology, support, and
  legal documents.
- Mobile: verified on deployed staging at `390 × 844`; photo cards stack
  vertically, beta warning remains visible, and bottom navigation remains
  available.

## Accessibility observations

- Beta state is non-modal and does not block the primary CTA.
- Warning copy remains visible text; error recovery exposes a labelled support
  link only when relevant.
- Existing responsive button rules keep the error actions full-width on narrow
  screens.

## Pricing, balance, support, and legal

- Clarified `1 рендер — 1 генерация виртуальной примерки`; renamed balance and
  history labels to use `рендер` for the paid unit.
- Balance remains backend-derived; no optimistic debit was introduced.
- Support is available through the existing support view and directly from
  unavailable/general generation failures.
- Existing offer, refund, privacy, and consent links are retained.

## Failed render findings

The existing API refunds the reserved credit when queue publishing fails and
the worker refunds it after a failed generation. The frontend now masks raw
unavailable/provider-style messages with the approved no-charge statement.

## Staging E2E results

- Create flow loads and shows the approved general beta warning.
- Balance is visible and remains backend-derived.
- Support, privacy, offer, and refund links are visible from the relevant
  cabinet views.
- History and the failed-render recovery CTA are reachable.
- No client console errors were observed during the warnings smoke test.
- No render was submitted during the unavailable-generation check; therefore
  no credit was charged by that check.

## Known external dependency — 05b Payment Failure Handling

During the commercial E2E audit, a payment-backend gap was identified and
explicitly moved outside this workstream.

When a Robokassa test payment is cancelled or marked as unsuccessful, the
current backend keeps its record in `pending`. It does not transition the
payment to `failed` and does not set `failed_at`. Credits are not granted and
the balance does not change, but the cabinet cannot present a completed
failure state or reliably offer retry.

Tracked separately as: **05b — Payment Failure Handling**.

Expected UX after 05b:

- payment status is `Не удалось` / `Оплата не завершена`;
- balance is unchanged and no renders are granted;
- the user sees that funds were not charged;
- a new top-up/retry is available;
- the failed payment stays in history with an updated timestamp.

This backend state-machine gap does **not** block closure of Commercial UX /
Warnings (05).

## Tests

- `node --check webapp/app.js`
- `pytest -q tests/test_commercial_beta_ux.py tests/test_webapp_legal_links.py`
- `git diff --check`

Result: focused checks pass (`4 passed`). Full `ruff check .` has two
pre-existing `ASYNC240` findings in `scripts/vehicle_identity_benchmark.py`.
Full `pytest -q` cannot collect because this worktree has no installed runtime
dependencies such as `fastapi`, `httpx`, `redis`, and `anyio`.

## Merge readiness

The implementation is already merged and deployed to `staging`. This
documentation-only follow-up is ready to merge; after that, archive the Phase
05 chat and schedule 05b independently of parser integration work.
