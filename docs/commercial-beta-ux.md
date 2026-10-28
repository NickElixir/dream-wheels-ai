# Commercial beta UX

## Scope

Release 1 Mini App UX changes on `feature/commercial-ux-warnings`, based on
`origin/staging @ 80cccd8`. The work is limited to `webapp/` warning and
recovery states. It does not change parser extraction, fitment rules, payment
architecture, or the render provider.

## Existing states found

- Reusable `wallet-status-island` and `panel-note` warning/error/success
  components already covered mobile wrapping.
- The create flow already has two separate photo cards, a consent block, legal
  links, identity recovery, and a controlled render-error screen.
- The fitment view already has readiness, source-extraction progress, and a
  preliminary verdict shell.
- Balance is loaded from the backend rather than changed optimistically in the
  browser. The wallet has a top-up path, and support/documents are separate
  mobile-accessible views.
- The server reserves one credit per job, refunds after queue-publish failure,
  and refunds a failed worker job. Internal retries do not create another
  debit.

## Changes made

- Added a non-blocking beta notice to the create flow.
- Added the approved parser warning after a source resolver detects values.
- Added the approved fitment warning for a non-failed compatibility verdict.
- Added the approved missing-data warning only when `missing_fields` is
  present; the UI does not turn that state into a positive verdict.
- Mapped controlled unavailable/timeout/network generation failures to the
  approved no-charge message, with retry and a direct support link. Raw error
  text remains hidden from the user-facing screen.
- Clarified paid-unit copy: `1 рендер — 1 генерация виртуальной примерки`,
  `История рендеров`, `Создать виртуальную примерку`, and `Пополнить счёт`.

## States checked

- Create: beta notice, photo consent legal links, unavailable generation
  recovery, retry, support link, zero-balance recovery.
- Fitment: automatic parameter detection, missing required data, completed
  preliminary verdict, failed provider verdict.
- Wallet/dashboard: backend balance rendering, payment/top-up route, current
  render terminology.
- Support/docs: Telegram and email support plus offer, refund, privacy, and
  consent links.

## Mobile and accessibility

The existing narrow layout stacks upload cards, warning blocks, support links,
and action buttons at `760px` and below. New notices reuse those components,
use semantic status text or visible copy, and do not require modal dismissal.
Visual browser verification is recorded in the completion handoff.

## Verification

- Passed: `node --check webapp/app.js`.
- Passed: `pytest -q tests/test_commercial_beta_ux.py tests/test_webapp_legal_links.py`
  (`4 passed`).
- Passed: focused `ruff check` and `ruff format --check` for the changed tests;
  `git diff --check`.
- Full `ruff check .` is blocked by two pre-existing `ASYNC240` findings in
  `scripts/vehicle_identity_benchmark.py`.
- Full `pytest -q` cannot collect because this worktree lacks runtime test
  dependencies including `fastapi`, `httpx`, `redis`, and `anyio`.

## Follow-up outside this workstream

- The parser warning is surfaced only from the existing source-resolver state;
  no parser backend integration was added.
- The fitment warning is presentation-only and does not change verdict logic.
- Confirm the production provider-error taxonomy keeps unavailable failures
  distinguishable from invalid user input as the backend evolves.
