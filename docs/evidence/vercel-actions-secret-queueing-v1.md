# Vercel Actions secret queueing evidence v1

Date: 2026-08-29
Scope: staging deployment pipeline credential recovery; no Fitment domain/UI change.

## Finding

GitHub Actions reads repository-level secrets when a workflow run is queued.
Re-running an earlier failed workflow keeps its original event SHA and does not
validate a subsequently replaced repository secret. Consequently, a rerun is
not a valid test of a rotated `VERCEL_TOKEN`.

The authoritative GitHub reference is:

- [GitHub Actions secrets reference — when GitHub reads secrets](https://docs.github.com/en/actions/reference/security/secrets#when-github-actions-reads-secrets)
- [GitHub Actions re-running workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)

## Evidence collected

1. `dream-wheels-ai-webapp-staging`
   (`prj_YIkAGGO32fE5EZbuIwVaQ7dng7UA`) has `BACKEND_URL` in its
   `Production` environment, pointing to the existing Render staging target.
2. A local Vercel CLI pull against that exact project and environment receives
   `BACKEND_URL`; the Vercel dashboard/project configuration is therefore not
   the cause of the previous guard failures.
3. The affected GitHub Actions workflow run was queued before the durable
   repository `VERCEL_TOKEN` replacement. Its later reruns continued to stop
   at the fail-closed staging environment guard before build or deployment.
4. The staging and production GitHub Environments contain no environment-level
   `VERCEL_TOKEN` override. The replacement repository secret is the intended
   credential source for a newly queued run.
5. No Vercel deployment was created by any of the failed guard attempts.

## Required validation method

The next validation must be a **newly queued** workflow run, not a rerun. The
normal reviewed path is a non-empty PR merged into `staging`:

```text
new staging push
  -> reusable CI gate
  -> staging BACKEND_URL guard using the newly queued secret
  -> exactly one prebuilt Vercel staging deployment
  -> alias and backend-health verification
```

This evidence document is that non-empty, reviewable change. It does not
alter backend targets, Vercel environment variables, Fitment contracts, or
the frozen UI. It must not be replaced with a manual Vercel redeploy, because
that would neither exercise the Actions credential nor prove the pipeline.

## Pending evidence after merge

Record only after the newly queued staging workflow finishes:

- Actions run URL and conclusion;
- staging deployment ID, source SHA, and `Ready` state;
- staging alias target;
- proxy health response and confirmation that it reaches Render staging;
- the 24-hour Vercel deployment count before and after the one intended deploy.

## Checkpoint

```text
VERCEL_DEPLOYMENT_PIPELINE_MIGRATION = IN_PROGRESS
VERCEL_TOKEN_QUEUEING_BOUNDARY = DOCUMENTED
VERCEL_STAGING_ENVIRONMENT = VERIFIED_OUT_OF_BAND
VERCEL_DEPLOYMENT_GATE = PENDING_FRESH_STAGING_RUN
FITMENT_BETA_READY = NO
```
