# Dream Wheels AI — Design System Draft

> **Status:** first system-level design contract draft. It defines reusable visual and interaction rules for Dream Wheels AI; it is not a Landing implementation brief and it does not replace frozen product UI contracts.

## Purpose and authority

`DESIGN.md` answers: **how should Dream Wheels feel and behave as one system across surfaces?** It deliberately abstracts reusable rules from the approved Landing reference without copying Landing V1 coordinates, section heights or page composition.

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
- small selected marker;
- short accent rule;
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

### Borders and dividers

**[DERIVED]**

- Use 1 px low-contrast dividers for rhythm and separation.
- Use a subtle interactive border before a heavy shadow.
- Selection should normally be communicated through restrained tonal contrast plus a small accent marker/rule. Avoid enclosing the entire option in an accent border unless a specific component has separately approved visual requirements.
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

**[REFERENCE]** A light/white rectangular control can serve a strong contextual action such as “Посмотреть детали”. It is visually subordinate to the lime conversion action but stronger than text-only control.

Use for a meaningful non-primary action that deserves visibility without being the page/task primary CTA.

### Secondary subtle

Transparent/dark action with fine border or text treatment. Use for navigation, comparison and actions that must stay available without competing with the primary CTA.

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

**[APPROVED DESIGN]** Selection must be clearly perceivable but visually subordinate to vehicle/product imagery.

Preferred mechanisms:

- subtle surface or tonal change;
- higher text/image emphasis;
- short lime bottom rule;
- small side marker;
- compact icon/indicator where semantically appropriate.

Avoid by default:

- full lime outline around the complete card;
- lime-filled selected cards;
- glow;
- large check badges;
- selection treatment that competes with automotive imagery.

Hover, focus and selected states must remain visually distinct. **[ACCESSIBILITY]** Focus indication is independent from visual selection and must remain clearly visible for keyboard interaction.

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
