# Fitment Vehicle-Form & Verdict Copy — Bug Fixes

## Objective

Fix five issues found during a live authenticated staging audit (2026-09-21,
`@nick_elixir`, jobs `46de6d95...` "Zeekr 001" and a fresh "Lada Largus 2019"
job) and a follow-up read-only code audit. Two of the five are not code
changes (see Scope, items 4 and 5) — read those sections before starting.

## Division of responsibility

- **Codex implements** the code fixes and adds automated tests below.
- **Verification on live staging is NOT Codex's job.** The auditor session
  (Claude, browser-driven, already has an authenticated `@nick_elixir`
  staging session and known test job IDs) will re-run the exact manual repro
  steps in the "Manual verification" section of each item, on the deployed
  branch/PR preview, after Codex's automated tests pass. Do not mark an item
  done based on unit tests alone — flag it "ready for manual verification"
  and stop there.

## Mandatory start procedure

Per `docs/handoffs/README.md`: `git status`, `git branch --show-current`,
`git log --oneline -n 15`, confirm base branch state before editing. Branch
from `staging` (or a fresh `chore/fitment-bug-fixes` off it) — confirm target
branch with the user before pushing, per prior session convention. Do not
touch `worktrees/` — those are other active sessions' checkouts.

## Scope

### 1. Марка/Модель (make/model) go blank after "Подтвердить данные автомобиля" — HIGH PRIORITY

100% reproducible: open Fitment on any job → confirm vehicle data → `PATCH`
and refetch both return 200, but the Марка (and sometimes Модель) `<select>`
renders blank immediately after, even though the backend data is correct
(proven by reload restoring it, and the next step listing correct
modification options).

Root cause (medium-low confidence — could not pin the exact write site
without a live debugger): `webapp/app.js`, `renderFitmentControls()`
(~lines 2655-2687) rebuilds the make/model/year `<option>` lists on every
catalogue-fetch state transition, including in-flight background fetches
from `loadFitmentVehicleCatalogue()` (~3269-3282) still resolving when the
user clicks confirm. The `"change"` handler (~6639-6680) unconditionally
writes `state.fitmentForm.vehicle.make = value` (and clears model/year) with
no check that the event was user-initiated. A confirmed empirical fact: if
the "Загружаем марки/модели/годы" background-loading hints finish BEFORE
clicking confirm, the bug does not occur — this is a race, not a random flake.

**Required fix:**
- Add a save/load "generation" token: bump it in `saveFitment()` and
  `loadFitmentOverview()`; have `loadFitmentCatalogue()` drop/ignore
  responses tagged with a stale generation instead of applying them.
- In the `"change"` handler for `[data-fitment-catalogue="makes"]` (and
  models/years), guard against non-user-initiated events — check
  `event.isTrusted` and/or that `document.activeElement` is the input firing
  the event, before writing to `state.fitmentForm`.
- Before implementing, add a temporary breakpoint/log on writes to
  `state.fitmentForm.vehicle.make` to confirm which code path actually
  fires during the race, since the exact trigger wasn't 100% pinned by
  static analysis. Fix the confirmed path; keep the generation-token guard
  regardless as defense in depth.

**Automated test:** simulate a catalogue-fetch resolving after
`saveFitment()` has already started a refetch; assert
`state.fitmentForm.vehicle.make` is not cleared by the stale response.

**Manual verification (auditor, browser, post-deploy):**
1. Log in as `@nick_elixir` on the deployed preview.
2. Open Fitment on a job with pre-filled vehicle data, immediately (without
   waiting for catalogue loading hints to clear) click "Подтвердить данные
   автомобиля".
3. Confirm Марка/Модель remain populated after the PATCH+refetch completes.
4. Repeat 3x across 2 different jobs (this is how the bug was originally
   confirmed 2/2) to rule out a flake reappearing.

### 2. Malformed "ET50–50" range in verdict text — cheap fix

Confirmed on a live Lada Largus 2019 verdict: "расчётный диапазон автомобиля
ET50–50". Root cause (high confidence): `src/fitment/providers/wheel_size.py`
(~lines 640-654) — when only one offset value exists for an axle/size group,
`et_min_mm=unique_offsets[0], et_max_mm=unique_offsets[-1]` duplicates the
single point into a fake range. `webapp/app.js` (~line 2441) then always
renders `` `ET${min}–${max}` `` with no check for `min === max`.

