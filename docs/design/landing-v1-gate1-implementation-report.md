# Dream Wheels Landing V1 — Gate 1 implementation report

Status: `GATE_1_IMPLEMENTED = YES`
Visual approval: `GATE_1_VISUAL_APPROVAL = USER_REVIEW_REQUIRED`
Merge: `NO`
Deploy: `NO`

## Scope

Implemented only the first Landing surface:

- overlay Header;
- full-bleed Hero;
- Mini Catalog with vehicle rail, wheel selector, Garage media plane and technical rail.

Sections below Mini Catalog are no longer rendered on the Gate 1 route. Gate 2, mobile redesign, final photography, production wheel renders, Garage compositor, fitment verification, merge and deploy were not performed.

## Changed files

- `landing/src/pages/index.astro`
- `landing/src/layouts/Layout.astro`
- `landing/src/components/MiniCatalog.tsx`
- `landing/src/styles/global.css`

The existing Preact state model, five vehicles, wheel switching, favorites, attribution-preserving CTA and analytics abstraction were retained. `DESIGN.md` and `PRODUCT.md` were not changed.

## Geometry QA

Measured in the in-app browser at `1024 × 768` CSS px after render:

| Element | Rendered | Reference direction | Result |
| --- | ---: | ---: | --- |
| Hero | 1024 × 379 | 1024 × ~372 | Minor |
| Header/content gutter | 51 px | ~51 px | Match |
| Hero copy block | 236 px wide | ~220–240 px | Match |
| Hero media field | x=256, 768 px wide | x≈252, ~772 px | Match |
| Catalog | 1024 × 376 | 1024 × ~372 | Minor |
| Vehicle rail | 188 px wide | ~188 px | Match |
| Wheel carousel | x=260, 454 px wide | x≈311, ~580 px in source composition | Major, constrained by available mock data/layout |
| Garage plane | 454 × 198 px | broad faded plane, not a visible card | Intentional implementation approximation |
| Technical rail | 238 px wide | ~238 px | Match |

The Garage plane is open to the page field with fades and no rounded image container. Its DOM box is only a layout anchor; the visual treatment is blended into the dark field.

## Visual QA

Captured a desktop browser screenshot in the Codex in-app browser at `1024 × 768`. The screenshot was inspected against the approved `zeekr-styled-landing.png` reference and the reconstruction measurements.

### Comparison ledger

| Area | Result | Notes |
| --- | --- | --- |
| Geometry | Mostly aligned | 5% gutter and simultaneous catalog rails now match the reference structure. |
| Typography | Aligned directionally | IBM Plex Sans is used for all product/editorial/technical text; Inter Tight is restricted to action controls. |
| Image dominance | Partial | Existing mock garage photography remains temporary and is not a final Zeekr production asset. |
| Alignment | Match for Gate 1 skeleton | Header, hero copy, vehicle rail and technical rail share reference gutters. |
| Visual density | Improved | The previous padded shell/card layout is replaced by a compact editorial composition. |
| Color | Match directionally | Canvas is `#050B0E`; lime is `#C2E823`; orange is removed from Gate 1. |
| Selection treatment | Match | Active items use tonal emphasis and a compact lime marker/rule, not a full lime card outline. |
| Technical rail | Match directionally | Values are inline and the compatibility state is visibly separate from the visual stage. |
| Interaction | Pass | Vehicle, wheel, favorite and attribution logic verified in-browser. |

### Known discrepancies

- The repository contains only three mock wheel assets, so three wheel cells render instead of the reference's five visible product cells.
- Existing vehicle images are rectangular mock garage scenes, not final isolated vehicle crops or approved production compositing assets.
- The mock car scene is reused for the Hero and Garage plane; production should replace this with dedicated Hero and catalog assets.
- The browser screenshot is a Gate 1 implementation check, not a visual approval or pixel-perfect recreation of the supplied raster.

## Functional QA

Verified in the browser:

- page loads with meaningful Header, Hero and Catalog content;
- all five vehicle controls are present;
- BMW X5 selection updates the catalog title and stage image;
- Mesh 02 wheel selection updates name and technical values to `R20 / 9J / 5×112 / ET40 / 66.6`;
- favorite control toggles to “Удалить из избранного” and persists through the existing localStorage path;
- CTA links are passed through the existing attribution helper;
- keyboard-visible focus remains independent from selected-state styling;
- no browser console errors were observed during the tested flow;
- reduced-motion CSS remains present.

Commands passed:

```text
npm run check
npm test
npm run build
```

Results: Astro check 0 errors / 0 warnings; 4 tests passed; production build completed successfully.

## Typography loading

The implementation requests only the approved families and required roles:

- IBM Plex Sans: 300, 400, 500, 600;
- Inter Tight: 500, 600.

The Google Fonts CSS response measured 927 bytes in the QA environment. Browser font state confirmed the used IBM Plex Sans weights loaded and Inter Tight 600 loaded for the action role. Individual cross-origin font-file transfer sizes were not exposed by the in-app browser's resource-timing surface, so final production transfer-size accounting remains a Gate 1 follow-up before self-hosting/deployment.

## Temporary/mock assets

- `/assets/mock/zeekr-001.webp`
- `/assets/mock/bmw-x5.webp`
- `/assets/mock/mercedes-gle.webp`
- `/assets/mock/li-auto-l7.webp`
- `/assets/mock/geely-cityray.webp`
- `/assets/mock/wheel-a.webp`
- `/assets/mock/wheel-b.webp`
- `/assets/mock/wheel-c.webp`

No large “MOCK” label was added to the Hero. A small `MOCK ASSET` provenance marker remains in the Catalog stage to keep temporary data explicit during review.

## Final status

Gate 1 is implemented and ready for user visual review. Do not proceed to Gate 2, merge or deploy until that review is complete.
