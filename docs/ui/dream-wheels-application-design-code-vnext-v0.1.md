# Dream Wheels — Application Design Code VNext v0.1

## Status and authority

PRE_RENDER / APPLICATION STATUS

    APPLICATION_DESIGN_VNEXT = FROZEN
    APPLICATION_DESIGN_DIRECTION = ACCEPTED
    VISUAL_SYSTEM_FREEZE = REACHED
    VNEXT_UI_CONTRACT = FROZEN
    RUNTIME_IMPLEMENTATION = AUTHORIZED

This document is the authoritative visual/UI target for implementing Dream Wheels Application VNext. The [reconciled prototype](../references/application-vnext-state-coverage-prototype-v3.html) is its canonical interactive visual reference; the [closing QA report](vnext-full-screen-qa-audit.md) is its canonical static-prototype evidence.

Formal UI contract approval follows closing reconciliation QA PASS: 128 checks, 0 errors, no open HIGH/BLOCKER in static-prototype scope, plus a passing closing consistency smoke. `RUNTIME_IMPLEMENTATION = AUTHORIZED` permits implementation against this target; it does **not** certify runtime conformance, API/backend integration, payments, real devices or production readiness. Earlier review/freeze notes in this document are historical snapshots and cannot override this status.

The [V1 Design Code](../ui-design-code.md) remains the frozen legacy/current-runtime reference until the application is actually migrated. For **new VNext implementation**, this frozen VNext Design Code and its canonical prototype take precedence over V1 visual conventions. Both are frozen for different implementation generations; neither status implies that the current runtime has already adopted VNext.

It also does not replace feature-level behavioural contracts. Domain/state specifications remain authoritative for behaviour and semantics.

The accepted direction was selected after comparing two application visual explorations:

- A — Fine Engineering
- C — Bespoke Automotive Atelier

The frozen synthesis is:

> Bespoke Automotive Atelier in a Fine Engineering interface language

In practical terms:

    STRUCTURE / INFORMATION / CONTROL LANGUAGE = A
    AUTOMOTIVE ATMOSPHERE / IMAGERY / MATERIAL FEELING = C

The application must feel like a premium automotive environment without becoming an editorial website, luxury brochure or decorative engineering dashboard.

## Frozen contract scope

The frozen target covers application information hierarchy; visual language; navigation model; desktop/mobile responsive transformations; primary/secondary/tertiary action hierarchy; semantic color roles; IBM Plex Sans; surface/radius language; media presentation; Create summary-first/form-on-demand and parser UI states; Fitment hierarchy and all four verdict presentations; `FITMENT_VERDICT ≠ RENDER_PERMISSION`; Result image-first hierarchy, before/after slider and feedback vocabulary; compact History archive; Balance and payment-state presentation; Auth/session, empty and error states; Support, Photo Guide and Documents; mobile bottom navigation and Help model; no decorative status dots; and rare brand lime with near-white primary CTA.

Implementation may make non-semantic technical adjustments for subpixel rendering, real-content spacing, component/framework details and browser-specific corrections. Such adjustments must not change the frozen hierarchy, semantics, interaction model or visual language. Material design or copy changes require separate review. This freeze does not validate production runtime, frontend/backend integration, parser API, Fitment execution, render provider, auth runtime, Robokassa/payment execution, network failures, Safari iOS, Chrome Android, Telegram WebView, physical safe areas, software keyboard, screen readers or real-device performance; those are subsequent implementation and staging/device QA tasks, not blockers to this UI-contract freeze.

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

Frozen visual intent:

    cold dark graphite
    very low chroma
    no blue/purple AI tint
    no obvious gradient background

Rendered color tokens and their balance are defined by the canonical prototype.

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

Frozen application intent:

    default grouped surface: restrained 6–10 px
    special media / large interaction surface: up to about 12 px
    pills: only when the semantic form genuinely requires a pill
    circles: only for circular controls/icons

