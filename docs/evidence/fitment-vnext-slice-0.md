# Fitment VNext — Slice 0 regression evidence

Base: `staging` at `5a30a650` (PR #225).

## Red reproduction

- `WHEEL_ONLY_SAVE works while Vehicle is unconfirmed and keeps its revision`: failed because no PATCH was sent. The old save path validated Make/Model/Year/Market even when the active branch was Wheel.
- `refreshing a numeric Wheel field never reads unsupported selection properties`: failed with `InvalidStateError` from `selectionStart` on a number input.

## Changes and green verification

- Wheel save validates and submits its own branch. The PATCH excludes `vehicle` even when the server returns `next_action=complete_vehicle_details`.
- Selection restoration runs only on text controls that support the Selection API.
- Existing server `next_action` still controls Standard Check admission; save does not run a check. Render permission is unchanged.
- `node --test tests/test_fitment_transition_behavior.mjs tests/test_fitment_vnext_focus.mjs`: 43 passed.
- `pytest -q tests/test_jobs_fitment_api.py tests/test_fitment_checks_api.py`: 77 passed.
- `pytest -q tests/test_fitment_frontend_v2.py tests/test_fitment_frontend_g2.py tests/test_fitment_frontend_slice6.py tests/test_fitment_frontend_slice7.py`: 63 passed.
- `ruff check .` and `ruff format --check .`: passed.

## UI_CHANGE_MANIFEST

- User-visible changes: Wheel save works with incomplete Vehicle; numeric editing no longer throws.
- New elements: NONE.
- Removed elements: NONE.
- Interaction-pattern changes: Wheel save no longer follows Vehicle validation. Authority: frozen state machine and implementation spec §§3, 7.5, 7.6, 21.
- Unspecified design decisions: NONE.

Slice 0 does not establish full E2E. A disposable staging Fitment context remains required by §22.
