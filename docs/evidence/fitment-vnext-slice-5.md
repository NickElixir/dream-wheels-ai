# Fitment VNext — Slice 5 Standard Check lifecycle

Dependency: Slice 3b PR #237. Final integration target: staging.

## Changes

- Explicit check uses canonical identity/setup/job IDs only. Local geometry
  drafts are excluded; no Save request starts a check.
- Server next_action remains admission authority. Duplicate starts and starts
  during canonical mutations are blocked.
- Request responses are bound to context and navigation token. Obsolete POST
  and polling responses cannot replace another job's state.
- Queued/processing and pending POST lock Vehicle/Wheel controls and Save,
  including runtime bridge guards. Create Image remains outside the lock.
- A polling transport failure does not unlock a still-pending snapshot. Refresh
  status recovers polling. Execution failure retains canonical data and offers
  retry (only with server admission) or parameter editing.

## Verification

- Runtime transitions: 53 passed. Frontend suite: 180 passed.
- Standard Check API and frontend regression pytest: 38 passed.
- Browser fixture at 1440/1024/768/390: no overflow/errors; native disabled
  fieldset prevents source/editor actions while Create Image remains enabled.
  Failed state exposes retry and editing.
- Browser callbacks are presentation simulations. API admission, canonical-only
  payload and late-response isolation are exercised by automated tests.
- Authenticated staging E2E remains BLOCKED on disposable context. No live
  historical Fitment context, render or credits were mutated.

## UI_CHANGE_MANIFEST

- User-visible changes: calm shared pending copy, disabled mutation region,
  execution failure recovery and refresh-status action after polling failure.
- New elements: semantic disabled fieldset; parameter-edit recovery button.
- Authority: implementation spec §§3, 11–13; frozen Standard Check admission.
- Unspecified design decisions: refresh-status recovery uses existing secondary
  button language and authenticated overview reload.
