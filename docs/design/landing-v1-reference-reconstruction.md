# Dream Wheels AI — Landing V1 reference reconstruction

## Purpose, source and confidence

This is a reverse-engineering specification for the approved visual reference, not an implementation proposal. It is the visual source of truth for a later reconstruction pass. No Landing source, style, component, asset or deployment was changed while making this document.

- Source: [`zeekr-styled-landing.png`](/Users/nikolai/Downloads/zeekr-styled-landing.png)
- Native raster: **1024 × 1536 px**, RGB, 2:3.
- Measurement basis: native source pixels first. Percentages use the full source width (1024 px) or height (1536 px), as applicable.
- Confidence: **high** means a hard visible boundary/control; **medium** means the value is visually recoverable but softened by photography or scaling; **low** means the reference does not expose a reliable implementation rule.
- Companion data: [`landing-v1-reference-measurements.json`](./landing-v1-reference-measurements.json).

The reference is a dense, dark editorial experience rather than a stack of padded application sections. Photography creates the composition; UI stays compact, rectilinear and secondary. The default page field samples near `#050b0e`; the independently sampled reference lime is approximately `#C2E823` (RGB 194,232,35), not orange. This does **not** claim the original CSS value is known; final implementation must visually match the approved raster. Pale text is warm/cool off-white rather than pure white. Fine dividers are low-contrast blue-grey/white at roughly 10–16% opacity.

## Page geometry at the reference resolution

| Region | Source Y | Height | Share of full 1536 px page height | Confidence |
| --- | ---: | ---: | ---: | --- |
| Header + Hero | 0–372 | 372 px | 24.2% | High |
| Mini Catalog | 372–744 | 372 px | 24.2% | High |
| Two Questions | 744–923 | 179 px | 11.7% | Medium |
| How It Works + video trigger | 923–1130 | 207 px | 13.5% | Medium |
| Before/After + primary CTA | 1130–1310 | 180 px | 11.7% | High |
| FAQ | 1310–1476 | 166 px | 10.8% | High |
| Follow + Footer | 1476–1536 | 60 px | 3.9% | High |

The dominant horizontal guide is `x=51` / `x=973`: a 51 px gutter on each side, or about **5% of the full 1024 px viewport width**, yielding a 922 px / 90% content field. This guide applies to text, selectors, accordion columns and footer content. Photography itself often reaches the viewport edges.

### Global design system

- **Canvas:** near-black `#050b0e` with very dark teal/blue lift in non-photographic areas. There are no big rounded section shells.
- **Photography:** dark automotive editorial grade; low-key, warm sunlight, controlled specular highlights and subtle floor reflection. Image edges often dissolve into the canvas with black overlays, not rounded masks.
- **Accent:** reference sampled lime ≈ `#C2E823`; reserved for primary CTA fills, selected states and the compatibility check. It must never become a broad decorative gradient. The final token is an implementation choice and must be compared visually with the raster.
- **Typography:** clean, narrow-to-neutral grotesk. Display weights are light/regular rather than heavy; body and UI are compact regular/medium. The reference makes an intentional contrast between 42–46 px display type in the Hero and 9–12 px UI/body text.
- **Radius:** effectively 0–4 px. Selector cards and CTA are gently rounded at most; no pill system, no large corner radius.
- **Rules:** 1 px separators define rhythm between sections and rows. Shadows are photographic only; UI has almost no floating shadow.
- **Reference provenance:** 1024 px is a portrait capture that nevertheless preserves a desktop-like multicolumn catalog. The approved image supplies this desktop/reference composition only; it does not document mobile reflow.

## 1. Header

**Observed geometry.** The header is visually overlaid within the first 52–56 px of the Hero; it does not consume an independent tall band. Wordmark begins around `x=49`, `y=18`. Centre navigation starts near `x=315`; login and primary button occupy `x≈827–983`. The primary header CTA is approximately 102 × 30 px with a 3–4 px radius. Nav labels are roughly 10–11 px, with 28–38 px gaps.

