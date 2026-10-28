# Fitment Phase B — H1 correction and bounded triage

Status: **H1 FIX READY — WAITING FOR FINAL QA SCOPE**.
Final gate: **DO NOT MERGE — WAITING FOR CLAUDE 390/EN QA COMPLETION**.

## Baseline and scope

- Repository: `NickElixir/dream-wheels-ai`.
- Freshly fetched `origin/staging`: `d5c9d7e786a8d8abdcf12ac59e7d3c211b8dfaf1`.
- Branch: `fix/fitment-phase-b-e2e-corrections`.
- Previously qualified runtime reported in the owner brief: `7ac81e2171cff69bd0ea02372a6ae920ff27a444`.
- Product correction contains no dependency on QA tooling PR #246.
- Implemented: H1 only. M1/M2/M4 are characterization and proposals only.
- No backend/schema/provider/rate-limit changes, staging deployment, merge,
  live context mutation, Render, credits, or reviewer recheck request.

## Finding summary

| Finding | Root cause | Contract status | Proposed fix | Implement now? |
| --- | --- | --- | --- | --- |
| H1 | Canonical make/model labels fed directly to strict option-value comparison; editor CTA always Save | Violation of explicit base Save/Confirm lifecycle | Project catalogue identities at snapshot boundary; show guarded Confirm for clean saved proposal | YES — implemented |
| M1 | Overview navigation invokes resolver for a saved URL; per-job sentinel resets on each open | BUG: reopening unchanged resolved identity should not refresh proposals merely through navigation | Skip unchanged already-resolved identity on entry; retain initial resolve, explicit Retry and actual source changes | NO — pending owner approval |
| M2-A | Every front manual field edit clears fingerprint/SKU, including absent geometry | BUG: commercial SKU identity is not a technical-field confirmation | Keep product identity on geometry completion; invalidate only that field's source proposal/acceptance; preserve URL/SKU invalidation boundaries | NO — pending owner approval |
| M2-B | Source application deliberately preserves manual fields across SKU change | EXPECTED / CONTRACT-CONSISTENT for manual geometry, including when B lacks geometry | Preserve manual values; keep explicit conflicts when B supplies a differing value | NO — no correction proposed |
| M4 | Authenticated website boot returns before navigation-context restoration; bootstrap loads dashboard only | PRODUCT BUG, reproduced with ordinary completed-context metadata in isolated boot test | Restore persisted context after verified website bootstrap, with revision-safe overview/draft load and suppressed automatic resolver | NO — pending owner approval |

## H1 root cause and correction

Backend `src/jobs_api.py` revalidates the base selection exactly, persists canonical
labels, and retains provider slugs internally. Its existing PATCH contract treats
changed fields as proposed; a later unchanged PATCH explicitly confirms them.
`fitmentFormFromOverview()` correctly reads canonical labels. However,
`vnextFitmentSnapshot()` previously forwarded them directly to `<select>` options
whose values are provider catalogue identities. `field()` compares values strictly.
Thus `LADA`/`Vesta` did not select `lada`/`vesta` after the first successful PATCH.
`vehicleEditor()` also hardcoded `Сохранить автомобиль` for both domain stages.

The snapshot now projects the form through the existing
`fitmentCatalogueCanonicalValue()` utility. Stable option identity has priority;
only an unambiguous exact catalogue label is a fallback when the overview exposes
no slug. No fuzzy match, global lowercasing of stored identity, or canonical
mutation is introduced. The raw form and canonical overview remain separate from
presentation, so an unchanged confirmation still sends canonical values.

`fitmentBaseVehicleAwaitingConfirmation()` consumes server `unconfirmed` and
`complete_vehicle_details`, a complete saved base, and absence of Vehicle edits.
The editor then renders `Подтвердить данные` / `Confirm details` with a dedicated
`confirm-vehicle` bridge action. That action rechecks eligibility before the normal
revision-bound Vehicle-only PATCH. Material edits remove Confirm eligibility and
return to Save; a successful re-save returns to Confirm.

| State | CTA | Persistence / next stage |
| --- | --- | --- |
| Unsaved catalogue selection | Сохранить автомобиль | Existing PATCH saves proposed base |
| Saved proposed base, no local Vehicle edits | Подтвердить данные | Explicit unchanged PATCH confirms base |
| Confirmed base | Choose exact variant | Existing lookup bound to saved revision/market |
| Selected exact variant | Подтвердить комплектацию | Existing explicit apply; no auto-confirm |

