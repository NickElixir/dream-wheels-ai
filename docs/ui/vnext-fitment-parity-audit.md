# VNext Fitment parity audit

Base reviewed: `origin/staging` at `7fd2e2df77a18d82566701853cbfd0077e6d58bf`
Implementation branch: `feature/vnext-fitment-usability`
Scope: Fitment presentation only. Backend, API, schema, verdict calculation, revision semantics, and render permission remain unchanged.

| Capability | Legacy support | VNext support | Server/runtime owner | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Vehicle base edit | Yes | Yes | `webapp/app.js`: `saveFitment`, `/fitment` revisioned save | PASS | Grouped basic and additional fields; catalogue chain remains runtime-owned. |
| Vehicle catalogue chain | Yes | Yes | `webapp/app.js`: catalogue loaders and `fitmentCatalogueFieldState` | PASS | Loading, no-data, failed, disabled-dependent and retry states are presented inline. |
| Required vehicle variant selection | Yes | Yes | `/fitment/vehicle-variants`, `applyFitmentVehicleVariant` | PASS | Required choices remain visible; base form is hidden until manual recovery is explicitly selected. |
| Variant reselection | Yes | Yes | Existing lookup/reselection runtime in `webapp/app.js` | PASS | Confirmed variant is summarized and can be explicitly changed. |
| Manual vehicle recovery | Yes | Yes | Existing vehicle editor/save bridge | PASS | Separate from required variant decision; no parallel editor. |
| Wheel manual fields | Yes | Yes | Revisioned `/fitment` save | PASS | Identity, geometry, PCD pair, and configuration are grouped. |
| Uniform/staggered setup | Yes | Yes | `setup_mode`, `rear_rim` in existing overview/form | PASS | Front/rear headings and independent field paths; rear receives no front suggestions. |
| Wheel URL resolver | Yes | Yes | `resolveFitmentRimSource` and `/fitment/rim-source/resolve` | PASS | Disclosure stays within the wheel editor; URL retained during loading/error. |
| Multiple resolver variants | Yes | Yes | Existing resolver response and variant selection action | PASS | Explicit choices use the existing action. |
| Parser conflicts | Yes | Yes | Existing resolver conflict response/actions | PASS | Inline to the matching wheel field; no backend payload dump. |
| Parser retry/manual fallback | Yes | Yes | Existing resolver retry and wheel editor actions | PASS | Failure retains values and wheel context; existing recovery controls remain available. |
| Vehicle/rim candidates | Yes | Yes | Existing overview candidate fields | PASS | Inline to owning field; the selected value is not offered again. |
| Save/progression | Yes | Yes | `saveFitment`; server response `next_action` | PASS | Editor progression remains based on returned overview and currentness refresh. |
| Stale snapshot | Yes | Yes | Fitment check `is_current` | PASS | Stale verdict is secondary and visibly marked out of date. |
| Run/retry technical check | Yes | Yes | Existing `/fitment/checks` and retry path | PASS | Queued/processing states use server execution status only. |
| Four verdicts and execution failure | Yes | Yes | Fitment check response | PASS | Verdict labels remain server-owned; execution failure is not rendered as `unknown`. |
| Result → Fitment → originating Result | Yes | Yes | `openFitmentView`, `closeFitmentView` | PASS | Exact originating view/job context remains in the existing runtime. |
| Historical Result → Fitment isolation | Yes | Yes | Exact job ID in `fitmentJobId` and runtime context | PASS | No new client-side history or job selection logic. |
| Render from Fitment | Yes | Yes | Existing `submitJob` / render-from-assets flow | PASS | Render action remains independent of Fitment verdict and does not use Fitment as permission. |

## Invariants

- `FITMENT_VERDICT != RENDER_PERMISSION` remains true; no render path reads the verdict as authorization.
- `FITMENT_EXECUTION_FAILURE != UNKNOWN_VERDICT` remains true; failed execution uses its own presentation and retry action.
- Exactly one full object editor is presented at a time. Required vehicle variant choice is a separate decision step, not an open editor.
- All field values, errors, resolver data, and revision ownership remain in the existing runtime/API flow.

## Rare-state coverage

Presentation and automated coverage include missing previews; catalogue loading/no-data/failure/retry; variant loading/no-match/failure/reselection; resolver idle/loading/success/variants/conflict/failure/retry/manual fallback; uniform and staggered wheel data; queued, processing, completed (all four verdicts), stale, and execution failure; auth-required and overview-load errors; field validation and revision/save failure paths.

Browser QA is recorded separately in the implementation report for the exact final HEAD. Authenticated staging smoke is intentionally post-merge and is not claimed by this pre-merge audit.