These describe the frozen radius language; exact CSS values and exceptions are defined by the canonical prototype.

### Borders

Use thin low-contrast graphite-grey borders and dividers. Status or selection should not default to full accent outlines.

### Elevation

UI elevation is minimal. Use shadow only where a transient overlay genuinely needs separation. Automotive photography carries the visual depth.

## 5. Color roles

### VNext color tokens

These values are present in the canonical prototype and belong to the frozen
visual contract. The prototype remains authoritative for their rendered use.

    canvas             #07090B
    primary CTA        #F0EFE9
    primary CTA text   #0C0F11

    brand lime         #D8FF37

    positive           #75CAA0
    warning            #D8AD67
    negative           #D87979
    unknown            #A0A7AC
    pending            #7D878E

### Primary action

Primary product CTA uses white / near-white rather than lime by default.

Example:

    [ Создать изображение ]

The button should feel strong because of contrast, not because of brand-color saturation.

### Brand lime

Lime is retained as the Dream Wheels signature accent, but it is not a general
interaction or status color.

Appropriate use:

- small brand mark;
- focused micro-accent;
- rare explicitly approved brand moment;
- controlled conversion emphasis when a later contract requires it.

Do not use lime for:

- default primary CTA;
- selected sidebar navigation;
- ordinary action links;
- success / compatible status;
- warning / expiry;
- error / incompatibility;
- full card borders, glow or large status fields.

The default application shell may legitimately contain no visible lime on a
given screen.

### Semantic colors

Semantic color communicates state, not decoration:

    positive   -> calm green
    warning    -> muted amber
    negative   -> muted red
    unknown    -> neutral grey
    pending    -> cool neutral grey

Current role examples:

    positive   -> compatible, saved, ready, positive feedback
    warning    -> condition, expiring renders, non-blocking attention
    negative   -> incompatibility, failed operation, hard conflict
    unknown    -> insufficient evidence / unresolved result
    pending    -> parser / check / generation in progress

`Нужна доработка` in result feedback is warning/amber, not error/red.

Brand lime must never substitute for positive/success. Color is never the only
status carrier: the status label and, where needed, its explanation remain
authoritative. Do not add decorative colored dots to status pills or rows.
Icons/symbols are reserved for cases where the symbol itself adds meaning.

### Action links and external links

Action links such as:

    Изменить
    Изменить данные
    Изменить ссылку
    Заменить диск

use muted neutral text with **no persistent underline**.

On hover / keyboard focus they move to near-white and may show an underline.
The focus ring remains near-white/neutral rather than lime.

A real external URL may use link affordance, but it should still remain
neutral in color; do not introduce conventional blue links into VNext.

## 6. Typography

### Core typeface

Use IBM Plex Sans as the primary application voice.

It supports the accepted synthesis of precise technical data and restrained editorial automotive presentation.

### Weights

Prefer 400, 500 and 600. Avoid habitual 700–900 UI weight. Heavy type is reserved for exceptional emphasis.

### Technical values

Use tabular numerals where alignment matters: ET, PCD, DIA, diameter, width, balance/credits and timestamps where applicable.

Values visually dominate labels.

### Display/editorial moments

Large or expressive editorial typography may appear only where the content justifies it, such as a result-focused or Garage hero state.

Do not apply a luxury serif as the default application UI voice.

Inter Tight is not part of this frozen VNext contract. Any later typeface change requires separate approval.

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

Primary CTA stays near-white in this frozen contract; a different action-color rule requires separate approval.

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

## 22. Historical open decisions for the first HTML prototype — superseded

The following questions belonged to the first prototype review. They were resolved in the canonical reconciled prototype and closing QA; they are not open decisions under the frozen contract:

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

## 23. Historical first interactive HTML prototype — superseded

The first VNext review artifact was:

`docs/references/pre-render-fitment-v2-vnext-prototype.html`

It represented the then-working A+C synthesis and provided review states for desktop
and responsive/mobile behaviour.