Single-market `russia` stays auto-resolved and hidden. Multi-market selection stays
visible and survives Save/Confirm. Wheel payload, canonical values, confirmations,
source/SKU identity and revisions are untouched. Server `next_action` and
`FITMENT_VERDICT != RENDER_PERMISSION` remain unchanged.

## H1 tests and local evidence

| Requirement | Evidence | Result |
| --- | --- | --- |
| H1-A | Label↔slug projection; stable ID priority; ambiguous labels rejected; canonical unchanged | PASS |
| H1-B | First Save retains make/model/year/market and renders dedicated Confirm in unconfirmed state | PASS |
| H1-C | Second explicit PATCH uses current revision, confirms base, loads candidates; exact apply remains required | PASS |
| H1-D | LADA / Vesta / 2020; single `russia` hidden and persisted | PASS |
| H1-E | Lexus / RX / 2020; selected `usdm` persisted and shown | PASS |
| H1-F | Change Year after Save; stale Confirm sends no mutation; re-save sends changed year and returns Confirm | PASS |
| H1-G | Completed Wheel: no Wheel/setup keys in either Vehicle PATCH; canonical Wheel bytes/revisions/provenance unchanged | PASS |

All four new H1 scenario tests fail against unchanged staging for the intended
projection/confirmation defects and pass with the correction. They use the real
controller and renderer with deterministic API responses. Frozen backend tests
independently cover actual persistence/confirmation and domain isolation.

- Frontend/auth: **194 PASS**.
- Cumulative transition/catalogue/composition/focus/boot: **118 PASS**,
  including four H1 and four unfixed triage characterization scenarios.
- Focused frozen frontend/API/Vehicle/check contracts: **170 PASS**.
- Full backend: **612 PASS / 5 skipped**, 14 existing httpx deprecation warnings.
- Build, Ruff check/format, diff and scoped pre-commit: PASS.
- Whole-repository hooks encountered inherited whitespace/EOF issues; unrelated
  automatic rewrites were restored. Only corrective files pass through delivery.

Browser: Codex in-app browser / Chromium, local controlled fixture
`http://127.0.0.1:8774/tests/browser-fixtures/fitment-phase-b-h1.html`.
The fixture executes production `app.js` controller and production view with
local API doubles; it does not contact staging or an external provider. Fixture
bootstrap supplies the make catalogue for its intentionally empty starting base.
This is focused H1 verification, not authentication/provider or full visual E2E.

| Browser check | 1440×1000, LADA single market | 390×844, Lexus multi market |
| --- | --- | --- |
| Correct title/URL, meaningful UI, no framework overlay | PASS | PASS |
| Select → Save → retained values → Confirm → variants | PASS | PASS |
| Market semantics | Hidden `russia` retained | Visible selected USA / `usdm` retained |
| Wheel unchanged; no automatic Check or exact apply | PASS | PASS |
| Page horizontal overflow | None: scrollWidth 1440 | None: scrollWidth 390 |
| Console warnings/errors / InvalidStateError | None | None |

Screenshots and DOM/request transcripts:

- [Desktop before Save](fitment-phase-b-h1/desktop-before-save.png)
- [Desktop after Save](fitment-phase-b-h1/desktop-after-save.png)
- [Desktop variants](fitment-phase-b-h1/desktop-variants.png)
- [Desktop sequence](fitment-phase-b-h1/desktop-sequence.txt)
- [Mobile before Save](fitment-phase-b-h1/mobile-before-save.png)
- [Mobile after Save](fitment-phase-b-h1/mobile-after-save.png)
- [Mobile variants](fitment-phase-b-h1/mobile-variants.png)
- [Mobile sequence](fitment-phase-b-h1/mobile-sequence.txt)

Screenshots show the controlled API log below the production surface. Live staging
H1 correction and full authenticated E2E are **NOT verified by this evidence**.
Independent remaining 390/EN QA scope is still pending.

## M1 — automatic resolver triage

**Classification: BUG. Implementation: NOT YET.**

Client trigger: `loadFitmentOverview()` schedules
`resolveFitmentRimSource({automatic:true})` after a successful overview load when
URL exists, restoration did not restore a draft, automatic resolution is not
suppressed, and the job sentinel differs. `openFitmentView()` resets that sentinel.
The real controller characterization test opens the same completed context twice
and observes two POSTs, unchanged canonical ET38, new ET35.5 conflict and Check
still available from authoritative `run_standard_check`.

