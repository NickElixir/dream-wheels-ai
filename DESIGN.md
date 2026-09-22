# Dream Wheels AI — Design System Draft

> **Status:** first system-level design contract draft. It defines reusable visual and interaction rules for Dream Wheels AI; it is not a Landing implementation brief and it does not replace frozen product UI contracts.

## Purpose and authority

`DESIGN.md` answers: **how should Dream Wheels feel and behave as one system across surfaces?** It deliberately abstracts reusable rules from the approved Landing reference without copying Landing V1 coordinates, section heights or page composition.

### Domain-specific public branding

**[APPROVED PRODUCT/DESIGN]** Public branding follows the domain language:

- `колесамечты.рф` is Russian and uses the visible public brand `КОЛЕСА МЕЧТЫ` without an `AI` suffix or English brand subtitle.
- `dreamwheels.pro` is English/global and uses the visible public brand `DREAM WHEELS`.

This rule changes public presentation only. It does not rename repositories, packages, internal identifiers or code namespaces.

**[APPROVED PRODUCT COPY]** The current Russian Landing Hero copy is authoritative: headline «Добро пожаловать» / «Dream Wheels» on two lines; supporting copy «Посмотрите выбранные диски» / «на своём автомобиле»; right caption «ВАШ АВТОМОБИЛЬ» / «ВАШИ ДИСКИ» / «ВАША УВЕРЕННОСТЬ» on three lines; primary CTA «Попробовать» with the note «Первые 3 примерки бесплатно». The header retains only «Войти». Do not restore older raster-derived Hero copy or removed supporting copy.

**[APPROVED PRODUCT COPY]** Hero formulations and elements that the user has already changed or removed must not be automatically reintroduced by later design reconstruction, QA or integration passes. Reference raster remains authoritative for geometry only; current approved production copy has priority for text.

### Hero composition integration checkpoint

**[APPROVED DESIGN / USER REVIEW REQUIRED]** The current Russian Landing Hero uses the refined Geely Monjaro candidate with text left and vehicle right. Desktop follows the `85svh` direction with a bounded `clamp(680px, 85svh, 920px)` minimum-height model; tablet keeps the desktop-like direction, and mobile follows text top / vehicle bottom until a dedicated mobile companion is approved.

`HERO_DESKTOP_DIRECTION = APPROVED_85SVH`

`HERO_DESKTOP_COMPOSITION = TEXT_LEFT_VEHICLE_RIGHT`

`HERO_STATIC_SCENE = GEELY_MONJARO_REFINED_CANDIDATE`

`HERO_ANIMATION = DEFERRED`

`HERO_MOBILE_DIRECTION = TEXT_TOP_VEHICLE_BOTTOM`

`HERO_MOBILE_ASSET = PENDING`

The Hero uses only a local left-side text-readability gradient. Vehicle grounding remains asset-provided; production CSS must not add a drop shadow, radial black shadow, pseudo-element grounding shadow or dark floor vignette beneath the car. The current candidate remains a review checkpoint and must not be described as fully final-approved before user review.

### Satin Lime Metal CTA checkpoint

**[APPROVED DESIGN / USER REVIEW REQUIRED]** The production Landing uses a hybrid CTA system. Hero primary CTA uses `Satin Lime Metal`: a restrained vertical lime gradient with soft internal light, a darker lower edge and subtle peripheral depth; it is neither neon nor glossy plastic. Header login uses `Dark Graphite Tactile`: a compact cool graphite surface with near-white text, a restrained top reflection and a short downward shadow. Keyboard focus for both is neutral light, never lime-on-lime.

`PRIMARY_CTA_MATERIAL = SATIN_LIME_METAL`

`HEADER_LOGIN_MATERIAL = DARK_GRAPHITE_TACTILE`

`CTA_ARROWS = REMOVED`

`CTA_SYSTEM = HYBRID`

`CTA_HYBRID_SYSTEM = USER_REVIEW_REQUIRED`

### Vehicle selector brightness checkpoint

**[APPROVED DESIGN / USER REVIEW REQUIRED]** Vehicle selector rows use a dark tactile graphite surface that is visibly lighter than the page canvas while remaining secondary to wheel tiles. Profile avatars are enlarged within the existing compact row geometry and sit over a local soft horizontal cool-grey halo. The halo is contained inside the avatar zone; it is not a white panel, external glow or a copy of the wheel-tile backdrop. Selected vehicle rows receive modestly brighter material, a slightly stronger halo and near-white label contrast. Hover and pressed states change material depth without lime indicators or avatar scaling.

`VEHICLE_SELECTOR_STYLE = TACTILE_WITH_SOFT_HORIZONTAL_HALO`

`VEHICLE_AVATAR_SCALE = INCREASED`

`VEHICLE_SELECTOR_HIERARCHY = SECONDARY_TO_WHEEL_SELECTOR`

`VEHICLE_SELECTOR_REFINEMENT = USER_REVIEW_REQUIRED`

### Mini Catalog provisional layout freeze

