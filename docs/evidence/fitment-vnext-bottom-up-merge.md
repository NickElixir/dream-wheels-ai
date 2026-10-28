# Fitment VNext — bottom-up merge execution

Executed: 2026-10-02 Europe/Moscow (2026-10-01 UTC).
Scope: reviewed runtime chain #226–#241, #243, #244, #245 into staging.

## PRE-FLIGHT

- Starting staging: `5a30a65059e21da79f3d58f8c9eb2c53ee812fc6`.
- All 19 reviewed HEADs matched live GitHub before writes. Reviewed diffs/file sets were captured before integration; SHA-256 hashes are in the companion JSON.
- Immutable rollback ref: `refs/tags/pre-fitment-vnext-merge-2026-10-01` at the starting SHA. Created before first runtime merge (`2026-10-01T21:15:17Z`); lightweight ref creation was not separately timestamped.
- Automatic staging frontend deployment was blocked using only environment `staging` (ID `20805708543`): selected deployment branches, sole temporary branch rule `fitment-merge-deploy-paused-2026-10-02` (policy ID `61683643`). No such deployment branch was created.
- CI and the shared Deploy Frontends workflow stayed enabled; production environment and main were unchanged. The CI job has no staging environment restriction. Vercel native Git deployments are disabled in `webapp/vercel.json`.
- Rule semantics: [GitHub environment deployment branches](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#deployment-branches-and-tags).

## MERGE EXECUTION

Every PR used a merge commit, exact reviewed head admission and green checks.
After every merge, fetched staging tree matched the reviewed head. Every child
retarget preserved its full reviewed diff byte-for-byte and its changed-file set.
Branches were retained. #235's internal merge was preserved; #241's child was #243.

| PR | Reviewed HEAD | Base before | Merge commit | staging tree == head | Next PR retargeted | Child diff clean | CI | Status |
|---|---|---|---|---|---|---|---|---|
| 226 | 603bc3c7103f348b1b3e7d991b75d49d4e3ecf9e | staging | 182606b80c5a87fe957d8a71c2ca0314402ba0ac | YES | 227 | YES | GREEN | PASS |
| 227 | 19e3edfecf8229b1ca1bd4a051bb728cd219897a | staging | c0f6c0d0a43214c13c4df2fb3cdebbd4b830e910 | YES | 228 | YES | GREEN | PASS |
| 228 | 9281d09510a56c74db7c846865e639d30a95921a | staging | a3e11d36a120b9af06308f37a44a9fee3c6edb72 | YES | 229 | YES | GREEN | PASS |
| 229 | 9398b3f2df4ecc91c18015f2d9fcea76a46268ef | staging | 0f1e4a432e6d22f50c6ae01293bbc2139671d763 | YES | 230 | YES | GREEN | PASS |
| 230 | 3fb54ed32efc3993b20b4305cb8ed24e2e1855b7 | staging | b6ea67f3baa55081cea55443da1f85c8d759008f | YES | 231 | YES | GREEN | PASS |
| 231 | 57ae636a7ea3b12d72d835a13afb4291243f7122 | staging | 36f4e1e28d10e47053f83d062e8d25ce4eac6802 | YES | 232 | YES | GREEN | PASS |
| 232 | c231f0a4a0f97a566118895fb66633a544d9b093 | staging | 5e2cd0d5a10a158f3e7a2332acec089fb7f86e7b | YES | 233 | YES | GREEN | PASS |
| 233 | 75c8ce15bf835bacfc426ceea2c5cc449105e970 | staging | 0aaadd68d1329fdf8c8449cad9ed8fe7558f41cf | YES | 234 | YES | GREEN | PASS |
| 234 | b07ffea4f90fcd82b6716c2265b1e2f7877385e2 | staging | 35ad8d7b2e6a9031366cf8e4c20417a33cd5047e | YES | 235 | YES | GREEN | PASS |
| 235 | 50fb3e9e20f3990d05f47974ccde68266572a745 | staging | 236a98bc24bc3fdab33813cd9d8be7f0e9e10636 | YES | 236 | YES | GREEN | PASS |
| 236 | 26ab712bf3e78486b8b88c01ca3d55fa8d7c25d3 | staging | f7961e55ca408fae1e29d7fc46607c301480f776 | YES | 237 | YES | GREEN | PASS |
| 237 | 069f262e52903151b60e40dbbe7b444ce7b03f4f | staging | 5446d60718bfce6aa194f7cbd5d389199170610e | YES | 238 | YES | GREEN | PASS |
| 238 | 5394e4982f8fb5dd03358d90d758cebd14d91d89 | staging | cab4865d7e14e9c0a628b484f5b0b83ccc493469 | YES | 239 | YES | GREEN | PASS |
| 239 | b0eaafce5dd076ec3a878dc7f1ea9561a2506f71 | staging | 035a813e368186fb6deb6a9df9c70c4ce371a6c8 | YES | 240 | YES | GREEN | PASS |
| 240 | fd3bf56993c73006b85f3c3205bd731bc22d9540 | staging | 9b1debbace7a5fa9c3371ff207c70998fe6295cc | YES | 241 | YES | GREEN | PASS |
| 241 | 981382dc11e7085868b3787ae75265a929b0e6b0 | staging | e585cf9fa0d97dfbfa892483c4c49653a0322cd9 | YES | 243 | YES | GREEN | PASS |
| 243 | 512ebe311669ce446b6ac9ffcfadddb8bd5902ac | staging | 4585e9a862a39dcd513a451698cc1f4ebcc4c0b8 | YES | 244 | YES | GREEN | PASS |
| 244 | ac236e75c64b70800ba67964a3c12cd379ec7ffd | staging | 7751a2f6744e06863fd69947867a0c7d100ccfa8 | YES | 245 | YES | GREEN | PASS |
| 245 | 5000465cfc14bb24939c1aa70099774806bf9bc1 | staging | 7ac81e2171cff69bd0ea02372a6ae920ff27a444 | YES | — | — | GREEN | PASS |

## FINAL TREE

- Reviewed #245 head: `5000465cfc14bb24939c1aa70099774806bf9bc1`.
- Final runtime staging merge: `7ac81e2171cff69bd0ea02372a6ae920ff27a444`.
- #245 tree: `031c04abdc9f9656627caa33e7c9f93b63f7251f`.
- Staging runtime tree: `031c04abdc9f9656627caa33e7c9f93b63f7251f`.
- TREE MATCH: YES. No conflict resolution or runtime changes were introduced.

## FINAL CI

[Run 36927901802](https://github.com/NickElixir/dream-wheels-ai/actions/runs/36927901802)
on exact final runtime SHA: SUCCESS, attempt 2.
CI gate passed in attempt 1: frontend 194 PASS; transition 90 + catalogue 11 +
composition/focus 6 + boot 3 = 110 PASS; backend 612 PASS / 5 skipped / 15 warnings;
Ruff lint/format (135 files), syntax, gateway and bundle build PASS.

Attempt 1 deployment was denied by the staging branch rule before any steps.
All 19 intermediate workflow runs were completed (deployment rejected or queued
run cancelled) before restoring the environment. No intermediate frontend was
published. The original unrestricted environment was restored, temporary rule
deleted, and only the failed final deployment job was explicitly rerun.
[GitHub rerun semantics](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
preserve the original exact event SHA/ref. This was a deliberate final rerun;
no historical event was expected to replay automatically.

## STAGING DEPLOYMENT

- Frontend: `dpl_BhEALDwj5vpBrmSS8DGPnadUxENu`, READY, final runtime SHA.
- Frontend built at `2026-10-01T21:22:03Z`; deployment URL: https://dream-wheels-ai-webapp-staging-4ez9jfwky.vercel.app.
- Backend: `dep-davcsov9nhgc73fu80j0`, LIVE, final runtime SHA; finished at `2026-10-01T21:21:56.733699Z`.
- Render backend uses automatic staging deployments; final LIVE version was checked via Render API. Backend intermediate additive releases occurred automatically; only frontend intermediate deployment was paused.
- Public staging `version.json` build = `7ac81e2171cff69bd0ea02372a6ae920ff27a444`. Gateway and direct backend health return `status=ok`.
- Exactly one final frontend deployment: previous Vercel record is pre-integration `dpl_3ahtDeRsdRvpwUexwFjwTb1oV7V9` at `adef5ce8c98e8d0078556906ed70796dbd9beb0e`.
- Available browser `/app/fitment` entry displays sign-in gate. No authenticated Fitment mutation or E2E was performed.

## SLICE 8 UPDATE

#242 was retargeted to staging only after both final deployments were LIVE.
Its retargeted diff contained exactly the readiness document. The docs branch
then merged staging without conflicts, preserving the runtime tree, before
updating readiness and adding this execution report/companion JSON.
Only intentionally updated `docs/evidence/` files differ from staging.
The deployment workflow ignores `docs/**` and root Markdown; a docs-only #242
merge should not trigger frontend deployment. Verify live runs after merge.
Render staging has no build filter, so the docs-only merge commit will carry
`[skip render]`, the provider's supported auto-deploy control; this leaves CI
enabled. Verify the latest backend deployment remains the final runtime release.
See [Render skip controls](https://render.com/docs/deploys#skipping-an-auto-deploy).
New readiness/execution prose uses repository-relative paths; historical evidence
and the owner's 14.6 MB screenshot archive were retained.

## PHASE B PREREQUISITES

| Prerequisite | Status |
|---|---|
| Final frontend | READY |
| Final backend | READY |
| Dedicated QA auth | MISSING / unverified |
| Native Telegram staging app | MISSING / unverified; QA PENDING |
| Disposable Fitment context | MISSING |
| Real vehicle photo case | MISSING / unqualified |
| Real wheel URL case | MISSING / unqualified |
| Real multi-market case | MISSING / unqualified |
| Real multi-SKU case | MISSING / unqualified |

No supported disposable-context helper was found in repository scripts/API,
and no qualifying QA-owned context was supplied. Recommend a separate staging
infrastructure task for resettable isolated VehicleIdentity/RimSetup with known
revisions, no render enqueue and no credit reservation/spend. Do not reuse
completed history or mutate the database as a substitute.
Verify real Wheel Size API market IDs/labels do not produce duplicate semantic
choices; do not automatically deduplicate by display label.

## BLOCKERS

Runtime integration/deployment: NONE.
Phase B: disposable context missing; remaining QA inputs unqualified.

## MERGE RESULT

`PASS — FITMENT VNEXT INTEGRATED INTO STAGING`

## PHASE B STATUS

`BLOCKED BY DISPOSABLE FITMENT CONTEXT`

`AUTHENTICATED STAGING SMOKE = BLOCKED`

`FULL STAGING E2E = BLOCKED`

## RELEASE READINESS

`BLOCKED BY STAGING E2E`

Rollback uses the known-good frontend deployment above and pre-integration
backend `dep-dauo1t0ae00c73f34su0` at the rollback ref. If code reversal is
needed, use revert PR/merge commits, preserve #224 safety and safe additive
backend contracts; never reset/force-push shared staging. No migrations changed.