This is once per entry cycle, not every component render. Successful draft
restoration and suppressed restoration paths can skip it; repeated overview GETs
within the same entry are protected by the sentinel. Entry does not inspect saved
fingerprint, SKU, source revision, durable resolved state or confirmed provenance.
Request context/generation guards prevent obsolete responses, but not redundant
provider calls. Server resolution is unpersisted and initiated by that client POST.

Frozen authorities: implementation spec §§7.2/10/15, API source identity contract,
and runtime mapping's legacy automatic URL re-resolution gap. Initial resolution,
explicit Retry and a true URL/SKU source change may call the provider. Reopening
an unchanged already-resolved source should not call it solely for navigation.
Repeated explicit resolver proposals may conflict but cannot overwrite canonical
Wheel. Check availability while there is a local conflict is contract-consistent:
Check evaluates saved canonical data, never that unresolved draft.

Limiter: `resolve_fitment_rim_source()` calls owner-scoped `enforce_rate_limit()`
before resolving. Backend emits HTTP 429 with `Retry-After`; the gateway forwards
that response header. Reopening consumes the same owner's window. The owner brief
reported approximately ten calls and 1703 seconds; this pass does not reproduce
throttling against staging. Resolver discards error metadata, maps all failures to
generic copy, and offers immediate Retry. Rate-limit UX is a separate proposal:
consume supplied retry timing, show safe retry-later copy, and prevent pointless
immediate Retry; do not invent a countdown or change limiter configuration.

Minimal future correction/tests: identity-aware entry skip, unchanged source across
reopen/reload no POST; unresolved first source one POST; explicit Retry one POST;
URL/SKU change remains resolvable; stale responses remain isolated; canonical
conflicts and server Check authority preserved. Requires owner approval.

## M2-A — SKU provenance loss

**Classification: BUG. Implementation: NOT YET.**

`selectFitmentRimVariant()` stores selected SKU/fingerprint. Then
`markRimFieldEdited()` clears both for every front field other than URL, including
manual completion of geometry absent from the provider. The real-controller
characterization test uses a brand-only SKU and observes that loss immediately.
`canChooseSku` then loses its required selected identity, hiding the return action.

The API uses fingerprint/SKU for product context, while proposal/accepted contexts
and manual field lists own technical evidence. The implementation spec §7.3 makes
commercial SKU choice separate from confirmation; the Phase A corrective evidence
also explicitly preserves manual input independently of source-backed proposals.
A missing technical field's manual completion should not erase commercial identity.

Minimal future correction: retain product identity for technical edits; remove only
the edited field's proposal/acceptance and mark it manual. Keep real product URL
replacement and SKU transition invalidation. Do not retain source-backed technical
confirmation across a changed identity. Add brand-only SKU → manual fields → Save
payload/provenance tests and choose-another-SKU visibility tests; unchanged identity
and actual source-change regressions. No patch to this behavior in H1.

## M2-B — manual geometry across SKU A → B

**Classification: EXPECTED / CONTRACT-CONSISTENT. Implementation: NOT YET.**

`applyRimSourceValues()` preserves fields in `fitmentRimManualFields`, removes their
old source proposal/acceptance, and produces a manual conflict if B supplies a
different technical value. Missing B geometry does not revoke independent manual
input. The characterization test confirms accepted manual ET38 survives a
brand-only B, is not pending and has the newly selected SKU. Existing Phase A tests
separately cover changed source-backed proposals/acceptance and manual conflicts.

No automatic clearing of manual geometry is proposed. The API source-change
boundary is still revision-bound, and final Save records explicit confirmations;
local manual acceptance is not equivalent to having saved provider evidence.

## M4 — context restoration

**Classification: normal PRODUCT BUG, not QA-carrier-only. Implementation: NOT YET.**

`persistFitmentNavigationContext()` stores `jobId`, `originView` and `activeSection`
in session storage. Both ordinary history/result entry and operator bridge entry
use `openFitmentView()` and this same store. `/app/fitment` selects a view through
`app-route.mjs`; it does not encode or infer a job from its path.

DOMContentLoaded's authenticated website branch awaits
`bootstrapAuthenticatedApplication()` and returns. Bootstrap hydrates files and
dashboard, but never reads the Fitment navigation context. Restoration exists only
in the later non-website branch. A controlled boot test stores an ordinary completed
render's supported navigation metadata, simulates verified website auth, runs the
real bootstrap and observes a ready application with empty `fitmentJobId`, while
metadata remains readable. The defect is therefore independent of QA markers or
carrier status. No real history or account was mutated to reproduce it.

