# Fitment VNext — Phase A Corrective Functional Pass

Status: **PARTIAL — READY FOR INDEPENDENT RE-REVIEW; local resolver browser smoke is unavailable in the demo context.**

Base: PR #241 runtime HEAD `981382dc11e7085868b3787ae75265a929b0e6b0`.
Corrective branch: `fix/fitment-vnext-phase-a-corrections`.
Corrective HEAD: filled after commit.
PR: filled after creation.

This is a focused corrective pass for B1–B4 and H1–H4. It does not integrate or merge the implementation stack. The supplied Phase A review says `NOT READY`; its underlying reviewer report was not present in this checkout, so findings below are mapped to the supplied corrective specification and the cited slice evidence.

## Corrected findings

| Finding | Root cause | Correction | Regression coverage | Status |
|---|---|---|---|---|
| B1 — Save owner | Active navigation section could decide the domain mutation. | Vehicle and Wheel Save pass explicit owners through the VNext bridge. Wheel payload omits Vehicle, including when Vehicle is incomplete. | Wheel-only PATCH payload/revision preservation and explicit owner tests. | PASS |
| B2 — Save to Check transition | A successful canonical Wheel Save could leave its editor active and keep Check hidden. | Successful save closes the clean Wheel editor; availability follows authoritative `next_action === run_standard_check`. Save does not start Check. | Ready transition test checks editor closed, `canRunCheck`, and visible Check action without reload. | PASS |
| B3 — Resolver/SKU confirmation | Resolver values lacked source/SKU-bound proposal and acceptance state. Repeated lookup or SKU change could leak old confirmation. | Transient source proposal/accepted contexts are keyed by source fingerprint and SKU. Repeated unresolved proposals remain pending; SKU change replaces unresolved proposals, invalidates changed source acceptance, preserves manual edits, and protects canonical fields. | Repeat resolver, source proposal acceptance, SKU A→B, manual conflict and canonical protection tests. | PASS |
| B4 — Async context isolation | Some late async success/error/401/finally branches lacked job generation ownership. | Runtime context generation plus request tokens guard overview, catalogue, variant/reselection, Save/apply/replace, resolver, currentness/history and photo hydration paths. Old context responses cannot update a new job or trigger its auth recovery. | Late overview success/500/401 and late Wheel Save A→B tests, plus catalogue/composition/race suites. | PASS |
| H1 — Confirmed Vehicle reselection | The chooser was hidden unless `next_action` required initial variant selection; an open Wheel editor also hid reselection mode. | Explicit `reselect` mode renders the optional chooser independently of `next_action` and while Wheel editing remains visible. Cancel leaves canonical Vehicle and Check unchanged. | Bridge-action runtime transition, renderer assertion for active Wheel editor, browser options + Cancel smoke. | PASS |
| H2 — Variant Apply failure | Outer UI could report success after an internally swallowed failure. | Apply resolves as applied only after authoritative overview confirms the selected variant; failure preserves chooser and candidate and cannot show success. | 503 retains canonical overview, candidate, selection and retry state; successful authoritative Apply path retained. | PASS |
| H3 — Currentness after mutation | A currentness detail refresh could leave or restore a result as current after a revision change. | Mutation overview stale state is applied immediately; failed/contradictory detail refresh cannot restore currentness to true. Previous evidence remains visible as stale. | Revision change + detail GET returning `is_current=true`; rendered state remains stale and prior evidence remains. | PASS |
| H4 — Preliminary warning | Approved warning/disclaimer was absent from the visible VNext result component. | Existing approved localized warning and disclaimer render in the subdued VNext result footer for completed non-failed outcomes. | VNext renderer assertions for compatible, conditional, incompatible, unknown and stale; failed operational checks remain distinct. Browser saw both approved texts. | PASS |

## Cross-slice regression results

