# Dream Wheels AI — Landing

Static Astro landing and interactive catalog, isolated from the existing WebApp.

## Development and validation

```bash
cd landing
npm install
npm run dev
npm run check
npm test
npm run build
npm run build:domains
```

Local language previews: `/ru/`, `/ru/catalog`, `/en/`, `/en/catalog`. Preview pages carry `noindex,follow`. Public paths are `/` and `/catalog`.

## Two domain artifacts

`build:domains` builds `dist-domains/ru` for `https://www.dream-wheels.ru` and `dist-domains/en` for `https://dreamwheels.pro`. Each directory is independently deployable static output; no runtime middleware is required for its language. Root HTML, islands and metadata use the same build locale, regardless of browser language or query override. `dist-domains/manifest.json` records public-page checksums. Nothing is uploaded by this command.

The shared header/footer use clean public paths and language-prefixed local preview paths. The locale switch preserves the equivalent page, hash and approved attribution keys. Production middleware remains available for hosting that supports it; it does not intercept application/API paths.

Catalog examples use the current final assets and data. Compatibility statuses remain `unknown`; no new verdict is inferred. B2B is an explicitly labelled demo and does not submit requests. Application handoff, authentication, generation and CRM integration are deferred.

See `../docs/landing/ru-en-sync-acceptance.md` and `../docs/landing/ru-en-publication-runbook.md`. Local preparation does not establish production readiness or change domains, routing, DNS or hosting.