**[APPROVED DESIGN / USER REVIEW REQUIRED]** The Mini Catalog retains frameless transparent vehicle cutouts inside tactile rows. Below the full-width Garage result, specs, compatibility and disclaimer form a left-aligned compact information island with `max-width: 820px` on wide desktop; title and favorite remain aligned to the Garage. The control-to-result gap is `clamp(30px, 3vw, 38px)` on desktop and reduces on mobile. The Catalog uses a subtle cool graphite field `#071013` to signal a change from Hero without a visible divider or page-wide card.

`VEHICLE_AVATAR_FRAME = NONE`

`CATALOG_RESULT_INFO = MAX_WIDTH_CONSTRAINED`

`CATALOG_CONTROL_RESULT_SPACING = INCREASED`

`CATALOG_SECTION_TONAL_SEPARATION = ENABLED`

`MINI_CATALOG_LAYOUT = PROVISIONALLY_FROZEN`

Final asset-level polish is deferred until `SHOWCASE_WHEELS_SHORTLIST + REAL_CATALOG_DATA`.

### Two Questions — full-viewport editorial split

**[APPROVED DESIGN / USER REVIEW REQUIRED]** After the provisionally frozen Mini Catalog, Landing presents the two different Dream Wheels actions as one cinematic editorial spread: visual try-on and checking compatibility by parameters. It is not two SaaS cards and uses no card borders, lime outlines, pseudo-AR or technical diagrams. Desktop starts at a 55/45 visual split; portrait tablet and mobile become a sequential vertical narrative.

`TWO_QUESTIONS_LAYOUT = FULL_VIEWPORT_EDITORIAL_SPLIT`

`TWO_QUESTIONS_DESKTOP_RATIO = 55_45`

`TWO_QUESTIONS_MOBILE = SEQUENTIAL`

**[APPROVED PRODUCT COPY]** The `КАК БУДУТ СМОТРЕТЬСЯ?` case uses the supplied orange Zeekr 001 visual and presents the selected wheel as `Race Ready Technology CSS3347` with the technical caption `8,5/19" 5x108 ET45 DIA63,4 MK/M`. Do not insert decorative `·` separators between technical values.

`HOW_IT_LOOKS_CAR = ZEEKR_001_ORANGE`

`HOW_IT_LOOKS_PRODUCT = Race Ready Technology CSS3347`

`HOW_IT_LOOKS_SPECS = 8,5/19" 5x108 ET45 DIA63,4 MK/M`

**[APPROVED PRODUCT COPY]** The technical half describes `проверка совместимости по параметрам`. It must not imply factual installation compatibility and must not use deprecated preliminary terminology in this section.

`COMPATIBILITY_TERM = "проверка совместимости по параметрам"`

`PRELIMINARY_COMPATIBILITY_TERM = DEPRECATED`

`TWO_QUESTIONS_LABELS = SYSTEM_01_SYSTEM_02`

`TWO_QUESTIONS_BRIDGE = DARK_TONAL_BRIDGE`

`TWO_QUESTIONS_GLOBAL_EXPLANATION = REMOVED`

`TECHNICAL_WHEEL_VISIBILITY = SOURCE_BRIGHTNESS_PRESERVED`

**[APPROVED DESIGN / USER REVIEW REQUIRED]** The technical scene uses the supplied polished vertical 4:5 workshop asset. Both Two Questions headings share one responsive typography token; only their controlled line breaks differ. The orange Zeekr crop centers the front half and preserves visual breathing room between its bumper and the dark tonal bridge.

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

### Source priority

1. Approved product principles and frozen domain/UI contracts
2. Approved Landing screenshot
3. Approved Landing reconstruction specification
4. Structured reference measurements
5. Existing implementation

Existing code can expose technical constraints and current product conventions. It is not the visual authority for future Landing reconstruction.

### Relationship between documents

```text
DESIGN.md
= reusable system-level visual, interaction and accessibility rules

docs/design/landing-v1-reference-reconstruction.md
= page-level Landing V1 geometry and composition

docs/design/landing-v1-reference-measurements.json
= source-raster measurements and confidence labels

docs/product-roadmap.md, docs/fitment-compatibility.md,
docs/ui-design-code.md and frozen Fitment UI contracts
= product, domain, workflow and current-application constraints
```

None of these documents replaces the others. In particular, this draft does not silently override the current canonical [`docs/ui-design-code.md`](docs/ui-design-code.md) or frozen Fitment V2 interaction contract.

### Provenance labels

- **[REFERENCE]** — directly visible in the approved Landing screenshot.
- **[DERIVED]** — generalized from multiple approved reference observations.
- **[PRODUCT]** — follows from product/domain requirements.
- **[APPROVED DESIGN]** — an explicit Dream Wheels design decision that has been reviewed and approved, including deliberate deviations from a visual reference.
- **[ACCESSIBILITY]** — follows from accessibility and inclusive-interaction requirements.
- **[PROPOSED]** — reusable system decision that requires approval before becoming a hard rule.
- **[OPEN]** — not reliably decided by available sources.

## Non-negotiable product meaning

### Visual Try-on is not Technical Fitment