The prototype is a review artifact, not runtime implementation.

The review target was to expose enough states to test the system:

    compatible
    compatible_with_conditions
    incompatible
    unknown
    processing
    operational failure

Visual Try-on remains independent from Fitment in every state.

The later cross-surface and state-coverage passes applied the same design code to Dashboard / Garage, Create and Result; the [canonical prototype](../references/application-vnext-state-coverage-prototype-v3.html) supersedes this first artifact.


## 24. Historical cross-surface VNext stress-test prototype — superseded

The cross-surface review artifact at that stage was:

`docs/references/application-vnext-cross-surface-prototype.html`

It served as a unified cross-surface flow prototype for four representative
application surfaces:

- Dashboard / Garage;
- Create;
- Fitment;
- Result.

Its purpose was to test whether the same visual system remained coherent through
one connected product flow: Garage / Dashboard -> Create -> Fitment -> Result,
while Fitment remains optional for Visual Try-on.

That prototype preserved the product conventions:

- Dashboard keeps balance, primary creation action and latest-result context;
- Create keeps Vehicle and Wheel as explicit first-class inputs and preserves
  Visual Try-on / Fitment separation;
- Fitment reuses the accepted pre-render V2 visual language and keeps
  `Создать изображение` available despite an incompatible verdict;
- Result uses one viewer with `Результат / Оригинал`, keeps the result
  composition intact, and exposes the approved result actions and rating
  controls.

At that historical stage this artifact did not freeze Dashboard, Create, Result,
navigation or runtime component APIs. The present frozen UI authority is defined
at the top of this document; runtime component APIs remain outside its scope.


## 25. Historical VNext flow-level validation target — superseded

The next review pass at that stage expanded beyond a single-screen Fitment
review and evaluated one connected application language across:

    Dashboard / Garage
      -> Create
      -> optional Fitment
      -> Result

The questions for that visual QA were:

- does the shell feel like the same product on all four surfaces;
- does Dashboard remain automotive rather than becoming a SaaS dashboard;
- does Create stay task-efficient without losing the premium automotive feel;
- does Fitment remain precise without dominating the product identity;
- does Result feel like the emotional payoff while retaining the same control
  language;
- does the same system survive the 390 px mobile transformation.

This gate was subsequently satisfied by the closing QA and formal approval
recorded above. It does not constitute runtime QA.


## 26. Historical cross-surface QA pass 1 — superseded

Status at pass 1 (not the current frozen status):

    CROSS_SURFACE_QA_PASS_1 = COMPLETE
    DESKTOP_STRUCTURE = PASS
    MOBILE_390_STRUCTURE = PASS
    PIXEL_FREEZE = NOT_REACHED

The first cross-surface QA pass covered Dashboard / Garage, Create, Fitment and
Result against the same shell and responsive system.

Corrections made during the pass:

- removed duplicated desktop topbar balance/date metadata where the sidebar or
  screen already carries that information;
- preserved compact balance context in the mobile topbar, where the desktop
  sidebar is absent;
- restored a visible page-level H1 on mobile instead of hiding the screen title;
- changed Create desktop composition so the vehicle remains the main automotive
  object while the wheel stays a substantial product object;
- kept Create, Fitment and Result in the same near-white CTA / cold graphite /
  restrained-divider system;
- replaced mixed Russian/English explanatory copy with user-facing Russian;
- replaced the middle-dot metadata separator with the approved en dash;
- separated wheel identity and technical series in Result metadata;
- encoded source/result image behaviour as uncropped `object-fit: contain`;
- preserved Fitment table stacking for narrow screens and full-width mobile
  actions;
- preserved one shared mobile navigation model, with Fitment treated as a
  contextual step inside Create rather than a separate bottom-navigation item.

No surface-specific visual exception was required to keep the A+C hybrid
coherent across the four tested surfaces.