**Required fix:** in `app.js` at the ET-range formatting site (~line 2441),
render a single value with no dash when `reference_et_min_mm ===
reference_et_max_mm`. Leave `wheel_size.py`'s data model as-is (min==max is
an accurate representation of "one known point"; the frontend copy bug is
the actual defect) — call this out explicitly if the fix turns out to need
a `wheel_size.py` change instead, but prefer the frontend-only fix if it
suffices.

**Automated test:** unit test the ET-range formatting function with
`min === max` and `min !== max` inputs.

**Manual verification (auditor, browser, post-deploy):**
Re-run the exact repro: fresh job, Lada Largus / manual vehicle entry,
wheel PCD 4×100 / 15" / 6J / DIA 58.6 / ET 40, run Fitment check, confirm the
verdict text shows a single ET value (no "50–50"-style duplicate range) for
any single-offset case.

### 3. Stale "Укажите ET" hint shown despite ET already used in the verdict

Same verdict screen shows "❓ Укажите ET колесного диска для технической
проверки" even though ET=40 was supplied and used. Root cause (medium
confidence): `src/fitment/rules/verdict.py` (~lines 27-41),
`_MISSING_FIELD_BY_REASON` maps both `ReasonCode.rim_offset_missing` AND
`ReasonCode.et_outside_reference_range` to the same `"offset_et"` bucket —
so an ET that was evaluated and found out-of-range is counted identically to
an ET that was never provided. There's a secondary, unconfirmed possibility
(needs live provider-data check) that a non-uniform per-axle result
(`src/fitment/rules/checks.py` `check_size_and_offset`, run per-axle even
for uniform setups per `src/fitment/rules/engine.py` ~lines 43-47) is
contributing a second, unrelated `rim_offset_missing` result for the axle
the user didn't separately fill in uniform mode.

**Required fix:**
- Remove `ReasonCode.et_outside_reference_range` from
  `_MISSING_FIELD_BY_REASON` — it must not appear in `missing_fields` or
  trigger "please provide" copy; it's a completed, out-of-range result and
  belongs only in `blocking_issues`.
- Investigate whether `assemble_verdict()` needs axle-awareness for uniform
  setups (skip/collapse the second axle's `size_offset` result when
  `setup_mode == "uniform"`), mirroring the existing square-setup handling
  already in `src/fitment_checks_api.py` (~lines 460-464). Confirm with a
  live check on a uniform-setup job before deciding this part is needed —
  don't implement speculatively if the first fix alone resolves the
  symptom.

**Automated test:** unit test `assemble_verdict()`/`_MISSING_FIELD_BY_REASON`
so a result with `et_outside_reference_range` never appears in
`missing_fields`.

**Manual verification (auditor, browser, post-deploy):** same repro as
item 2 — confirm the "Укажите ET" hint no longer appears when ET was
explicitly entered and used in the shown calculation.

### 4. RimSpec not inherited from visual try-on into Fitment — NOT A BUG, document only

Confirmed intentional: `src/identity/prompts.py` (line ~10) explicitly
instructs the vision model not to infer rim specifications. No code change
needed. Action: add one line to `docs/fitment-compatibility.md` (or wherever
product scope is documented) noting this is deliberate, so it isn't
re-reported as a defect in a future audit. Do not build image-based PCD/ET
extraction as part of this ticket — out of scope, would need a separate
product decision.

### 5. Payment "Сбой" / balance=0 — CORRECTION: already implemented on `staging`, verify config only