**Typography and styling.** The wordmark is compact, all-caps, white, about 14 px; only “AI” is lime. Nav and login are 10–11 px white at reduced contrast. Header relies on the hero dark overlay for legibility and has no prominent opaque background or border.

**MUST MATCH**

- Keep it as a thin overlay aligned to the universal 5% gutters.
- Preserve the hierarchy: wordmark left, three low-chrome links near centre, login plus compact lime CTA at right.
- Keep the action visually lighter than the Hero CTA; there must be no large sticky-navigation bar.

**CAN ADAPT**

- Exact nav labels, authenticated state and target URLs.

## 2. Hero

**Observed geometry.** Full-bleed region `y=0–372` (**24.2% of the full 1536 px page height**). Copy begins at `x≈52`, with a usable width of 220–240 px (**21.5–23.4% of the full 1024 px viewport width**). Its eyebrow is around `y=67`; headline spans `y≈86–236`; description around `y=258–297`; CTA at `x≈52, y≈311`, approximately 207 × 33 px. The photographic/media field (car plus architecture) occupies roughly `x=252–1024`, `y=0–371`: 772 px, or **75.4% of the full 1024 px viewport width**. The visible car silhouette itself is approximately `x=334–914`, `y=115–336`: 580 px, or **56.6% of the full 1024 px viewport width**. These are distinct measurements.

**Typography.** Eyebrow is all-caps, 9–10 px, tracking about `0.24em`. The headline “БОЛЬШЕ / СТИЛЯ / В ВАШИХ / РУКАХ” is roughly 42–46 px, 0.90–0.96 line-height, light weight, slight negative tracking. It occupies four lines in the supplied Russian copy; the exact line count may change with language, but the block must stay compact and commanding. Description is 12–13 px at ~1.25–1.35 line-height. CTA is 11–12 px medium/bold, black text and a simple right arrow.

**Treatments.** A black left-to-right gradient protects the text. Architectural sunlight is warm from upper/right; the main car stays charcoal. The lower right uses minute editorial metadata (“ZEEKR 001 / SAME CAR… / 01/15”) at 8–9 px, aligned to the image rather than treated as an application card.

**MUST MATCH**

- The car is the dominant first-view object and reaches the right edge; the copy is an overlay, not an equal split column.
- Preserve the black-to-transparent overlay, the warm architectural photo grade and the very compact lime CTA.
- Keep Hero content inside the 5% gutter but allow media to be full-bleed.

**CAN ADAPT**

- Actual vehicle, hero crop, editorial caption and localized copy.

## 3. Vehicle selector

**Observed geometry.** This begins at `y≈390` within the Catalog. Label at `x≈51`; left rail spans `x≈51–239` (188 px / **18.4% of the full 1024 px viewport width**) and continues vertically. Visible item cards are approximately 188 × 45 px, separated by 9–11 px. Four cards are visible in the source: Zeekr 001, BMW 3 Series, Li L7, NIO ET5. Each combines a cropped car thumbnail of ~67 × 34 px and 10–11 px type. In the approved screenshot, the selected card has a single lime 1 px outline; inactive cards use a barely-visible blue-grey outline.

**MUST MATCH**

- On the reference desktop layout, vehicle selection is a vertical left rail, not a horizontal chip row.
- Thumbnails are real automotive crops, darkly graded and visually consistent with the stage.

**CAN ADAPT**

- Vehicle count and list virtualization/scrolling.

## 4. Wheel selector

**Observed geometry.** The selector title starts at `x≈311, y≈391`. The carousel spans `x≈311–891` (580 px / **56.6% of the full 1024 px viewport width**) with five 102 × 90 px wheel cells visible (`y≈411–501`) and roughly 17–19 px gaps. Two circular carousel buttons sit at `x≈921–973`, `y≈388–412`, about 24 px each. In the approved screenshot, the selected wheel uses the same thin lime outline; the image is dominant within the cell and the two-line brand/model caption is 9–10 px below it.

