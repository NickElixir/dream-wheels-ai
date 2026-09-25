# Dream Wheels VNext Implementation Preflight

**Date:** 2026-09-25  
**Scope:** decision-only preflight. No VNext/runtime behavior was implemented or changed.

## 1. Status and authorities

The runtime migration boundary in `docs/ui/vnext-runtime-implementation-map.md` remains valid: preserve backend/domain contracts and replace/adapt presentation incrementally. In particular:

```text
FITMENT_VERDICT != RENDER_PERMISSION
FITMENT_EXECUTION_FAILURE != UNKNOWN_VERDICT
FITMENT_FAILURE != RENDER_PERMISSION
```

This preflight does not revise those invariants.

Frozen-authority verification is now complete. The source branch `docs/vnext-final-reconciliation` resolves to `b7a12c6b7fe8550bd48d242282b655a78e32e39f`; the formal freeze commit `7f35d55416bb2688c50b84c4b62e116dc0cc14ec` and the QA-evidence commit `b7a12c6b7fe8550bd48d242282b655a78e32e39f` are verifiable. The exact frozen Design Code, canonical HTML, closing QA report, required reference assets and QA screenshots were copied by Git blob identity onto the staging-based docs sync branch in `c3a992401bfd5b6fb7cdcbeae5a5ea6cb5a75c46`. No runtime files were changed.

## 2. Current staging baseline

| Item | Value |
|---|---|
| Runtime-map audit baseline | `29415ac318cda1f45a5981d082a220575e9ff66b` |
| Current `origin/staging` HEAD | `8355f04363701e2d8ea9a1092a24db78aebe4499` |
| Current branch | `docs/vnext-frozen-authority-sync` from `origin/staging` |
| Added commits since mapping | VNext documentation series (including `fc1c1ff`), Fitment corrections, auth/session refinements, and dashboard/auth re-gating (`8355f04`) |

Current `staging` is the required implementation base. It must not be reset to the old audit SHA.

## 3. Drift since runtime audit

| Change since `29415ac` | Affects preflight? | Required map update? |
|---|---|---|
| `fc1c1ff` merged earlier Design Code/state-coverage documentation; authority sync `c3a9924` replaces those files with the exact formal-freeze versions and adds closing QA/evidence | Yes: closes the frozen-authority gap | No runtime-map rewrite; authority status updated below |
| `webapp/app.js`, `index.html`, `style.css` auth-gate/routing changes | Yes: confirms a live ES-module app can coexist with the auth bundle | No; preserve the gate and routing boundary |
| `webapp/auth/*` session/auth tests and refocus re-gate | Yes: auth loading/session UI belongs to VNext adaptation | No; no framework or gateway change |
| `fitment_checks_api.py`, Fitment rules | No material impact on the three questions | No |
| No changes to `src/identity*`, `src/rim*`, `src/jobs_api.py`, or payment modules in this range | Yes: Create conclusion is unchanged | No |

**Result: no material drift requiring a rewrite of the runtime map.** The webapp/auth changes reinforce, rather than invalidate, the proposed incremental module boundary.

## 4. Frontend strategy decision

```text
FRONTEND_STRATEGY = VANILLA_ES_MODULES
BUILD_SYSTEM = UNCHANGED
FRAMEWORK_MIGRATION = NOT_REQUIRED
```

Evidence:

- `webapp/index.html:1118` already loads `/app.js` with `type="module"`.
- `webapp/auth/harness.html` already loads an ES-module harness; `webapp/auth/app-auth.js` is bundled as an IIFE only because it exposes the existing global auth boundary.
- `webapp/vercel.json` is a static/gateway deployment; ordinary module files can be served alongside `app.js` without a new deployment model.
- The existing `webapp/package.json` build tool (`esbuild`) serves auth bundle maintenance only. No bundler, transpiler, dependency, TypeScript, React, or Vue addition is required for PR1.
- Telegram uses the browser WebView and the already loaded `telegram-web-app.js`; native ES modules and DOM APIs are compatible with the current static Mini App model. Preserve feature detection and Telegram safe-area/button handling.

| Capability | Current runtime | VNext need | Decision |
|---|---|---|---|
| ES modules | `app.js` is already a module | required | use directly |
| Feature controllers | coupled inside `app.js` | yes | add incrementally |
| Shared primitives | repeated DOM/CSS patterns, no component layer | yes | add vanilla render functions/components |
| Bundler | only auth build uses esbuild | not required for PR1 | unchanged |
| TypeScript | absent | not required | do not introduce for foundation |
| React/Vue | absent | not required for current migration | do not introduce |
| Telegram compatibility | browser WebView + `Telegram.WebApp` | required | preserve existing integration boundary |
| Gateway/auth | `authenticatedFetch`, auth bundle, Vercel gateway | preserve | views never construct auth behavior |

The choice does not prevent a later framework review. After VNext has runtime/E2E parity and release evidence, reassess only if component dependencies, state synchronization, lifecycle complexity, test friction, or UI regressions demonstrate need. PR1 must not create a speculative framework abstraction layer.

