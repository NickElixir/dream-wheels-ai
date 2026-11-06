# RU landing on Timeweb: release and rollback

Status: release tooling merged in PR #336/#337. WebApp `/new` test accepted by owner without VPN and published to RU production (workflow 42111679768, source c6a78c619ec5a0ada2fa227c3e7fb76170defe8f). Owner approved both isolated landing apps on the Moscow request preset and a total 20 RUB deployment/diagnostic budget. Landing application creation and production DNS switch remain pending.

## Boundaries

- `www.dream-wheels.ru` remains the public RU canonical origin. Apex redirects to www.
- `/` and `/catalog` are public static Astro pages. Catalog fitment remains unconfirmed; try-on and B2B actions remain demos.
- `dreamwheels.pro` remains the EN Vercel landing. Existing WebApp, Deno gateway, Render, payments and data are separate releases.
- Create CTA targets `https://app.dream-wheels.ru/new`; login targets the application root. `/new` is an alias for the existing create view; `/create` and `/app/new` remain compatible.
- Do not deploy the WebApp SPA output as the landing. The landing output is `dist/landing-timeweb`.

## Build and verification

Run `npm ci --prefix landing`, `npm --prefix landing run check`, `npm --prefix landing test` and the landing workflow's Node/Python boundary tests.
Build using `TIMEWEB_LANDING_PROFILE=landing-ru-test npm run build:landing:timeweb`.
Production uses `landing-ru-production`. `LANDING_BUILD_SHA`, if provided by a provider without Git metadata, must be the full reviewed source SHA. When Git metadata exists it must match HEAD.

The build publishes an explicit allowlist only: public pages, catalog assets, compiled scripts/styles, local fonts, favicon, version/manifest and legacy bridge pages. Source directories, `/dev`, localized build internals and secrets are excluded. Test pages are noindex; production public pages are indexable. Local fonts retain their OFL licenses.

`node scripts/verify_landing_release.mjs --site <technical HTTPS origin> --sha <full SHA> --profile landing-ru-test` checks version, page checksums, canonical metadata, robots policy, application links, HTML cache policy and static resource HTTP status/MIME.

## Cloud preparation

1. Read current frontend presets/source metadata with the landing workflow's `inventory` operation. This creates nothing.
2. Obtain owner approval for the exact App Platform frontend request tariff before creating isolated `dream-wheels-landing-test` and production applications. Do not select a container/VPS tariff.
3. Configure build command `npm run build:landing:timeweb`, output `/dist/landing-timeweb`, native automatic deployments off, exact source SHA, and only the two build variables above. No backend credentials are required.
4. Set GitHub variables `LANDING_RU_TEST_APP_ID`, `LANDING_RU_TEST_URL` and production equivalents to the actual dedicated application IDs and technical HTTPS origins. Existing WebApp IDs 281247 and 281549 are explicitly rejected by the landing release script.
5. Configure the provider's web server to revalidate HTML (`Cache-Control: no-cache`), enable compression, and serve real directory pages. Initially use revalidation for all files; unversioned public image URLs must not be immutable. Do not configure an index.html SPA fallback for all landing paths.
6. Verify `/catalog` normalization, MIME types, fonts, unknown-path 404 and the legacy bridges on the actual provider. Static legacy bridges preserve path/query/hash for `/app/**` and `/t/**`, with `/app/new` mapped to `/new`. Arbitrary legacy dynamic paths require a custom 404 bridge or a verified native redirect rule. Do not claim these work until tested on Timeweb.

The manual workflow releases only an explicitly mapped existing landing application. It never creates paid resources or changes DNS. Its sanitized pre-change settings snapshot is retained as an artifact for rollback.

## Acceptance and production switch

Publish test first from staging. Test both pages and catalog selections, RU/EN links, CTA and legacy URLs on MacBook and Android without VPN, including mobile Internet. Confirm that the WebApp `/new` alias has been published separately before switching landing CTA traffic.

After owner acceptance, release the same reviewed source to production (via staging → main with green CI), with production robots policy. Record source SHA, deployment IDs, technical URLs and previous settings. Confirm the test application's served version matches the accepted SHA. The production workflow requires the same accepted SHA as its requested release.

Before changing DNS, save current RU records/TTL and obtain explicit approval. Bind both RU hostnames and verify TLS, apex redirect, public pages, all assets and old links. Recheck EN Vercel read-only. Only then record completion here.