### APPROVED DESIGN DEVIATION

The thin lime outlines above are factual observations of the approved screenshot. Production Landing implementation must follow [`DESIGN.md`](../../DESIGN.md) for **selection styling** instead:

- no full lime outline by default;
- restrained tonal change;
- compact lime marker/rule;
- higher selected text/image emphasis;
- accessibility focus remains independent and clearly visible.

This approved deviation affects selection styling only. It does **not** change Catalog geometry, dimensions, hierarchy, Automotive stage/media-plane behaviour, or any other reference measurement in this document or the structured measurements JSON.

**MUST MATCH**

- Wheel choice reads as a horizontal product carousel above the automotive stage, not as a small control inside the spec rail.
- Product images are isolated, centred wheel portraits with consistent square image treatment.
- Carousel navigation is an understated pair of 24 px outlined circles in the upper-right.

**CAN ADAPT**

- Actual number of wheel entries, pagination semantics and whether it scrolls, snaps or pages.
- Names, brand marks and available finish metadata.

## 5. Mini Catalog automotive stage

**Observed geometry.** Catalog overall is `y=372–744` (**372 px / 24.2% of the full 1536 px page height**). Separate three visual measurements:

- **Garage scene / media plane:** the photographic plane begins to dissolve toward the viewport’s left edge around `x≈0` and `y≈502`, continues behind/around the car and reaches the lower Catalog divider. Its visible influence may extend to `x≈734`, but its boundaries are intentionally faded and therefore **not** a reliable rectangular element bound (low confidence).
- **Catalog focus area:** `x≈160–690`, `y≈522–744` (530 × 222 px). This is the dominant visual/focus area only—**57.5% of the 922 px content-field width** and **59.7% of the 372 px Catalog section height**—not a literal automotive-stage container.
- **Car bounds:** visible silhouette approximately `x≈177–677`, `y≈546–726` (500 × 180 px), or **48.8% of full 1024 px viewport width** and **48.4% of the 372 px Catalog section height**. These are medium-confidence estimates because the car dissolves into a black floor.

The wheel selector creates the focus area’s upper alignment line; the car’s roof starts below the product cards rather than touching them.

> **Implementation warning:** The measured focus area **MUST NOT** be implemented as a rectangular image card or visible container. The approved design uses a full-bleed/faded photographic plane integrated into the page field.

**Image/UI proportion.** The car bounds occupy about **48.4% of the Catalog section height** (180 of 372 px). The focus area is about **57.5% of the 922 px content-field width**. The car, not UI, is the first visual read; selectors are second; the technical rail is third.

**Eye path.** The intended reading path is: Hero car → selected vehicle in left rail → highlighted wheel in the top carousel → large side-profile car at lower centre → wheel name/specification rail at lower right → fitment confirmation/button. The stage’s asymmetric leftward car placement deliberately leaves room for the rail.

**MUST MATCH**

- Use one broad, low side-profile garage scene/media plane with image and floor reflection; it must feel like a photographic exhibit, not a generic image card.
- Keep the catalog focus area visibly larger than any individual control. The media plane should be contiguous with the page dark field, with no rounded or visible container.
- The stage and spec rail are simultaneous elements on desktop; do not put details below the car at this breakpoint.

**CAN ADAPT**

- The exact car direction/crop, final image asset and visible reflection strength.

## 6. Catalog specification / compatibility rail

**Observed geometry.** The rail begins at `x≈734`, `y≈524`, width ~238 px (**23.2% of the full 1024 px viewport width**; 25.8% of the 922 px content field) and runs to about `y=730`. Wheel title “OZ SUPERTURISMO” is ~15–16 px. The short descriptor is 10–11 px. Four inline measurements form a single compact row around `y=576–604` (R19 / 8.5J / 5×114.3 / ET40), labels beneath are 8–9 px. Compatibility sits as a 238 × ~42 px dark translucent row at `y≈618`, with lime check at left and chevron at right. A white, flat, 238 × ~31 px secondary button follows at `y≈670`; “Добавить к сравнению” is a plain text/action row below.