**[PRODUCT]** **Visual Try-on ≠ Technical Fitment.**

- Visual Try-on answers how a selected wheel may look on a vehicle.
- Technical Fitment is a separate preliminary assessment based on structured, confirmed vehicle and wheel data plus deterministic rules.
- A realistic AI render, a product photograph, OCR, an inferred value or a selected visual variant must never be presented as proof of physical compatibility.
- A visual try-on can proceed when Technical Fitment is `unknown` or `incompatible`; technical verdicts must not be used to falsify or block the visual result.

This distinction affects every surface:

- **Result views:** visual result and technical assessment have separate labels, regions and explanations.
- **Status components:** compatibility wording must say what was checked and preserve preliminary qualification where required.
- **CTA:** a visual CTA may invite a try-on; it must not imply installation approval.
- **Color:** green/lime success treatment may describe a positive technical status only when the verdict supports it. It must not decorate a visual render as an implied fitment guarantee.
- **Warnings:** missing/ambiguous technical data produces explicit `unknown`/verification guidance, never manufactured confidence.

## Brand character

### What Dream Wheels should feel like

**[DERIVED]** Premium automotive, dark, editorial, technical, precise, restrained, photographic, modern and confident. The system is minimal without becoming sparse: it makes large automotive imagery and small technical data coexist without turning either into decoration.

The intended feeling is a considered automotive studio—controlled light, strong composition, clear material detail and purposeful interface cues. Product controls should feel exact and calm rather than ornamental.

### What Dream Wheels must not feel like

**[DERIVED]** Dream Wheels must not resemble:

- generic AI SaaS;
- crypto/Web3 marketing;
- cyberpunk or gaming UI;
- a neon dashboard;
- glassmorphism demonstration;
- luxury-fashion art direction that compromises task completion;
- generic e-commerce marketplace.

## Landing V1 catalog materiality

**[APPROVED DESIGN]** Interface physicality explains state and action; it is not a decorative effect. For Landing V1, the approved language is dark tactile material UI: dark tonal surfaces, very restrained physical depth, small hover lift and a mild pressed/selected depression. Photographic automotive content remains visually primary over the interface shell.

This is not classic neumorphism. Landing V1 must avoid:

- oversized soft neumorphic cards;
- glossy skeuomorphism;
- glass everywhere;
- neon;
- decorative glow;
- lime selection indicators by default.

Resend is a reference direction only for restrained dark materiality, tonal surfaces, precise borders/highlights and dense premium interface behaviour. Do not copy its layout, typography, dashboard patterns, brand identity, exact colors or radii.

### Wheel tile — Refined B4: Tactile Showcase

**[APPROVED DESIGN]** The approved Mini Catalog wheel-selector direction is Refined B4:

- square tile using the audition reference implementation size without turning that pixel size into a universal token;
- outer radius about 10–12 px and a dark tactile metal surface;
- outer tile and perimeter slightly deeper than the inner zone;
- nearly imperceptible cool-neutral top highlight;
- restrained brushed/grain texture;
- no bright decorative border in the ordinary state.

The inner zone uses a cool-grey blurred rectangular backdrop with a smaller radius than the tile. Its center is not pure white; it falls softly toward darker edges with no visible seam, inner rectangle edge or halo/glow. The wheel must remain fully visible and may have only a very soft local shadow directly beneath the wheel presentation.

The current refined material pass is approved as a direction, not as a universal WebApp treatment.

### Vehicle selector direction

**[APPROVED DESIGN]** Production vehicle rows use the compact dark tactile-material basis with a moderate radius around 8 px. Inactive/selected states rely on material, photo contrast and text contrast without lime indicators, and rows remain compact selectors rather than large independent cards.

### Vehicle thumbnail direction — model silhouette/profile

**[APPROVED DESIGN]** Production vehicle selectors use model-specific profile or near-side-profile thumbnails instead of random reduced 3/4 photos. All five thumbnails share orientation, visual scale, canvas height and a simple isolated/dark treatment while preserving the recognizable identity and proportions of the exact vehicle generation used in the showcase. This is not a generic vector car icon.

`VEHICLE_THUMBNAIL_DIRECTION = USER_APPROVAL_REQUIRED`

The required audition compares the current 3/4 photo with an isolated side-profile/model-icon candidate using identical tile geometry, text, material and selection state. Compare recognizability, compactness, premium feel, consistency across five cars, generic-configurator risk and fit with Refined B4 wheel tiles before approval.

## Color system

### Semantic roles

**[PROPOSED]** Names below describe roles, not a final CSS variable file. Final numeric values require visual comparison against approved references and contrast validation.

