# Dream Wheels — Application Design Code VNext v0.1

## Status and authority

PRE_RENDER / APPLICATION STATUS

    APPLICATION_DESIGN_VNEXT = DRAFT
    APPLICATION_DESIGN_DIRECTION = CONDITIONALLY_ACCEPTED
    VISUAL_SYSTEM_FREEZE = NOT_REACHED
    RUNTIME_IMPLEMENTATION = NOT_AUTHORIZED

This document captures the current working visual direction for the next Dream Wheels application redesign.

It does not replace docs/ui-design-code.md, which remains the frozen current application visual contract until a later explicit UI freeze.

It also does not replace feature-level behavioural contracts. Domain/state specifications remain authoritative for behaviour and semantics.

The current direction was selected after comparing two application visual explorations:

- A — Fine Engineering
- C — Bespoke Automotive Atelier

The working synthesis is:

> Bespoke Automotive Atelier in a Fine Engineering interface language

In practical terms:

    STRUCTURE / INFORMATION / CONTROL LANGUAGE = A
    AUTOMOTIVE ATMOSPHERE / IMAGERY / MATERIAL FEELING = C

The application must feel like a premium automotive environment without becoming an editorial website, luxury brochure or decorative engineering dashboard.

## 1. Core character

The target application character is:

    Premium
    Automotive
    Editorial where imagery matters
    Precise
    Quiet
    Material
    Photographic
    Controlled

Engineering is a supporting information layer, not the brand metaphor.

The application is not a motorsport HUD, CAD interface, engineering telemetry console, generic AI SaaS dashboard, luxury fashion website, archive/museum product or neon/cyberpunk configurator.

## 2. Primary design principle

### Automotive object first, interface second

The interface exists to help the user evaluate:

1. the vehicle;
2. the wheel;
3. the visual result;
4. the technical evidence;
5. the next action.

UI chrome must not compete with these objects.

The preferred hierarchy is:

    vehicle / wheel / result
      > current decision or status
      > primary action
      > technical evidence
      > supporting metadata

On highly technical screens such as Fitment, technical evidence may temporarily move above secondary imagery, but it must remain calm and legible rather than becoming the visual identity.

## 3. Canvas and surfaces

### Canvas

Use a cold, near-black graphite canvas close to the published Landing language.

Working visual intent:

    cold dark graphite
    very low chroma
    no blue/purple AI tint
    no obvious gradient background

Exact color tokens remain open until HTML visual QA.

### Surfaces

Prefer hierarchy in this order:

1. empty space;
2. tonal separation;
3. fine divider;
4. subtle surface;
5. explicit bordered surface only when grouping is functionally useful.

Do not wrap every section in a card. Large floating rounded SaaS panels are not the default grouping mechanism.

### Materiality

Material feeling should come primarily from automotive photography, subtle graphite tonal differences, precise edges, restrained metallic or satin cues and controlled contrast.

Do not simulate literal brushed metal, carbon fibre, glass or leather across ordinary interface surfaces.

## 4. Radius, borders and elevation

### Radius

VNext should converge away from the current 18–28 px SaaS-card system.

Working application intent:

    default grouped surface: restrained 6–10 px
    special media / large interaction surface: up to about 12 px
    pills: only when the semantic form genuinely requires a pill
    circles: only for circular controls/icons

These are working ranges, not frozen CSS tokens.

### Borders

Use thin low-contrast graphite-grey borders and dividers. Status or selection should not default to full accent outlines.

### Elevation

UI elevation is minimal. Use shadow only where a transient overlay genuinely needs separation. Automotive photography carries the visual depth.

## 5. Color roles

### Primary action

Working decision: primary product CTA uses white / near-white rather than lime by default.

Example:

    [ Создать изображение ]

The button should feel strong because of contrast, not because of brand-color saturation.

### Brand lime

Lime becomes a rare brand accent, not the default fill for every primary action.

Appropriate use:

- small brand mark;
- focused micro-accent;
- rare active/selected brand moment;
- controlled conversion emphasis where explicitly approved;
- small supporting indicator.

Avoid lime on every primary button, full card borders, selection outlines, large status fields and glow.

### Semantic colors

Use separate semantic tones:

    positive   -> calm green
    warning    -> muted amber
    negative   -> muted red
    unknown    -> neutral / amber depending context
    pending    -> cool neutral grey

Brand lime must not substitute for positive/success. Color is never the only status carrier.

## 6. Typography

### Core typeface

Use IBM Plex Sans as the primary application voice.

It fits the working synthesis because it can support both precise technical data and restrained editorial automotive presentation.

### Weights

Prefer 400, 500 and 600. Avoid habitual 700–900 UI weight. Heavy type is reserved for exceptional emphasis.

### Technical values

Use tabular numerals where alignment matters: ET, PCD, DIA, diameter, width, balance/credits and timestamps where applicable.

Values visually dominate labels.

### Display/editorial moments

Large or expressive editorial typography may appear only where the content justifies it, such as a result-focused or Garage hero state.

Do not apply a luxury serif as the default application UI voice.

Inter Tight may be evaluated later for action/display roles, but it is not a required VNext dependency at v0.1.

## 7. Buttons and actions

### Primary

Default VNext primary action:

    near-white background
    near-black text
    restrained radius
    clear label
    optional simple line icon

No gradient, glow or exaggerated shadow.

### Secondary

Dark/transparent control with a fine border or text treatment.

Use for context-specific alternate actions such as:

    Выбрать другой диск
    Повторить проверку
    Скачать изображение

### Tertiary

Text action with clear affordance.

### Action hierarchy rule

A technical Fitment verdict does not redefine the Visual Try-on action.

If visual render prerequisites are ready, Создать изображение remains a normal product action for every Fitment verdict.

## 8. Selection language

Selection should feel material and restrained.

Prefer higher image/text contrast, subtle graphite tonal shift, slight border-strength change and stronger label/value emphasis.

Avoid lime outline, glow, large check badge, bright selected fill, side stripe and bottom accent line used everywhere.

Selection is not a brand showcase moment.

## 9. Status language

Status presentation is:

    small icon/symbol
    + concise visible label
    + optional explanation
    + semantic color

Avoid giant status badges and full-width colored banners unless recovery urgency genuinely requires them.

Examples:

    × Конфликт
    ! Требуется условие
    ✓ Подходит

Fitment-specific machine semantics remain owned by the Fitment product/domain contract.

## 10. Technical data presentation

Technical information should be precise without looking like telemetry.

Preferred pattern:

    PARAMETER     VEHICLE / REFERENCE     WHEEL     RESULT

For the current Fitment VNext direction, display the user-relevant parameters as separate rows:

    PCD
    DIA
    Диаметр
    Ширина
    ET

Do not add decorative PCD diagrams, CAD arrows, radial drawings, grid overlays or geometry graphics merely to make the screen appear technical.

The comparison table should show all relevant checked parameters, not only the field that caused the overall verdict.

The row responsible for a condition/conflict may receive stronger semantic emphasis, but the component structure stays consistent.

## 11. Imagery

### Vehicle imagery

The vehicle is usually the strongest visual object.

Use controlled automotive lighting, realistic paint/material response, premium but believable photography, complete vehicle composition where the task requires evaluation and consistent camera logic within one selection/result context.

Avoid fake showroom excess, random stock photography, over-stylized CGI, unnecessary cropping and decorative blur over evaluation-critical areas.

### Wheel imagery

Wheel is a first-class product object.

Prefer clean isolated product image, consistent scale, neutral background or transparent cutout, preserved wheel identity and visible spoke/finish detail.

Do not reduce the wheel to a tiny thumbnail when the current decision depends on it.

### Cinematic atmosphere

Take atmosphere from direction C selectively:

- result/Garage screens may use controlled environmental lighting;
- application task screens should not carry a permanent cinematic background;
- technical screens remain structurally closer to A.

## 12. Photography versus UI

The main synthesis rule:

    A controls the UI
    C controls the photography

The application should not become visually warm/beige overall merely because C used warmer workshop lighting.

UI base remains cold graphite. Warm/cinematic light may appear inside imagery.

## 13. Navigation and shell

VNext should use one shared application system for desktop web, mobile web and Telegram Mini App.

The visual identity stays common.

Responsive variants may change navigation shell, safe areas, bottom actions, density, stacking order and sticky-action treatment. They do not create a second design language.

A shell redesign is allowed only through the same UI process and must preserve clear navigation semantics.

## 14. Responsive behaviour

### Desktop

Use a predictable task grid. Allow media and technical evidence to sit side by side where the task benefits from it. Do not center every screen inside one decorative card.

### Mobile / 390 px

Preserve hierarchy rather than shrinking desktop.

Typical transformation:

    desktop multi-column comparison
      -> vertical groups / stacked field comparison

Primary action must remain reachable without covering status explanations, final technical rows, bottom navigation or Telegram safe area.

### Telegram Mini App

Use the same components and semantics. Adapt only shell, viewport, safe-area spacing, action placement and touch density.

## 15. Motion

Motion is functional and restrained.

Use short fades, subtle opacity/position transitions, direct state-change feedback and small image/result crossfades.

Avoid long entrances, bouncing, rotating decorative objects, cinematic UI transitions that delay task completion and autoplay ambient motion.

Respect prefers-reduced-motion.

## 16. Fitment anchor interpretation

Fitment remains the current visual stress-test because it combines vehicle, wheel, technical evidence, negative/conditional states, primary product CTA and secondary technical action.

Its target hierarchy is:

    Vehicle + Wheel
      -> Overall technical verdict
      -> Short meaning
      -> Full comparison table
      -> Optional explanation
      -> Create image
      -> Contextual Fitment action

The screen should visually inherit A for structure, table, action hierarchy and graphite UI; C for automotive imagery quality and premium atmosphere.

It must not inherit engineering-dashboard decoration from A, permanent luxury-interior background from C, beige/gold UI chrome or serif-first application typography.

## 17. Surface stress test — Dashboard / Garage

### Purpose

Test whether VNext can feel automotive and premium without technical density.

### Required hierarchy

    current vehicle / Garage context
      > latest visual result or vehicle media
      > primary create action
      > recent wheel / result context
      > balance/supporting metadata

### VNext interpretation

Take from A: clear shell, restrained controls, white primary CTA, crisp typography and minimal chrome.

Take from C: stronger vehicle/result imagery, cinematic but controlled Garage image and sense of a personal automotive environment.

Reject generic SaaS KPI tiles, analytics-dashboard layout, large lime dashboard cards and workshop/service-ticket visual kitsch.

### Pass condition

The screen should still feel unmistakably Dream Wheels even if all technical Fitment content is removed.

## 18. Surface stress test — Create

### Purpose

Test whether VNext supports a task-heavy flow without becoming sterile.

### Required hierarchy

    Vehicle
      -> Wheel
      -> technical context when available
      -> render decision

### VNext interpretation

Take from A: progressive structure, clear state/action boundaries, disciplined form layout and calm technical data.

Take from C: larger vehicle/wheel previews, richer media presentation and premium product-object treatment.

Reject full-screen cinematic background behind forms, excessive cards, lime selection everywhere and decorative technical graphics.

### Pass condition

The user can complete Vehicle + Wheel selection efficiently while the screen still feels automotive rather than form-builder/SaaS.

## 19. Surface stress test — Result

### Purpose

Test whether VNext can become image-first without losing system consistency.

### Required hierarchy

    visual result
      > vehicle/wheel identity
      > result actions
      > fitment context if present
      > rating/supporting metadata

### VNext interpretation

