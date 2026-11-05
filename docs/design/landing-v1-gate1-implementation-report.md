# Dream Wheels Landing V1 — Gate 1 cleanup before approval

Status: `GATE_1_CLEANUP = COMPLETE`
Visual approval: `GATE_1_VISUAL_APPROVAL = USER_REVIEW_REQUIRED`
Wheel carousel arrows: `REMOVED`
Merge: `NO`
Deploy: `NO`

## Scope

This report records the Gate 1 cleanup and subsequent approved Landing integrations. The original cleanup changes only Header, Hero and Mini Catalog; the later Two Questions integration adds one production editorial section directly after the Mini Catalog. Neither pass starts Gate 2 or redesigns the existing Landing.

- Hero is one photographic composition with a soft left-to-right black gradient; its media now continues behind copy with no hard panel boundary.
- Hero keeps only the headline and primary CTA; the supporting copy and benefit statements are removed.
- Catalog begins directly with vehicle and wheel selectors. The editorial intro and wheel-count label are removed.
- Catalog exposes five `102 × 90 px` desktop wheel cells. Two cells are QA-only previews based on existing temporary wheel images; they are disabled and do not become production catalog variants.
- Wheel carousel arrows are removed because all five showcase cells fit simultaneously. No disabled controls, placeholders or pagination dots replace them.
- Catalog selection remains tonal and text/image based; previously removed lime selection circles, outlines, side stripes and bottom rules are not reintroduced.
- The Garage media plane is unframed and faded into the page field. No mock/provenance label is rendered in the UI.
- Landing exposes only the compact favorite control for a selected wheel; it does not advertise details, comparison or 3D viewing.

No WebApp capability, production asset, fitment verification, mobile redesign, Gate 2 work, merge or deploy was changed.

## Approved Hero copy provenance

**[APPROVED PRODUCT COPY]** The production Hero currently renders `Добро пожаловать` / `Dream Wheels`, followed by `Посмотрите выбранные диски` / `на своём автомобиле`; it keeps the right caption `ВАШ АВТОМОБИЛЬ` / `ВАШИ ДИСКИ` / `ВАША УВЕРЕННОСТЬ`, the primary CTA `Попробовать` and note `Первые 3 примерки бесплатно`. The Header exposes only `Войти`. This copy is user-approved and must not be replaced by older English or raster-derived formulations in later reconstruction, QA or integration passes.

## Hero final integration checkpoint

`HERO_DESKTOP_DIRECTION = APPROVED_85SVH`

`HERO_DESKTOP_COMPOSITION = TEXT_LEFT_VEHICLE_RIGHT`

`HERO_STATIC_SCENE = GEELY_MONJARO_REFINED_CANDIDATE`

`HERO_ANIMATION = DEFERRED`

`HERO_MOBILE_DIRECTION = TEXT_TOP_VEHICLE_BOTTOM`

`HERO_MOBILE_ASSET = PENDING`

The production Hero now uses `/assets/mock/hero-geely-monjaro-refined.png`, a 1672 × 941 derivative of the supplied Monjaro scene. The desktop direction uses a bounded 85svh composition; tablet remains desktop-like, while the current master asset is responsively cropped on mobile until a dedicated mobile companion is approved. The image keeps the left copy zone calm and the vehicle on the right. CSS adds only a local left-side readability gradient; no full-width bottom haze or CSS-generated vehicle grounding shadow is used.

Status remains `GATE_1_VISUAL_APPROVAL = USER_REVIEW_REQUIRED`; this pass is an integration checkpoint, not final approval.

## Satin Lime Metal CTA production pass

The Landing uses a hybrid CTA system. Hero `Попробовать` retains `Satin Lime Metal`: restrained vertical lime gradient, upper material reflection, deeper lower edge, soft radial perimeter falloff and short dense downward shadow. Compact Header `Войти` uses `Dark Graphite Tactile`: a cool graphite gradient, near-white text, restrained top reflection and short shadow. Both preserve short tactile hover/pressed response and neutral light keyboard focus. Arrows remain absent.

`PRIMARY_CTA_MATERIAL = SATIN_LIME_METAL`

`HEADER_LOGIN_CTA = DARK_GRAPHITE_TACTILE`

`CTA_ARROWS = REMOVED`

`CTA_SYSTEM = HYBRID`

`CTA_HYBRID_SYSTEM = USER_REVIEW_REQUIRED`

## Documentation update — catalog materiality and vehicle direction

This documentation-only follow-up records the latest design decisions from the materiality auditions. It does not change the Gate 1 implementation described below.

