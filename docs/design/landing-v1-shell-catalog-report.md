# Dream Wheels AI — Landing V1 Shell + Mini Catalog report

## Branch and scope

- Branch: `feature/landing-v1-shell-catalog`
- Base: current `origin/staging` (`dev` is local-only and has no `origin/dev` ref)
- Commit: `4a086ce feat(landing): add v1 shell and mini catalog`
- Existing `webapp/` was not modified.
- No production deploy, merge or PR was performed.
- The experimental `feature/editorial-garage-pipeline` branch was not merged and its draft composites are not consumed.

## Implemented

The new `landing/` directory is a standalone Astro static build with the requested sections: header, hero, Mini Catalog, two-question split, how-it-works, video placeholder, Before/After, primary CTA, FAQ, social follow and footer.

Mini Catalog is the primary interactive surface. It includes five catalog vehicles and three mock wheel variants per vehicle, vehicle switching, wheel switching, specs, an explicit preliminary compatibility state, favorites in versioned localStorage, and restrained image crossfade. The component consumes ordinary `variant.image.src` values, so approved Garage/CDN images can replace mock assets without changing UI architecture.

## Architecture decisions

- Astro static output with no SSR or server islands.
- Preact is used only for Mini Catalog and Before/After interactions.
- Catalog data is isolated in `src/data/catalog.ts`; JSX does not contain vehicle or wheel entities.
- `src/lib/analytics.ts` is the only event abstraction. It emits a custom event and can forward to an existing `ym` provider without coupling the landing to a provider.
- CTA links preserve `utm_*` and `market` query parameters and target `https://dreamwheels.pro/app/new`.
- The page defaults to English for `dreamwheels.pro`; domain-based RU/EN copy can be added through a copy map without introducing `/ru`, `/en`, locale detection or cookies. No locale switcher was added.
- Mock media is lightweight WebP and lives under `public/assets/mock/`. No Garage master or draft mask is used.

## Routes and boundaries

The landing build owns `/`. The existing WebApp route tree remains in `webapp/`. The requested Release 1 boundaries remain the integration contract: `dreamwheels.pro/app/**` for WebApp, `dreamwheels.pro/t/**` for Telegram WebApp and `dreamwheels.pro/api/backend/**` for the gateway. A future hosting change must map only the landing domain to this static build.

## Responsive decisions

Desktop keeps the car visual as the dominant right-side stage and places selectors/specs in an editorial rail. Below 900px, the stage becomes full-width, selectors remain horizontally scrollable, and details move below the visual. Below 560px, navigation simplifies, CTA remains visible, step content stacks, and Before/After keeps a touch-sized range input. Focus states, semantic buttons, `details` FAQ, alt text, reduced motion and keyboard slider interaction are included.

## Tests and build

- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm test`: 4 passing tests covering catalog counts/default data, invalid IDs, favorites recovery/toggle behavior and CTA attribution filtering.
- `npm run build`: passed; static output generated at `landing/dist/`.
- Browser console: no errors or warnings in the local QA session.
- Browser QA: mobile-sized viewport 514×619 and emulated desktop viewport 1309×818 CSS px.
- Core interaction path verified: vehicle switch → wheel switch → favorite toggle → Before/After keyboard movement.

## Known limitations and intentional deviations

- The built-in visual concept generator was unavailable due to a network error, so the implementation follows the explicit approved text brief and existing Dream Wheels editorial references rather than an accepted generated concept screenshot. No CLI/API fallback was invoked because it would require an explicit provider/key choice.
- The hero, catalog stage, Before/After and thumbnails are clearly marked mock/reference media. They are not final showcase assets and do not claim fitment verification.
- Video sources are reserved as WebM/MP4 paths with poster and lazy loading, but no production video was added.
- Social links are explicit placeholders until official channels are confirmed.
- Full RU copy is not included in this milestone; the domain-based structure is ready for a future content map.
- Browser visual screenshot inspection was performed inline; no visual concept screenshot was available for a direct side-by-side comparison.

## Not performed by design

No final vehicle selection, wheel selection, fitment validation, Dream Wheels render generation, SAM2 segmentation, production masks, Garage compositing, Mux, CMS, payment/auth redesign, WebApp rewrite, production deployment, merge or PR was performed.
