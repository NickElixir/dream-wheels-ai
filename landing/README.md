# Dream Wheels AI — Landing V1

Standalone Astro static landing shell and Mini Catalog. This directory is intentionally isolated from the existing Telegram WebApp in `../webapp/`.

## Local development

```bash
cd landing
npm install
npm run dev
```

Checks:

```bash
npm run check
npm test
npm run build
```

The catalog uses mock assets in `public/assets/mock/`, marked in the UI and data model as mock-only. Replace `variant.image.src` later with approved CDN/object-storage assets without changing the interaction layer.

The static Landing owns `/` and `/catalog` behind the front door. Existing `/app/**`, Telegram WebApp `/t/**`, and `/api/backend/**` requests continue through the separate WebApp rewrites.

## RU / EN two-domain candidate

The Landing and Catalog share Astro/Preact components and use the typed dictionaries in `src/i18n/`. Locale is a build-time page prop, so all HTML, metadata, and interactive islands use the same language without a client-side flash. Static output is preserved.

- Current production still serves RU at `/` and `/catalog` on `dreamwheels.pro`. This branch is preview-only and must not be promoted until domain and legal gates pass.
- The candidate sets `domainI18nEnabled` to `true`. Root-level Vercel Routing Middleware rewrites only `/` and `/catalog` internally to the pre-rendered `/en/`, `/en/catalog`, `/ru/`, or `/ru/catalog` page according to the request host. The visible URL stays clean and Astro remains static.
- Direct `/en/` and `/ru/` preview paths receive an `X-Robots-Tag: noindex, follow` middleware response header. The clean public paths have locale-specific canonical and RU/EN/x-default hreflang tags.
- `resolveLocale()` supports Unicode/punycode hostname resolution and a deterministic RU fallback. `getLocalizedUrl()` maps equivalent public routes to `dreamwheels.pro` and `колесамечты.рф`, preserving query parameters other than the preview-only `locale` override.
- The candidate can be tested on a protected Vercel preview URL with `x-dw-candidate-host: dreamwheels.pro` or the punycode form of `колесамечты.рф`. This override is accepted only on `.vercel.app` preview deployments (`VERCEL_ENV=preview`), never on production or a custom domain.
- The existing `/app/**`, `/t/**`, and `/api/backend/**` rewrites are unchanged and outside the middleware matcher.
- CTA handoff stays at `/app/new`; on the future RU domain it uses the same origin. WebApp locale handling is a separate release.

The current legal links lead to Russian-only Privacy Policy and Public Offer pages. EN labels explicitly say “(Russian)”; an approved English legal release is a blocker for public EN cutover. This candidate does not change DNS, Vercel domain assignments, production routing, WebApp, or backend.
