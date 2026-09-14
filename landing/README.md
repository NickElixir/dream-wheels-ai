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
