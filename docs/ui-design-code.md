# Dream Wheels AI — UI Design Code

> **Status:** canonical approved design contract for the cabinet, create flow, result detail, history, balance, and future Fitment UI work.
>
> `UI_DESIGN_BASELINE = FROZEN`
>
> This document is the visual and terminology authority. The required delivery
> process is [UI development process](ui/ui-development-process.md). A frozen
> feature state specification is the behavioural authority for that feature;
> its product/domain contract remains authoritative for domain meaning. This
> document does not design Standard Fitment UI; that separate artifact will be
> `docs/ui/fitment-ui-state-spec-v1.md`.
>
> Supporting references, not parallel authorities:
> `docs/references/sprint-1-dashboard.html`,
> `docs/references/sprint-2-create-flow.html`, `docs/sprint-3-ui.md`,
> `docs/references/fitment-verdict-fallbacks.html`, and
> `docs/references/standard-extended-fitment-check.html`.

## Visual foundation

- The product is a dark cabinet with a bright lime accent: technological,
  strict and restrained, never generic or excessively AI-ish.
- Use islands/cards to group meaningful content and state. Do not turn every
  sentence into a floating card or decorative glow surface.
- Background `#070809`; panels `#161a22`, `#1b2029`, `#202631`.
- Text `#eef2f6`; muted `#a3adba`, `#7e8896`.
- Accent `#ddff00` / `#e7ff3a`; success `#27d88a`; warning `#ffcc56`; danger `#ff6666`.
- Panels use 18–28 px radii, thin translucent borders, and restrained shadows.
- Buttons and focus rings use product-owned colours. Avoid native browser styling.

## User-facing terminal punctuation

Do not use a terminal full stop (`.`) in a standalone user-facing UI text
block. This includes headings, labels, buttons, badges, statuses, captions,
helper text, inline validation, warnings, disclaimers, error explanations,
informational paragraphs, notification bodies and standalone instructional
paragraphs.

```text
Сессия истекла
Войдите через Telegram, чтобы продолжить
```

Ordinary punctuation inside text remains correct. A full stop may separate
sentences, provided the final sentence has no terminal full stop:

```text
Не удалось загрузить комплектации. Введённые данные сохранены
```

This is not a ban on all terminal punctuation. A real question keeps `?`; `!`
is allowed only when semantically necessary and should be rare; colons,
commas, dashes and other internal language punctuation remain valid. For
example, `Как получился результат?` is correct.

When moving previously approved warning or disclaimer copy to production UI,
it is permitted to remove only its terminal full stop. Do not change meaning,
words, sentence order or legal qualification under the guise of punctuation
cleanup. Content authority and this punctuation house style are separate
layers.

## Spacing and empty space

- Use a four-step spacing scale: 9 px compact paired controls, 12 px within a small island, 16 px between screen sections and regular card content, 24 px only between independent groups
- A compact auth or status island paired with its related balance or action uses 9 px, never a larger generic card gap
- A screen-level sequence of panels uses 16 px. Larger whitespace must have a clear structural purpose, such as separating independent flows or accommodating a fixed navigation area
- Hidden, loading, or empty states must not reserve a visual gap in a panel. Remove them from the layout until they are visible
- Do not create standalone fixed-height spacers. Vertical rhythm comes from the spacing scale, content padding, and meaningful component separation

## UI review sequence

Every UI change must be reviewed in this order before handoff:

1. Run the local app and inspect the current guest state in the browser
2. Check the desktop layout and a mobile viewport
3. Walk through every affected screen and the adjacent navigation states
4. Verify all requested Russian copy, then verify the matching English copy
5. Check loading, empty, warning, error, authenticated, and unauthenticated states
6. Verify repeated components against their canonical screen, including size, alignment, colour, icon, and button state
7. Re-check the original request item by item and search the codebase for superseded copy
8. If authentication is required for a state, ask the user to authenticate in Telegram and continue the review after access is available

The review is incomplete until the changed flow is checked in the browser after the final code change

## Separators and numbers

- Never use a full stop, middle dot (`·`), bullet (`•`), or a similar glyph as a visual separator in user-facing UI.
- Prefer the en dash `–` for an explanatory clause or status metadata. Do not use a dot-like glyph to separate pieces of metadata.
- Technical parameter series use spaces around a slash: `20" / 8,5J / 5×114,3` in Russian and `20" / 8.5J / 5×114.3` in English.
- Russian decimal values use a comma. A decimal point is allowed only in English locale, URLs, and code-like identifiers.
- Vehicle and rim names use spaces only: `Toyota Prius`, `OZ Ultraleggera`. Put vehicle year/generation and rim specifications on a separate secondary line instead of joining them with a dash.
- Use an en dash for explanatory clauses and non-entity status metadata; use commas for natural-language lists.