Items that remained after pass 1, subsequently resolved for the static UI
contract by the canonical prototype and closing QA:

- final photographic assets rather than schematic prototype media;
- exact token freeze for graphite, semantic colours, focus treatment and radii;
- browser/pixel QA of the final review build at the target desktop viewport and
  390 px;
- remaining application states outside this representative flow, including
  auth/session, payment/balance detail, history processing/failed variants and
  global empty/error states.


## 27. Dashboard island decision

The Dashboard is an explicit exception to the general “avoid card everywhere”
rule because it combines several independent product objects rather than one
linear task.

Accepted Dashboard structure:

    Current Vehicle island
    + Balance / render-expiry island
    + Latest Result island
    + flat Recent Render media tiles

The islands are structural grouping, not decorative SaaS cards.

The Result screen remains more image-dominant than Dashboard / Create /
Fitment. Comparison is one direct before/after slider between `Оригинал` and
`Результат`, with no parallel tabs or third comparison mode.


## 28. Preview geometry and result feedback

### Create and Fitment preview geometry

Source image dimensions must not define the application layout.

Desktop Create and Fitment use fixed responsive preview stages:

- the vehicle and wheel columns have explicit relative widths;
- both preview stages in one pair use the same vertical stage height;
- source assets render with `object-fit: contain`;
- wheel artwork remains centered inside its stage rather than stretching;
- metadata below the vehicle and wheel preview begins on the same horizontal
  baseline.

This keeps captions, subtitles and change actions aligned even when the
uploaded car photo and wheel image have different native aspect ratios.

On narrow mobile layouts the objects stack vertically, but the same
composition-preserving `contain` rule remains.

### Result comparison

Result uses one draggable before/after slider:

    Оригинал |<----> | Результат

It replaces the previous tab switcher. Do not combine tabs, a third compare
mode and the slider.

### Result feedback

Keep the existing staging feedback vocabulary and interaction:

- `Оценка результата`;
- `Помогите улучшить следующие примерки`;
- `👍 Удачный результат`;
- `👎 Нужна доработка`;
- for negative feedback:
  - `Диск отличается`;
  - `Машина изменилась`;
  - `Ракурс / масштаб`;
  - `Качество изображения`;
  - `Другое`;
- positive confirmation: `Спасибо за оценку`.

The VNext redesign changes visual treatment, not this feedback model.


## 29. Consolidated flow prototype v2

The current consolidated review artifact is:

`docs/references/application-vnext-flow-prototype-v2.html`

It supersedes the previous cross-surface prototype for the next design review.

Key revisions:

- Dashboard no longer assumes a persistent `Мой автомобиль` object; it focuses
  on new try-on entry, latest result, balance / render expiry and recent renders;
- Create removes explanatory/status copy and uses summary-first,
  form-on-demand editing;
- wheel source URL is a separate editable source from wheel technical data;
- vehicle and wheel preview stages keep fixed responsive geometry independent
  of source aspect ratio;
- Fitment preserves the accepted VNext composition;
- Result removes the inspector column and becomes image-first;
- Result uses one before/after slider and the existing staging feedback model;
- completed Result does not show a redundant `Готово` status row;
- completed Result exposes one primary product action only:
  `Создать ещё вариант`; secondary download/share/reuse/check actions are not
  part of the current v2 composition.


## 30. Flow refinement after v2 review

### Dashboard

Dashboard islands use natural content height. Balance must not stretch to match
Latest Result merely because both occupy one grid row.

### Create edit flow

The summary-first pattern remains the default. Editing is progressive:

    summary
      -> edit form
      -> save / parser refresh
      -> compact confirmation state
      -> summary

Vehicle and manually edited wheel data expose an inline saved state after
confirmation.

Changing a wheel product URL is a source refresh, not plain text editing. The
prototype therefore shows a short parser state before returning to the summary.
Runtime parser failure/recovery remains governed by the feature state contract.

### Result actions

For the current completed-result composition, keep one product action:

    Создать ещё вариант

