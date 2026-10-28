# Post-Fitment-Audit Follow-ups

## Objective

Six smaller items surfaced during and after the Fitment verdict bug-fix
series (`09-fitment-verdict-bugs-fix.md`, `10-feedback-render-detail-refresh.md`).
None are confirmed live bugs in the way those were — treat each item's
"Confidence" note as the actual state of evidence, and follow the
"Required work" exactly, including where it says to stop after diagnosis
rather than fix speculatively.

## Division of responsibility

Codex implements. Where an item needs live browser confirmation (items 1, 3,
4), the auditor session verifies on deployed staging afterward — same
convention as the prior two handoffs in this series. Don't mark those items
"done" from code/tests alone.

## Mandatory start procedure

Per `docs/handoffs/README.md`: `git status`, `git branch --show-current`,
`git log --oneline -n 15`. Branch from `staging` (or fresh off it). Confirm
target branch with the user before pushing. Don't touch `worktrees/`.

## Scope

### 1. Fitment transient draft is sessionStorage-only — unconfirmed but architecturally real risk

**Confidence: unconfirmed on real hardware.** Not reproduced live — this is
a code-level risk assessment, not an observed bug report.

`webapp/app.js`: `FITMENT_TRANSIENT_DRAFT_STORAGE_PREFIX` (~line 27) backs
`persistFitmentTransientDraft()` (~line 2010) with `sessionStorage`. It is
called from exactly 3 sites: on 401/reauth (~line 3674), and two navigation
paths (~lines 7930, 11273) — never on field blur/change. `sessionStorage` is
scoped to one WebView instance; CLAUDE.md's own external-docs table already
flags a documented Telegram iOS WebView reload-on-file-picker quirk. If that
reload fires mid-edit, unsaved Fitment form state (make/model/PCD/ET the
user typed but hasn't hit "Подтвердить"/"Сохранить" for yet) can vanish with
no error surfaced — this was the leading theory for the original "data
disappears" complaint that kicked off the whole audit series, though the
three bugs actually found and fixed (`09`, `10`) turned out to be a
different mechanism (a render race, a stale cache, a missing re-render) —
not this one.

**Required work:**
1. **Reproduce first, on a real device.** Open Fitment in the actual
   Telegram iOS app, start editing a field, trigger the OS photo picker
   (e.g. via "Заменить фото"), return, and check whether in-progress
   (unsaved) form values survived. Do not implement the fix below until this
   is confirmed — if it doesn't reproduce, this item is closed as a
   non-issue.
2. **If confirmed**, frontend-only fix, no backend change:
   - Move the draft from `sessionStorage` to `localStorage` (same prefix
     constant, same key scheme by `job_id`) — `localStorage` survives a
     WebView instance being torn down and recreated; `sessionStorage` does
     not.
   - Add a debounced (~300ms) persist call triggered on every form field
     change, in addition to (not instead of) the existing 3 call sites —
     right now only navigation/teardown moments are covered, so anything
     typed between them is unprotected regardless of storage backend.
   - Leave the TTL/expiry logic as-is; it is not the cause of this risk.
3. Do not build a server-side (Redis) draft as part of this item — only
   escalate to that if the `localStorage` fix is confirmed insufficient
   after real-device retesting.

### 2. PR Vercel preview check is a false-green signal

**Confidence: confirmed** — directly observed during this audit series.

Every PR carries a `Vercel – auth-01-worktree` status check that reports
`SUCCESS`, but opening that preview URL returns `500
FUNCTION_INVOCATION_FAILED`. The project name itself (`auth-01-worktree`)
suggests it's a leftover from an unrelated auth-focused workstream,
accidentally wired to fire on every PR regardless of what changed. This
matches the "redundant/unlinked Vercel project" pattern already flagged in
`docs/evidence/vercel-deployment-topology-audit-v1.md`. Net effect: nobody
reviewing a PR — human or the auditor session — has a working preview to
check before merge; every verification in this audit series had to wait for
a merge to `staging`.

**Required work (Vercel dashboard + GitHub settings, not application code):**
1. In the Vercel dashboard, locate the `auth-01-worktree` project and either
   disconnect its Git integration (stop it from deploying on every push) or
   delete it if nothing depends on it — confirm with the user before
   deleting anything.
2. Remove its status check from the PR's required/displayed checks.
3. Set up real Preview Deployments on the actual webapp project
   (`dream-wheels-ai-webapp` per prior deployment-topology docs), accounting
   for the Vercel Hobby plan's concurrent-preview quota, which prior
   handoffs (`vercel-deployment-pipeline-migration-b1.md`) already document
   as the reason previews were constrained before.

### 3. `version.json` isn't wired to actual deploys

**Confidence: confirmed** — directly observed.

`GET /version.json` on staging returned `{"build":
"20260913-auth-account-linking-1"}` at a point where the deployed `app.js`
bundle already contained code from a same-day (Sept 22) merge — confirmed by
grepping the live bundle for function names known to exist only in the newer
commit. The file is not generated by the actual deploy pipeline; it appears
to be a leftover manually-set value from an unrelated release.

**Required work:**
1. In `.github/workflows/deploy-frontends.yml`, add a build step that
   generates `webapp/version.json` (or wherever it's served from) at build
   time from the actual git SHA being deployed:
   `{"build": "<git sha>", "built_at": "<ISO 8601 build timestamp>"}`.
2. Remove whatever manual/separate process currently sets the stale value,
   if one is found — search for "20260913-auth-account-linking" or hardcoded
   `version.json` writes outside the deploy workflow.
3. After this, `GET /version.json` should be a reliable way to confirm what
   commit is actually live, without needing to grep the bundle.

### 4. Duplicate render jobs and unstable history list ordering — diagnose only, do not fix speculatively

**Confidence: low** — observed anomalies during manual testing, root cause
not investigated.

Two separate, possibly unrelated observations from live testing on
2026-09-21/22:
- History showed near-duplicate `Zeekr 001` / `zeekr 001` entries a few
  minutes apart (11:41, 11:43, 11:50 on 2026-09-18) with inconsistent title
  casing.
- Across repeated page loads of `/app/history`, list ordering and thumbnail
  presence were inconsistent enough that manual clicks on "Посмотреть"
  sometimes landed on the wrong card. This could be an image-loading race
  rather than a data problem — not established either way.

**Required work:**
1. Query the `jobs`/`credit_ledger` tables for those three near-duplicate
   Zeekr 001 jobs: confirm their `created_at` timestamps, whether they share
   a `vehicle_identity_id`, and — most importantly — whether a credit was
   debited for each one separately. If yes, that's the actionable bug:
   duplicate submissions charging the user multiple times for what was
   likely one user action (e.g. a retried/double-clicked create request).
2. If duplicate charging is confirmed, the fix is client-side: disable the
   "Создать изображение" button immediately on click (prevent double-submit)
   and add an idempotency key to `POST /jobs/from-assets` so a retried
   request with the same key doesn't create a second job/charge.
3. The list-ordering/missing-thumbnail flakiness: only investigate further
   if it's independently reproduced with console/network evidence. Do not
   guess a fix without a repro — this may not be a real bug.

### 5. Dead state: `feedbackReasonPickerByJob`

**Confidence: confirmed**, trivial.

`webapp/app.js`: `feedbackReasonPickerByJob: {}` is declared in `state`
(~line 1444) and written to via `delete state.feedbackReasonPickerByJob[jobId]`
in two places (~lines 8610, 11174, per the `staging` HEAD at the time of
this audit — re-check line numbers, the file shifts). It is never read
anywhere. The actual logic for whether the "Что улучшить" reason picker is
visible, and which reason is selected, comes from `feedbackReasonPickerVisible()`
(derives from the job's saved `feedback.sentiment === "disliked"`) and
`feedbackReasonForJob()` (`feedback.reason`) — both independent of this
dead field.

**Required work:** delete the `state.feedbackReasonPickerByJob` declaration
and both `delete state.feedbackReasonPickerByJob[jobId]` call sites.
`grep -n feedbackReasonPickerByJob webapp/app.js` before and after to
confirm zero remaining references. No behavior should change — if any test
or manual check shows a difference, stop and investigate before proceeding,
since that would mean this field wasn't actually dead.

### 6. `webapp/app.js` monolith — manual per-view render coordination

**Confidence: confirmed**, architectural observation, not a single bug.

The file is ~11,300 lines with 32 distinct `render*` functions (one per
screen/section: `renderDashboard`, `renderRenderDetail`, `renderFitment`,
`renderWallet`, etc.) and 48 call sites across the file that manually
combine which of those to invoke after a given state mutation — e.g.
`renderRenders(); renderDashboard();` or
`if (state.view === "render-detail") renderRenderDetail();`. Both bugs fixed
in this audit series (`09`: a form field going blank after save; `10`: the
feedback buttons desyncing) were, structurally, the same class of mistake —
a state-mutating function that didn't include the right combination of
render calls for whichever screen might currently be open. This isn't a
call to rewrite the file; it's that the current pattern requires every
future change to manually re-derive the correct render call set, and will
keep producing this exact bug shape.

**Required work — incremental, not a rewrite:**
1. Add one new helper, e.g.:
   ```js
   function rerenderActiveView() {
       switch (state.view) {
           case "render-detail": return renderRenderDetail();
           case "renders": return renderRenders();
           case "wallet": return renderWallet();
           case "fitment": return renderFitment();
           // ...one case per state.view value in actual use — enumerate
           // from the codebase, don't guess the full list
           default: return renderDashboard();
       }
   }
   ```
   Enumerate the real set of `state.view` values from the codebase (grep
   `state.view =` assignments) rather than assuming the cases listed above
   are complete or correctly named.
2. Replace call sites incrementally, PR by PR, not in one sweep — each
   replacement of a manual `renderRenders(); renderDashboard(); if (...)
   renderRenderDetail();`-style block with a single `rerenderActiveView()`
   call (plus a separate `renderDashboard()` call only where the dashboard
   genuinely needs updating independent of `state.view`) should be its own
   small, independently reviewable change. Do not attempt all 48 sites in
   one PR.
3. This item has no fixed completion criteria for this ticket — treat it as
   "add the helper and migrate the two call sites already touched by `09`
   and `10` as a proof of concept," then open a separate lower-priority
   follow-up for the remaining call sites rather than blocking this PR on
   migrating all 48.

## Constraints

- No destructive git operations, no `--no-verify`, no direct push to
  `main`.
- Items 1 and 4 have an explicit "diagnose/reproduce first" gate — do not
  implement their fixes without first confirming the underlying premise.
- Item 2 and 3 are infra/config, not application code — verify who has
  Vercel dashboard access before assuming Codex can complete them
  end-to-end; if access is missing, produce the exact steps for the
  product owner instead (mirroring how `05b-payment-failure-handling.md`
  handled the Robokassa dashboard check).
- Keep each item's changes in its own commit; items 2/3 (infra) should not
  be mixed into the same commit as items 5/6 (application code).
- Run `ruff check .`, `ruff format --check .`, `pytest -q`, and the frontend
  Node test suite before declaring any code item ready for verification.

## Definition of done (per item)

- [ ] Item 1: reproduced (or ruled out) on a real iOS Telegram client;
      if confirmed, `localStorage` migration + debounced persist
      implemented; flagged for auditor verification, not closed from code
      alone
- [ ] Item 2: broken Vercel project disconnected/removed, real preview
      deployments working; flagged for auditor verification (open a PR and
      confirm its preview actually loads)
- [ ] Item 3: `version.json` generated from git SHA in the deploy workflow;
      confirmed matching a real deploy
- [ ] Item 4: duplicate-charge question answered from the DB; fix
      implemented only if confirmed; list-ordering flakiness left
      uninvestigated unless independently reproduced
- [ ] Item 5: dead state removed, zero remaining references confirmed
- [ ] Item 6: `rerenderActiveView()` helper added, migrated at minimum at
      the two call sites touched by handoffs `09`/`10`; remaining
      migration spun off as a separate follow-up item, not blocking this
      PR
- [ ] All code items: `ruff` + `pytest` + Node tests clean
- [ ] Handoff doc updated per completion procedure below

## Mandatory completion procedure

Per `docs/handoffs/README.md`: update this file's bottom with final
branch(es), commit SHAs, PR link(s), and which items are "ready for
auditor verification" vs "done" vs "closed as non-issue" (item 1/4 may
land here if not reproduced).
