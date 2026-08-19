# Commercial UX / Beta Warnings — completion handoff

## Context

- Branch: `feature/commercial-ux-warnings`
- Base: `origin/staging @ 80cccd8093b2b8b313a29ed90601eca6d3040ac0`
- PR: not created

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
- Mobile: CSS stacks cards and action buttons at `760px` and below; new
  warnings use existing wrapping components. In-app browser access to the
  local static server was unavailable in this environment, so a live mobile
  screenshot remains a staging/Telegram Mini App follow-up.

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

## Tests

- `node --check webapp/app.js`
- `pytest -q tests/test_commercial_beta_ux.py tests/test_webapp_legal_links.py`
- `git diff --check`

Result: focused checks pass (`4 passed`). Full `ruff check .` has two
pre-existing `ASYNC240` findings in `scripts/vehicle_identity_benchmark.py`.
Full `pytest -q` cannot collect because this worktree has no installed runtime
dependencies such as `fastapi`, `httpx`, `redis`, and `anyio`.

## Ready for staging

YES, subject to a staging/Telegram Mini App visual smoke at mobile width.

## Exact next action

Commit this branch, open a PR to `staging`, and capture the five warning states
in a staging Mini App at mobile width before merge.