## Navigation and motion

Desktop uses a permanent sidebar in a real layout column: Главная, Примерить диски, Мои примерки, Баланс; Support, photo guidance, documents. Mobile follows the same product destinations with compact labels: Главная, Создать, Мои, Баланс, Ещё.

Use restrained fade and small translate motion. Respect `prefers-reduced-motion`.

Do not duplicate navigation inside a page when the relevant desktop sidebar or
mobile navigation already provides it. A contextual back action is allowed only
when it returns to the immediately preceding flow.

## Page headers

- Each screen has one page-level title in the topbar. Do not repeat it in a hero, a compact header island, or the first content panel
- Each internal page has one primary H1 only. An eyebrow or subtitle must add
  new context; it must not repeat the H1 in different styling.
- The topbar caption uses the primary text colour and a 700 weight. It is the visual title of the screen, not a muted breadcrumb
- On small screens, a long caption may move to a second row inside the topbar. Do not wrap it in a separate background, border, or card

## Sticky actions and responsive boundaries

- A sticky CTA belongs to a defined action boundary, not over independent
  content, cards, navigation, or warnings.
- Reserve content padding for any fixed action area so the final control and
  disclosure remain reachable.
- On mobile, account for the device safe area; CTA height, bottom navigation
  and safe-area inset must not overlap.
- Check desktop and a 390 px mobile viewport for horizontal overflow,
  truncation, sticky overlap and keyboard/action reachability.

## Product terminology and approved labels

Use terms consistently:

- **примерка** is the user-facing visual process and result;
- **рендер** is the commercial unit;
- **генерация** is the technical action that creates an image, not a synonym
  for a completed result;
- technical fitment is a separate preliminary assessment, never a synonym for
  visual try-on or rendering.

The approved recurring labels are `Главная`, `Примерить диски`, `Мои
примерки`, `Баланс`, `Создать примерку`, `Создать изображение`, `Создать ещё
вариант`, `Пополнить баланс`, `Перейти к оплате`, and `Открыть последний
результат`. Reuse these labels where their established action semantics apply;
do not replace them with ad-hoc synonyms during implementation. Do not use
`История рендеров` as the primary user-facing section name or `Пополнить счёт`
as the approved top-up CTA.

## Status islands

Use islands only for meaningful loading, success, warning, or error states. Identity/auth blockers use a visible danger island with actionable recovery, never an endless loading state.

Fitment preparation uses one context marker only: `Demo` is a small environment label shown next to `Вернуться к примерке` in preview mode. Do not show a second `Предварительно` badge; readiness copy already explains that the data is not a technical verdict.

Completed render history uses a compact summary island for the vehicle name, wheel specs, date, guest note, and status. The `Готово` status must not stretch across the card as a full-width bar.

Warnings and disclaimers are visible, concise and non-modal unless the domain
state genuinely blocks the action. User-facing copy must describe the next
safe action without exposing internal/provider diagnostics. A warning,
readiness badge or confirmation label must have the exact domain meaning that
the backend contract assigns to it.

## Common image rule

A complete car composition is more important than filling a fixed visual box.

- Main source/result image: `width:100%`, `height:auto`, `object-fit:contain`.
- Do not crop a result or original with `object-fit:cover`.
- Compact history thumbnails stay in a fixed frame but use `object-fit:contain`; neutral dark letterboxing is acceptable.

## Sprint 2 — create flow

The upload flow is one page with progressive islands and no outer container around the whole scenario:

```text
Upload → Определить данные → AI proposal → confirmation → review → render
```

- Car photo and wheel photo are two equal cards on desktop and stack on mobile
- Each photo card contains its own upload area or preview, completion label, and replacement action
- Keep uploaded images uncropped with `object-fit: contain`; their frames follow the source aspect ratio
- Consent, product link, recognition state, confirmation, and review are separate full-width blocks
- Recognition is a normal status island in the content flow. It must not look like a CTA, overlap content, or extend beyond the main column
- The website fallback CTA belongs after the current flow content and must not be fixed over cards or navigation

Vehicle: make, model, year/range; primary proposal plus up to two alternatives. Rim: diameter, mandatory width, PCD. PCD displays as `5×114.3`; backend stores `bolt_count` plus `pcd_mm`. Do not show rim brand/model, SKU, ET, DIA, technical compatibility, or a full vehicle selector.

The upload preview preserves the entire image with `object-fit: contain`. Its frame follows the uploaded image aspect ratio with restrained motion instead of cropping it into a fixed-height box.