**[APPROVED DESIGN]** Landing V1 uses dark tactile materiality to explain interaction state, not as decoration. The approved Refined B4 wheel tile keeps the current square geometry and labels, uses a dark brushed-metal outer surface with a softly deeper perimeter and a very subtle top highlight, and places the fully visible wheel on a cool-grey blurred rectangular backdrop. The backdrop is slightly darker than near-white, transitions without a visible seam, and has no halo/glow. A restrained local wheel shadow is permitted; photographic vehicle grounding remains asset-provided.

**[APPROVED DESIGN]** The current neutral selected wheel frame remains allowed. Selected image and label retain full contrast; lime dots, lines, lime outlines and lime-filled selected states are rejected for Landing selectors. The selected-wheel action remains Favorites only.

**[APPROVED DESIGN]** Wheel background removal is preferred preprocessing for production showcase assets, and wheel geometry, finish, logo and design identity must be preserved.

`WHEEL_BACKGROUND_REMOVAL = PREFERRED PREPROCESSING`

`WHEEL_DESIGN_IDENTITY = MUST BE PRESERVED`

**[PROPOSED]** Vehicle selectors may use compact tactile rows around 8 px radius. A model-specific isolated side-profile thumbnail is a candidate direction, not an approval: it must be auditioned against the current 3/4 photo with identical geometry, text, material and selection state.

`VEHICLE_THUMBNAIL_DIRECTION = USER_APPROVAL_REQUIRED`

**[OPEN]** Current audition wheel names/assets remain QA/design fixtures only. The production wheel shortlist, real catalog data, fitment verification, final vehicle thumbnails, final Hero/Garage assets and universal WebApp materiality remain open.

`SHOWCASE_WHEELS_SHORTLIST = NOT YET CREATED`

`REAL_CATALOG_DATA = NOT YET INTEGRATED`

`FITMENT_VERIFICATION = NOT YET COMPLETE`

## Changed files

- `landing/src/pages/index.astro`
- `landing/src/components/MiniCatalog.tsx`
- `landing/src/styles/global.css`
- `DESIGN.md`
- `docs/design/landing-v1-reference-reconstruction.md`
- this report

Existing vehicle/wheel state, favorites, attribution, analytics, keyboard controls and reduced-motion behaviour remain intact.

## Fixed-width visual QA

Environment: in-app browser, local Landing route, `1024 × 768` CSS px. The comparison inspected the source top region `x=0–1024`, `y=0–744` and the rendered Header + Hero + Catalog at the same normalized width.

### Geometry discrepancy table

| Element | Reference | Rendered | Delta / result |
| --- | ---: | ---: | --- |
| Hero height | 372 px | 372 px | Match |
| Hero copy x | ~52 px | 51 px | −1 px |
| Hero H1 top | ~86 px | 85 px | −1 px |
| Hero H1 width | ~220–240 px | 240 px | Match |
| Hero CTA | x≈52, y≈311, 207×33 | x=51, y=307, 207×32 | within 4 px |
| Header/content gutter | ~51 px | 51 px | Match |
| Catalog y / height | 372 / 372 px | 372 / 372 px | Match |
| Vehicle rail x / width | ~51 / 188 px | 51 / 188 px | Match |
| Wheel selector | x≈311, y≈411, 580×90 | x=311, y≈412, 580×90 | five cells retained; arrows removed |
| Wheel cells | five, 102×90 px | five, 102×90 px | Match |
| Garage plane anchor | broad/faded, begins below carousel | x=311, y=504, 580×240 px; visible image fades from x=176 | Intentional non-card implementation |
| Spec content origin | x≈734, y≈524 | x=735, y=520 | within 4 px |
| Spec rail width | ~238 px | 238 px | Match |

### Fidelity ledger

| Area | Reference evidence | Pass 2 result |
| --- | --- | --- |
| Hero media treatment | One photographic field behind Header/copy | Implemented with a continuous image and soft black gradient; no opaque left panel. |
| Hero copy | User-supplied NIO copy | Eyebrow, H1 and CTA remain; supporting body and benefit statements are intentionally removed. |
| Catalog geometry | Wheel carousel above car and spec rail | Implemented at reference x/y/width, with five visible cells and no navigation arrows. |
| Selection | User-approved tonal lift | Implemented for vehicles and wheels; no lime circle, line, outline or fill. |
| Catalog hierarchy | Car/Garage should lead selector chrome | UI borders reduced and Garage plane is unframed; temporary image still limits the side-profile silhouette match. |
| Technical rail | Compact factual rail | Implemented with requested copy, technical values, qualified status and the compact favorite control only. |

### Remaining discrepancies — not visually approved

