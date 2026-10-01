# Fitment VNext — Slice 4b proposal and staggered evidence

Dependency: Wheel confirmation API PR #231, stacked on Slice 4a PR #230.

## Changes

- Resolver values remain local proposals. Save waits for explicit acceptance of
  all required front/rear geometry and resolution of source conflicts. PCD is
  accepted as one user-facing characteristic covering both API fields.
- Confirmed canonical values are compared numerically with resolver proposals;
  equal comma/dot decimals produce no conflict. Keep/use decisions modify the
  draft only. SKU selection precedes the parameter form.
- VNext Save sends axle-scoped `confirmed_fields` from PR #231 so new/changed
  accepted geometry becomes ready in one PATCH. Wheel-only requests exclude
  Vehicle and preserve the server's Standard progression pointer.
- Switching to staggered copies Front into an unconfirmed Rear draft once.
  Rear edits and acceptance are independent. Switching back and returning to
  staggered preserves Rear until final Save. Revision-mismatched restoration
  discards local acceptance along with the draft.
- Numeric readiness rejects incomplete/invalid geometry and ET outside
  -150…150 without rounding decimal values.

## Verification

- Runtime transition/composition/focus tests: 50 passed.
- Frontend auth/presentation tests: 177 passed.
- Frontend v2 and catalogue state-machine pytest: 37 passed.
- API/check/resolver tests in dependency PR #231: 97 passed; its CI passed.
- Production view, refresh callback and CSS loaded by
  `tests/browser-fixtures/fitment-vnext-slice4-proposals.html`: 1440, 768 and
  390 px have no horizontal overflow; proposal buttons measure 42 px;
  pending Save is disabled; front/rear comma decimals survive refresh;
  browser console contains no errors. Fixture callbacks simulate presentation
  only; API behavior is verified separately by runtime/backend tests.

## Remaining scope

The current acceptance buttons are an intermediate implementation. Frozen
compound controls and the desktop/mobile option picker (including ET search,
recommended/all modes, exact match and manual fallback) remain for Slice 4c.
Vehicle recognition, the final result composition and later slices remain.
Authenticated staging E2E is **BLOCKED** until a disposable Fitment context is
available; these local checks do not claim staging E2E completion.

## UI_CHANGE_MANIFEST

- User-visible changes: neutral proposal labels, per-characteristic acceptance,
  canonical/current conflict text, independent Rear draft and Save readiness.
- New elements: local confirmation buttons and Rear draft preservation note.
- Removed elements: parameter form before SKU selection.
- Interaction-pattern changes: local acceptance → one final Wheel Save;
  reversible staggered toggle before Save.
- Authority: implementation spec §§7.2–10, 19 and v13 interaction reference.
- Unspecified design decisions: intermediate confirmation buttons pending the
  separately reviewed frozen compound-control implementation.
