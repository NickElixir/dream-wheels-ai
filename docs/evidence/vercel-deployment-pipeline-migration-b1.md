# Dream Wheels AI — Vercel deployment pipeline migration (Stage B1)

Date: 2026-08-28  
Scope: local preparation only; no deployment or remote repository mutation

## Outcome

Stage B1 is prepared locally after the Vercel topology audit. The intended
pipeline is:

```text
feature/fix/e2e/docs PR or branch  → CI only
staging push                        → CI success → one staging Vercel deploy
main push                           → CI success → one production Vercel deploy
main push with admin/** changes     → CI success → one admin Vercel deploy
manual workflow dispatch            → one intentional preview deploy
```

Render remains the backend deployment owner: staging uses the existing Render
staging target and production uses the existing Render production target.

## Prepared files

- `.github/workflows/ci.yml`
  - Standalone CI covers `feature/**`, `fix/**`, `e2e/**`, and `docs/**`
    pushes, as well as pull requests to `main` and `staging`.
  - No Vercel action is present in the CI job.
- `.github/workflows/deploy-frontends.yml`
  - Runs on `staging`/`main` pushes and invokes the local CI workflow as a
    reusable `ci` job before any deployment job.
  - Uses pinned Vercel CLI `53.1.1` and prebuilt artifacts.
  - Has separate staging, production, and conditional admin jobs.
  - Has a `workflow_dispatch` preview job only; `run_e2e` records a handoff
    marker and does not invoke an unconfigured runner.
  - Checks the pulled `BACKEND_URL` before staging/preview deployment so a
    staging build cannot silently target production Render.
  - Each active job contains one deployment command; no retry or diagnostic
    deployment is defined.
  - Staging, production, admin, and manual preview all require the reusable
    `ci` job, avoiding `workflow_run` default-branch bootstrapping.
- `webapp/vercel.json` and `admin/vercel.json` prepare
  `git.deploymentEnabled: false` so the connected projects can retain their
  Git links while native Git deployment is disabled when the configuration is
  applied.

## GitHub configuration required before activation

Add the following in repository Actions settings (Stage B2):

- Secret: `VERCEL_TOKEN`.
- Variables: `VERCEL_ORG_ID`, `VERCEL_WEBAPP_STAGING_PROJECT_ID`,
  `VERCEL_WEBAPP_PRODUCTION_PROJECT_ID`, `VERCEL_ADMIN_PROJECT_ID`.

The project IDs are the existing Vercel projects from the topology audit. The
redundant `dream-wheels-ai-staging` project is intentionally not referenced.

## Vercel dashboard boundary

Before the first activation, keep each GitHub connection but ensure native Git
deployments are disabled for the projects, using the project-specific
`git.deploymentEnabled` policy prepared in each frontend's `vercel.json`. This
prevents duplicate Git-created deployment objects. If the dashboard only
offers an all-or-nothing switch, disable native Git deployment and let the
reviewed workflow own deployment. Do not use an Ignored Build Step as a quota
workaround.

Vercel may require one migration deployment for the new `vercel.json` setting
to take effect. That deployment must be explicitly included in the Stage B2
quota plan; it is not performed by B1 and must not be hidden in a push.

## Stage B2 migration sequence

1. Disconnect Git from the legacy `dream-wheels-ai-staging` Vercel project;
   retain the project and history, and do not delete it.
2. Push the migration change-set first to a `feature/infra-*` branch. This
   receives standalone CI only; the deployment workflow is not triggered.
3. Observe the linked webapp/admin projects for zero native deployments or a
   bounded one-time migration deployment caused by applying
   `git.deploymentEnabled: false`.
4. Verify native Git deployment is disabled for webapp and admin before any
   merge to `staging`.
5. Merge to `staging`. The expected result is one successful reusable CI gate
   followed by exactly one `dream-wheels-ai-webapp-staging` deployment.

The first migration push must not be treated as an ordinary staging release:
the old native Git mechanism may still be active until the repository setting
has taken effect.

The staging project must expose the existing Render staging `BACKEND_URL` to
the workflow's pulled production/preview environment. The production project
must retain the existing Render production target. These remote settings are
not changed in B1. The legacy `dream-wheels-ai-staging` project remains out
of the workflow; its Git connection should be disabled or disconnected
manually in the later cleanup step after confirming rollback/audit
requirements.

## Quota and safety status

The last server-provided Hobby-limit message remains:

```text
Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day").
```

The preserved retry boundary is `2026-08-28T17:35:45Z`. This is a rolling
24-hour gate, not a midnight reset. No quota probe, empty commit, deployment,
promotion, redeploy, commit, or push was performed for B1.

## Validation

- `pytest -q` → `290 passed, 3 skipped`.
- `ruff check .` and `ruff format --check .` pass.
- `python -m compileall src/ tests/ -q` passes.
- Both workflow files parse as YAML.
- `git diff --check` passes.
- No application/domain/UI semantics were changed.

## Checkpoint

```text
VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT = COMPLETE
VERCEL_DEPLOYMENT_POLICY_V1 = PROPOSED
VERCEL_DEPLOYMENT_PIPELINE_MIGRATION = PREPARED_NOT_APPLIED
STAGE_B1_READY_FOR_B2 = YES (local correction complete)
VERCEL_DEPLOYMENT_GATE = BLOCKED (preserved ETA: 2026-08-28T17:35:45Z)
FITMENT_BETA_READY = NO
NEXT = Stage B2 after quota gate and explicit user approval
```