| Token | Role | Intended use |
| --- | --- | --- |
| `--dw-bg-primary` | Page canvas | Primary dark field behind all surfaces |
| `--dw-bg-secondary` | Dark depth | Secondary bands, navigation or lower-emphasis canvas zones |
| `--dw-surface-subtle` | Quiet surface | Purposeful grouped content, compact rows, selected-context support |
| `--dw-surface-interactive` | Interactive surface | Inputs, selectable controls and explicit action regions |
| `--dw-surface-status` | Status surface | Compact warning/positive/unknown context—not decoration |
| `--dw-overlay-photography` | Media overlay | Text legibility over editorial photography |
| `--dw-text-primary` | Primary copy | Headlines, task titles, important values |
| `--dw-text-secondary` | Supporting copy | Body copy, labels and explanatory UI |
| `--dw-text-muted` | Metadata | Low-priority context that remains readable |
| `--dw-border-subtle` | Fine separation | Low-contrast rows, seams and surface boundaries |
| `--dw-border-default` | Interactive boundary | Inputs and ordinary actionable surfaces |
| `--dw-accent-primary` | Primary accent | Scarce conversion/selection/positive-fitment accent |
| `--dw-accent-primary-hover` | Accent feedback | Hover/pressed variant that remains visually calm |
| `--dw-status-positive` | Positive technical status | Supported, preliminary-compatible state with label + icon |
| `--dw-status-warning` | Needs review | Conditional/unknown/incomplete data state with label + icon |
| `--dw-status-negative` | Known conflict/error | Incompatible/failed/blocked status with explanation |
| `--dw-status-neutral` | Informational state | Queue, processing or neutral context |

### Reference anchors and validation

**[REFERENCE]** The approved Landing raster samples approximately as follows:

```text
Canvas ≈ #050B0E
Reference sampled lime ≈ #C2E823
```

These are sampled pixels, **not guaranteed original CSS tokens**. Token values must be finalized through visual comparison to the approved raster and accessibility contrast review. Do not treat an old implementation hex as proof of the final system value.

### Accent usage

**[DERIVED]** Lime is intentional, scarce and high-signal.

Use it for:

- primary conversion CTA;
- small selected marker, preferably a compact dot/indicator;
- restrained tonal emphasis where appropriate;
- compatibility-positive signal only when product evidence supports it;
- small emphasis details with a clear semantic role.

Do not use it for:

- large page backgrounds;
- decorative gradients;
- large decorative typography;
- every interactive element at once;
- a visual try-on image as a proxy for fitment confirmation.

### Landing vs Application accent policy

**[OPEN] DECISION NEEDED:** There is not enough approved product evidence to decide whether Landing and WebApp must use exactly the same lime token and usage ratio.

Two viable options require product/design approval:

1. **Shared token, different density.** Landing and Application share one base accent; Landing uses it more sparingly for conversion/editorial selection, while Application applies it to meaningful primary task actions and focus/selected states. This maximizes recognition while preserving surface character.
2. **Related surface tokens.** Landing uses the raster-matched editorial lime and Application uses a contrast-qualified product lime from the same visual family. This gives application controls more predictable contrast, but risks visible brand drift unless the relationship is calibrated.

## Typography system

**[APPROVED DESIGN]** Dream Wheels uses a restrained two-family typography system. IBM Plex Sans is the approved primary typeface for Landing V1. Inter Tight is approved only as a limited action typeface. This preserves clear display-to-data contrast, a product/editorial/technical voice and a distinct but subordinate action voice.

### Primary family — IBM Plex Sans

Use IBM Plex Sans for:

- Hero/display typography;
- section headings;
- body copy;
- navigation;
- vehicle names;
- wheel names;
- technical values;
- technical labels;
- Fitment/status copy;
- metadata.

Indicative role weights:

- Display / Hero: `300`;
- Major headings: `300–400`;
- Body: `400`;
- Navigation/UI labels: `400–500`;
- Vehicle/wheel names: `500`;
- Technical values: `500–600`;
- Metadata: `400`.

Exact numeric typography tokens remain implementation-calibrated against the approved Landing reference.

### Action family — Inter Tight

Use Inter Tight only for:

- primary CTA labels;
- secondary button labels;
- compact explicit action controls where button typography benefits from a tighter action voice.

Indicative weights: `500–600`.

Do not extend Inter Tight by default to body copy, navigation, selectors, technical data, Fitment text, metadata or editorial headings.

Intent:

```text
IBM Plex Sans = Dream Wheels product/editorial/technical voice
Inter Tight = explicit action voice
```

The two-family system must remain restrained. Do not create additional font roles without a separately approved design decision.

### Rejected directions for Landing V1

The following are rejected for Landing V1 typography:

- Onest as the primary family;
- Golos Text as a secondary system family;
- Commissioner as a secondary system family;
- Roboto Condensed as a button family.

This is a Landing V1 design decision, not a statement that these fonts are intrinsically unsuitable elsewhere.

### Loading requirement

Production must load only the required weights and scripts. Measure actual font transfer size during Gate 1. If Inter Tight introduces disproportionate loading cost relative to its limited usage, flag it for review rather than silently removing it.

