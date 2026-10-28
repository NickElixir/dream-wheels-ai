# Fitment VNext — job-scoped Vehicle proposal API

Dependency: Vehicle confirmation contract PR #235.

The existing identity `/resolve` creates a render input draft and requires
both source images. The frozen Fitment flow needs recognition from one local
Vehicle photo in an existing owned job, without render/history side effects.

Added `POST /identity/fitment/{job_id}/vehicle-proposal`. Existing principal
auth, ownership query, identity rate limit, MIME/byte limits, image normalization
and strict visual make/model/year schema are reused. Vehicle revision is checked
before and after resolution. No DB/storage/render/credit mutation is performed.

## Verification

- 10 focused API tests passed: auth before DB access, owner-scoped lookup,
  supported year-range proposal, unchanged canonical context, missing/unavailable
  context, stale revision before/during resolution, invalid/empty/MIME image and
  retryable provider failure. DB execute raises in the test fake to reject writes.
- Existing identity API and vehicle identity tests passed (18 tests).
- Ruff check/format passed.
- No live provider call, staging mutation or render initiated.
- Full staging E2E remains BLOCKED on disposable Fitment context.

## UI_CHANGE_MANIFEST

- User-visible/new/removed elements: none in this API PR.
- Interaction change: read-only recognition proposal supports the frozen local
  photo → recognition → catalogue/variant confirmation flow.
- Authority: spec §§6.1, 6.4 and 19.
- Unspecified design decisions: none.
