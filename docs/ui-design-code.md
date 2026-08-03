# Dream Wheels AI — UI Design Code

> **Status:** approved reference for Sprint 1 Cabinet, Sprint 2 create flow, Sprint 3 result detail, Sprint 4 fitment preparation, and the Standard / Extended Fitment Check handoff.
>
> Canonical references: `docs/references/sprint-1-dashboard.html`, `docs/references/sprint-2-create-flow.html`, `docs/sprint-3-ui.md`, `docs/references/fitment-verdict-fallbacks.html`, and `docs/references/standard-extended-fitment-check.html`.

## Visual foundation

- Background `#070809`; panels `#161a22`, `#1b2029`, `#202631`.
- Text `#eef2f6`; muted `#a3adba`, `#7e8896`.
- Accent `#ddff00` / `#e7ff3a`; success `#27d88a`; warning `#ffcc56`; danger `#ff6666`.
- Panels use 18–28 px radii, thin translucent borders, and restrained shadows.
- Buttons and focus rings use product-owned colours. Avoid native browser styling.
- Mandatory copy rule: every user-facing label, caption, heading, subheading, warning, status, button, helper text, and generated paragraph must end without punctuation in every locale
- This rule applies to static HTML, translated strings, dynamic states, validation messages, and generated UI copy; punctuation inside a sentence remains allowed

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

Desktop uses a permanent sidebar in a real layout column: Главная, Примерить диски, Мои примерки, Баланс; Support, photo guidance, documents. Mobile uses: Главная, Создать, История, Баланс, Ещё.

Use restrained fade and small translate motion. Respect `prefers-reduced-motion`.

## Status islands

Use islands only for meaningful loading, success, warning, or error states. Identity/auth blockers use a visible danger island with actionable recovery, never an endless loading state.

Fitment preparation uses one context marker only: `Demo` is a small environment label shown next to `Вернуться к рендеру` in preview mode. Do not show a second `Предварительно` badge; readiness copy already explains that the data is not a technical verdict.

Completed render history uses a compact summary island for the vehicle name, wheel specs, date, guest note, and status. The `Готово` status must not stretch across the card as a full-width bar.

## Common image rule

A complete car composition is more important than filling a fixed visual box.

- Main source/result image: `width:100%`, `height:auto`, `object-fit:contain`.
- Do not crop a result or original with `object-fit:cover`.
- Compact history thumbnails stay in a fixed frame but use `object-fit:contain`; neutral dark letterboxing is acceptable.

## Sprint 2 — create flow

Keep the approved upload screen unchanged. The flow is one page with progressive islands:

```text
Upload → Определить данные → AI proposal → confirmation → review → render
```

Vehicle: make, model, year/range; primary proposal plus up to two alternatives. Rim: diameter, mandatory width, PCD. PCD displays as `5×114.3`; backend stores `bolt_count` plus `pcd_mm`. Do not show rim brand/model, SKU, ET, DIA, technical compatibility, or a full vehicle selector.

The upload preview preserves the entire image with `object-fit: contain`. Its frame follows the uploaded image aspect ratio with restrained motion instead of cropping it into a fixed-height box.

Review explicitly says the render is visual and compatibility is not checked. Do not repeat this warning with a future-stage banner: the editable fitment preparation screen becomes available from a completed result, while the automated technical verdict is not yet implemented.

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

Repeat restores the prior server-backed car/rim assets and confirmed identity context in the create flow. It does not create a job or debit a render until the user explicitly starts a new render.

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
Processing: Создаём виртуальную примерку / В обработке
Failed:     Не удалось создать виртуальную примерку / Рендеры не списаны / Повторить
```

Comparison and rating controls are unavailable for processing and failed jobs.

## Boundaries

A visual render is never technical fitment proof. Do not add a Fitment Verdict, provider lookup, detailed fitment form, comparison slider, free-text rating, analytics dashboard, or automatic ML dataset ingestion in these sprints.

## Standard and Extended Fitment Check handoff

`docs/references/standard-extended-fitment-check.html` is the current visual and interaction contract for the future Standard and Extended Fitment Check flow. It is not a runtime data source. Production UI must receive separate `blocking issues`, `conditions`, `advisories`, and provider execution status from the backend; internal diagnostic codes are not user-facing copy.

An ET value outside the calculated reference interval is shown as `Совместимо с условиями` only when the rules engine has no confirmed hard conflict. The user-facing condition must require a physical check of inner and outer clearances before installation. This state is not an unconditional positive verdict.

## Implementation handoff

Codex must read `docs/product-roadmap.md`, this file, `docs/sprint-3-ui.md`, `docs/adr/0003-render-feedback-data-boundary.md`, and `docs/render-feedback-api-contract-v1.md` before Sprint 3 work. Do not turn prototype data into a frontend source of truth.
