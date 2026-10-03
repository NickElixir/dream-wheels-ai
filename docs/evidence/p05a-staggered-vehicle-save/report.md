# P0.5-A — Staggered Vehicle-only Save

Base staging: `d356709a17e88ba32d3fa09777deeff42d52a998` (P0-C1b PR #254 merged). Branch: `fix/p05a-staggered-vehicle-save`. Separate PR targets staging; no merge or staging mutations performed.

## Cause and correction

`save_fitment_details` derived effective mode from the saved setup, then unconditionally required rear payload and entered the rear persistence branch for staggered mode. This conflated saved Wheel state with request mutation ownership.

`wheel_section_present` uses request model semantics: explicitly provided fields in legacy rim, front rim, rear rim, or a non-null setup_mode. This includes confirmation/source fields before update normalization removes them. Default empty Rim models do not count. Both the rear validation and rear persistence branch now require Wheel-section presence. Existing setup-mode changes and real Wheel validation are retained.

No frontend workaround, Wheel redesign, migration or UI/runtime provider change.

## Proven evidence

The existing real PostgreSQL canonical provenance scenario is parameterized over uniform/staggered. Staggered uses distinct front/rear specs with rear ET 42.75 and width 9.5. Full setup and both Rim rows (including revisions, IDs, values, provenance and timestamps) are equal after first Vehicle Save, confirmed no-op, changed Vehicle Save and rejected requests.

- First Save creates/attaches Vehicle at revision 1, outcome saved; no Wheel write.
- Same-value domain confirmation reaches revision 2, outcome confirmed.
- Confirmed no-op keeps complete Vehicle row and current Check unchanged, outcome confirmed.
- Changed year advances Vehicle to revision 3 with proposed year/outcome saved; current Check becomes stale; Wheel rows remain equal.
- Invalid catalogue, stale revision and wrong owner remain rejected without intent or Wheel writes.
- Real staggered Wheel request without rear retains 422 rear_rim. Separate endpoint tests cover rim values, front values, confirmation fields and setup_mode presence.
- Valid Wheel-only Save leaves full Vehicle row unchanged and adds no Vehicle intent.
- Forced audit-insert rejection still rolls back first identity creation/attachment; concurrent accepted no-ops and changed-save conflicts retain their existing semantics.

## Verification

- Full backend, including both optional local PostgreSQL targets: **678 PASS / 5 skipped**, 20 existing deprecation warnings.
- Dedicated real PostgreSQL provenance/isolation test: **2 PASS**.
- Frontend transition/boot regressions: **132 PASS**.
- Ruff check/format, diff and commit hooks: required and checked during delivery.

Adjacent logs/JSON are local evidence; no authenticated live staging E2E is claimed. CI on the pushed HEAD is separate delivery evidence. Source checks/diff show no frontend change.

## Remaining work / review gate

P0.5-A implementation ready for focused independent review. Merge staging remains a later reviewed action. P0.5-B, C0, C and D have not been implemented by this PR. P0.5 is not closed and P1 readiness is not claimed.