Do not create a second action row for download, share, reuse or fitment. If a
future product contract reintroduces a contextual technical link, use
`Проверка совместимости` rather than `Открыть проверку`.

Result feedback remains a separate feedback interaction and is not counted as
a product action.


## 31. Link and semantic-color QA pass

The consolidated v2 prototype now applies the color/link rules above:

- action links no longer carry a permanent underline;
- underline appears only as hover/focus affordance;
- external source URLs remain neutral rather than blue;
- primary CTA remains near-white;
- positive / warning / negative / unknown / pending have separate semantic
  tokens;
- brand lime is retained in the token set but is intentionally absent from
  ordinary navigation, CTA and Fitment status treatment.

This pass does not expand the amount of color in the interface. It makes the
existing color usage systematic.


## 32. Historical Mobile 390 and Create state pass — superseded

Status at this intermediate pass (not the current frozen status):

    VNEXT_V2_MOBILE_390_STRUCTURE = PASS
    CREATE_FORM_STATE_MODEL = REPRESENTED
    CREATE_PARSER_FAILURE_RECOVERY = REPRESENTED
    FINAL_PIXEL_FREEZE = NOT_REACHED

### Result CTA hierarchy

Completed Result keeps one product action, `Создать ещё вариант`, but it is
visually attached to the result identity block rather than floating at the far
right of the page header.

This keeps the screen editorial and image-first:

    identity / metadata
      -> create another variant
      -> comparison viewer
      -> feedback

### Mobile 390 transformation

The 390 px layout preserves the desktop hierarchy without shrinking it
mechanically:

- Dashboard islands stack with compact internal spacing;
- Recent renders become a single-column media list;
- Create stacks vehicle and wheel previews and reduces wheel-stage height;
- summary rows become vertical label / value / action groups;
- edit forms become one-column and actions become full-width;
- Fitment previews stack, the technical table becomes grouped parameter blocks
  and CTA actions become full-width;
- Result uses a square comparison viewer at 390 px so the before/after control
  remains usable without creating an excessively short image strip;
- bottom navigation retains the shared application language and safe-area
  padding.

### Create form and parser states

Summary-first remains the default state. The prototype now represents:

    idle summary
    -> editing
    -> save
    -> saved confirmation

For wheel product URL:

    edit URL
      -> parser loading
      -> success
         or
      -> parser failure
          -> try another URL
          or
          -> upload manually

Parser failure is not a Fitment verdict and does not alter the Visual Try-on /
Fitment separation.

The review harness can switch the URL parser between success and error so both
states can be inspected without changing runtime code.

### Freeze note

This note records an earlier structural-QA milestone. Browser review with real
demo assets and formal UI-contract approval are recorded in the [closing QA](vnext-full-screen-qa-audit.md)
and the frozen status at the top of this document.


## 33. State coverage prototype v3

The canonical frozen interactive reference is:

[Reconciled state coverage prototype v3](../references/application-vnext-state-coverage-prototype-v3.html)

It extends the accepted v2 happy-path composition without changing the current
runtime.

### Source authority used for the added states

The added states are grounded in the current staging contracts and runtime
copy:

- `docs/sprint-3-ui.md` for completed / processing / failed history states;
- `docs/commercial-beta-ux.md` for controlled generation failure and
  no-charge recovery;
- `docs/auth-v1.1-release-scope.md` plus the current `webapp/app.js` auth
  vocabulary for Email OTP, Telegram and session restoration;
- `docs/ui/pre-render-fitment-v2-state-inventory.md` for expired / restoring /
  restored session semantics and the no-auto-replay rule;
- current `webapp/app.js` wallet package, Robokassa, payment-state and expiry
  vocabulary.

### Real repository assets

The v3 state review uses the existing staging demo assets where the technical
scenario does not depend on synthetic Fitment values:

- `webapp/assets/demo-vehicle-zeekr.jpg`;
- `webapp/assets/demo-rim-xtrike.png`;
- `webapp/assets/demo-render-zeekr-xtrike.jpg`.

The accepted Fitment incompatibility anchor remains a controlled technical
fixture until a real asset + fully verified technical dataset is available for
that same scenario.

### Render processing

The prototype represents render work as an asynchronous state rather than a
fake percentage progress meter.

User-facing processing vocabulary remains aligned with staging:

    Создаём виртуальную примерку
    Создаём примерку...
    Это может занять до 90 секунд

History remains the durable place for the job after navigation.

### History

The v3 history review includes all three Sprint 3 terminal/current states:

    completed  -> Готово / Открыть
    processing -> Создаём виртуальную примерку / В обработке
    failed     -> Не удалось создать виртуальную примерку
                  Рендеры не списаны
                  Повторить

Processing and failed entries do not expose result comparison or rating.

### Authentication and session

Review states:

    restoring
    login
    email OTP
    expired session

Release 1 authorities remain Email OTP through Supabase and Telegram.

For session expiry, restoration preserves entered semantic context but never
automatically replays the previous provider, Fitment or Render action.

### Balance and payment

The Balance review keeps the existing credit model:

    100 ₽  -> 3 renders
    200 ₽  -> 7 renders
    500 ₽  -> 20 renders
    1000 ₽ -> 45 renders

Package duration shown by the current runtime is 30 days.

The screen keeps expiry batches and nearest-expiry consumption guidance and
represents payment states as:

    pending
    paid
    failed

Payment remains routed through Robokassa; the VNext work changes presentation,
not payment architecture.

### Global empty / controlled error states

The prototype includes reviewable states for:

- empty render history;
- generation temporarily unavailable with the existing no-charge message;
- balance temporarily unavailable.

These states use the same quiet semantic-color system as the rest of VNext and
avoid large destructive error surfaces.

### Freeze note

This earlier state-coverage milestone was superseded by the [closing QA PASS](vnext-full-screen-qa-audit.md)
at desktop 1440×1000 and mobile 390×844 and by formal UI-contract approval.
The static prototype QA does not cover runtime, API, payments or real devices.


### Balance title and payment history

The Balance screen uses one page-level title only. Do not repeat `Баланс` as a
second section heading immediately below the page header.

Payment history remains part of the product and must not be removed by the
VNext simplification pass. The VNext Balance composition includes:

    current available renders
    expiry cohorts
    top-up package selection
    receipt email
    current / latest payment state
    top-up history

Top-up history preserves the current runtime concepts:

    amount
    received render count
    date/time
    invoice number
    status

Supported visible payment states remain:

    Оплачено
    В ожидании
    Сбой

The status may use restrained semantic text/border color, but no decorative
colored dot.


## 34. History and Balance refinement

### History

The VNext History screen is an archive, not a dashboard card stack.

Rules:

- keep one page-level `Мои примерки` title only;
- group entries by date;
- use compact horizontal archive rows on desktop;
- reduce preview size relative to the previous card treatment;
- use plain semantic status text instead of status pills;
- keep `Открыть` only for completed results;
- keep `Повторить` only for failed renders;
- processing entries remain non-terminal and do not expose a result action.

The compact archive treatment should scale to long render histories without
turning the page into a wall of large cards.

### Balance operational payment card

The right-side payment island is conditional, not permanent.

Show it only when the latest payment still requires user action, for example:

    В ожидании подтверждения
    [ Обновить статус ]

For `paid` or `failed` review states, do not keep a redundant permanent
`Последняя оплата` island. Historical outcomes belong in the payment history.

### Payment history

`История пополнений` is always present below the main Balance / top-up area.

It uses a visually light archive table rather than a second heavy card stack.
Each row keeps:

    amount
    render count
    date/time
    invoice id
    payment status

Payment status is plain semantic text, not a pill and not a colored dot.

The history remains expandable with `Показать ещё`.
