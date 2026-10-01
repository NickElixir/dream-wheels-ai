# Fitment VNext — Slice 8 integration readiness

Status: **RUNTIME INTEGRATED / DEPLOYED; PHASE B BLOCKED**, not completed E2E.
Updated: 2026-10-02 (Europe/Moscow). Spec: `docs/ui/fitment-vnext-implementation-spec.md`.
Reference: `docs/references/fitment-vnext-integrated-prototype-v13.html`.
Pre-merge staging base: `5a30a65059e21da79f3d58f8c9eb2c53ee812fc6`.
Final runtime staging merge: `7ac81e2171cff69bd0ea02372a6ae920ff27a444`.
Reviewed #245 HEAD: `5000465cfc14bb24939c1aa70099774806bf9bc1`.
Both trees: `031c04abdc9f9656627caa33e7c9f93b63f7251f` (identical).

`FUNCTIONAL PHASE A = PASS`

`UI GATE = PASS / CLOSED`

## Review and integration order

All 19 runtime PRs were merged into staging in the order below, using merge
commits. Every reviewed HEAD matched; every intermediate staging tree matched
the corresponding PR HEAD; every child retarget preserved its reviewed diff
and changed-file set. Parent branches were retained. #242 is a separate docs PR.
The full execution table and deployment controls are in
`docs/evidence/fitment-vnext-bottom-up-merge.md`.

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
| 17 | [#243](https://github.com/NickElixir/dream-wheels-ai/pull/243) | Phase A functional corrections | fitment-vnext-phase-a-corrective-functional.md |
| 18 | [#244](https://github.com/NickElixir/dream-wheels-ai/pull/244) | Phase A follow-up corrections | fitment-vnext-phase-a-corrective-functional-2.md |
| 19 | [#245](https://github.com/NickElixir/dream-wheels-ai/pull/245) | v13 UI fidelity, owner polish, final UI gate | fitment-vnext-ui-corrective-pass.md |

The #235 reviewed internal merge `856bdcb` was preserved. The next PR after
#241 was #243, not #242. The 14.6 MB screenshot evidence was kept per owner
decision; reviewed runtime/UI branches were not rewritten.

## Final staging deployment and CI

- Final exact-SHA CI: [run 36927901802](https://github.com/NickElixir/dream-wheels-ai/actions/runs/36927901802), SUCCESS, attempt 2. CI gate passed in attempt 1; attempt 2 explicitly reran only the blocked final staging deployment job.
- Frontend: `dpl_BhEALDwj5vpBrmSS8DGPnadUxENu`, READY; build `7ac81e2171cff69bd0ea02372a6ae920ff27a444`, built at `2026-10-01T21:22:03Z`.
- Backend: `dep-davcsov9nhgc73fu80j0`, LIVE; commit `7ac81e2171cff69bd0ea02372a6ae920ff27a444`, finished at `2026-10-01T21:21:56.733699Z`.
- Public staging alias `version.json` matches the final runtime SHA. Gateway `/api/backend/health` and direct backend `/health` return `{"status":"ok"}`.
- Exactly one final frontend deployment was created; its preceding deployment remains `dpl_3ahtDeRsdRvpwUexwFjwTb1oV7V9` at `adef5ce8c98e8d0078556906ed70796dbd9beb0e`.
- Browser entry at `/app/fitment` shows the sign-in gate in the available guest browser. This is entry verification, not authenticated Fitment E2E.
- Staging feature configuration: `FITMENT_VERDICT_ENABLED=true`, `RIM_URL_RESOLVER_ENABLED=true`, `VEHICLE_IDENTITY_ENABLED=true`, recognition provider `openai`, `WORKER_ENABLED=true`. No context creation or render was attempted.

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
| Automated suites | Frontend 194 PASS; transition/catalogue/composition/focus/boot 110 PASS; pytest 612 passed/5 skipped; build/Ruff PASS | PASS on final staging runtime merge |

The current counts come from final integrated staging CI on `7ac81e2`.
Backend CI emitted 15 warnings; all tests and required steps passed.
Per-slice evidence records the narrower runs made at that slice.
Local guest and simulated browser fixtures are not authenticated staging E2E.

## Prerequisites for execution

1. Runtime integration and matching frontend/backend deployments are complete,
   as recorded above. The docs-only #242 merge does not require a new runtime deployment.
   Frontend workflow ignores docs paths; the docs merge uses Render's `[skip render]` control to avoid an unnecessary backend deployment while retaining CI.
2. Provide a supported disposable Fitment context for a dedicated test account,
   with independently owned VehicleIdentity/RimSetup and known revisions.
   Creation must not enqueue a render, reserve/spend credits, or reuse completed
   render history. No supported helper was found in repository scripts at this
   audit; this document does not create one or certify any context as disposable.
3. Record baseline canonical entities/revisions, credit balance and render-job
   count, without storing credentials or private photo bytes in evidence.
4. Use real test photo and wheel URL, plus defined provider-failure/no-data cases.
5. Make native Telegram staging Mini App available for WebView/lifecycle QA.

| Prerequisite | Status | Evidence / missing input |
|---|---|---|
| Final frontend version | READY | Public version and Vercel deployment match `7ac81e2` |
| Final backend version | READY | Render LIVE deployment matches `7ac81e2`; health ok |
| Dedicated QA authentication | MISSING / unverified | Available browser is a guest; no dedicated QA account/session qualified in this task |
| Telegram staging app | MISSING / unverified | Native staging launch/configuration not qualified; Telegram QA PENDING |
| Disposable Fitment context | MISSING | No supported no-render helper or qualified QA-owned job supplied |
| Real vehicle photo | MISSING | Phase B photo case not supplied/qualified |
| Real wheel URL | MISSING | Phase B live resolver case not supplied/qualified |
| Multi-market case | MISSING | Real provider IDs/labels case not qualified |
| Multi-SKU case | MISSING | Real product URL/SKU case not qualified |

`PHASE B BLOCKED BY DISPOSABLE FITMENT CONTEXT`

Recommend a separate staging infrastructure task providing a supported,
resettable QA-owned context with known revisions, isolated VehicleIdentity and
RimSetup, no render enqueue and no credit reservation/spend. Do not mutate
completed render history or insert a substitute directly into the database.

Verify real Wheel Size API market IDs/labels do not produce duplicate semantic
choices. Record IDs and labels; do not deduplicate by display label automatically.

`TELEGRAM STAGING QA = PENDING`

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

Immutable rollback ref: `refs/tags/pre-fitment-vnext-merge-2026-10-01`, target
`5a30a65059e21da79f3d58f8c9eb2c53ee812fc6`, created before the first runtime
merge at `2026-10-01T21:15:17Z` (the lightweight ref has no separate creation timestamp).
Known-good pre-integration frontend: `dpl_3ahtDeRsdRvpwUexwFjwTb1oV7V9`
at `adef5ce8c98e8d0078556906ed70796dbd9beb0e`; pre-integration backend:
`dep-dauo1t0ae00c73f34su0` at the rollback SHA.
Current integrated deployments are recorded above. Restore the known-good frontend if staging
integration fails; do not weaken #224 admission/revision safety contracts or
revert additive backend contracts merely to roll back the UI.

Staging merges and deployment controls were executed. No production/main
change, Fitment data mutation, credit expenditure or render was performed.
The spec definition of done is not met:
authenticated smoke/full E2E and native Telegram verification remain pending.

`FITMENT_VNEXT_AUTHENTICATED_STAGING_SMOKE = BLOCKED`

`FITMENT_VNEXT_FULL_STAGING_E2E = BLOCKED`

`AUTHENTICATED STAGING SMOKE = BLOCKED`

`FULL STAGING E2E = BLOCKED`

`RELEASE READINESS = BLOCKED BY STAGING E2E`