**MUST MATCH**

- The rail is slim and factual. Technical values are inline, compact and visually subordinate to the selected wheel name.
- Compatibility has a single deliberate state treatment: lime check on a dark strip; avoid a decorative wheel-geometry diagram.
- The reference screenshot shows a “Посмотреть в 3D” action as a strong white rectangular control, intentionally different from the lime primary conversion CTA. This is a factual reference observation, not a production Landing promise.

### APPROVED PRODUCT/DESIGN DEVIATION

Production Landing V1 does not advertise 3D viewing. Use “Посмотреть детали →” in the same strong white rectangular control position.

This deviation changes copy and action semantics only. It does not alter the reference geometry, button position, size, hierarchy or Catalog composition.

**CAN ADAPT**

- Exact values, validation wording and enabled/disabled state. If data is mock, it must continue to say so in the product-appropriate wording.
- Details action destination and comparison persistence.

## 7. Two Questions

**Observed geometry.** Full-bleed image pair `y≈744–923` (179 px / **11.7% of the full 1536 px page height**). The composition is split essentially 50/50 at `x≈512` (**50% of the full 1024 px viewport width**); no outer card margin is visible. Left and right panels have different automotive photography, each darkened enough for text. Copy starts around `x=54` and `x=534`; number and small label are around 9–10 px, heading around 22–25 px with two lines, body 10–11 px. The link sits 16–20 px below body with a simple arrow. A fine vertical seam defines the two halves.

**MUST MATCH**

- Two equal, edge-to-edge editorial photo panels; they are not plain copy cards.
- Both questions remain independently readable over their images, with the same compact text rhythm.

**CAN ADAPT**

- Text and photographs, plus whether the entire panel links or only the textual action does.

## 8. How It Works

**Observed geometry.** Region `y≈923–1130`, with a heading block at `x≈52, y≈934–994`. Eyebrow is 9 px; “ОТ ФОТО ДО РЕЗУЛЬТАТА / ЗА НЕСКОЛЬКО ШАГОВ.” is around 25–28 px at 0.98–1.05 line-height. A “Смотреть видео” action at `x≈875–974`, `y≈970` uses 9–10 px text and a ~22 px white circular play button. Four workflow columns begin around `y≈1007`, using a 4-column grid across the 922 px content field. Text starts at x≈52, 306, 544, 789; each image frame is about 183 × 68 px at `y≈1051–1119`. Small arrows occupy the inter-column gaps.

**MUST MATCH**

- Compact four-step editorial strip, not a tall three-card educational section.
- One low-chrome video trigger belongs in the heading row; no large separate video poster exists in the reference.
- Steps mix small numeric label, short copy and consistently sized image frames.

**CAN ADAPT**

- Video target, duration and actual media may change; the visual position and restraint should not.

## 9. Product video area

The source does **not** show a standalone product-video area with a poster, media frame or 16:9 block. The only visible video affordance is the 9–10 px “Смотреть видео” label and circular play control embedded in the How It Works header at the far right.

**MUST MATCH**

- Treat video as a small contextual action within How It Works at this visual version.
- It must not add a large intervening vertical block between workflow and Before/After.

**CAN ADAPT**

- Modal, inline playback or external player behaviour.
- Accessible label, transcript and thumbnail on interaction.

## 10. Before / After

**Observed geometry.** Region `y≈1130–1310`, a full-bleed 180 px cinematic strip (**11.7% of the full 1536 px page height**). Left copy aligns to `x≈52`; the dominant car occupies roughly `x≈418–903` across the lower/right portion. The splitter is a 1 px white line at `x≈682` (**66.6% of the full 1024 px viewport width**), with an approximately 31 px white circular handle centered at `y≈1224`. “ДО” sits around `x=393`; “ПОСЛЕ” around `x=943`, both 9–10 px. Text reads “ПРИМЕРЬТЕ ДИСКИ / НА СВОЕЙ МАШИНЕ.” at ~26–28 px, description 11–12 px, lime action at `x≈52, y≈1262`, approximately 171 × 31 px.

