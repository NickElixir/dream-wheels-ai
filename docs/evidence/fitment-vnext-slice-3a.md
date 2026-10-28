# Fitment VNext — Slice 3a Vehicle catalogue evidence

Base: stacked on Slice 2 PR #228, Slice 1 PR #227, and Slice 0 PR #226.

## Changes

- The VNext Vehicle editor follows provider-backed Make → Model → Year → conditional Market. Market appears only for the backend `selection_required` resolution; a single market remains resolved in the runtime without an extra choice.
- `no_data` and provider failure have separate messages. Failure offers retry. Existing catalogue context-version, abort, and revalidation logic remains the source of option data and stale-response protection.
- Body, Generation, and Modification are no longer editable before exact provider variant selection. The saved summary and exact variant technical series remain visible through the existing runtime.
- This PR does not change the backend's existing deterministic single-candidate auto-confirmation or the provider variant revision boundary.

## Verification

- `node --test webapp/auth/vnext-fitment.test.js`: 22 passed.
- `node --test tests/test_fitment_transition_behavior.mjs tests/test_fitment_vnext_composition.mjs tests/test_fitment_vnext_focus.mjs`: 47 passed.
- `npm test` in `webapp/`: 176 passed after installing lockfile dependencies.
- Relevant catalogue, variant and frontend pytest suites: 44 passed.
- Browser fixture `tests/browser-fixtures/fitment-vnext-slice3-catalogue.html` loads the production VNext view and CSS. At 1440, 768, and 390 px, no horizontal overflow. Single-market hides the chooser; multiple-market shows it; provider failure offers retry; `no_data` does not masquerade as failure. No browser console errors.

## Open Slice 3 contract work

- A job-scoped Vehicle recognition/re-recognition API is missing. Existing `/identity/resolve` creates a new `render_input_draft` and requires car and wheel uploads; it cannot safely replace or re-recognize the Vehicle source of an existing Fitment job. The disabled source CTA remains disabled pending a separate narrow backend-contract PR and frontend connection.
- Spec §6.3 requests explicit final confirmation for a single exact variant; `docs/ui/fitment-flow-contract-v2.md` freeze and the current `POST /fitment/vehicle-variants` API support deterministic single-candidate auto-confirmation. This PR preserves the frozen API behavior pending a contract decision. Multiple candidates still require explicit selection and confirmation.
- Authenticated staging E2E remains pending a disposable Fitment context. This fixture is synthetic browser QA, not staging E2E.

## UI_CHANGE_MANIFEST

- User-visible changes: provider-backed manual Vehicle catalogue follows the frozen sequence and conditional Market; error and no-data states are distinct.
- New elements: retry action for failed Market lookup.
- Removed elements: free-form Body, Generation and Modification before exact variant selection; single-market chooser.
- Interaction-pattern changes: none to canonical save or exact variant application.
- Authority: implementation spec §§6.2, 19, 21; flow contract v2 technical/UX freeze.
- Unspecified design decisions: none.
