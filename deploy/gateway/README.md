# RU API gateway

Canonical environments, release and rollback:
[RU release pipeline](../../docs/ru-release-pipeline.md).

One source directory serves two **separate** Deno Deploy applications:
`gateway-test` for `app-test.dream-wheels.ru`, `gateway` for
`app.dream-wheels.ru`. Both use the same fixed production Render API/data.
Neither is a second backend.

```sh
cd deploy/gateway
deno task check
deno task start
```

`/health` reports gateway build/environment; `/upstream-health` checks fixed
Render health (60-second deadline). `/api/backend/*` accepts only explicit
route/method pairs. Protected routes require Bearer and Render validates it.
Telegram website login endpoints are excluded. Exact-origin CORS, 25 MiB bounded
streaming uploads, 60-second upstream deadline, no
redirects/cookies/cache/admin/arbitrary targets. Logs contain safe request
ID/method/route template/status/header duration only.

Use the manual `Release RU API gateway` GitHub workflow with an exact tested
SHA: `ru-test` from staging, `ru-production` from main. It injects public
`GATEWAY_BUILD_SHA` / `GATEWAY_ENVIRONMENT`, updates the existing app, then
checks served metadata and Render connectivity. `DENO_DEPLOY_TOKEN` is an
Actions secret. No app creation or plan upgrade is part of routine deployment.
CLI is pinned to `jsr:@deno/deploy@0.0.9908`; upload only this directory, never
the repository root. There is no default app in deno.json: **always pass --app
explicitly** when using the CLI manually. Never commit tokens or `.env` files.

Rollback by redeploying the previously recorded gateway SHA with its matching
metadata, or selecting the previously recorded revision in Deno. Verify health
and upstream afterward. Keep the previous revision available until acceptance.

Deno Deploy is a temporary dependency; see the lifecycle note and official
notice in the canonical runbook. A provider-local health result does not prove
user network reachability: Android/MacBook checks without VPN remain required.

Official references:

- https://docs.deno.com/runtime/reference/cli/deploy/
- https://github.com/denoland/skills/blob/main/skills/deno-deploy/references/AUTHENTICATION.md
- https://deno.com/blog/cloudflare