## Rollback

Keep prior source SHA and sanitized provider settings snapshot. Redeploy the previous reviewed SHA using the same landing profile; verify the served version and pages. If DNS has switched and a provider issue persists, restore the saved RU DNS records and previous redirect configuration. Do not alter EN, WebApp, Deno or Render as part of landing rollback.

## Deferred optimization

Measure cold and warm loads before bundling or cache changes: requests to Timeweb separately from API/gateway calls, transferred bytes, fonts, LCP and cache hits. Optimize stable hashed resources and image sizes after acceptance. Keep authentication/session/history/balance/upload regression checks in the WebApp pipeline. No new CDN is part of this migration.

## Created application inventory (2026-11-06)

- Test: 283503, https://nickelixir-dream-wheels-ai-5b0e.twc1.net
- Production candidate: 283505, https://nickelixir-dream-wheels-ai-774d.twc1.net
- Both initially built from f6ae3bf42a825b5e2e732961c13dc1af2761088b on preset 2801.
- GitHub mapping variables are configured. DNS remains unchanged.
- Provider defaults require explicit Cache-Control: no-cache and disabling SPA fallback. The manual configure operation changes only the two newly approved app IDs, snapshots prior settings, enables gzip/zstd and adds test-only X-Robots-Tag.
- The pinned SDK lacks the reverse_proxy mutation. The operation uses the same PATCH /api/v1/apps/{id} and reverse_proxy schema as the official public Timeweb panel client (common-cloud.ad6824a47dfcc6b1.js / cloud.0ed7ccedba1c1f05.js), authenticated only inside Actions. Never print request headers or token values.

## Verification checkpoint — 2026-11-06

Both app configurations were applied successfully by manual workflow runs 42120310407 (test) and 42120326818 (production candidate). Their pre-change snapshots are retained in those runs. Public DNS is unchanged.

The live verifier passed for both technical origins on exact source f6ae3bf42a825b5e2e732961c13dc1af2761088b: root/catalog page checksums, language/canonical/robots policy, application links, HTML revalidation and 265 static resource HTTP/MIME checks per site. `/catalog` returns 308 to `/catalog/`; an unknown route returns HTTP 404 with the bridge page. Catalog vehicle selection was verified in the deployed browser.

Owner no-VPN acceptance has NOT passed: MacBook screenshot reports DNS_PROBE_FINISHED_NO_INTERNET. Do not switch RU DNS based on server checks. Public DNS resolves the test technical hostname to 178.209.127.53, the same IP as app.dream-wheels.ru. A direct-IP HTTPS request with the correct hostname and normal certificate verification returns the expected test version. This does not establish browser/mobile network availability; compare the existing application and the new hostname on the same MacBook, and the new hostname on Android mobile Internet. No system DNS/VPN settings were changed by this task.

Next: resolve this network acceptance failure, obtain successful owner no-VPN acceptance and explicit DNS switch confirmation, attach the RU hostnames to the production candidate and apply the saved rollback-aware DNS plan. Keep EN Vercel unchanged. Request-limit configuration remains optional and should be revisited after rollout.

## Owner network acceptance — 2026-11-06

The owner subsequently confirmed that both the application and landing work without VPN on Android and MacBook. The earlier failed screenshot is retained as diagnostic history; the network acceptance gate is now passed. Production candidate still serves f6ae3bf42a825b5e2e732961c13dc1af2761088b with profile landing-ru-production.

Prepared DNS switch (NOT applied): attach dream-wheels.ru and www.dream-wheels.ru to Timeweb app 283505, replace apex A 216.198.79.1 with 178.209.127.53, and replace www CNAME aef97379b8e88c90.vercel-dns-017.com. with nickelixir-dream-wheels-ai-774d.twc1.net.; retain TTL 600 and canonical www with apex redirect. Provider domain attachment may automatically update DNS, so it belongs to the explicitly approved switch step, not read-only preparation.

Before applying, recheck conflicting A/AAAA/CNAME records at the DNS provider. After applying, verify TLS for both hostnames, apex redirect, root/catalog/assets, old app/t links and EN Vercel read-only. Rollback records remain in dns-before-timeweb-20261106.json. Await the owner's explicit DNS switch confirmation; do not treat the successful network test as that confirmation.