| Semantic role | Intended use | Relative scale | Weight | Line-height character | Tracking / casing |
| --- | --- | --- | --- | --- | --- |
| `Display XL` | Editorial Landing hero statement | Largest system role | IBM Plex Sans 300 | Tight, intentional multi-line composition | Slight negative tracking; sentence/title case as content requires |
| `Display L` | Large editorial section statement | Very large | IBM Plex Sans 300–400 | Compact but breathable | Slight negative tracking |
| `Heading L` | Major product or section title | Large | IBM Plex Sans 300–400 | Clear and task-oriented | Neutral to slight negative tracking |
| `Heading M` | Panel, result or major component title | Medium | IBM Plex Sans 300–400 | Compact | Neutral tracking |
| `Heading S` | Subsection/group title | Small-medium | IBM Plex Sans 400–500 | Compact | Neutral tracking |
| `Body L` | Explanatory paragraph | Comfortable reading size | IBM Plex Sans 400 | Relaxed enough for reading | Normal casing/tracking |
| `Body M` | Standard supporting copy | Default product body | IBM Plex Sans 400 | Compact-readable | Normal casing/tracking |
| `Body S` | Dense support copy | Small but readable | IBM Plex Sans 400–500 | Tight but not cramped | Normal casing/tracking |
| `UI Label` | Buttons, form labels, navigation | Compact | IBM Plex Sans 400–500; Inter Tight 500–600 for approved actions | Single-line where practical | Normal casing; avoid gratuitous all caps |
| `Metadata` | Secondary provenance, timestamps, editorial captions | Small | IBM Plex Sans 400 | Compact | Often normal case; lower contrast only when still readable |
| `Eyebrow` | Section index/category/context marker | Small | IBM Plex Sans 400–500 | Single line | Uppercase with deliberate tracking |
| `Technical Value` | R19, 8.5J, PCD, ET, DIA, verdict value | Compact but visually dominant over label | IBM Plex Sans 500–600 | Tabular-friendly | Normal casing; prefer tabular numerals when comparison matters |
| `Technical Label` | Parameter name/source/context | Smaller than value | IBM Plex Sans 400–500 | Compact | Normal casing; never a substitute for an accessible label |

**[ACCESSIBILITY]** Screenshot-measured microtype does not override readable minimums, localization needs or contrast. Application UI must not inherit 9 px editorial text where it harms readability.

## Spacing system

**[PROPOSED]** Use a limited scale rather than screenshot-derived one-off padding.

```text
--dw-space-1: micro
--dw-space-2: tight
--dw-space-3: compact
--dw-space-4: regular
--dw-space-5: medium
--dw-space-6: large
--dw-space-8: extra-large
--dw-space-10: editorial-large
--dw-space-12: editorial-extra-large
```

The numeric base is intentionally open until a common runtime scale is approved. Relative rules are firm:

- **Micro spacing:** icon-to-label, label-to-value and tightly related metadata.
- **Control spacing:** related input/button groups, selected option sets and compact action clusters.
- **Component spacing:** internal padding and gaps that establish a meaningful island, form group or result region.
- **Section rhythm:** separation between independent content changes, not arbitrary `120px` padding.

**[DERIVED]** Landing has high visual density. Large empty vertical gaps are not a default; spacing follows hierarchy, media composition and separator rhythm. Application may have more functional breathing room, but must not become loose or indistinct.

## Layout principles

### Shared layout principles

**[DERIVED]**

- Automotive imagery and core result context have stronger visual priority than decorative container chrome.
- Use alignment lines, fine seams and tonal separation before adding nested boxes.
- Preserve content hierarchy when media, technical data and actions coexist.
- A measured image focus area is not automatically a DOM container.
- Avoid repeated centred max-width cards as the default answer to grouping.

### Landing layout principles

**[REFERENCE] / [DERIVED]**

- Use an approximately 5% visual gutter on the approved desktop reference, without promoting `x=51` to a universal token.
- Full-bleed photography is allowed; content may overlay media where contrast is protected.
- Asymmetry is valid. Automotive image can dominate the layout while controls stay compact.
- Section borders and seams create rhythm.
- Prefer shallow editorial sequences and high image-to-UI ratio.
- Do not make the Landing resemble an application dashboard.

### Product Application layout principles

**[PRODUCT] / [DERIVED]**

- Use a more predictable task grid with controls, data, status and action reachability prioritized over editorial composition.
- Result imagery remains large and preserves full composition; it is not cropped to fill a fixed visual box.
- Desktop and mobile navigation follow the current product conventions until separately approved otherwise.
- Do not copy Landing’s full-bleed overlays, large display type or asymmetric composition one-for-one into task-critical UI.

## Radius, border and shadow systems

### Radius

**[PROPOSED]**

```text
--dw-radius-none: 0
--dw-radius-xs: 2–4 px visual intent
--dw-radius-sm: restrained grouping where a surface needs softness
--dw-radius-round: 50% for intentional circular controls only
```

**[REFERENCE]** Landing surfaces read as 0–4 px by default. Large 16–32 px SaaS-card radii and habitual pills are prohibited unless a frozen application contract explicitly requires a component variant. Circular icon buttons are an intentional exception, not a general shape language.

**[APPROVED DESIGN]** Landing V1 tactile selectors are a deliberate exception to the default 0–4 px reading: vehicle rows use about `8 px`, and wheel tiles use about `10–12 px`. These values apply to this Landing selector direction only; they are not universal rules for Landing or WebApp components.