**Do not re-implement a FailURL handler.** The original code audit ran
against a stale local checkout (`feature/vercel-deployment-pipeline`,
branched before PR #134 merged) that predates this work and doesn't have it
— `origin/staging` already has the exact safe design the audit was about to
recommend, shipped in PR #134 (`docs/handoffs/05b-payment-failure-handling.md`):
`pending → failed` via `/payments/robokassa/fail`, idempotent, `FOR UPDATE`
row-locked, never writes credits/balance, never demotes an already-`paid`
row, and `failed → paid` remains possible if a late authoritative
`ResultURL` arrives. The observed "Сбой" + balance=0 in the live audit is
this design working as intended (payment genuinely failed, correctly
fail-closed) — not a defect.

**Required action (config/ops verification only, no code change):**
- That handoff doc's own status line still reads
  `PAYMENT_FAILURE_HANDLING = NOT_READY`, with the specific open gate being
  "the real Robokassa failure/cancel staging E2E after configuring staging
  Fail URL to the backend failure-return endpoint". Confirm in the Robokassa
  merchant dashboard (staging credentials) that `Fail URL` is actually set to
  `https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/fail`
  (and `Success URL` likewise to `.../payments/robokassa/success`) — the
  audited "Сбой" payment is a good real data point that the fail path does
  reach the backend, but confirm this wasn't a coincidence (e.g. a genuinely
  declined card) by checking Render logs for that invoice's fail-callback.
- Check whether a periodic reconciliation job exists for invoices stuck in
  `pending` past a reasonable timeout, cross-checked against Robokassa's
  payment-status API. If none exists, open it as a separate, lower-priority
  ticket — do not build it speculatively as part of this ticket.
- No code changes, no automated tests needed for this item.

## Constraints

- No destructive git operations, no `--no-verify`, no direct push to `main`.
- Keep commits atomic per item (1, 2, 3 together since same area is fine per
  the analysis).
- Do not implement item 4 or item 5 as code — both are documentation/config
  verification only (see their sections above).
- Do not speculatively implement the axle-awareness part of item 3 unless a
  live check on a uniform-setup job confirms it's needed after the
  `_MISSING_FIELD_BY_REASON` fix alone.
- Run `ruff check .`, `ruff format --check .`, and `pytest -q` before
  declaring any item ready for manual verification.

## Definition of done (per item)

- [ ] Item 1: generation-token guard implemented, automated test added,
      flagged ready for manual verification (NOT self-certified via unit
      test alone)
- [x] Item 2: ET-range single-value formatting fixed, test added
- [x] Item 3: `missing_fields` mapping fixed, axle-awareness investigated
      and either implemented with evidence or explicitly deferred with
      reasoning
- [x] Item 4: doc note added, no code change
- [ ] Item 5: staging Robokassa dashboard Fail/Success URL config verified
      against `docs/handoffs/05b-payment-failure-handling.md`; reconciliation
      job existence checked and gap (if any) filed separately — no code
      change in this ticket
- [x] All automated checks: `ruff` + `pytest` clean
- [x] Handoff doc updated per completion procedure below with branch,
      commit, PR link, and which items are "ready for manual verification"
      vs "done"

## Mandatory completion procedure

Per `docs/handoffs/README.md`: update this file's bottom with final branch,
commit SHA, PR link, and explicitly list which items still need the
auditor's browser-based manual verification pass before they can be closed.

## Completion update (2026-09-22)

