# Frontend-only production release

## Contract

This opt-in mode publishes WebApp to Vercel and/or Timeweb while leaving the
production backend, writer flags, payments, database and Deno gateway untouched.
The default full Vercel release still requires the original frozen-backend gate.
Admin publication is not supported in frontend-only mode.

The candidate must be exact current main, contain the accepted RU test SHA and
have identical webapp/landing/deploy source to that accepted SHA. RU test and
Vercel staging must both still serve that SHA. Backend `/health/release` must report an active healthy
service, a full Git SHA and known boolean runtime flags. The backend commit must
exist in repository history and be an ancestor of the candidate. No inferred or
operator-supplied backend SHA is accepted.

Every changed path between live backend and candidate must match the explicit
policy in `scripts/frontend_release_policy.py`. Unknown root files, backend,
migrations, dependencies, gateway and Vercel server-proxy changes fail closed.
Dependency manifests/locks and server/build configurations are explicitly denied,
including nested package files and landing middleware/provider configuration.
Symlinks and submodules anywhere in the accepted or candidate Git tree are denied,
including unchanged links whose targets changed outside the runtime directories.
Rename detection is disabled to inspect both sides of moves. The allowlist includes
reviewed release-control files to permit introduction of this mode; changes to
these controls still require review. It is not proof that arbitrary UI behavior is
API-compatible: normal integration tests and staging acceptance remain mandatory.
Backend health and source compatibility are rechecked before each publication.
There is no atomic transaction across two hosting providers; record and verify
both results separately. Env drift and remote API contract drift are not detected
by Git equality alone. Do not use this mode after unreviewed runtime configuration
changes.

## Avoiding backend auto-deploy

Keep Render `autoDeployTrigger=checksPass`. Use the documented `[skip render]`
phrase in the release PR title AND the actual merge commit message. Render skips
that commit; ordinary backend releases retain automatic deployment after CI.
Do not use squash for staging -> main release PRs. Before merge, explicitly supply
and inspect the merge commit title/body so GitHub's default title cannot lose the
marker. No Render configuration or operational flag changes are needed.

The preflight uses `pull_request_target`, so both the job definition and Python
policy come from the trusted base branch, not the PR merge version. Permissions
are contents:read only; no secrets, PR checkout, dependencies or executables from
the PR are loaded. Fetching its commit and inspecting Git objects treats it as
data only. Do not switch this event back to pull_request or execute head code. A marked PR requires exactly one body line:

    Accepted-Staging-SHA: <full accepted staging SHA>

Configure its compatibility job as a required main check after activation; repository
branch protection is not modified by this code. GitHub/Render do not prevent a
privileged operator from manually overriding the procedure. CI cannot make an
unauthorized main merge impossible without branch protection.

## Initial activation

1. Review this PR, pass CI and merge into staging. Deploy/retest the same exact
   staging SHA on both RU test and Vercel staging.
2. Before the first main merge, run the new preflight manually from a separately
   reviewed and pinned tooling commit (record its full SHA and diff), not arbitrary
   head code. Run it against the exact release head and accepted test SHA. The new
   PR workflow is not yet trusted/present in main for that first release.
3. Update the release PR title and final merge message with `[skip render]`, add
   Accepted-Staging-SHA and verify the diff includes no backend changes. Merge only
   with explicit release approval and green CI. Verify Render records a skipped
   deploy and no new backend deployment starts. Failure: stop before publication.
4. Use the new workflows from main; do not bypass their checks or change backend
   flags to satisfy them.

## Operator commands

Use full immutable SHAs (replace placeholders); no secrets on the command line:

```sh
python3 -m scripts.check_frontend_release CANDIDATE --tested ACCEPTED --preflight
gh workflow run deploy-frontends.yml --ref main -f target=production -f release_mode=frontend-only -f ref=MAIN_SHA -f tested_sha=ACCEPTED -f deploy_admin=false -f run_e2e=false
gh workflow run ru-release.yml --ref main -f profile=ru-production -f operation=release -f release_mode=frontend-only -f commit=MAIN_SHA -f gateway_sha=EXISTING_GATEWAY_SHA -f production_tested_sha=ACCEPTED
```

Keep the existing gateway SHA; do not deploy Deno for frontend-only changes.
Capture previous frontend versions/Timeweb snapshot. After release, verify versions,
auth bundles, direct root/new/help and legacy routes, no-token API boundaries and
manual login. Do not trigger uploads/renders/payments as a routine smoke test.
Rollback remains a separately selected prior frontend artifact/settings snapshot;
do not roll back the database/backend. Do not blindly re-run a timed-out provider
deploy: inspect its actual state first.

References: https://render.com/docs/deploys and https://render.com/docs/monorepo-support


## Workflow validation

CI runs pinned actionlint 1.7.12, with a pinned Linux archive checksum, on all four
release/CI workflows. YAML duplicates and invalid workflow expressions fail CI;
optional shellcheck/pyflakes integrations are disabled (Ruff covers Python).
For a local installation run:

```sh
actionlint -shellcheck= -pyflakes= .github/workflows/ci.yml .github/workflows/deploy-frontends.yml .github/workflows/ru-release.yml .github/workflows/frontend-release-preflight.yml
```
