# Dream Wheels AI Admin

Internal Next.js dashboard for render/job statistics.

## Local Development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required env vars:

- `DATABASE_URL` — Supabase Postgres connection string. Use the pooler URL in production.
- `ADMIN_USERNAME` — HTTP Basic Auth username.
- `ADMIN_PASSWORD` — HTTP Basic Auth password.
- `SUPABASE_STORAGE_URL` — matching project's HTTPS Storage endpoint (`https://<ref>.supabase.co/storage/v1`).
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only** credential for signing known job assets. Never prefix with `NEXT_PUBLIC_`.

No secrets are exposed to the browser. The dashboard reads Postgres from Server Components and is protected by middleware Basic Auth.

## Vercel

Deploy this directory as a separate Vercel project with `admin` as the root directory.

Set the same env vars in Vercel Project Settings.

## Job images

The dashboard links to `/jobs/<uuid>` with original car, original wheel and result.
Media requests use same-origin Basic-auth routes, explicit job asset FKs, owner/kind/bucket
checks, and a five-minute Storage signed redirect. `raw` stays private. Signed URLs are
bearer capabilities until expiry: opening an original leaves the admin auth boundary
for five minutes. Responses are `private, no-store`, with no-referrer policy. Credentials,
Storage paths and signed URLs are not passed as React client props or logged.

Draft/reused assets are resolved by FK, not mutable `assets.job_id`. Legacy source fallback
only accepts the historical `<job UUID>/car|wheel.<image extension>` keys. External URLs,
including Telegram URLs, are never fetched. Legacy results must belong to the configured
project's public `results` bucket. Missing metadata is shown as not recorded. Attachment
indicators describe DB references, not live object existence. Full originals load on demand;
dashboard result previews are lazy loaded (no new derivative generation/storage writes).

Use an isolated local database or mocks for development. Never connect local tests to production.
The DB URL and Storage credentials must reference the same project. Do not make `raw` public,
weaken RLS, expose credentials to browser builds, or copy production secrets into fixtures.

Verification (Node 22+):

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

## Release boundary

Prepare changes locally, review, merge to staging, then verify an authenticated **admin**
Vercel preview before approving production. Existing `deploy-frontends.yml` preview is for
WebApp, not admin. Its production `deploy_admin` option is part of a broader backend-gated
release, not an admin-only deployment. Do not dispatch that workflow merely to publish admin.
Configure a separate reviewed admin-only release/preview path before publication; avoid
unintentionally deploying WebApp or Render. Inspect Render auto-deploy before a main merge.
Deployment and production env changes require explicit approval. No SQL migration is required.

Next.js and eslint-config-next are pinned to 16.4.5. Run `npm audit --omit=dev` before
publication; do not use `npm audit fix --force`. Page-level authorization and media-route
authorization provide defense in depth beyond Proxy, but do not replace framework updates.

Every dashboard/media DB query runs inside `BEGIN READ ONLY`, with a transaction-local
15-second statement timeout and rollback/release on errors. This prevents ordinary admin
queries from writing even with an inherited database credential, but is not a substitute
for a least-privileged read-only database role. Production role permissions have not been
verified. Storage signing still uses a privileged server credential: deployment protection
and admin Basic Auth must remain enabled. No Storage write/delete API is exposed by admin.
