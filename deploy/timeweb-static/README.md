# Timeweb static frontend

Canonical environments, release, acceptance and rollback:
[RU release pipeline](../../docs/ru-release-pipeline.md).

From repository root, with validated public Supabase/Turnstile build variables:

```sh
TIMEWEB_PROFILE=ru-test npm run build
# production uses TIMEWEB_PROFILE=ru-production
node --test deploy/timeweb-static/build.test.mjs
```

Profiles select fixed gateway URLs and disable website Telegram login. Missing
profiles, legacy `TIMEWEB_API_TARGET`, and mismatched source SHA are rejected.
`APP_BUILD_SHA` is required only where Git metadata is unavailable; the release
runner injects the selected commit automatically. It must match HEAD otherwise.
Output `dist/timeweb` includes the SPA fallback, generated public browser config,
version metadata and noindex robots. Do not publish repository source, tests,
node_modules or secrets. Vercel remains on its separate build/release workflow.