**MUST MATCH**

- Full-bleed visual transform with one high-contrast vertical splitter and small round handle.
- The car crosses the result panel and reads as a real photographic object, not as two detached images in cards.
- A conversion CTA is embedded in the left overlay. This is the principal low-page CTA composition.

**CAN ADAPT**

- Source/result imagery and initial split position; maintain a plausible 60–70% initial position if the content needs right-side outcome emphasis.
- Accessible keyboard/touch control implementation and labels.

## 11. Primary CTA

There is no standalone, oversized CTA section in the approved screenshot. Primary lime calls-to-action occur in two places: Hero (`≈207 × 33 px`) and Before/After (`≈171 × 31 px`). They share the same flat lime fill, black 10–12 px medium/bold text, a right-arrow, and minimal 3–4 px rounding.

**MUST MATCH**

- Use lime only for primary conversion actions, positioned inside photography-backed compositions.
- Keep dimensions compact; avoid a decorative monogram, circular CTA art piece or an isolated 500 px tall CTA section.

**CAN ADAPT**

- CTA copy, app route and attribution handling.

## 12. FAQ

**Observed geometry.** Region `y≈1310–1476`, about 166 px (**10.8% of the full 1536 px page height**). Eyebrow at `x≈51, y≈1331`; title at `x≈51, y≈1350`, about 23–25 px. “Все вопросы →” aligns far right around `x≈890, y≈1353`. The list begins `y≈1378` and uses two columns: left `x≈50–492`, right `x≈529–973`; each has three rows around 27–29 px high. Each entry appears as an individual low-contrast, fully outlined rectangular row with roughly 2–4 px radius; compact 10–11 px text sits inside with a 10–12 px plus at right.

**MUST MATCH**

- FAQ is a short, two-column compact grid at the reference desktop width, with almost no dead space.
- Entries use individual, fully outlined, low-contrast rectangular borders with approximately 2–4 px radius; they must not read as rounded cards or only as top-rule separators.

**CAN ADAPT**

- Question set, open state and semantic `<details>` implementation.

## 13. Follow Dream Wheels

The source does not create an independent social/follow section. Social follow is compressed into the closing strip at `y≈1476–1536`: white Telegram, Instagram, YouTube and VK icons appear around `x≈742–861`, centered vertically around `y≈1506`.

**MUST MATCH**

- Social affordances belong to the footer band and are icon-led, compact and aligned with the global content field.
- They should not become a large preceding “Follow” section in this reference version.

**CAN ADAPT**

- Which official channels appear, accessible names and target links.

## 14. Footer

**Observed geometry.** Final 60 px (`y≈1476–1536`) separated by a 1 px rule. Wordmark at `x≈47, y≈1494`; supporting line beneath at ~8 px. Legal/navigation items run from `x≈264–711`, around 9 px. Social icons follow. Copyright sits at `x≈891–975`, about 8 px over two lines.

**MUST MATCH**

- A shallow, single-line desktop footer with a top divider and tightly controlled microtype.
- Wordmark left, utility links centre, social near right, legal far right.

**CAN ADAPT**

- Final legal wording, channels, year and footer links.

## Mini Catalog reconstruction blueprint

The Catalog is the most distinctive product composition and must be reconstructed before secondary sections.

