# Fitment VNext — Slice 2 branch and draft evidence

Base: stacked on Slice 1 PR #227 and Slice 0 PR #226.

## Red reproduction

- Wheel save with an unsaved Vehicle edit reset the Vehicle form to server canonical data.
- Demo Wheel save while Vehicle was unconfirmed did not advance the Wheel revision and could not represent the independent branch transition.

## Changes

- Wheel save sends no Vehicle payload, preserves an unsaved Vehicle draft, and writes its current server revision baseline after the Wheel response. A restored matching draft retains the Vehicle edit; a mismatched baseline still follows the full-discard rule from PR #224.
- Demo branch state keeps `complete_vehicle_details` or `select_vehicle_variant` after Wheel save until Vehicle is ready. It never invents `run_standard_check` for an incomplete Vehicle.
- The VNext view shows the Wheel editor without the required Vehicle variant chooser when Wheel is explicitly active. Both source Edit controls remain available. `next_action` still supplies Standard Check progression and its copy.
- Check admission, verdict rules, and Visual Try-On permission are unchanged.

## Verification

- Red tests failed on the prior Slice 1 head for draft loss and demo progression.
- `node --test tests/test_fitment_transition_behavior.mjs tests/test_fitment_vnext_composition.mjs tests/test_fitment_vnext_focus.mjs`: 47 passed.
- `npm test` in `webapp/`: 175 passed.
- Relevant Fitment frontend/backend pytest suites: 140 passed.
- `ruff check .` and `ruff format --check .`: passed.
- The test covers Wheel-only PATCH without Vehicle, unchanged Vehicle revision, persisted draft restore against the new Wheel revision, and active Wheel editor with `select_vehicle_variant`.
- Existing tests cover full draft discard on any authoritative revision mismatch.
- Authenticated staging E2E remains pending on a disposable Fitment context.

## UI_CHANGE_MANIFEST

- User-visible changes: active Wheel editor remains available while Vehicle variant selection is required.
- New elements: NONE.
- Removed elements: simultaneous Vehicle variant chooser from the active Wheel workspace.
- Interaction-pattern changes: active editor follows explicit branch selection, while Standard Fitment readiness follows server `next_action`. Authority: frozen state machine and spec §§3, 10, 11, 21.
- Unspecified design decisions: NONE.
