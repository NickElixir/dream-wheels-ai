# Fitment VNext — Slice 8 integration readiness

Status: **PREPARED / EXECUTION BLOCKED**, not completed E2E.
Updated: 2026-10-01. Spec: `docs/ui/fitment-vnext-implementation-spec.md`.
Reference: `docs/references/fitment-vnext-integrated-prototype-v13.html`.
Verified staging base: `5a30a65059e21da79f3d58f8c9eb2c53ee812fc6`.

## Review and integration order

Each PR is based on the preceding feature branch to keep its diff reviewable.
Final integration target is staging. None is merged or deployed at this audit.
CI `lint-and-test` is SUCCESS for every PR #226–#241 at its current head.

| Order | PR | Scope | Evidence under `docs/evidence/` |
|---|---|---|---|
| 1 | [#226](https://github.com/NickElixir/dream-wheels-ai/pull/226) | Slice 0 regression guards | fitment-vnext-slice-0.md |
| 2 | [#227](https://github.com/NickElixir/dream-wheels-ai/pull/227) | Slice 1 composition | fitment-vnext-slice-1.md |
| 3 | [#228](https://github.com/NickElixir/dream-wheels-ai/pull/228) | Slice 2 parallel state/drafts | fitment-vnext-slice-2.md |
| 4 | [#229](https://github.com/NickElixir/dream-wheels-ai/pull/229) | Slice 3a catalogue | fitment-vnext-slice-3a.md |
| 5 | [#230](https://github.com/NickElixir/dream-wheels-ai/pull/230) | Slice 4a decimals/SKU | fitment-vnext-slice-4a.md |
| 6 | [#231](https://github.com/NickElixir/dream-wheels-ai/pull/231) | Explicit Wheel confirmation API | fitment-vnext-wheel-confirmation-contract.md |
| 7 | [#232](https://github.com/NickElixir/dream-wheels-ai/pull/232) | Slice 4b proposals/staggered drafts | fitment-vnext-slice-4b.md |
| 8 | [#233](https://github.com/NickElixir/dream-wheels-ai/pull/233) | Slice 4c compound picker | fitment-vnext-slice-4c.md |
| 9 | [#234](https://github.com/NickElixir/dream-wheels-ai/pull/234) | Slice 2b Vehicle-only Save | fitment-vnext-slice-2b.md |
| 10 | [#235](https://github.com/NickElixir/dream-wheels-ai/pull/235) | Explicit Vehicle variant API | fitment-vnext-vehicle-confirmation-contract.md |
| 11 | [#236](https://github.com/NickElixir/dream-wheels-ai/pull/236) | Job-scoped recognition proposal API | fitment-vnext-vehicle-proposal-api.md |
| 12 | [#237](https://github.com/NickElixir/dream-wheels-ai/pull/237) | Slice 3b photo/recognition/exact variant | fitment-vnext-slice-3b.md |
| 13 | [#238](https://github.com/NickElixir/dream-wheels-ai/pull/238) | Slice 5 Standard Check lifecycle | fitment-vnext-slice-5.md |
| 14 | [#239](https://github.com/NickElixir/dream-wheels-ai/pull/239) | Persisted comparison evidence API | fitment-vnext-comparison-contract.md |
| 15 | [#240](https://github.com/NickElixir/dream-wheels-ai/pull/240) | Slice 6 results/currentness | fitment-vnext-slice-6.md |
| 16 | [#241](https://github.com/NickElixir/dream-wheels-ai/pull/241) | Slice 7 responsive/accessibility/polish | fitment-vnext-slice-7.md |

After each reviewed dependency lands, retarget the next PR to staging and
reconcile its base before merging. Squash-merging a dependency does not preserve
its original commit ancestry: inspect the next diff for already-landed changes,
resolve them on an unpublished integration branch if needed, and rerun CI.
Do not merge the top cumulative branch as one replacement for slice reviews.

## Verification matrix

| Gate | Current evidence | Staging status |
|---|---|---|
| Wheel Save with incomplete Vehicle; Vehicle canonical/revision unchanged | Slice 0/2/2b API/runtime tests; Slice 7 real local guest save | BLOCKED |
| Decimal ET and numeric focus; PCD exact pair | Slice 0/4a/4c tests; local picker ET 35,125 round trip, no InvalidStateError | BLOCKED |
| Server next_action; independent branch edits; no automatic Check on Save | Slice 2/5 runtime tests and local guest preview | BLOCKED |
| Vehicle recognition/catalogue/conditional market/exact variant | Slice 3a/3b and API tests; synthetic browser QA | BLOCKED for live providers/auth |
| Resolver/SKU/field acceptance/conflicts/staggered | Slice 4 API/runtime tests and synthetic browser QA | BLOCKED for real URL/provider |
| Revision-safe drafts; dirty versus stale; queued/processing/failure/recheck | Slice 2/2b/5/6 API/runtime tests | BLOCKED |
| Results/evidence/unknown/stale/mobile table | Slice 6 tests and four-width browser QA | BLOCKED for real Check output |
| FITMENT_VERDICT != RENDER_PERMISSION | Slice 1/5/6 tests; Create Image available in local incomplete flow | BLOCKED for authenticated flow |
| Responsive/focus/accessibility | Slice 7 browser QA 1440/1024/768/390 | Native Telegram/WebView pending |
| Automated suites | Frontend 182; runtime/catalogue/composition/focus 69; pytest 612 passed/5 skipped; Ruff PASS | CI PASS on all implementation heads |

The latest aggregate test counts come from Slice 7's cumulative implementation
head `981382d`. Per-slice evidence records the narrower runs made at that slice.
Local guest and simulated browser fixtures are not authenticated staging E2E.

## Prerequisites for execution

1. Review/integrate the slice stack into staging and deploy matching frontend
   and backend. Record both deployed SHAs and feature-entry configuration.
2. Provide a supported disposable Fitment context for a dedicated test account,
   with independently owned VehicleIdentity/RimSetup and known revisions.
   Creation must not enqueue a render, reserve/spend credits, or reuse completed
   render history. No supported helper was found in repository scripts at this
   audit; this document does not create one or certify any context as disposable.
3. Record baseline canonical entities/revisions, credit balance and render-job
   count, without storing credentials or private photo bytes in evidence.
4. Use real test photo and wheel URL, plus defined provider-failure/no-data cases.
5. Make native Telegram staging Mini App available for WebView/lifecycle QA.

## Authenticated API contract smoke A–F

Use only the disposable context. Capture sanitized request fields, response
states/revisions, deployed versions and assertions for each step.

| Case | Action and expected assertion |
|---|---|
| A | GET baseline: unconfirmed Vehicle, empty/partial Wheel, complete_vehicle_details; save canonical snapshots/revisions. |
| B | Wheel-only PATCH with explicitly confirmed five parameters and decimal ET: Wheel ready, Vehicle canonical/revision byte-for-byte unchanged; pointer still complete_vehicle_details; no Check created. |
| C | Vehicle catalogue/exact variant confirmation: Wheel canonical/revisions unchanged; both ready -> server run_standard_check. |
| D | Start Standard Check using canonical IDs: queued/processing/completed or explicit failed; duplicate admission and late responses obey lifecycle/idempotency rules; pending mutations locked. |
| E | Local edit keeps current result; canonical Save makes previous Check stale; readable prior evidence and recheck; revision-mismatched draft discarded completely. |
| F | Create Image remains available for incomplete/incompatible/unknown/stale/failed states under existing render rules. Verify availability without starting a paid render; credits/render count unchanged through smoke. |

## Full browser E2E execution record (pending)

- Real photo -> recognition proposal -> catalogue/manual recovery -> explicit
  exact variant, including one-variant and multi-market cases.
- Real URL -> resolver -> explicit SKU if needed -> all five confirmations ->
  Wheel-only Save before Vehicle completion, then complete both branches.
- Standard Check -> actual verdict/evidence table -> canonical edit -> stale ->
  recheck. Exercise provider no-data/failure, check failure/retry and navigation
  with late responses. Verify unsaved opposite-branch draft preservation.
- Repeat uniform/staggered, decimal comma/dot ET, duplicate Check protection and
  restored draft mismatch; inspect actual API canonical snapshots/revisions.
- Desktop Chromium 1440×1000/1024; tablet 768; mobile 390×844; keyboard/dialog
  focus, table readability, no overflow/console error/InvalidStateError.
- Native Telegram: authenticated entry, photo picker recovery, navigation/reload
  and draft lifecycle. Local desktop preview cannot certify these behaviors.
- Record post-run canonical/revision state, balance and render count; no paid
  render is required to demonstrate Render action availability.

## Rollback and completion boundary

Keep the previous frontend recoverable. Restore its frontend release if staging
integration fails; do not weaken #224 admission/revision safety contracts or
revert additive backend contracts merely to roll back the UI.

No production/main change, live mutation, credit expenditure or render was
performed for this readiness audit. The spec definition of done is not met:
authenticated smoke/full E2E and native Telegram verification remain pending.

`FITMENT_VNEXT_AUTHENTICATED_STAGING_SMOKE = BLOCKED`

`FITMENT_VNEXT_FULL_STAGING_E2E = BLOCKED`
