# Fitment VNext — Slice 3b Recognition and explicit variant confirmation

Dependency: job-scoped proposal API PR #236 and opt-in confirmation API PR #235.

## Changes

- Vehicle photo replacement stays local, with a job-scoped IndexedDB draft and
  expiring session descriptor. It preserves canonical Vehicle and current check.
- Recognition uses the authenticated, revision-bound proposal endpoint. Only
  Make/Model/Year or year range enter the local catalogue draft after explicit
  selection. A year range requires the user to select the exact year; remembered
  catalogue values cannot silently supply it.
- Stale responses are discarded by job/request token and Vehicle revision.
  Failure offers retry and manual catalogue entry. Visual Try-On stays independent.
- VNext variant lookup opts into explicit confirmation. One candidate is
  preselected but still requires the revision-bound Apply action. Legacy callers
  retain the API default.

## Verification

- Runtime/catalogue/composition/focus Node tests: 64 passed.
- Frontend suite: 179 passed. Full backend pytest: 610 passed, 5 skipped.
- Browser presentation fixture at 1440/768/390: no page overflow or console
  errors; proposal selection leaves exact year blank; failure retains manual
  entry and Create Image; one exact variant exposes confirmation.
- Fixture exercises production presentation with simulated callbacks. Network,
  ownership and persistence boundaries are covered by runtime/API tests.
- Native Telegram picker/WebView reload and authenticated staging E2E are not
  validated by local browser QA. Staging E2E remains BLOCKED on disposable context.

## UI_CHANGE_MANIFEST

- User-visible changes: local photo selection, recognition progress/proposals,
  retry/manual fallback, explicit single-variant confirmation.
- New elements: hidden image file control, flat proposal rows and async status.
- Interaction changes: Use proposal opens catalogue; it does not persist Vehicle.
- Authority: implementation spec §§6, 15, 18; frozen parallel branch contract.
- Unspecified design decisions: proposal candidates use existing flat row language.