| Element | Approx. native bounds | Relation to 1024 px viewport | Implementation intent | Confidence |
| --- | --- | --- | --- | --- |
| Catalog region | x 51–973, y 372–744 | 90.0% of full 1024 px viewport width × 24.2% of full 1536 px page height | Full-width dark field with internal 5% gutter | High |
| Vehicle rail | x 51–239, y 411+ | 18.4% of full 1024 px viewport width | Vertical 188 px cards; aligns to gutter | High |
| Wheel carousel | x 311–891, y 411–501 | 56.6% of full 1024 px viewport width | Five 102 px cells above media plane | Medium |
| Carousel controls | x 921–973, y 388–412 | 5.1% of full 1024 px viewport width | Two 24 px outlined circular buttons | Medium |
| Garage scene / media plane | x≈0–734, y≈502–744 | Faded/implicit visual extent; no dependable rectangular percentage | Full-bleed photographic plane integrated into page field | Low |
| Catalog focus area | x 160–690, y 522–744 | 57.5% of 922 px content-field width × 59.7% of 372 px Catalog height | Dominant focus only; not an element bound | Medium |
| Visible car | x 177–677, y 546–726 | 48.8% of full 1024 px viewport width × 48.4% of 372 px Catalog height | Side profile; wheel/arch geometry readable | Medium |
| Technical rail | x 734–972, y 524–730 | 23.2% of full 1024 px viewport width; 25.8% of 922 px content-field width | Fixed slim factual rail; no diagram | High |

At this source size, the image/UI balance is deliberately aggressive: selectors and specs are approximately one half of the catalog’s visual attention only because the car is oversized, low and centrally placed. A generic 50/50 “image left/details right” layout would fail. The car must visually join the selector structure through its roof line, and the wheel choice must appear before the resulting car—not below it. The measured Catalog focus area is a measurement of visual attention, not a DOM/card rectangle.

## IMPLEMENTATION INFERENCE — NOT OBSERVED IN REFERENCE

The approved raster documents the desktop/reference composition only. The following are future implementation inferences and are **not** reverse-engineered visual facts from the image:

- At narrow widths, centre navigation may collapse to an accessible menu while retaining wordmark and one primary action.
- Hero height, CTA width and copy wrapping may adapt to available width while maintaining image dominance; primary buttons may expand to preserve readable tap targets.
- Vehicle selection may become a horizontal scroller; the technical rail may move below the media plane; selector ordering and result-media priority should remain.
- The two-question panels may stack, workflow steps may become a carousel or vertical sequence, FAQ may become one column, and the footer may use multiple rows.
- Touch, keyboard, modal-video and adaptive Before/After controls are interaction/responsive decisions, not properties observed in the raster.

## Current implementation gaps

Comparison is restricted to the existing `landing/` architecture and styles. The approved screenshot is the visual authority; existing implementation is not.

1. **Macro composition is inverted — critical.** Current Landing uses a constrained `min(1240px, 100vw - 80px)` shell, vertical padding and isolated sections. Reference is a near-continuous full-bleed editorial composition with a 5% internal gutter and photos breaking to viewport edges.
2. **Hero media dominance and copy placement — critical.** Current Hero is a two-column grid with a contained image frame and a large 68–130 px orange-accent headline. Reference overlays a compact 42–46 px light-weight Russian headline on a full-bleed photo, uses lime accents, and gives the photographic/media field about 70–75% of the full viewport width while the visible car silhouette is about 55–60%.
3. **Mini Catalog geometry — critical.** Current component places a horizontal vehicle selector above a two-column stage/detail layout; wheel choices live inside the right detail panel. Reference requires a vertical vehicle rail, a top horizontal five-wheel carousel, a low side-profile stage, and a simultaneous 238 px spec rail.
4. **Catalog visual density and stage treatment — high.** Current stage is a framed general-purpose block with labels/“MOCK / UI ONLY”. Reference is denser, uses photographic continuity/floor reflection, and has restrained editorial metadata rather than overt placeholder branding.
5. **Two Questions — high.** Current design renders line-separated text-oriented rows. Reference uses two equal full-bleed photographic panels with overlaid copy and a central seam.
6. **How It Works and video — high.** Current design has three tall instructional columns followed by a 530 px video frame. Reference has four compact steps in one strip and only a small video trigger; the large video block substantially changes page proportions.
7. **Before/After and CTA architecture — high.** Current implementation has a separate large Before/After block and then a 500 px standalone CTA section with a circular DW mark. The reference embeds the CTA inside a shallow full-bleed Before/After strip and does not have the standalone CTA section.
8. **FAQ density — medium-high.** Current FAQ is a wide single-column list with 21 px summary labels and large section padding. Reference has a compact two-column six-row grid in about 166 px of vertical space.
9. **Social/footer position — medium.** Current Follow is a separate tall section. Reference folds social icons into a 60 px footer strip.
10. **Colour/radius/typographic system — medium.** Current UI system is warm orange with prominent `Arial Narrow` treatment, larger headings and more generous vertical whitespace. Reference is lime-accented, thin/light grotesk, mostly 0–4 px radius, compact 9–12 px UI and shallow sections.

