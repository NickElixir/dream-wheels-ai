# Render Feedback Buttons — Stale Detail-View Rendering

## Objective

Fix a confirmed UI bug: on the render detail page ("Детали примерки"), the
"Оценка результата" (👍/👎) feedback buttons visually get stuck in an
inconsistent state after a click — both buttons can appear selected at once,
and a stale "Что улучшить" reason picker can stay visible after switching to
"Удачный результат" — even though the submission succeeds and the correct
state is stored server-side. This was found during a live authenticated
staging audit (2026-09-22, `@nick_elixir`).

## Division of responsibility

Codex implements the fix and adds regression coverage. Final confirmation on
live staging (repro steps below) is the auditor session's job, same as prior
handoffs in this series (`09-fitment-verdict-bugs-fix.md`) — don't mark this
done from unit tests alone.

## Mandatory start procedure

Per `docs/handoffs/README.md`: `git status`, `git branch --show-current`,
`git log --oneline -n 15`, confirm base branch state before editing. Branch
from `staging` (or a fresh branch off it) — confirm the target branch with
the user before pushing. Do not touch `worktrees/`.

## Confirmed root cause

**The data is correct.** A fresh page reload always shows the right
sentiment/reason state — this is a pure client-side rendering bug, not a
persistence bug.

`webapp/app.js`, `submitHistoryFeedback()` (currently ~line 8741-8836):

- The optimistic update at line 8791-8792 (`setFeedbackRecord(jobId,
  optimisticFeedback); renderRenders();`) only calls `renderRenders()`.
- The `finally` block at line 8831-8835 (`state.feedbackBusyByJob[jobId] =
  false; renderRenders(); renderDashboard();`) also only calls
  `renderRenders()`/`renderDashboard()`.

Neither path re-renders the **render detail view**
(`state.view === "render-detail"`), which is a separate render function,
`renderRenderDetail()`. If the user is on that page when they click a
feedback button, the DOM for the feedback block is never refreshed by either
the optimistic write or the real server response — the buttons visually
freeze in whatever state they were in right before the click. What looks
like "both buttons selected" immediately after a click is the browser's own
focus/hover state on the just-clicked button layering on top of the
still-unrefreshed DOM, which still carries the *previous* button's real
`selected` class from before the click.

The codebase already has the correct guarded pattern for this exact
situation, used in **four other places** — most relevantly at line 8944,
inside a sibling per-job background-refresh function:

```js
if (state.view === "render-detail" && state.renderDetailJobId === jobId) renderRenderDetail();
```

(The other three instances, at lines 7900/8522/9330/11161 — re-check exact
line numbers before editing, the file shifts — use a simpler
`if (state.view === "render-detail") renderRenderDetail();` without the
per-job guard; the guarded version at 8944 is the better model to copy since
`submitHistoryFeedback` also operates on a specific `jobId` and multiple
jobs' feedback could in principle be in flight.)

## Required fix

In `submitHistoryFeedback()`:

1. After the optimistic `setFeedbackRecord(jobId, optimisticFeedback);
   renderRenders();` (~line 8792), add:
   ```js
   if (state.view === "render-detail" && state.renderDetailJobId === jobId) renderRenderDetail();
   ```
2. In the `finally` block (~line 8831-8835), add the same guarded call
   alongside `renderRenders(); renderDashboard();`.
3. Double-check the `catch` block's `setFeedbackRecord(jobId,
   currentFeedback)` (rollback on error) is also covered by the `finally`
   block's added render call — it should be, since `finally` always runs
   after `catch`, but verify the guard reads the correct final job id after
   an error-rollback rather than a stale reference.

## Automated test

Add a Node behavior test (matching the style of the existing
`tests/test_fitment_transition_behavior.mjs`/`tests/test_fitment_vehicle_catalogue_behavior.mjs`
harness pattern) that:
- Sets `state.view = "render-detail"` and `state.renderDetailJobId` to a
  job id with an existing "disliked" feedback record.
- Calls `submitHistoryFeedback(jobId, "liked")` against a mocked successful
  fetch.
- Asserts `renderRenderDetail` (or its DOM output) reflects the new "liked"
  state without requiring a manual reload/navigation — i.e. that the
  render-detail path was actually invoked as part of the optimistic and/or
  final update, not just `renderRenders()`.
- Also cover the `deleting`/error-rollback branches if the harness makes
  that easy — lower priority than the main success-path assertion.

## Manual verification (auditor, browser, post-deploy)

1. Log in as `@nick_elixir` on staging, open any completed render's detail
   page ("Детали примерки"), scroll to "Оценка результата".
2. Click "👍 Удачный результат" (or "👎 Нужна доработка" first if the job's
   current state is "liked" or unset — the point is to click the button
   that changes the current sentiment).
3. Immediately (no reload) confirm exactly one button shows the `selected`
   style, the other does not, and the "Что улучшить" reason panel visibility
   matches the new sentiment (hidden for "liked", shown for "disliked").
4. Reload the page and confirm the same correct state persists (this part
   already works today — don't regress it).
5. Repeat once more switching back the other way, to catch any asymmetry
   between the like→dislike and dislike→like transitions.

## Constraints

- No destructive git operations, no `--no-verify`, no direct push to
  `main`.
- Single, small, scoped fix — don't refactor `submitHistoryFeedback` beyond
  adding the missing render calls.
- Run `ruff check .`, `ruff format --check .`, `pytest -q`, and the frontend
  Node test suite before declaring this ready for manual verification.

## Definition of done

- [ ] Both missing `renderRenderDetail()` guard calls added
- [ ] Regression test added and passing
- [ ] `ruff` + `pytest` + Node tests clean
- [ ] Flagged "ready for manual verification", not "done", until the
      auditor confirms live on staging
- [ ] Handoff doc updated per `docs/handoffs/README.md` completion
      procedure: branch, commit, PR link