Review explicitly says the try-on is visual and compatibility is not checked. Do not repeat this warning with a future-stage banner: the editable fitment preparation screen becomes available from a completed result, while the automated technical verdict is not yet implemented.

## Sprint 3 — result detail, comparison, history and rating

### Result detail

Open the selected result in the existing history context; do not create a new route. Desktop has viewer left and actions/rating right. Mobile stacks vertically.

Use one image viewer and a full-width segmented control above it:

```text
[              Результат              ][              Оригинал              ]
```

- both segments have equal width and 44–48 px minimum height;
- result is active by default;
- selecting Original swaps the same viewer image with a short fade;
- do not use a side-by-side view or comparison slider in Sprint 3.

### Actions

Show `Скачать изображение` and primary `Создать ещё вариант`.

`Создать ещё вариант` is the current approved recurring Result CTA. Its exact
Result/History reuse semantics—including whether and how car or rim context is
restored—must be defined by the current Result/History state specification
before that flow is redesigned. Historical Sprint 3 documents do not silently
override this canonical terminology or decide the reuse behaviour.

### Rating controls

Show only for a completed job:

```text
Как получился результат?
[ 👍 Понравилось ] [ 👎 Не похоже ]
```

- Like uses success selected styling and acknowledgement; clicking it again clears the selection.
- Dislike uses warning selected styling and reveals inline single-select reasons: Диск отличается, Машина изменилась, Ракурс / масштаб, Качество изображения, Другое.
- No modal, text area, or submit button.
- Persisted data is tied to the durable render job. The UI must reload the current server record; browser-local state is not authoritative.

### History states

```text
Completed:  Готово / Открыть
Processing: Создаём изображение / В обработке
Failed:     Не удалось создать изображение / Рендеры не списаны / Повторить
```

Comparison and rating controls are unavailable for processing and failed jobs.

## Boundaries

A visual render is never technical fitment proof. Do not add a Fitment Verdict, provider lookup, detailed fitment form, comparison slider, free-text rating, analytics dashboard, or automatic ML dataset ingestion in these sprints.

Fitment verdict never blocks the visual try-on. A render may proceed without a
technical verdict, and a verdict must never be presented as proof that the
visual result is technically installable.

## Existing surface conventions

- **Dashboard:** permanent desktop shell, balance context, primary creation
  action and latest-result state; balance remains backend-derived.
- **Create:** one progressive flow of upload → recognition → confirmation →
  review → render, using separate state islands rather than a wrapper card for
  the entire scenario.
- **Result:** preserve composition in one viewer; comparison switches the same
  viewer instead of creating a second image surface.
- **History:** completed, processing and failed states are distinct; actions
  only appear when their server-backed prerequisites hold.
- **Balance:** shows render units and approved `Пополнить баланс` / `Перейти к
  оплате` recovery without optimistic client-side balance mutations.

## MUST PRESERVE / SAFE TO CHANGE

**MUST PRESERVE**

- dark cabinet, lime accent, restrained technological visual language;
- desktop sidebar and established mobile navigation conventions;
- one-H1 hierarchy, compact spacing, card/island composition and full-image
  composition rules;
- approved terminology, action semantics and warning/disclaimer boundaries;
- separation of visual try-on from technical fitment;
- established Dashboard, Create, Result, History and Balance conventions.

**SAFE TO CHANGE after the process freeze for the affected feature**

- copy placement, component composition and responsive arrangement where the
  approved state/CTA matrix requires it;
- styling details that preserve the above visual language and accessibility;
- feature-specific UI inside a separately frozen state specification.

Do not introduce a new visual language, a second navigation pattern, an
unapproved hierarchy or local heuristic state under the label of a safe change.

## Fitment boundary and next artifact

The next separate Fitment artifact is
`docs/ui/fitment-ui-state-spec-v1.md`. It will later record the state
inventory, text wireframes, CTA matrix, copy/error matrix, responsive
behaviour, prototype reference and E2E state matrix. Do not infer or prefill
those feature states here.

`docs/references/standard-extended-fitment-check.html` remains a historical
visual reference only. It is not a runtime data source or authority for
Standard Fitment V1 product semantics. The frozen Fitment domain contract in
`docs/fitment/fitment-verdict-v1.md` takes precedence, including ET outside a
provider-derived interval being `unknown`, not a conditional positive result.

## Implementation handoff

Codex must read `docs/product-roadmap.md`, this file, `docs/sprint-3-ui.md`, `docs/adr/0003-render-feedback-data-boundary.md`, and `docs/render-feedback-api-contract-v1.md` before Sprint 3 work. Historical Sprint 3 documents are context, not authority to override the current canonical terminology or an unfrozen Result/History reuse specification. Do not turn prototype data into a frontend source of truth.
