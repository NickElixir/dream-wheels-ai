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

The static route is `/`. Hosting must route only the landing domain to this build; existing `dreamwheels.pro/app/**`, Telegram WebApp and backend gateway routes remain outside this directory.

## RU / EN foundation

The Landing and Catalog share Astro/Preact components and use the typed dictionaries in `src/i18n/`. Locale is a build-time page prop, so all HTML, metadata, and interactive islands use the same language without a client-side flash. Static output is preserved.

- `/` and `/catalog` are the current RU production pages. They remain Russian on `dreamwheels.pro` and keep that domain as their canonical URL.
- `/en/`, `/en/catalog`, `/ru/`, and `/ru/catalog` are static preview pages. They carry `noindex` while `domainI18nEnabled` is `false`. They let the language switcher preserve the equivalent route and query string before the RU domain is connected.
- `resolveLocale()` supports Unicode/punycode hostname resolution and a deterministic RU fallback. The hostname mapping is prepared but deliberately inactive for the public routes.
- `getLocalizedUrl()` centrally maps each public path to `dreamwheels.pro` or `колесамечты.рф`. Preview pages expose the future self canonical and RU/EN/x-default hreflang pair for validation, but remain non-indexable.
- CTA handoff stays at `/app/new`; on the future RU domain it uses the same origin. WebApp locale handling is a separate release.

The static build cannot serve distinct HTML for two hostnames at the same URL without host-aware front-door routing. For the later domain cutover, first review EN copy and legal destinations; then configure host-specific rewrites for `/` and `/catalog` to the corresponding pre-rendered locale pages, enable `domainI18nEnabled` in `src/i18n/config.ts`, and validate canonical/hreflang, language switching, and `/app/**`, `/t/**`, `/api/backend/**` on a candidate. The flag alone does not activate hostname routing. This foundation does not modify Vercel routing or DNS.