| Test | Coverage | Status |
|---|---|---|
| T1 | Confirm Vehicle; Wheel Save uses Wheel-only payload despite stale Vehicle section. | PASS |
| T2 | Canonical Wheel Save closes editor and enables Check from server `next_action`, with no reload or automatic Check. | PASS |
| T3 | Repeat resolver without acceptance stays pending and not save-ready. | PASS |
| T4 | SKU A→B replaces unresolved system proposals, invalidates changed source acceptance and preserves manual values. | PASS |
| T5 | Job A late success, 500, 401 and mutation completion cannot replace Job B or open obsolete auth recovery. | PASS |
| T6 | Confirmed Vehicle reselection shows candidates; Cancel leaves canonical Vehicle and Check untouched. | PASS |
| T7 | Variant Apply 503 retains choices/selection and shows no false success. | PASS |
| T8 | Revision-changing mutation plus detail refresh reporting current leaves prior result visibly stale. | PASS |
| T9 | Completed VNext result visibly renders the approved warning and disclaimer. | PASS |

Existing Wheel-only Save with incomplete Vehicle, exact ET (`35,125` → `35.125`), revision-mismatch draft discard, Check lifecycle, Render independence, staggered rear draft preservation, resolver race, and numeric controls remain covered by the frontend/runtime suites. No `FITMENT_VERDICT` path grants or blocks Render permission.

## Automated validation

- Frontend: `npm test` — **183 passed, 0 failed**.
- Combined Fitment transition/runtime: `node --test tests/test_fitment_transition_behavior.mjs` — **65 passed, 0 failed**.
- Full backend: `pytest -q` — **612 passed, 5 skipped**; 14 existing httpx deprecation warnings.
- `ruff check .` — passed.
- `ruff format --check .` — passed; 135 files already formatted.
- `npm run build` — passed (test harness and app-auth bundles).
- `git diff --check` — passed.

## Local browser QA

Used the local guest preview at `http://127.0.0.1:8774/?preview=fitment` and the local result fixture. No staging account or staging Fitment data was used.

- Completed Vehicle + Wheel editor → Wheel Save → success message; editor closed and Check became enabled immediately from the demo's authoritative progression. No reload.
- Completed demo Check displayed “Подходит с условиями” and both approved warning texts.
- Confirmed Vehicle → “Изменить комплектацию” → three variants visible while Wheel editor remained open; Cancel restored the existing Vehicle summary.
- Saved a changed canonical ET in the demo; the prior result immediately displayed “Результат больше не актуален” while preserving its prior verdict/evidence.
- Warning, disclaimer and stale state remained visible without horizontal overflow at **1440×1000**, **1024×768**, **768×1024**, and **390×844** (`documentElement.scrollWidth === innerWidth` at each size).
- Browser console error log was empty; no `InvalidStateError` was observed.
- Resolver/SKU switching was not performed in this browser preview: the local guest demo's resolver path intentionally short-circuits rather than loading catalogue variants. Source/SKU behavior is covered by production-function runtime tests (T3/T4). Authenticated local catalogue browser coverage is therefore incomplete for this pass.

## Deferred findings and decisions

Per the corrective specification, these remain out of scope and are not declared fixed:

- M1 manual fallback secondary styling.
- M2 source preview geometry/object-fit.
- M3 picker radius/divider polish.
- M4 uniform/staggered visual hierarchy.
- L1 proposal focus restoration.
- L2 decimal presentation consistency.
- Product decisions: expanded “Идентификация диска”; staggered Front/Rear result collapsing.

The supplied independent Phase A review report itself was not found under `docs/evidence` or `docs/handoffs`; independent re-review of the cumulative corrected HEAD is required before integration.

## Environment and release gate

- No production/main changes.
- No staging mutations, render jobs, credits, or Telegram QA.
- **Full authenticated staging E2E was not run.** There is no disposable staging Fitment context; do not treat local preview as staging evidence.
- `FITMENT_VNEXT_FULL_STAGING_E2E = BLOCKED` until a disposable staging Fitment context or supported no-render creation API exists.
- Do not merge before independent Phase A re-review.
