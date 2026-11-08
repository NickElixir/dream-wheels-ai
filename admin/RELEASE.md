# Admin-only production release

## Scope and source

Promote the admin changes reviewed in PR #355 and merged into staging as
`6291fbdd8c8cd142c10ede75623e3475ef15fb3a`. The isolated release branch is based on
main and contains only `admin/**` and the admin CI job. Do not release all of staging:
it also contains unrelated catalogue, backend, WebApp and migration changes.

The user accepted images and the fullscreen viewer on the updated Preview of
`a01ec03bc4f6a1a13c6d143a311aa703cdf766bf`. The subsequent retry fix `6ff212a`
passed 15 tests and CI. This is not independent automated production E2E evidence.

## Preflight — required before publication

- Release PR to main is reviewed and its exact merge SHA passes CI.
- Before merging main, inspect Render auto-deploy policy: the merge itself may
  trigger a backend deploy. Do not merge until an approved no-backend-release path
  is confirmed. No Render settings/deploy changes are authorized by preparation.
- Verify Vercel project `dream-wheels-admin` (`prj_LFbkEgGQK0vnJnNJSYFG1BDkqk75`),
  team `team_pY1GgICRlvIf9srJZbTxfAQR`, root `admin`, Node 24.
- Verify Production has ADMIN_USERNAME, ADMIN_PASSWORD, DATABASE_URL,
  SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY. Storage variables were
  Preview-only at the preparation checkpoint; do not assume Production inherits them.
- DB and Storage must reference the same intended production Supabase project.
  Values are Secret and were not decrypted by the agent. Owner must confirm matching.
- The owner changed the shared DATABASE_URL during Preview diagnosis. Confirm the
  intended Production value before deployment. No automatic restore/rotation.
- DB-role permissions remain unverified. READ ONLY transactions and a 15-second
  query timeout protect application queries, but do not replace least privilege.
- Signing uses a privileged service-role credential. Keep app Basic Auth enabled;
  Preview Vercel Authentication must not be removed to simplify tests.
- Record currently assigned production deployment/aliases and configuration snapshot
  privately before publication. Never commit credential values or signed URLs.
- Explicit owner approval for production publication and any Production env changes.

## Isolated publication

Do not dispatch `deploy-frontends.yml`: its admin option is coupled to broader
frontend/backend-gated jobs. No WebApp, landing, Timeweb, Deno or Render release is
part of this operation. No schema change or migration is required.

After approval, use the Vercel MCP `create_deployment` operation for the existing
admin project only. Pin `gitSource` to GitHub `NickElixir/dream-wheels-ai`, `ref=main`
and the exact reviewed current-main SHA; set `target=production`. Do not override
project build settings or use a moving ref without SHA. Record deployment ID, URL,
source SHA and result; inspect build logs on failure. Never retry an uncertain write
without checking whether the deployment was created.

Alternative: a separately reviewed admin-only Actions workflow can be introduced
later; it is not provided or dispatched by this release preparation.

## Acceptance

Confirm READY and the expected SHA, then verify `admin.dreamwheels.pro`:
unauthenticated page/media requests denied; authenticated dashboard and filters;
car/wheel/result images; fullscreen/keyboard/zoom; retry after temporary image error;
failed and missing-asset jobs; return filters; mobile layout. Use existing designated
test jobs only. No generation, payments, balance changes or media upload/delete.
Do not weaken auth to permit automated acceptance. Owner acceptance can supplement,
but must not be described as agent-run E2E.

## Rollback

Preparation checkpoint (2026-11-09): latest listed ready Production deployment
`dpl_AXXKy1Pj2jtAPEysm61uE99hjvgy`, source
`c5a8524386182d540d77c636acc00f3941a52431`, rollback candidate true. Recheck the
actual assigned production alias immediately before release; this checkpoint is
not proof that the alias still points to that deployment.

On failure, stop further publication and obtain owner confirmation for rollback
of the admin project only to the recorded production deployment. Verify aliases
and Basic Auth afterward. Deployment rollback does not restore separately edited
environment settings or database state. No database rollback is required by these
code changes; do not reset data or run destructive SQL.