## 5. Proposed vanilla module boundaries

The smallest safe shape, added beside legacy `app.js`, is:

```text
webapp/
  app.js                         # legacy bootstrap and untouched flows during PR1
  vnext/
    api/client.js                # uses existing apiUrl/authenticatedFetch only
    controllers/                 # async effects, polling/lifecycle ownership
    models/                      # API-response -> view-model adapters
    ui/                          # reusable DOM primitives
    views/                       # pure-ish screen composition and event callbacks
    shell/                       # desktop/mobile navigation and page frame
    styles/                      # VNext tokens and component styles
```

```text
existing API/auth boundary
        ↓
feature controller (effects, cancellation, polling)
        ↓
view-model adapter
        ↓
view/primitives
        ↓
DOM
```

Presentation modules must not choose endpoints or headers, calculate Fitment verdicts, reserve credits, alter payment behavior, or manufacture domain truth. Controllers retain idempotency/polling/cancellation mechanics. Legacy screens can continue calling legacy code until each feature is migrated.

## 6. Frozen artifact integration

| Required artifact | Availability on sync branch | Verified source | Status |
|---|---|---|---|
| Design Code VNext | `docs/ui/dream-wheels-application-design-code-vnext-v0.1.md` | `docs/vnext-final-reconciliation@b7a12c6`; freeze edit in `7f35d554` | **available / exact frozen blob** |
| Canonical HTML | `docs/references/application-vnext-state-coverage-prototype-v3.html` | `docs/vnext-final-reconciliation@b7a12c6` | **available / exact reconciled blob** |
| Closing QA report | `docs/ui/vnext-full-screen-qa-audit.md` | `docs/vnext-final-reconciliation@b7a12c6` | **available / exact QA-evidence blob** |
| Required reference assets | fonts, transparent wheel, Photo Guide assets | same source branch/head | **available** |
| Closing QA screenshots | `docs/references/vnext-qa/desktop/*`, `mobile-390/*` | same source branch/head | **available** |
| Formal freeze provenance | `7f35d554...` -> `b7a12c6b...` | GitHub commit objects + source branch | **verified** |

Integration method: a docs-only branch was created from current `origin/staging` `8355f04363701e2d8ea9a1092a24db78aebe4499`. Commit `c3a992401bfd5b6fb7cdcbeae5a5ea6cb5a75c46` overlays the exact Git blobs from `docs/vnext-final-reconciliation@b7a12c6b7fe8550bd48d242282b655a78e32e39f`; no frozen file was reconstructed or edited during the sync. Existing runtime demo assets under `webapp/assets/` remain unchanged and satisfy the canonical HTML's relative references.

```text
FROZEN_ARTIFACTS_AVAILABLE = YES
METHOD = exact docs/reference blob sync from docs/vnext-final-reconciliation@b7a12c6 onto current staging base
SOURCE_FREEZE = 7f35d55416bb2688c50b84c4b62e116dc0cc14ec
SOURCE_QA_EVIDENCE = b7a12c6b7fe8550bd48d242282b655a78e32e39f
```

The previous authority blocker is closed. These files are implementation authority and must remain unchanged unless a new explicit design-contract change is approved.

## 7. Create URL/parser current runtime trace

```text
Create `state.files.car` + `state.files.wheel` + `state.rimProductUrl`
  -> `resolveIdentity()` (`webapp/app.js:10255`)
  -> multipart POST `/identity/resolve`
       car_image REQUIRED
       wheel_image REQUIRED
       rim_product_url OPTIONAL
  -> `identity_api.resolve_identity()` (`src/identity_api.py:75`)
  -> new `render_input_drafts` row + upload both raw assets
  -> normalize car + vehicle VLM resolver only
  -> `RimIdentityProposal(product_url=...)`, default `manual_required`
  -> response `{draft_id, car_asset_id, rim_asset_id, vehicle, rim, resolver}`
  -> client replaces `state.identityDraftId` and `state.identityProposal`
  -> `/jobs/from-assets` consumes selected vehicle/rim into an immutable render snapshot.
```

The separate resolver that actually fetches/extracts a public wheel product page is Fitment-only: `POST /jobs/{job_id}/fitment/rim-source/resolve` in `src/jobs_api.py:3215`, calling `src/rim_url_resolver.py:495`. It requires an existing owned render job with Fitment available and returns a user-confirmable, unpersisted Fitment draft. It is not evidence of a Create capability and must not be reused implicitly.

## 8. `/identity/resolve` capability matrix

