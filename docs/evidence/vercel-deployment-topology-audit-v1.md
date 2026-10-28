# Vercel deployment topology audit v1

## Scope and safety boundary

This is a read-only infrastructure audit for Phase 07 Slice 7. No Vercel
deployment, promotion, environment mutation, Git push, or project deletion was
performed. The Fitment domain/UI contract is unchanged.

Audit team: `nick's projects` (`team_pY1GgICRlvIf9srJZbTxfAQR`, Hobby).
The trailing-24-hour deployment window was audited at `2026-08-27T19:40Z`.

## Current project inventory

| Project | Project ID | Current purpose / actual use | Git link and branch | Root / runtime | Current domains | Git behavior | Backend target | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dream-wheels-ai-webapp` | `prj_tY0wyySMeQBg78MvSJa6XIEoSc5I` | Production frontend; actively receives feature/staging PR previews | `NickElixir/dream-wheels-ai`, production branch `main` | `webapp`, Other/static, Node 24.x | `dream-wheels-ai-webapp.vercel.app` plus team/main aliases | `createDeployments=enabled`; non-main pushes create previews | Production Render via project/runtime configuration | KEEP; restrict automatic non-main previews |
| `dream-wheels-ai-webapp-staging` | `prj_YIkAGGO32fE5EZbuIwVaQ7dng7UA` | Authoritative staging frontend and authenticated E2E entrypoint | `NickElixir/dream-wheels-ai`, production branch `staging`; deploy hook `staging-sync` | `webapp`, Other/static, Node 24.x | `dream-wheels-ai-webapp-staging.vercel.app` plus team/staging aliases | `createDeployments=enabled`; feature/fix/e2e pushes create previews; staging branch promotes production target | **Currently production Render** in the active alias; intended target is Render staging | KEEP; one staging deployment per staging merge, manual previews only |
| `dream-wheels-ai-staging` | `prj_s1f4Iz6xKuDGTSIQT8j37u0clTp8` | Redundant FastAPI Vercel project; Render is the real staging backend | `NickElixir/dream-wheels-ai`, production branch `main` | repository root, FastAPI, Node 24.x; no env vars/domains | `dream-wheels-ai-staging.vercel.app` plus team alias | `createDeployments=enabled`; feature pushes create previews | No authoritative backend target; Render staging is canonical | `REDUNDANT_OR_LEGACY`; disable Git auto-deploys, do not delete |
| `dream-wheels-admin` | `prj_LFbkEgGQK0vnJnNJSYFG1BDkqk75` | Separate admin frontend; not part of Fitment runtime | same repo, production branch `main` | `admin`, Other/static, Node 24.x | `dream-wheels-admin.vercel.app` plus team/main aliases | `createDeployments=enabled`; every PR branch creates previews | Admin runtime/database configuration | KEEP; separate cleanup from Fitment |
| `dream-wheels-ai-legal` | `prj_yLl9kM2yokY6h6RXQlYObj1oV4xY` | Legal site; no linked Git repo and no deployment in audited window | unlinked | project root, Other, Node 24.x | `dream-wheels-ai-legal.vercel.app` plus team alias | no Git link observed | not applicable | INVESTIGATE separately |
| `webapp` | `prj_1okdBJaSGfy1eFI3vAbmKwJ5fJWj` | Legacy/unlinked webapp project; no deployment in audited window | unlinked | project root, Other, Node 24.x | `webapp-sage-chi.vercel.app` plus team aliases | no Git link observed | not applicable | INVESTIGATE; do not delete |
| `output` | `prj_dJSMO0tQkuviwEoQUYbb05s5Kycf` | Empty/unlinked project; no domains or deployments | unlinked | project root, Other, Node 24.x | none | no Git link observed | not applicable | INVESTIGATE; do not delete |

The Vercel API exposes `gitProviderOptions.createDeployments=enabled` on the
linked projects at audit time. Before the local B1 preparation, the static
`webapp/vercel.json` had no `git.deploymentEnabled` rules, so unspecified
branches could deploy. B1 now prepares the repository-side disablement and
workflow orchestration; the remote project settings remain unchanged until
Stage B2.

## Deployment amplification observed

For PRs #103–#109, one feature/e2e/docs commit generally produced three
accepted preview deployments: `dream-wheels-ai-webapp-staging`,
`dream-wheels-ai-webapp`, and `dream-wheels-admin`. PR #109 produced 14
accepted deployments across three commits because the redundant FastAPI Vercel
project also participated and the staging frontend received repeated targets.
PR #110 produced zero accepted deployments; all four linked-project attempts
were rejected by `api-deployments-free-per-day`.

| PR | Representative commit(s) | Accepted deployments observed | Runtime value classification |
| --- | --- | ---: | --- |
| #103 | `05e9057`, `7fcc4c8` | 6 (3 + 3) | backend/UI fix plus formatting-only follow-up; duplicate project previews |
| #104 | `a125fdd` | 3 | evidence-only |
| #105 | `cab2d1a` | 3 | evidence-only |
| #106 | `5ac8467` | 3 | evidence-only |
| #107 | `09c8a19` | 3 | docs/evidence-only |
| #108 | `a8bc107` | 3 | handoff/docs-only |
| #109 | `e48ecfc`, `b0c1f6d`, `b8768fd` | 14 (6 + 4 + 4) | frontend/backend fix, test and formatting follow-ups; redundant backend project included |
| #110 | `c8f6a57`, `6178496` | 0 accepted; 4 rejected | docs/evidence-only; rejected by quota |

Approximate current multiplier:

- feature/e2e/docs commit: **3 Vercel deployments** by default;
- PR with one commit: **3 deployments** (or 4 when redundant staging participates);
- staging merge cycle: **3–6 accepted deployments** depending on linked projects
  and follow-up commits;
- the audited window contained **121 deployments** across all projects.

## Target policy

`VERCEL_DEPLOYMENT_POLICY_V1 = PROPOSED`

```text
feature/*, fix/*, e2e/*, docs/*  -> CI ONLY; no automatic Vercel deployment
staging                         -> one staging frontend deployment
main                            -> one production frontend deployment
backend staging                 -> Render staging
backend production              -> Render production
preview                         -> manual on demand only
docs-only                       -> no deployment
```

Target savings versus the observed topology:

| Event | Current | Target |
| --- | ---: | ---: |
| Feature commit | ~3 | 0 |
| One-commit PR | ~3 (sometimes 4) | 0 by default |
| Staging merge | ~3–6 | 1 |
| Production merge | project-dependent | 1 |

For the common docs/e2e PR pattern this is approximately a **3× reduction per
PR** and removes the largest source of quota waste. Across a multi-commit
release cycle like #109, the reduction is approximately **14 → 1** for a
staging-only release. These are planning estimates, not a new deployment
claim.

## Repository and dashboard boundary

The desired branch rules cannot safely be added to the shared
`webapp/vercel.json` without distinguishing the production and staging Vercel
projects: a shared `staging=true` rule would still deploy staging commits in
the production project. Vercel's `git.deploymentEnabled` branch map is the
correct mechanism, but it must be project-specific or paired with a later
manual-deploy workflow. `Ignored Build Step` is insufficient because it may
create a deployment object before skipping the build and therefore does not
protect the quota.

No dashboard mutation was applied in this pass. The frontend repository
configs now prepare `git.deploymentEnabled: false` for the two webapp projects
and admin; the following remote actions still require the user's manual
confirmation in Stage B:

1. `dream-wheels-ai-webapp` → **Settings → Git**: keep connected repository
   `NickElixir/dream-wheels-ai`; keep **Production Branch = `main`**; set the
   project Git deployment policy so non-main branches do not auto-deploy. If
   the dashboard only offers an all-or-nothing switch, disable automatic Git
   deployments and use the approved post-Phase-07 manual/CI production deploy
   instead; do not change `BACKEND_URL` here.
2. `dream-wheels-ai-webapp-staging` → **Settings → Git**: keep repository and
   **Production Branch = `staging`**; disable automatic preview deployments
   for feature/fix/e2e/docs branches, retaining only the intentional staging
   branch deployment. Do not rebuild before the current quota ETA, and do not
   change the backend target in this topology pass.
3. `dream-wheels-ai-staging` → **Settings → Git**: disable automatic Git
   deployments. Keep the project and its history for rollback/audit; Render
   staging remains authoritative. Do not delete the project.

The exact dashboard control names can vary by Vercel UI revision. The
authoritative API/config equivalent is `git.deploymentEnabled` (branch map or
`false`) from Vercel's Git configuration documentation. Vercel may require a
one-time migration deployment before the repository setting takes effect;
that deployment is a Stage B2 quota decision, not a B1 action. The post-
Phase-07 workflow migration (`staging merge → CI → one Vercel staging deploy`,
`main merge → CI → one production deploy`, optional manual preview) is now
prepared locally and remains `PREPARED_NOT_APPLIED`.

## Fitment proxy tech debt

`FITMENT_PROXY = ACCEPTABLE_FOR_RELEASE`

`PROXY_REFACTOR = DEFERRED_TECH_DEBT`

Future work may replace route-specific frontend proxy branching with one
constrained catch-all backend proxy while preserving method/path allowlisting,
auth forwarding, staging/production separation, and the invariant that a new
backend route does not add a new frontend Serverless Function. The proxy is not
refactored in Phase 07.

## Stage B1 local preparation

The quota-safe GitHub Actions implementation is prepared locally, without
creating a Vercel deployment or changing any Vercel project setting:

- `.github/workflows/ci.yml` now runs standalone on `feature/**`, `fix/**`,
  `e2e/**`, and `docs/**` pushes (pull requests to `main`/`staging` remain
  CI-only).
- `.github/workflows/deploy-frontends.yml` is prepared for the reviewed policy:
  push-triggered reusable CI gate, exactly one prebuilt staging or production
  deploy, admin deploy only when `admin/**` changed, and an explicitly manual
  preview path.
- The workflow refuses a staging/preview build if the pulled Vercel
  `BACKEND_URL` is not the Render staging target. Production is checked against
  the Render production target and fails closed when the variable is missing.
- Admin change detection compares the complete push range
  `github.event.before → github.sha` with full repository history, rather than
  only the last commit.
- The workflow does not reference the redundant `dream-wheels-ai-staging`
  Vercel project; Render remains the backend deployment owner.
- `webapp/vercel.json` and `admin/vercel.json` prepare
  `git.deploymentEnabled: false`; no remote Vercel setting was mutated.

Required GitHub Actions configuration for Stage B2 is documented here before
activation:

- secret: `VERCEL_TOKEN`;
- variables: `VERCEL_ORG_ID`, `VERCEL_WEBAPP_STAGING_PROJECT_ID`,
  `VERCEL_WEBAPP_PRODUCTION_PROJECT_ID`, `VERCEL_ADMIN_PROJECT_ID`;
- Vercel-native Git deployments must be disabled per project before the
  workflow is activated, otherwise duplicate deployment objects can still
  consume the Hobby quota.

The Stage B2 order is: disconnect legacy Git first; push the migration
change-set to a `feature/infra-*` branch; observe native webapp/admin
deployments; verify native Git is disabled; only then merge to `staging` and
expect one Actions-owned staging deployment.

The preview `run_e2e` input is deliberately only a handoff marker; this
workflow does not invent or invoke an E2E runner. Authenticated E2E remains a
separate Slice 7 gate.

No commit, push, Vercel API mutation, deploy, promotion, or redeploy was
performed in this preparation pass.

## Stage A/B1 result

```text
VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT = COMPLETE
VERCEL_DEPLOYMENT_POLICY_V1 = PROPOSED
VERCEL_CONFIG_CHANGES = PREPARED_LOCALLY (not applied remotely)
VERCEL_DEPLOYMENT_GATE = BLOCKED
VERCEL_DEPLOYMENT_PIPELINE_MIGRATION = PREPARED_NOT_APPLIED
SAFE_REPO_CHANGES = PREPARED_LOCALLY (not committed or pushed)
WORKFLOWS_PREPARED = [ci.yml, deploy-frontends.yml]
USER_ACTION_REQUIRED = [review local workflows; after quota gate, apply project Git settings and GitHub Actions configuration in Stage B2]
```

The current Slice 7 checkpoint remains:

```text
SLICE_7_CROSS_FLOW_STAGING_E2E = IN_PROGRESS
DIRECT_RENDER_A_B_C = NOT_EXECUTED_AUTH_PATH_UNAVAILABLE
FITMENT_BETA_READY = NO
```
