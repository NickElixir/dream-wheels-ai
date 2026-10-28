# Fitment VNext — explicit single-variant confirmation API

Dependency: Slice 2b PR #234.

Spec §6.3 requires explicit confirmation even for one exact candidate. The
existing frozen API automatically confirms a single candidate. This additive
opt-in resolves that difference without changing existing default behavior.

`POST /jobs/{job_id}/fitment/vehicle-variants?require_confirmation=true`
returns the same no_match/single/multiple outcome and candidate list. A
nonempty result has `requires_confirmation=true`; its mapping stays suggested,
with no selected modification and `next_action=select_vehicle_variant`.
The existing revision-bound `/apply` is the sole final confirmation action.
Calls without the query retain deterministic single auto-confirmation.

Verification: 86 Jobs Fitment and Standard Check API tests passed, including
opt-in single → suggested → explicit apply and existing auto-confirm idempotence.
Ruff check/format passed. No UI changes or staging mutation in this API PR.
Authenticated staging E2E remains BLOCKED on disposable context.

## UI_CHANGE_MANIFEST

- User-visible/new/removed elements: none.
- Interaction change: optional API support for frozen VNext explicit confirmation.
- Authority: spec §§6.3 and 19; existing auto-confirm default preserved.
- Unspecified design decisions: none.