- **MAJOR — temporary garage imagery:** existing source images are front/three-quarter mock garage scenes, not the approved low side-profile vehicle assets. Their car silhouette and reflection cannot match the raster precisely without creating or selecting final assets, which is out of scope. Without a CSS grounding shadow, any imperfect vehicle/floor contact remains a temporary asset limitation and is intentionally not compensated in production CSS.
- **MINOR — QA-only wheel cells:** `SVR Auto 04` and `SVR Auto 05` use selected temporary source images from `images/svrauto_wheels` to provide the required five-cell QA composition. They are disabled and are not production catalog data.

The presence of these major asset/composition discrepancies means this pass is **not** marked visually approved.

## Functional QA

Verified in the browser:

- local route loaded with meaningful Header, Hero and Catalog content;
- BMW X5 selection updated the selected vehicle and Garage image;
- Mesh 02 selection updated values to `R20 / 9J / 5×112 / ET40 / 66.6`;
- existing favorite state remained available;
- QA-only wheel previews are disabled and cannot alter catalog selection;
- wheel carousel arrows are absent and all five wheel cells remain visible;
- selected-wheel action is limited to the favorite control;
- no browser console warnings/errors were observed;
- selection/focus remain separate and reduced-motion CSS remains active.

Commands passed:

```text
npm run check
npm test
npm run build
git diff --check
```

Result: Astro check has 0 errors/0 warnings; all 4 tests pass; static build completes.

## Temporary assets

- `/assets/mock/zeekr-001.webp`
- `/assets/mock/bmw-x5.webp`
- `/assets/mock/mercedes-gle.webp`
- `/assets/mock/li-auto-l7.webp`
- `/assets/mock/geely-cityray.webp`
- `/assets/mock/wheel-a.webp`
- `/assets/mock/wheel-b.webp`
- `/assets/mock/wheel-c.webp`
- `/assets/mock/wheel-svrauto-04.jpg`
- `/assets/mock/wheel-svrauto-05.jpg`

Temporary-asset provenance is documented here only; no mock/provenance label is shown in the Landing UI.

## Mini Catalog Production Integration

**[APPROVED DESIGN]** Production Mini Catalog now uses `MINI_CATALOG_LAYOUT = WIDE_GARAGE_BOTTOM_SPECS` and `BOTTOM_SPECS_MATERIALITY = GROUPED_METAL_STRIP`. The vehicle selector retains the approved profile avatars and tactile rows; wheel tiles retain the Refined B4 square treatment; the right spec rail is replaced by a wide Garage followed by title/favorite, one grouped metal strip, and a separate flat compatibility status.

### Vehicle selector brightness pass

Vehicle rows now use the `TACTILE_WITH_SOFT_HORIZONTAL_HALO` direction: profile avatars are increased inside unchanged row height, their local cool-grey horizontal halo lifts them from a slightly brighter graphite surface, and labels gain restrained contrast. Selected, hover and pressed states use tonal material response only. Wheel tiles, Garage, specs, compatibility, catalog data, selection logic, routing and analytics are unchanged.

`VEHICLE_SELECTOR_STYLE = TACTILE_WITH_SOFT_HORIZONTAL_HALO`

`VEHICLE_AVATAR_SCALE = INCREASED`

`VEHICLE_SELECTOR_HIERARCHY = SECONDARY_TO_WHEEL_SELECTOR`

`VEHICLE_SELECTOR_REFINEMENT = USER_REVIEW_REQUIRED`

### Mini Catalog final polish and provisional freeze

Vehicle avatars remain transparent cutouts with no frame. On wide desktop, the lower specs strip, compatibility status and disclaimer are now a left-aligned `820px` maximum-width result-information island; title and favorite still follow the full Garage width. Selector controls now have `clamp(30px, 3vw, 38px)` of breathing room before the Garage result, reducing to `24px` on mobile. The Catalog background is the subtly lighter cool graphite `#071013`, providing tonal section separation without a divider, wrapper or Hero change.

`VEHICLE_AVATAR_FRAME = NONE`

`CATALOG_RESULT_INFO = MAX_WIDTH_CONSTRAINED`

`CATALOG_CONTROL_RESULT_SPACING = INCREASED`

`CATALOG_SECTION_TONAL_SEPARATION = ENABLED`

`MINI_CATALOG_LAYOUT = PROVISIONALLY_FROZEN`

Final asset-level polish is deferred until `SHOWCASE_WHEELS_SHORTLIST + REAL_CATALOG_DATA`.

This integration preserves current mock catalog data, Garage assets, fitment logic, favorite behavior, analytics events, Hero/Header, routing and all non-Landing/WebApp functionality. No real wheel shortlist was selected. Vehicle grounding remains asset-provided; no CSS grounding shadow or floor vignette was added.

Responsive QA target is sequential on tablet and mobile: vehicle selector, square wheel grid, wide Garage, grouped specs and compatibility status. Production audition routes remain available as historical references and were not deleted.

## Two Questions — production integration

