# Timeweb static frontend artifact

Build the site from the repository root:

```sh
node deploy/timeweb-static/build.mjs
```

The builder runs `npm ci` and `npm run build` in `webapp/`, validates the public
Supabase and Turnstile settings through `webapp/scripts/build-public-config.mjs`,
and writes the deployable site to `dist/timeweb/`. Provide
`EXPECTED_SUPABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or a
supported public alias), and `TURNSTILE_SITE_KEY` in the build environment.
`APP_BUILD_SHA` is optional; when absent, the builder uses `git rev-parse HEAD`.
When supplied, it must be a full 40-character commit SHA.

Publish the **contents** of `dist/timeweb/` as the static site's document root.
The output includes only the app entry files, favicon and cover, `assets/`,
`vnext/`, the two browser auth runtime scripts, generated browser config,
`version.json`, `robots.txt`, and `404.html`. `404.html` is a copy of the SPA
entry point so client-side routes can be opened directly. The generated HTML
and robots file prevent indexing.

The API base is fixed to `https://dream-wheels-ai-prod-vnext.onrender.com` in
`deployment-config.js`. Browser auth analytics posts directly to
`https://dream-wheels-ai-prod-vnext.onrender.com/analytics/events`. The
generated auth config contains only the validated publishable Supabase key,
public Turnstile site key, and browser settings. Never provide service-role
keys, bot tokens, or other server credentials to this build.

Run the focused builder checks with:

```sh
node --test deploy/timeweb-static/build.test.mjs
```