### Borders and dividers

**[DERIVED]**

- Use 1 px low-contrast dividers for rhythm and separation.
- Use a subtle interactive border before a heavy shadow.
- Selection should normally be communicated through restrained tonal contrast plus a compact accent dot/indicator. Avoid enclosing the entire option in an accent border or using an accent line/rule unless a specific component has separately approved visual requirements.
- FAQ-style dense rows may use individual fully outlined rectangles with minimal radius when the grouping is a row-level interaction.
- Dark surfaces can separate by tone or rule; they should not float by default.

Suggested semantic names: `--dw-border-subtle`, `--dw-border-default`, `--dw-divider`.

### Shadows

**[DERIVED]** Photographic shadows belong to the imagery. UI elevation is minimal. Do not use a standard floating-SaaS-card shadow. Where a menu, dropdown or transient overlay genuinely needs separation, use one restrained elevation token and preserve a visible boundary.

## Surface system

**[PROPOSED]**

- **Page canvas:** primary dark visual field.
- **Subtle surface:** quiet grouping or secondary page band.
- **Interactive surface:** inputs, selectable items, explicit task controls.
- **Selected surface:** dark base retained, with restrained tonal emphasis and/or a small accent marker.
- **Status surface:** compact semantic state context with icon, label and explanation.
- **Overlay on photography:** contrast-preserving text/action layer that does not obscure car or wheel evaluation.

> **[DERIVED] Dream Wheels should not solve every grouping problem with a rounded card.**

An island/card is appropriate when it groups a meaningful product state, form task or recovery action. It is not a universal decorative wrapper.

## Buttons and controls

### Primary

**[DERIVED]** Compact lime action with dark text, minimal radius and optional simple arrow/icon. Use rarely for the main conversion or main task action; visual prominence comes from scarcity, not size inflation.

Hover/pressed should slightly change tone or border/opacity without glow. Disabled state remains legible and explicitly unavailable—not merely colourless.

### Secondary strong

**[REFERENCE]** A light/white rectangular control can serve a strong contextual action such as “Сохранить вариант”. It is visually subordinate to the lime conversion action but stronger than text-only control.

Use for a meaningful non-primary action that deserves visibility without being the page/task primary CTA.

### Secondary subtle

Transparent/dark action with fine border or text treatment. Use for navigation, comparison and actions that must stay available without competing with the primary CTA.

Landing V1 exposes only the compact favorite control for a selected wheel; comparison is not a Landing action.

### Icon button

Compact and mostly monochrome. Use circular shape only where the function benefits from it, such as carousel direction, close or media play. Important actions retain a visible label or accessible name.

### Forms and controls

**[PRODUCT] / [ACCESSIBILITY]**

- Controls are compact but accessible.
- Every input has a clear visible or programmatically associated label.
- Focus is visible and distinct from hover and selected state.
- Errors explain the problem and recovery; do not expose provider/internal diagnostics to users.
- Technical data must remain readable; luxury minimalism never outweighs form usability.
- Sticky actions have an explicit boundary and never overlap related disclosure, navigation or final controls.

## Selection and status semantics

### Selection

**[APPROVED DESIGN]** Selection must be clearly perceivable but visually subordinate to vehicle/product imagery. Landing V1 selected vehicle and wheel controls use a restrained neutral/material treatment and fuller text/image emphasis. The current neutral frame for a selected wheel tile is allowed; selected image and label use full contrast, while the surface may retain mild physical depth. Lime dots, accent side stripes, bottom rules and lime outlines are not used on this surface, following the later explicit user decision to remove the selection circles.

Preferred mechanisms:

- subtle surface or tonal change;
- higher text/image emphasis;
- clear tonal and text/image emphasis.

Avoid by default:

- full lime outline around the complete card;
- lime-filled selected cards;
- lime side stripes or bottom rules;
- glow;
- large check badges;
- selection treatment that competes with automotive imagery.

Hover, focus and selected states must remain visually distinct. **[ACCESSIBILITY]** Focus indication is independent from visual selection and must remain clearly visible for keyboard interaction.

**[APPROVED DESIGN]** Landing V1 Mini Catalog exposes the compact favorite control as its only selected-wheel action. It must not add “Посмотреть детали”, comparison, 3D-viewing or another contextual action until a separately approved product capability and interaction are in scope.

**[APPROVED DESIGN]** Landing V1 production Mini Catalog uses `MINI_CATALOG_LAYOUT = WIDE_GARAGE_BOTTOM_SPECS`: the profile vehicle selector sits beside square Refined B4 wheel tiles, followed by a wide Garage media plane, selected-wheel title/favorite, one grouped metal specification strip, and a separate flat compatibility status. The Garage asset remains the source of vehicle grounding; production CSS must not add a vehicle shadow, floor vignette or pseudo-element grounding treatment.

**[APPROVED DESIGN]** `BOTTOM_SPECS_MATERIALITY = GROUPED_METAL_STRIP`. The strip is one calm dark graphite display-only surface with weak internal dividers, IBM Plex Sans values/labels and restrained material depth. Compatibility remains separate and flat with the existing lime status icon; it is not part of the metal strip.

