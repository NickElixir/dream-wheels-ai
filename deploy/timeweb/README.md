# Timeweb frontend container

This container serves the existing static `webapp/` frontend and forwards only
`/api/backend/*` requests to the approved production Render backend. Vercel
remains an independent deployment target. The proxy reuses
`webapp/lib/backend-proxy.js` so authorization, query strings, response headers,
and binary responses retain the existing behavior.

## Runtime configuration

Set these environment variables in the Timeweb service before starting it:

- `BACKEND_URL=https://dream-wheels-ai-prod-vnext.onrender.com` (the server
  rejects any other origin)
- `EXPECTED_SUPABASE_URL` and `SUPABASE_URL` to the same production Supabase URL
- `SUPABASE_PUBLISHABLE_KEY` (or supported public/anon alias)
- `TURNSTILE_SITE_KEY` to the production public site key
- `APP_BUILD_SHA` to the full 40-character immutable source commit SHA
- `PORT` only if the platform does not use the default `3000`
- Optional `BACKEND_TIMEOUT_MS` (default 90000)

The public Supabase publishable key and Turnstile site key are browser-visible
configuration, not server secrets. Do not pass service-role keys, bot tokens,
or other server credentials to this container. The public config is generated
at container startup and is not baked into the image. Startup fails closed if
required public settings are absent or invalid.

## Build and run

From the repository root:

```sh
docker build -f deploy/timeweb/Dockerfile -t dream-wheels-timeweb .
docker run --rm -p 3000:3000 \
  -e EXPECTED_SUPABASE_URL="$EXPECTED_SUPABASE_URL" \
  -e SUPABASE_URL="$SUPABASE_URL" \
  -e SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" \
  -e TURNSTILE_SITE_KEY="$TURNSTILE_SITE_KEY" \
  -e APP_BUILD_SHA="$(git rev-parse HEAD)" dream-wheels-timeweb
```

Do not expose `webapp/` as a generic directory listing. The Node server serves a
curated set of public root files and frontend asset directories, applies the
same SPA routes as `webapp/vercel.json`, and denies API implementation, build,
test, package, hidden, and environment files. `/healthz` and `/version.json`
return `X-Robots-Tag: noindex, nofollow`; the latter reports `APP_BUILD_SHA`.

The server accepts request bodies up to 25 MiB and applies finite client
header/request timeouts plus an abort timeout to backend fetches. It has no local
session, auth, or payment logic: browser credentials are forwarded through the
existing backend gateway.