| Capability | Supported? | Evidence | VNext consequence |
|---|---|---|---|
| Existing vehicle reuse | **NO** | request has no existing vehicle/draft reference; each call inserts a new draft and resolves `car_image` | cannot change only wheel URL while preserving chosen vehicle |
| Wheel URL input | **YES, pass-through only** | `identity_api.py:78,108`; `app.js:10285` | can retain entered URL, not resolve it |
| Wheel-only refresh | **NO** | both multipart images are required; vehicle resolver always runs | needs explicit extension |
| Wheel image extraction | **NO** | endpoint uploads supplied `wheel_image`; it never imports an image from URL | VNext URL success cannot show a resolved wheel image |
| Wheel technical specs | **NO** | response `RimIdentityProposal` is created only with `product_url`, defaults `manual_required` | no URL-derived PCD/DIA/diameter/width/ET/brand/model/SKU |
| Parser loading mapping | **PARTIAL** | client has truthful request-level `identityResolving` | may show generic resolving only; cannot show parser stages |
| URL retry | **PARTIAL** | user may submit again, but it requires both files and discards current proposal/draft | not frozen-flow recovery |
| Manual recovery | **PARTIAL** | provider failure returns `manual_fallback`; UI supports manual vehicle/rim confirmation | does not preserve a resolved vehicle during URL retry |
| Preserve selected vehicle | **NO** | `resolveIdentity()` clears `identityProposal`/`identityDraftId` before request | extension must keep/refer to selected confirmed vehicle |
| Preserve snapshots/history | **YES for existing rendered jobs** | `/jobs/from-assets` persists its render input snapshot; later requests create new drafts | extension must create/revise current editable draft only, never mutate consumed snapshots |

## 9. Create URL/parser decision

```text
CREATE_URL_IMPLEMENTATION = EXTEND_IDENTITY_RESOLVE
```

`/identity/resolve` is not sufficient: it cannot resolve a URL into product data/image/specs and cannot refresh the wheel independently of the vehicle. A separate generic endpoint is not justified yet because the existing identity draft boundary is the right owner for Create’s editable vehicle+rim input.

The minimal, separately approved backend PR before **PR3 Create** should add a draft-bound rim-only resolve mode/capability that:

1. accepts an existing owned draft (or confirmed vehicle reference) and `product_url` without re-uploading/re-running vehicle recognition;
2. calls the existing URL resolver behind the appropriate public-URL safety/rate-limit policy;
3. returns confirmed/unconfirmed extracted rim fields, conflicts/provenance, and a resolvable wheel image asset/URL only when actually available;
4. writes a new editable rim revision/provenance for that draft, never changes a consumed render snapshot or Fitment-check history;
5. returns ordinary request lifecycle errors so VNext can show honest `idle/loading/success/error`, retry another URL, or retain vehicle and switch to manual upload.

This is a scoped backend decision for PR3; it does **not** block PR1’s shell/primitives/adapters and must not be implemented in this preflight.

## 10. Required tests

Existing evidence:

- `tests/test_identity_api.py::test_identity_resolve_requires_both_images` establishes the current endpoint’s two-image requirement.
- `tests/test_identity_api.py::test_identity_resolve_returns_quick_proposal_without_job_or_queue` proves URL pass-through and `manual_required`, without credit reservation/queueing.
- `tests/test_rim_url_resolver.py` exercises the standalone extraction resolver.
- `tests/test_jobs_fitment_api.py` exercises the Fitment-only rim-source route, including resolver outcomes.

Required before/with the Create backend PR:

1. wheel-only URL resolution retains selected/confirmed vehicle without a vehicle-provider call;
2. success maps extracted image/spec/provenance and source conflicts to the draft;
3. retry URL after error retains vehicle and previous editable wheel state;
4. manual upload recovery retains vehicle and does not create a contradictory draft;
5. previous `/jobs/from-assets` snapshots and prior Fitment checks remain immutable;
6. authorization, ownership, SSRF/public-URL policy, rate limiting, idempotency, and asset access are covered.

Targeted Python tests could not be collected in this checkout because the environment lacks `fastapi`. Existing Node tests started, with 18 passing static/auth tests, but two suites could not load because `@supabase/supabase-js` is not installed. These are environment/dependency limitations, not observed runtime regressions.

## 11. Remaining blockers

**None for PR1 foundation.**

There is no frontend, browser, Telegram, gateway, build-system, or frozen-authority blocker for the VNext foundation. The Create URL capability remains a known dependency before PR3 Create and requires the separately approved `EXTEND_IDENTITY_RESOLVE` backend work described above; it does not block PR1.

## 12. PR1 readiness

```text
Current staging HEAD: 8355f04363701e2d8ea9a1092a24db78aebe4499
Authority/preflight branch: docs/vnext-frozen-authority-sync
Authority sync commit: c3a992401bfd5b6fb7cdcbeae5a5ea6cb5a75c46
Document: docs/ui/vnext-implementation-preflight.md

FRONTEND_STRATEGY: VANILLA_ES_MODULES
BUILD_SYSTEM: UNCHANGED
FRAMEWORK_MIGRATION: NOT_REQUIRED
FROZEN_ARTIFACTS: AVAILABLE
Method: exact docs/reference blob sync from docs/vnext-final-reconciliation@b7a12c6
CREATE_URL_IMPLEMENTATION: EXTEND_IDENTITY_RESOLVE
Runtime changes made: NONE
Remaining blockers: NONE

READY FOR PR1 — VNEXT FOUNDATION
```