Minimal future correction: restore supported persisted identity after verified
website bootstrap using the existing overview/draft restoration flow, suppress
automatic resolver during restore, retain generation guards and revision mismatch
full-discard semantics. Add ordinary completed context reload, auth-loss/re-auth,
stale draft, missing/inaccessible job and payment-return precedence tests. This
pass implements none of those changes.

## UI_CHANGE_MANIFEST

- User-visible changes: actual selected catalogue values remain selected after
  base Save; clean saved proposal exposes `Подтвердить данные` / `Confirm details`;
  material edit returns to Save.
- New element: no new surface; dedicated Confirm action on the existing primary
  control. No elements removed, no layout/style/token changes.
- Interaction change: explicit Save versus Confirm shown honestly; existing
  mutation and exact-variant boundaries retained.
- Authority: owner H1 specification; frozen state machine; flow/UI/API contracts;
  implementation spec §§6/10/19; v13 composition and VNext Design Code/amendment.
- Unspecified design decisions: NONE.

## Delivery gate

Draft PR targets staging. Exact final HEAD and CI result are reported in the PR
and delivery response; evidence content is committed with that HEAD. Do not merge,
deploy, ask Claude to recheck H1 or expand M1/M2/M4 scope until owner freezes the
remaining scope after independent 390/EN QA completion.

## Final confirm-vehicle mutation ownership correction

### Previous HIGH and root cause

The reviewed `efd136714fb96a008709f731c9079f0e022e8446` exposed a
section-independent Confirm action, but the save payload still depended on
`fitmentVehicleConfirmationRequired()` and its active Vehicle section. From Rim
or Result the action could send revisions without Vehicle and announce success.

### Explicit intent and mutation boundary

The bridge now passes `confirm_vehicle` through `saveVnextFitment` to
`saveFitment`. That intent owns the Vehicle mutation independently of the active
section and includes Vehicle plus `expected_vehicle_revision` and
`expected_rim_revision`, without Rim/front/rear/setup fields. Clean complete saved
proposal eligibility and positive integer revision guards are checked at the
mutation boundary. Form validation and current runtime generation guards remain.
A response without confirmed Vehicle state is rejected before success or variant
progression. HTTP 409 and server failure retain the existing failure path.

| Active section | Vehicle payload present | Result |
| --- | --- | --- |
| vehicle | YES | PASS |
| rim | YES | PASS |
| result | YES | PASS |

### Stale / revision guards and Wheel isolation

Edited, incomplete, non-proposed and missing-revision intents produce no PATCH.
Conflict, server failure and HTTP 200 without confirmation produce no success.
Wheel canonical data, RimSpec/RimSetup revisions, confirmed fields, SKU/fingerprint
and local Wheel draft remain unchanged in the ownership regression tests.
Existing H1-A–G and M1/M2/M4 characterization coverage remains intact.

### Verification

- Transition behavior: 104 PASS, including seven new ownership/failure guards.
- Cumulative Fitment/catalogue/composition/focus/boot: 125 PASS.
- Frontend auth/VNext: 194 PASS; production build PASS.
- Backend: 612 PASS / 5 skipped (14 existing deprecation warnings).
- Desktop browser 1440×1000: production controller with deterministic local API;
  base Save → set active Result → Confirm → `confirmed_incomplete` /
  `select_vehicle_variant`; two exact candidates, no automatic exact selection.
- Transcript records `active_section: result` on the confirming PATCH, both
  expected revisions and Vehicle, with no Wheel mutation; browser warn/error
  logs empty. This is targeted local browser QA, not full staging E2E.
- Evidence: [sequence](fitment-phase-b-h1/final-confirm-result-sequence.txt) and
  [screenshot](fitment-phase-b-h1/final-confirm-result.png).

### Exact delivery receipt and scope

The final commit identity cannot be embedded in its own contents. The exact
published HEAD and CI run for that same HEAD are recorded in the final delivery
receipt on [Draft PR #247](https://github.com/NickElixir/dream-wheels-ai/pull/247).
That receipt supersedes earlier HEAD/CI receipts for this focused re-review.
M1/M2/M4 and LOW runtime fixes: NO. Backend/API/schema/provider changes: NO.
Merge/deploy: NO. **DO NOT MERGE — ONE FOCUSED INDEPENDENT RE-REVIEW REQUIRED.**
