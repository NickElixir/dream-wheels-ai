# Fitment VNext — explicit Wheel confirmation contract evidence

Dependency: Slice 4a PR #230. This PR is a narrow backend extension required by
spec §§7.4, 10.1, and 19; it does not add a frontend save or resolver action.

## Gap and behavior

The existing PATCH confirms unchanged saved values. Newly entered or changed
values remain unconfirmed until another PATCH. VNext requires explicit local
acceptance of each characteristic followed by one final Save.

Optional axle-scoped `confirmed_fields` binds each acceptance to a non-null
value submitted in that request. New and changed accepted values become
confirmed during the same revision-bound write. Calls without this list retain
the existing semantics. Resolver-only calls remain proposals.

The existing ownership and expected Vehicle/Rim revision checks remain in place.
Wheel-only saves preserve Vehicle canonical fields/revision and authoritative
`next_action`; front and rear confirmation are independent.

## Verification

- Jobs Fitment API, Standard Check API, and resolver tests: 97 passed.
- New API tests cover a new value, changed value, same/new resolver fingerprint,
  one-PATCH readiness, decimal ET 35.125, unchanged Vehicle, independent Rear,
  and rejection of unsupported/omitted/null confirmation fields.
- Repeating accepted, unchanged values from the same source performs no Wheel
  or Vehicle write and keeps revisions stable; source changes still invalidate
  earlier provenance unless the values are explicitly confirmed again.
- Existing tests retain the original two-PATCH path for clients without the
  extension and the server's check admission/currentness rules.
- Ruff check and format verification passed.
- Authenticated staging E2E remains pending a disposable Fitment context.

## UI_CHANGE_MANIFEST

- User-visible changes: none in this backend-only PR.
- New elements: none.
- Removed elements: none.
- Interaction-pattern changes: optional API support for the already specified
  local acceptance → final Save boundary.
- Unspecified design decisions: none.