- implementation branch: `chore/fitment-verdict-bug-fixes`
- implementation commits: `bbbc16e`, `973e7d2`, `aa908e8`
- pull request: [#180](https://github.com/NickElixir/dream-wheels-ai/pull/180) into `staging`
- automated verification: `ruff check .`, `ruff format --check .`, `pytest -q` (549 passed, 5 skipped), and fitment Node behavior tests (46 passed)
- item 1: generation invalidation and synthetic catalogue-event guard implemented; ready for auditor browser verification
- item 2: single-point ET copy and range copy fixed with automated coverage; done
- item 3: `et_outside_reference_range` no longer populates `missing_fields`; uniform axle handling audited in both execution paths and retained because the existing backend already mirrors front profiles to rear for uniform setups; done
- item 4: visual try-on/RimSpec boundary note added; done
- item 5: repository audit found no periodic Robokassa pending-invoice reconciliation job. Separate lower-priority issue [#179](https://github.com/NickElixir/dream-wheels-ai/issues/179) opened. Robokassa merchant dashboard URL settings and the matching Render callback log were not externally verifiable from this workspace; manual verification remains required.

### Remaining manual verification before closure

1. On staging, reproduce the make/model blanking scenario with a delayed catalogue response around save/refetch and confirm the selected make/model/year remain intact.
2. In the Robokassa staging merchant dashboard, confirm the Fail URL and Success URL match the endpoints documented above.
3. Cross-check the audited invoice's Render logs for the corresponding fail callback and run the documented failed-payment smoke flow.

## Auditor browser verification (2026-09-22)

Verified live on `dream-wheels-ai-webapp-staging.vercel.app` (confirmed the
deployed `app.js` contains `beginFitmentCatalogueContextChange`, the
`isTrusted` guard, and the single-point ET formatting — `version.json` is
stale/not deploy-linked, don't use it to gate verification). Authenticated
as `@nick_elixir`, reused jobs `46de6d95...` ("Zeekr 001") and the "Lada
Largus 2019" job from the original audit.

- **Item 1 — CONFIRMED FIXED.** Reproduced the original trigger twice on
  the Lada Largus job's Fitment "Автомобиль" step, including a harder case
  than the original repro (clicked "Сохранить автомобиль" the instant the
  edit form opened, while Марка/Модель were still visibly blank from the
  in-flight catalogue fetch). Both times `LADA Largus / 2019 / 1.6i 16V`
  correctly persisted and displayed after save. 2/2, matching the original
  bug's 2/2 failure rate inverted.
- **Item 2 — CONFIRMED FIXED.** Re-ran the Fitment check ("Проверить ещё
  раз") on the same job/wheel (X-Trike X-153, PCD 4×100, DIA 58.6, ET 40).
  Verdict text now reads "ET диска ET40; расчётный диапазон автомобиля
  **ET50**" — no duplicated range.
- **Item 3 — NOT FIXED, contradicts this doc's "done" status.** On the
  exact same fresh re-check used to verify item 2, the "❓ Укажите ET
  колесного диска для технической проверки" hint is still shown, despite
  ET=40 being explicitly entered and visibly used in the calculation above
  it. The wheel setup is confirmed in "Одинаковые параметры спереди и
  сзади" (uniform) mode. This means either the front→rear mirroring this
  doc's completion note relies on isn't actually happening for this job, or
  the hint is driven by something other than `missing_fields`/
  `et_outside_reference_range` (which was correctly patched — see item 2's
  confirmation that the ET value itself renders correctly). **Recommend
  reopening item 3** with a targeted investigation of what specifically
  still triggers the "please provide ET" hint when ET is present and used;
  the previously-proposed axle-mirroring theory needs re-verification with
  live data (e.g. inspect the actual `rim_setup`/`rim_spec` rows for both
  axles on this job) rather than static-code confidence alone.
- **Item 4 — not independently re-verified** (doc-only change, low risk).
- **Item 5 — not verifiable from this session**; needs Robokassa merchant
  dashboard access, which the auditor browser session does not have.

**Net status: 2 of 3 code items (1, 2) confirmed fixed live. Item 3 needs a
follow-up fix before this handoff can close.**

## Item 3 reopened, PR #182 hypothesis retracted — confirmed root cause (2026-09-22)

Item 5 is closed: the product owner confirmed with Codex that Render logs
for the audited invoice show a clean fail-callback — config and code are
both fine, no reconciliation gap for that specific payment.

Item 3's first reopening spec (below, superseded) proposed an orphaned
`rim_spec` row from a staggered→uniform toggle as the cause. **The product
owner queried the staging DB directly and disproved this**: for
`rim_setup_id=f28f8950-8306-47e8-891c-d32e3fb3bd95`, `is_staggered = false`,
`front_rim_spec_id = rear_rim_spec_id`, and both axles have `offset_et_mm =
40.0`. Do not implement the staggered/uniform-toggle fix or the per-axle
frontend guard described below this section — they would fix a bug that
doesn't exist. That section is kept for context only; the confirmed cause
and fix are in this one.

### Confirmed root cause: stale cached Check, not a live rule-evaluation bug

The auditor queried the live API directly (extracted the bearer token from
`sessionStorage.dreamWheelsWebsiteAuth` in the browser session, called
`GET /api/backend/fitment/checks?...` and
`GET /api/backend/fitment/checks/{id}`):

- The check's `reasons` array has **only** `et_outside_reference_range` on
  both `front` and `rear` axles — `rim_offset_missing` does not appear
  anywhere in the current data. The per-axle divergence theory is fully
  disproved by the live API response, matching the DB finding.
- The check's `evaluated_at` is `2026-09-21T19:56:05` — **before** PR #180's
  fix commits (`bbbc16e`/`973e7d2`/`aa908e8`, dated 2026-09-22T00:04-00:06)
  even existed.
- Clicking "Проверить ещё раз" in the UI and immediately re-querying the API
  confirmed: **the same check `id`, the same `evaluated_at`** is returned.
  The button does not force re-evaluation when the vehicle/rim input hash is
  unchanged — it serves the existing `is_current` row as-is.
- That frozen row's `missing_fields: ["offset_et"]` was computed by
  `assemble_verdict()`/`_MISSING_FIELD_BY_REASON` **at evaluation time**,
  using the pre-PR#180 mapping that still included
  `et_outside_reference_range → "offset_et"`. The code fix in
  `src/fitment/rules/verdict.py` is correct and would produce the right
  `missing_fields` for a *newly evaluated* check — it just never got the
  chance to run against this (or any other) already-computed check.

This also explains why item 2 (the `ET50–50` → `ET50` copy fix) looked
correctly fixed on this exact same stale check: that fix is purely a
frontend formatting change applied to whatever `reference_et_min_mm`/
`reference_et_max_mm` values are in the (unchanged, already-correct-in-that-
regard) stored data. Item 3's fix is backend-computed and stored once, so it
never benefited from the redeploy the way item 2's client-side fix did.

The check response includes `"versions": {"provider": "wheel_size",
"engine": "v2", "rules": "v2"}` — a rules-version field that exists,
presumably, precisely to let currentness logic detect "the rules changed,
this cached verdict needs re-evaluation." PR #180 did not bump it.

### Required work

1. **Bump the rules version** (e.g. `"v2"` → `"v3"`) as part of any future
   change to verdict-assembly/reason-code logic — including, retroactively
   for this fix, a version bump alongside it if not already released as
   part of PR #180 (confirm current deployed value first).
2. **Make currentness/`is_current` logic version-aware**: a stored check
   whose `versions.rules` doesn't match the currently-deployed rules version
   should not be served as-is on a "check again" request — it should
   trigger a genuine re-evaluation (re-run `assemble_verdict()` against the
   existing, unchanged vehicle/rim data; no new provider call needed since
   the input data hasn't changed, only the local rule/copy logic has).
   Find wherever check idempotency/currentness is decided (likely
   `src/fitment_checks_api.py`, the `_check_is_current`-style logic
   referenced in earlier audits) and add the rules-version comparison there.
3. **Backfill/cleanup consideration**: decide whether pre-existing checks
   computed under the old rules version should be lazily re-evaluated on
   next access (preferred, matches point 2) or need an explicit one-time
   pass. Prefer lazy — avoids a migration and self-heals as users revisit
   checks.
4. **Regression test**: a test that creates a check under a simulated old
   `rules` version with the buggy `missing_fields`, then asserts that
   re-requesting it against the current rules version triggers
   re-evaluation and returns the corrected `missing_fields`/`reasons`.

### Manual verification (auditor, browser, post-deploy)

1. Re-run the exact same repro (Lada Largus job, `rim_setup_id=
   f28f8950-...`) — click "Проверить ещё раз" and confirm via the UI (or a
   direct API call, same technique as above) that the check gets a **new**
   `evaluated_at` and `missing_fields` no longer contains `"offset_et"` for
   an axle where ET was supplied and used.
2. Confirm the "Укажите ET" hint no longer renders alongside the correct
   ET40/ET50 explanation.
3. Spot-check one more, unrelated existing check (e.g. the original Zeekr
   001 job) to confirm the version-aware re-evaluation doesn't regress a
   verdict that was already correct.

---

## Superseded: original (incorrect) item 3 reopening spec — kept for context only

The section below was the first reopening attempt, based on a static-code
hypothesis that a staggered→uniform toggle left an orphaned `rim_spec` row.
**This was disproved by a direct staging DB query** (see above) — do not
implement anything in this section.
## Item 3 reopened — root cause and fix spec (2026-09-22)

Item 5 is now closed: the product owner confirmed with Codex that Render logs
for the audited invoice show a clean fail-callback — config and code are
both fine, no reconciliation gap for that specific payment. No further
action needed on item 5.

A follow-up read-only investigation found the **actual** mechanism behind
item 3, and it is not what the original PR #180 fix targeted.

### Root cause

The "❓ Укажите ET колесного диска для технической проверки" hint is **not**
driven by `missing_fields`/readiness at all — PR #180's fix
(`src/fitment/rules/verdict.py`, `_MISSING_FIELD_BY_REASON`) patched the
wrong layer. The hint actually comes from `webapp/app.js:2971-2988`, which
renders `check.blocking_issues`/`conditions`/`advisories` — three arrays
returned directly by the compatibility-check API, one line per item, via
`fitmentVerdictMessage()` (`app.js:2406-2448`). Line 2416-2417 renders the
"Укажите ET" hint whenever an item has `code === "rim_offset_missing"`,
completely independent of `missing_fields`.

`src/fitment/rules/engine.py:42-45` runs `check_size_and_offset` separately
for `front` and `rear` axles. For this job it is producing **two different
results**: front axle → `et_outside_reference_range` (ET40 vs ET50, shown
correctly per item 2's fix), rear axle → `rim_offset_missing` (shown as the
stale-looking hint). These are two genuinely different `RuleResult`s from
two different rule evaluations, both surfaced as separate verdict lines —
not a copy-paste display bug.

**Why would the axles differ in "uniform" mode?** `insert_rim_setup`
(`src/identity_service.py:604-622`) sets `front_rim_spec_id ==
rear_rim_spec_id` (same row) for a uniform setup, so they normally can't
diverge. The strong suspect (medium confidence, **not yet confirmed against
the actual DB row** — no DB access in the investigation) is the
staggered↔uniform toggle path: `src/jobs_api.py:3740-3899` clones the front
row into a new, separate rear row when switching to staggered mode; the
"switch back to uniform" branch at `src/jobs_api.py:3900-3910` only
re-points `rear_rim_spec_id = front_rim_spec_id` when a `setup_changed` flag
is truthy. If mode was ever toggled staggered→uniform (or that flag didn't
line up), the rear row stays orphaned. Subsequent uniform-mode edits
(`src/jobs_api.py:3682-3724`) only `UPDATE rim_specs ... WHERE id =
front_rim_spec_id` — so the front row gets ET=40 while the orphaned rear row
keeps its stale/NULL `offset_et_mm`, producing exactly the observed split.

### Required work

1. **Confirm before fixing**: query the `rim_setups` row for
   `rim_setup_id=f28f8950-8306-47e8-891c-d32e3fb3bd95` (the audited Lada
   Largus job) — check whether `front_rim_spec_id != rear_rim_spec_id`
   despite `is_staggered = false`. This confirms or rules out the toggle
   theory before any code changes.
2. **Backend fix** (if confirmed): repair the staggered→uniform toggle so
   `rear_rim_spec_id` always re-converges to `front_rim_spec_id` on that
   transition, not gated on a `setup_changed` flag that can fail to be true
   when it should. Evaluate whether a one-time backfill/repair pass is
   needed for any existing `rim_setups` rows already in this orphaned state
   (`is_staggered = false` but `front_rim_spec_id != rear_rim_spec_id`).
3. **Frontend defense-in-depth**: in `fitmentVerdictMessage()`/
   `renderFitmentVerdictGroup`, don't render a `rim_offset_missing` line for
   an axle the user never directly edited when `setup_mode === "uniform"`
   and the visible ET field is filled. This masks the symptom for any
   pre-existing orphaned rows without waiting on a backfill, but the
   backend fix in item 2 above is the real correctness fix — don't treat
   the frontend guard as sufficient on its own.
4. Add regression coverage: a Python test asserting that toggling
   staggered→uniform always converges `rear_rim_spec_id` to
   `front_rim_spec_id`, and a Node test asserting the verdict UI doesn't
   show `rim_offset_missing` for the non-edited axle in uniform mode when
   the shared ET value is present.

### Manual verification (auditor, browser, post-deploy)

Re-run the exact repro: open the Lada Largus job's Fitment, "Колесный диск"
tab, confirm setup mode is "Одинаковые параметры спереди и сзади", run
"Проверить ещё раз", confirm the "Укажите ET" hint no longer appears
alongside the correct ET40/ET50 explanation. If the DB investigation in
step 1 finds this specific job's row is unrecoverably orphaned pre-fix, use
a fresh job instead to verify the fix going forward, and separately confirm
whichever backfill/repair approach was chosen for existing rows.