**[APPROVED DESIGN]** Wheel carousel navigation controls are omitted in Landing V1 when all showcase wheel variants fit simultaneously. Do not render inactive or disabled carousel controls merely to reproduce the historical reference.

### USER-REJECTED ELEMENTS

**[APPROVED DESIGN]** Explicitly removed copy, controls or visual treatments must not be reintroduced by later reconstruction passes without explicit user approval.

Landing V1 must not restore:

- Hero supporting body or “ГОТОВЫЕ ПРИМЕРКИ”;
- “Один автомобиль — разные диски”;
- wheel carousel arrows when there is no overflow;
- lime dots, lines or outlines used as selection indicators;
- “Посмотреть в 3D”;
- “Посмотреть детали”;
- “Добавить к сравнению”.

The selected-wheel action remains Favorites only.

### Status system

**[PRODUCT]** System statuses are semantic, not purely visual:

```text
positive
warning
negative
unknown
pending
```

- **positive:** supporting technical evidence passes configured checks; wording retains the required preliminary qualification.
- **warning:** condition, required verification or incomplete evidence needs user attention.
- **negative:** known incompatibility, failed action or blocking conflict.
- **unknown:** critical evidence is absent, ambiguous or outside coverage; never converted to confidence from a photo.
- **pending:** an assessment or asynchronous task is not complete.

**[ACCESSIBILITY]** Color is never the only channel. Every status requires icon/symbol plus visible label/text. Fitment-positive styling must remain visually distinct from a visually attractive try-on result. “Preliminary” must not read as absolute guarantee.

## Imagery

### Hero and editorial imagery

**[REFERENCE] / [DERIVED]** Cinematic, large, full-bleed where appropriate, with controlled lighting and preserved automotive identity. Text overlays must use a functional contrast treatment. The car must remain recognisable and entirely evaluated as a vehicle, not transformed into background texture.

### Catalog and showcase imagery

**[REFERENCE] / [DERIVED]**

- Car remains dominant; wheels, tire profile and wheel-arch relationship stay readable.
- Camera logic stays consistent across variants.
- A Garage scene may be immutable where a production flow says so.
- Media may bleed, fade, overlap and dissolve into the page canvas instead of sitting inside a visible card frame.

### Product wheel imagery

Clean/studio, isolated, consistent scale and background. It exists for product evaluation; no decorative AI transformation that changes geometry, finish or details.

**[APPROVED DESIGN]** Supplier imagery may be transparent PNG/cutout, white-background JPEG or another studio square image. For production showcase, prefer removing the background ahead of time and placing the transparent cutout on the approved blurred cool-grey backdrop. Preserve the original wheel geometry, finish, logo and design identity. Do not use AI re-drawing merely to unify cards when it could change those properties.

`WHEEL_BACKGROUND_REMOVAL = PREFERRED PREPROCESSING`

`WHEEL_DESIGN_IDENTITY = MUST BE PRESERVED`

Current audition examples such as SVR Premium, RepliKey, Venti, MOMO and other temporary wheel assets are QA/design-audition fixtures only. They are not an approved showcase shortlist, fitment-approved products or final production catalog data.

`SHOWCASE_WHEELS_SHORTLIST = NOT YET CREATED`

`REAL_CATALOG_DATA = NOT YET INTEGRATED`

`FITMENT_VERIFICATION = NOT YET COMPLETE`

### User imagery

Preserve user vehicle identity and context. A visual result must never imply technical fitment by virtue of realism, staging or image treatment.

### Image-container rule

**[REFERENCE]** Measured image focus areas are not automatically DOM containers. Photography can bleed, fade, overlap or dissolve into the dark canvas. Do not wrap every image in a rounded rectangle + border + shadow.

### Imagery exclusions

No random stock-photo aesthetic, cyberpunk, artificial bloom, meaningless AI details or effects that interfere with wheel evaluation.

## Motion and interaction feedback

### Motion

**[DERIVED] / [ACCESSIBILITY]** Motion is restrained, short, physical and functional:

- crossfade or subtle opacity/position transition for a selected result;
- direct manipulation for Before/After;
- no long entrances, bouncing, rotation gimmicks, decorative GSAP choreography or interaction-delaying scroll effects;
- respect `prefers-reduced-motion`.

### Feedback states

Every interactive element specifies, as relevant: hover, focus, pressed, selected, loading, disabled, success and error.

- **Hover** previews affordance but does not replace semantic state.
- **Focus** is always visible for keyboard use and differs from selection.
- **Pressed** is immediate, subtle and physical—not a flashy animation.
- **Loading** communicates current work without inventing a completed technical state.
- **Disabled** explains why or directs the next safe action when the reason is not obvious.
- **Success/error** use semantic state treatment plus plain language.

## Iconography and technical data

### Iconography

**[DERIVED]** Use simple line icons with consistent optical weight and mostly monochrome rendering. Important actions pair icon with label; official social marks use official symbols. Avoid decorative icon overload and giant icon badges.