Existing reusable behaviour remains useful: data-driven vehicle/wheel selection, favorites localStorage, attribution-preserving CTAs, accessible `details`, and keyboard-friendly Before/After mechanics. The later reconstruction should preserve those behaviours while replacing visual structure only after approval.

## Implementation gates

### Gate 1 — Header + Hero + Mini Catalog

Acceptance criteria:

- At the approved desktop reference width, Header + Hero + Catalog occupy roughly the first 744 source-normalized pixels: **48.4% of the full 1536 px page height**, with no standalone whitespace gap between them.
- Header content and all major copy align to a consistent ~5% of the full 1024 px viewport-width gutter; Hero and Catalog media planes reach viewport edges where the reference does.
- Hero photographic/media field occupies roughly **70–75% of the full viewport width**. The visible car silhouette within that field occupies roughly **55–60% of the full viewport width**. These are separate acceptance checks; the copy overlay uses ~22–24% of the full viewport width, and lime is used for CTA/selection rather than orange.
- Catalog has a vertical vehicle rail, top five-cell wheel carousel, lower wide garage scene/media plane and right factual spec rail visible concurrently. The Catalog focus area is visually wider than the rail and lower than the wheel selector, but it is not a visible rectangular container.
- Car wheel arches and both visible wheels are not hidden by interface controls; result media is the first visual read.
- Switching vehicle/wheel, favorites and current compatibility semantics work without changing the reference geometry.

### Gate 2 — Two Questions + How It Works

Acceptance criteria:

- Two Questions is rendered as two equal photo-led panels with overlaid compact copy, not generic cards or plain rows.
- How It Works is a four-column compact workflow strip; image modules share an aspect ratio and arrows connect steps.
- No tall standalone video poster is inserted. Video action sits at the heading’s far-right in the reference desktop layout.
- Combined vertical rhythm normalizes to about **25.2% of the full 1536 px page height** at the approved reference proportions (179 + 207 px in the source), allowing a small tolerance for localization.

### Gate 3 — Before/After + CTA + FAQ + Social + Footer

Acceptance criteria:

- Before/After is a shallow, full-bleed photo strip with a vertical splitter around 60–70% of the full viewport width, a 30–32 px circular handle and its lime CTA inside the left overlay.
- There is no separate oversized CTA/monogram block between Before/After and FAQ.
- FAQ is a compact two-column, six-row grid at desktop width; each row has a low-contrast full outline and minimal 2–4 px radius, while preserving keyboard/accessibility semantics.
- Social icons are integrated into the shallow footer band; desktop footer remains a compact multi-column line with wordmark, utility links, icons and legal copy.
- Last three regions occupy roughly **26.4% of the full 1536 px page height** in the source (180 + 166 + 60 px) and remain denser than the current Landing.

## Explicit non-goals of this pass

- No implementation, CSS or component changes.
- No image generation, replacement design image, photography selection or asset transformation.
- No branch merge, deployment, UI commit or changes to existing Landing behaviour.