Landing now places one full-viewport editorial section after the provisionally frozen Mini Catalog. It distinguishes visual try-on from checking compatibility by parameters without introducing cards, UI diagrams or technical guarantee language.

- Desktop uses a `55/45` image-led split, a dark tonal bridge instead of a hard seam, and a `clamp(720px, 90svh, 1040px)` height.
- The left scene uses the supplied orange Zeekr 001 case and the two-level approved caption `Race Ready Technology CSS3347` / `8,5/19" 5x108 ET45 DIA63,4 MK/M`; desktop favors the front three-fifths of the vehicle, while mobile shifts the crop toward the front wheel, hood and front door.
- The right scene uses the supplied polished vertical 4:5 workshop asset (`workshop-fitment-vertical.png`). Its inherent upper text-safe zone keeps mechanical action below the heading; the local text mask is correspondingly weaker and fades before the loose wheel, hub and rotor.
- Portrait tablet and mobile become sequential cinematic scenes, each bounded to `clamp(560px, 78svh, 760px)`, with a short vertical tonal cut instead of the desktop bridge.
- Editorial labels read `SYSTEM 01` and `SYSTEM 02`; the former shared explanatory line is removed because the two scenes now carry the distinction themselves.
- Both headings use one responsive type token: desktop `clamp(52px, 4.3vw, 78px) / .88 / -.045em / 600`, mobile `clamp(38px, 10.5vw, 52px) / .88 / -.045em / 600`. Zeekr uses a front-half crop that retains the front wheel, hood, headlight and bumper breathing room before the bridge.
- Both images retain explicit intrinsic dimensions and lazy loading. The supplied source formats are delivered as JPEG (887 × 665) for the visual case and PNG (1672 × 941) for the workshop scene; this repository currently serves static public assets rather than an Astro derivative pipeline.

`TWO_QUESTIONS_LAYOUT = FULL_VIEWPORT_EDITORIAL_SPLIT`

`TWO_QUESTIONS_DESKTOP_RATIO = 55_45`

`TWO_QUESTIONS_MOBILE = SEQUENTIAL`

`HOW_IT_LOOKS_CAR = ZEEKR_001_ORANGE`

`TWO_QUESTIONS_LABELS = SYSTEM_01_SYSTEM_02`

`TWO_QUESTIONS_BRIDGE = DARK_TONAL_BRIDGE`

`TWO_QUESTIONS_GLOBAL_EXPLANATION = REMOVED`

`HOW_IT_LOOKS_PRODUCT = Race Ready Technology CSS3347`

`HOW_IT_LOOKS_SPECS = 8,5/19" 5x108 ET45 DIA63,4 MK/M`

`COMPATIBILITY_TERM = "проверка совместимости по параметрам"`

`PRELIMINARY_COMPATIBILITY_TERM = DEPRECATED`

`TECHNICAL_WHEEL_VISIBILITY = SOURCE_BRIGHTNESS_PRESERVED`

`TWO_QUESTIONS_WORKSHOP_ASSET = POLISHED_VERTICAL_4_5`

`TWO_QUESTIONS_HEADINGS = UNIFIED_TYPOGRAPHY`

`TWO_QUESTIONS_DESKTOP_SPLIT = APPROX_55_45`

`HOW_IT_LOOKS_CROP = FRONT_HALF_FOCUS`

`HOW_IT_LOOKS_BUMPER_BREATHING_ROOM = ENABLED`

`TECHNICAL_TEXT_SAFE_AREA = PRESERVED`

`TECHNICAL_ACTION_POSITION = LOWER_FRAME`

`TWO_QUESTIONS = USER_REVIEW_REQUIRED`

`SYSTEM_01_HEADING = КАК БУДУТ СМОТРЕТЬСЯ?`

`SYSTEM_01_BODY = Оцените конкретные диски на своём автомобиле.`

`SYSTEM_LABELS = SYSTEM_01_SYSTEM_02`

`TWO_QUESTIONS_BODY_TYPOGRAPHY = UNIFIED`

`HOW_IT_LOOKS_PRODUCT_NAME = Race Ready Technology CSS3347`

`HOW_IT_LOOKS_SPEC_FORMAT = CANONICAL_RU_WHEEL_NAMING`

`HOW_IT_LOOKS_SPEC_STYLE = TECHNICAL_SECONDARY`

`TWO_QUESTIONS_BRIDGE = UNCHANGED`

## Final status

`GATE_1_VISUAL_APPROVAL = USER_REVIEW_REQUIRED`

`PRODUCTION_LANDING_CHANGED = YES`

`CATALOG_DATA_CHANGED = NO`

`GATE_2_STARTED = NO`

`MERGE = NO`

`DEPLOY = NO`

Stop at Gate 1. Do not proceed to Gate 2, merge or deploy.
