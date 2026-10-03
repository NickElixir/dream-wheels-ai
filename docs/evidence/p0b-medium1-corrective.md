# P0-B MEDIUM-1 CORRECTIVE REPORT

PR: [#253](https://github.com/NickElixir/dream-wheels-ai/pull/253), targeting staging. Existing branch/worktree retained. No new PR or merge.

- Starting reviewed HEAD: `25dfdaf11ce379dac85d481a795f7b84b36a0133`.
- Base: `db8dc3e72729abef8ba7def9393d8e37a4139e2c`.
- Corrective commit: `fix: clear stale Fitment check launch failure`.
- New HEAD: the single corrective commit containing this report; exact SHA and CI are recorded in PR #253 delivery metadata.
- READY FOR FOCUSED RE-REVIEW: **YES**.

## Root cause and semantics

`fitmentCheckStartFailed` represented a local rejected Check POST but was reset only by Retry/view reset. Successful Save or authoritative reads could install newer canonical data or a backend execution while the old local flag still masked that state with failure presentation.

The flag now describes the latest launch failure only until a successful accepted canonical/Check event supersedes it. Backend `execution_status=failed` continues to be represented by `fitmentCheck`, independently of the local launch flag. No fake failed execution is created.

The runtime diff is seven clearing assignments adjacent to existing accepted-state assignments. No renderer, validation, revision, dirty-state, backend, credit, payment or verdict redesign.

## Clearing points

| Event | Behavior |
| --- | --- |
| Retry starts | Existing reset retained, before POST acceptance |
| Fitment opens/reset | Existing reset retained, before overview load |
| Successful Wheel Save | Clears after PATCH response passes current-context checks and canonical overview is accepted |
| Successful Vehicle Save | Same shared Save acceptance point; not a Wheel-only fix |
| Successful authoritative overview reload | Clears after current request and overview contract validation, including responses without Check and with a current Check |
| Accepted backend Check | Clears at guarded POST acceptance, polling, currentness read, and selected Check detail acceptance from history |
| Demo canonical save/reload/check | Clears in existing demo state acceptance function |

Existing context/generation/token guards and the rule rejecting an attempt to resurrect a backend-stale Check remain unchanged. A successful Check read may clear the local flag while the backend execution is still failed; that backend failure continues to render its own failure/Retry UI.

## Intentionally retained

Dirty local edits, opening the editor, field input, invalid Save before PATCH, failed Save, HTTP/network/invalid-contract overview reads, failed Check reads and superseded-context responses do not clear the flag. A rejected stale→current Check response does not clear it either.

## Focused regression tests

Nine `MEDIUM-1` tests in `tests/test_fitment_transition_behavior.mjs`:

1. Actual failed launch POST → Wheel edit → valid Wheel Save → revision advances, flag false, no fake execution, old failure markup gone and normal current summary/Check available.
2. Failed launch → Vehicle edit and successful Vehicle canonical Save → flag false.
3. Successful overview reload without Check and with completed/failed current backend Check; backend Check wins. Backend failed execution still displays failure/Retry despite local flag false.
4. Failed HTTP/network or invalid overview refresh preserves the local flag.
5. Editor/input/invalid Save and failed Save preserve the flag.
6. Successful Save clears failure while preserving a newer Wheel draft and backend-stale old verdict.
7. Guarded accepted Check read clears; failed and rejected stale reads preserve the flag.
8. A late response from a superseded context cannot clear the active flag.
9. Existing Retry start and view reset clearing semantics remain intact.

Tests assert both runtime/snapshot and rendered markup where applicable. Existing F-01 dirty/Save races, F-02 retry/double-start, F-03 sources, F-05 groups and W-01 buckets remain covered by the full suites.

## Automated verification

| Check | Result |
| --- | --- |
| Focused `node --test --test-name-pattern=MEDIUM-1 tests/test_fitment_transition_behavior.mjs` | **9 PASS** |
| `python3 -m pytest -q` | **668 PASS / 6 skipped**, existing 20 deprecation warnings |
| `npm --prefix webapp test` | **208 PASS** |
| `node --test tests/test_fitment_transition_behavior.mjs tests/test_webapp_boot_behavior.mjs` | **131 PASS** |
| `npm --prefix webapp run build` | **PASS** |
| `git diff --check` | **PASS** |
| Ruff changed Python | **N/A**, no Python changes |

[Focused log](p0b-medium1-corrective/focused-tests.txt), [backend](p0b-medium1-corrective/backend-tests.txt), [frontend](p0b-medium1-corrective/frontend-tests.txt), [transition/boot](p0b-medium1-corrective/transition-boot-tests.txt), [build](p0b-medium1-corrective/build.txt).

## Focused browser QA

Local Chromium on **1440** and **390**, controlled API responses against the current application. Six screenshots. No JavaScript page/console errors or horizontal overflow.

At both widths:

1. Click Check; mock POST actually returns 500 → launch-failure flag true and error visible.
2. Open Wheel editor, open ET picker, type a new decimal ET, apply it; local edit retains flag.
3. Click Save; successful Wheel PATCH advances revision → flag false, no Check object, failure text gone, current summary and enabled Check displayed.
4. Click Check again → 500 → flag true; successful GET overview reload → flag false and old failure presentation gone.

The runner uses existing local-only instrumentation; the new `medium1` mode does not repeat the full 31-state pass. It records POST/PATCH/GET transcript and refuses a non-local base URL. No production/staging jobs, credits or account writes.

Reproduce with the server serving `webapp` on `127.0.0.1:8781`:

```sh
P0B_QA_FOCUS=medium1 \
P0B_QA_OUTPUT=/tmp/p0b-m1-browser \
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
node scripts/qa/fitment_p0b_browser.cjs
```

[Browser transcript](p0b-medium1-corrective/browser-network.json), [screenshots](p0b-medium1-corrective/screenshots/).

This is local browser QA, **not live staging E2E**. P0-A live staging E2E remains **WAIVED BY OWNER / NOT EXECUTED**.

## New findings / scope

Local corrective verification: NEW BLOCKER **0**, NEW HIGH **0**, NEW MEDIUM **0**, NEW LOW **0**.

Review LOW-1…LOW-5 are unchanged and not included in this corrective commit. N-06/F-06/F-17/W-02, P1/P2/P3, i18n foundation, History, payment/credit logic, verdict engine and P0-A are outside scope.

Next gate: focused independent re-review of **MEDIUM-1 only**. PR #253 remains open; no merge performed.