Take more from C than on Fitment/Create: larger result image, stronger atmosphere, fewer visible containers and editorial spacing around the automotive result.

Keep A for action hierarchy, labels, controls, comparison/original switch and metadata structure.

Primary CTA stays near-white unless a later action-specific rule overrides it.

### Pass condition

Result feels like the emotional payoff of the product, while controls still look like the same system used by Create and Fitment.

## 20. Cross-surface invariants

These rules should survive Dashboard, Create, Fitment and Result:

    dark cold graphite canvas
    near-white primary CTA
    rare lime brand accent
    IBM Plex Sans
    tabular technical numerals
    thin low-contrast dividers
    restrained radius
    minimal elevation
    semantic status colors
    photography-led automotive identity
    no decorative engineering graphics
    no generic rounded SaaS dashboard language

## 21. Delta from the current frozen application code

### Keep

- dark application environment;
- restrained technological character;
- strong separation of Visual Try-on and Fitment;
- full vehicle/result image preservation;
- semantic status system;
- compact technical formatting;
- desktop/mobile task hierarchy;
- limited motion.

### Change in VNext direction

- primary action moves from default lime toward near-white;
- lime becomes a rare brand accent;
- application radii reduce substantially;
- UI cards/islands become less dominant;
- image hierarchy becomes stronger;
- vehicle and wheel become more deliberate product objects;
- IBM Plex Sans becomes the preferred application voice;
- visual surfaces move closer to Landing materiality without literally copying Landing composition;
- technical comparison uses flatter table/rule language rather than stacked rounded result cards.

### Explicitly not inherited from direction C

- warm beige UI system;
- gold borders;
- serif-first UI;
- luxury-background imagery behind every task;
- showroom decoration on technical surfaces.

### Explicitly not inherited from direction A

- sterile engineering dashboard feel;
- excessive technical density;
- telemetry/CAD visual metaphors;
- engineering as primary brand identity.

## 22. Open decisions for HTML prototype

The first HTML prototype must resolve these visually rather than through further abstract discussion:

1. exact graphite palette;
2. exact near-white CTA tone;
3. final application radius values;
4. divider contrast;
5. whether primary CTA uses a thin border in dark contexts;
6. final Fitment table column proportions;
7. vehicle/wheel media size ratio;
8. desktop max content width;
9. mobile status/table stacking;
10. how much C-style cinematic imagery is retained before the task screen feels like a landing page;
11. focus-ring treatment after lime stops being the default primary action;
12. exact use of IBM Plex Sans weights.

## 23. Interactive HTML prototype

The first VNext review artifact is:

`docs/references/pre-render-fitment-v2-vnext-prototype.html`

It implements the working A+C synthesis and provides review states for desktop
and responsive/mobile behaviour.

The prototype is a review artifact, not runtime implementation.

It should implement the working A+C synthesis and expose enough states to test the system:

    compatible
    compatible_with_conditions
    incompatible
    unknown
    processing
    operational failure

Visual Try-on remains independent from Fitment in every state.

After the Fitment prototype validates the VNext system, the same design code is applied to Dashboard / Garage, Create and Result before an application-wide UI freeze.


## 24. Cross-surface VNext stress-test prototype

The next review artifact is:

`docs/references/application-vnext-cross-surface-prototype.html`

It applies the current VNext language beyond Fitment to three representative
application surfaces:

- Dashboard / Garage;
- Create;
- Result.

The purpose is to test whether the same visual system remains coherent when the
screen moves from technical evidence to task flow and finally to image-first
result presentation.

The prototype preserves the current product conventions:

- Dashboard keeps balance, primary creation action and latest-result context;
- Create keeps Vehicle and Wheel as explicit first-class inputs and preserves
  Visual Try-on / Fitment separation;
- Result uses one viewer with `Результат / Оригинал`, keeps the result
  composition intact, and exposes the approved result actions and rating
  controls.

This artifact is still a review prototype. It does not freeze Dashboard,
Create, Result, navigation or runtime component APIs.