### Technical data presentation

**[PRODUCT]** Dream Wheels presents diameter, width, PCD, ET, DIA and compatibility state with precise, compact data language:

- values dominate labels;
- use tabular alignment where comparisons benefit from it;
- numeric formatting is consistent within language/locale;
- small metadata never means unreadably small;
- show precision without dashboard clutter;
- do not add wheel geometry diagrams merely to fill space.

## Automotive-first hierarchy

**[DERIVED]** When automotive imagery and UI coexist, the vehicle/result is usually the primary visual object unless the current user task requires controls to take temporary priority.

```text
Landing: car/result > selected product > technical metadata

Product Application task flow:
current task/status + result > controls > supporting metadata
```

This is a hierarchy guideline, not an instruction to hide controls or technical evidence.

**[APPROVED DESIGN]** Mini Catalog hierarchy is: vehicle/Garage result → wheel products → selected wheel specifications → vehicle/wheel selectors → supporting status/metadata. Tactile effects remain subordinate to the vehicle.

## Surface-specific guidance

### Landing Surface

**[REFERENCE] / [DERIVED]**

- photography-led, dense editorial rhythm and full-bleed media;
- minimal containers, overlay text and compact CTAs;
- shallow sectional cadence and high image-to-UI ratio;
- no dashboard appearance;
- no large standalone CTA section unless separately designed and approved;
- use [`docs/design/landing-v1-reference-reconstruction.md`](docs/design/landing-v1-reference-reconstruction.md) for Landing V1-specific geometry, not this system document.

### Product Application Surface

**[PRODUCT] / [DERIVED]** The Application inherits color roles, type roles, borders, imagery language, selection semantics, status semantics and button hierarchy. It does not literally inherit huge editorial headlines, full-bleed composition everywhere, overlay copy over critical controls, 9 px text, excessive density or unconventional navigation.

Task completion, data legibility and recovery are primary. Current frozen application conventions may intentionally use meaningful islands, stronger card radii and a more predictable navigation shell. Any convergence with the new system needs a separately approved application pass.

## Accessibility and responsive principles

### Accessibility target

**[ACCESSIBILITY]** Target WCAG 2.2 AA for contrast and interaction where applicable. Required baseline:

- contrast-qualified text, controls, focus indicators and status treatment;
- semantic buttons, inputs, headings, lists and disclosure controls;
- keyboard operation and visible focus;
- touch targets that remain usable without precision tapping;
- `prefers-reduced-motion` support;
- status never conveyed by color alone;
- useful alt text that distinguishes source, result and product imagery;
- readable technical metadata;
- screenshot measurement never overrides accessibility.

### Responsive principles

**[PROPOSED]** Preserve hierarchy rather than literal desktop scale:

- car/result remains prominent;
- controls reflow instead of shrinking indefinitely;
- technical rail may move;
- horizontal selectors may scroll when it protects readability;
- touch targets expand as needed;
- readability and action reachability override literal visual fidelity.

**[OPEN] Mobile Landing composition requires separate design approval.** The approved Landing raster is a desktop/reference composition, not a mobile layout specification.

## Dream Wheels UI anti-patterns

Do not use the following as defaults:

- large rounded SaaS cards;
- excessive pills;
- decorative gradients;
- glassmorphism;
- neon AI aesthetic;
- giant icon badges;
- every section inside a max-width card;
- giant whitespace by default;
- generic feature-card grids;
- purple/blue AI gradients;
- fake dashboards on Landing;
- decorative technical diagrams with no user value;
- using orange/lime everywhere;
- full accent borders around every selected card/control;
- overuse of shadows;
- carousel gimmicks;
- autoplay motion that distracts from vehicle evaluation.

## Token naming convention

**[PROPOSED]** Use a coherent family when this specification is later translated into code:

```text
--dw-color-*
--dw-bg-*
--dw-surface-*
--dw-text-*
--dw-status-*
--dw-space-*
--dw-radius-*
--dw-border-*
--dw-type-*
--dw-motion-*
```

This document does not create CSS variables, component APIs or implementation code.

## Open design decisions

**[OPEN]** The following cannot be resolved reliably from the approved screenshot and current contracts:

1. Exact original CSS accent hex and exact neutral-palette steps.
2. Whether Landing and Application use one accent token with different density or related accent tokens.
3. Mobile Landing composition and breakpoint-specific image hierarchy.
4. Detailed application component-library convergence, including when frozen existing card radii can evolve.
5. Final motion timing/easing values.
6. Icon library and any custom icon set.
7. Final Landing/Website language-specific copy scale and line-break rules.

## Draft validation

**Overfitting — pass.** This document does not promote Landing coordinates, source screenshot widths or a single car crop into universal system rules.

**Hallucinated system — guarded.** Proposed tokens and open decisions are labelled. One lime CTA in the Landing is not treated as evidence that all Application primary actions must have identical treatment.

**Contradictions — guarded.** The document preserves Visual Try-on versus Technical Fitment, acknowledges the current frozen Application UI as a separate authority, and states that accessibility overrides screenshot micro-measurements.
