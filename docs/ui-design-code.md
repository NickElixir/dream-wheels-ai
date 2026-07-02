# Dream Wheels AI — UI Design Code

> **Status:** approved reference for the Sprint 1 cabinet and Sprint 2 create flow.
>
> Canonical interactive references:
> - `docs/references/sprint-1-dashboard.html`
> - approved Sprint 2 prototype: `dream_wheels_dashboard_adaptive_demo_v15_sprint2.html` (to be copied into repository reference assets before implementation)

## Scope and boundaries

This document defines user-facing design and interaction rules for the cabinet, upload entry, Sprint 2 identity confirmation, balance/wallet, render history, and visual feedback. It is a UI reference, not a replacement for backend contracts.

Rendering and Fitment are independent. A visual result must never be presented as proof of technical compatibility.

## Visual foundation

Use the established dark Dream Wheels system:

- background `#070809` with restrained dark radial glow;
- panels `#161a22`, `#1b2029`, `#202631`;
- text `#eef2f6`; muted text `#a3adba`, `#7e8896`;
- accent `#ddff00` / `#e7ff3a`;
- semantic success `#27d88a`, warning `#ffcc56`, danger `#ff6666`;
- panel radius 18–28 px, thin translucent borders, soft shadows.

Do not let browser-default button colours or focus outlines leak into the interface. Use product-owned foreground colours and `:focus-visible` rings.

Standalone interface guidance and helper copy should not end with a period, except legal, multi-sentence, or technically necessary copy.

## Buttons and motion

- Primary CTA: acid fill, dark text, strong weight, highest priority.
- Secondary action: dark outlined island chip, minimum 44–48 px touch target.
- Inline actions must remain chips rather than naked text links when competing with controls.
- Keep animation restrained: fade and `translateY(-6px → 0)` around 220–300 ms.
- Respect `prefers-reduced-motion`.

## Responsive navigation

### Desktop

Permanent sidebar in a real layout column:

```text
Основное
- Главная
- Примерить диски
- Мои примерки
- Баланс

Помощь
- Поддержка
- Как подготовить фото
- Документы
```

The wordmark returns to **Главная**. Keep the account block at the bottom. Main content starts after the sidebar and keeps a bounded centered rail with visible gutters.

### Mobile

Bottom navigation:

```text
Главная · Создать · История · Баланс · Ещё
```

`Ещё` opens a compact bottom sheet with support, photo guidance, and documents.

## Status islands

Use islands for meaningful asynchronous state, warning, validation, or account information—not every interaction.

- hidden: `max-height: 0`, zero vertical padding, opacity 0, `translateY(-6px)`;
- shown: normal padding, opacity 1, `translateY(0)`;
- tones: loading, success, warning, error.

### Critical error island

Use a red critical island when identity resolution fails in a way the user can fix or retry, for example:

- missing Telegram auth / missing `init_data` or `telegram_user_id`;
- backend route mismatch or unavailable Sprint 2 API;
- any other failure that would otherwise leave the flow stuck in loading or an empty validation state.

Recommended structure:

```text
Нужен вход в Telegram
Этот шаг требует `init_data` или `telegram_user_id`. Откройте Mini App из Telegram или нажмите «Войти через Telegram» сверху, затем повторите проверку
[ Войти через Telegram ] [ Повторить ]
```

Rules:

- use danger styling, not warning styling, for auth/backend blockers;
- keep the message specific and actionable, not generic;
- prefer one primary recovery action and one retry action;
- keep the island visible until the user changes state or retries successfully;
- do not use a disabled CTA to represent this condition;
- do not leave the user in an infinite loading state when the request has already failed;
- if the backend is the cause, explain that the preview points to a backend without the Sprint 2 routes or that the API host needs to be corrected;
- keep the critical island visually separate from the visual-renders review island so users do not confuse render generation with fitment or auth recovery.

## Dashboard and history

Dashboard contains account heading, balance, latest render/empty state, **Создать виртуальную примерку**, and quick links.

Use **рендеры** in Russian UI, not `credits`.

For completed history items, show readable scenario name, date, and `Готово`; never expose raw filenames or transport errors. `Открыть` expands one result inside the same card; only one card may be open. The opened image must use full card width, `width: 100%`, `height: auto`, and no cropped `object-fit: cover` presentation.

## Render-expiry island

Show only when backend supports immutable grant-level expiry:

```text
Срок действия рендеров                         Подробнее →
16 рендеров                                    до 15 июля
20 рендеров                                    до 30 июля
⚠ Сначала используются рендеры с ближайшей датой окончания
```

No decorative hourglass. Do not populate it from mock or browser-local data.

## Upload entry — existing approved screen

Sprint 2 must preserve the approved upload screen and its existing mechanics:

```text
Загрузите фото машины и диска
Машина целиком сбоку, диск анфас. JPG или PNG, до 10 МБ
```

- two large stacked zones: **Фото машины**, **Фото диска**;
- light user-facing labels and helper text;
- soft warning island about fully visible car wheels;
- no redesign of upload zones during Sprint 2.

## Sprint 2 — Assisted Vehicle & Rim Identification

### Product purpose

Sprint 2 improves visual-render accuracy without turning the first experience into a technical fitment form.

It is a single-page flow inside **Примерить диски**. It uses progressive disclosure: existing upload block first, then new islands below it. It is not a multi-route wizard.

```text
Existing upload screen
→ Определить данные
→ AI analysis island
→ confirmation islands
→ review island
→ Создать виртуальную примерку
```

### AI analysis island

After both images are uploaded, the primary action is **Определить данные**.

Show a short loading island:

```text
Определяем автомобиль и диск
Анализируем фото. Это не проверка совместимости — данные нужны для более точной виртуальной примерки
```

Never use compatibility language here.

### Vehicle confirmation island

Show one primary AI proposal:

```text
Автомобиль
Lexus RX · 2020
[ ✓ Верно ]
```

Rules:

- quick identity contains make, model, and year or year range;
- show at most two alternative candidates;
- alternatives are selectable chips/cards, not a full vehicle catalogue selector;
- selected candidate receives accent outline/background;
- copy explains that the user is checking an AI proposal;
- confidence can be shown as a compact pill, never as a guarantee.

### Rim confirmation island

Show only values that support render proportions:

```text
Диск
Диаметр: 20"
Ширина: 8.5J
PCD: 5×114.3
```

Rules:

- width is mandatory in quick identity because it affects visual wheel proportions;
- display PCD as `NxPCD`, for example `5×114.3`;
- backend stores PCD as `bolt_count` plus `pcd_mm`; this implementation detail must not dominate user-facing copy;
- keep a compact confidence pill;
- actions are `✓ Верно` and `Не уверен`;
- do not offer speculative rim alternatives in the first UX.

Do not show wheel brand, model, SKU/article, product URL, ET, DIA, fastener type, fitment recommendations, or compatibility status in the default quick confirmation UI.

### Review island

Show an explicit pre-render summary:

```text
Всё готово
Автомобиль     Lexus RX · 2020
Диск           20" · 8.5J · 5×114.3
Назначение     Визуальная примерка

Совместимость пока не проверена. Это визуальный рендер, а не технический fitment verdict

[ Создать виртуальную примерку ]
```

The final CTA is the acid primary button.

### Future fitment teaser

Below the Sprint 2 review CTA show a non-clickable informational island:

```text
Проверка совместимости — скоро
Позже здесь появится техническая проверка PCD, ширины, ET, DIA и условий установки
```

Do not use a disabled CTA. Do not promise a date. Do not show this as a currently available technical feature.

### Responsive layout

- desktop: vehicle and rim confirmation may sit in a two-column layout only when card width remains comfortable;
- mobile: all islands stack in a single column;
- review stays readable with label/value rows;
- panel spacing must make every island visually distinct.

## Wallet and payment

Keep the approved three-step payment layout: package → receipt email → confirm/open Robokassa. Keep package emojis ⚡ 🏁 💎 👑. Package expiration copy follows the same backend condition as the render-expiry island.

## Visual feedback UI

Feedback is a secondary completed-render control only:

```text
Как результат?
[ 👍 Понравилось ] [ 👎 Не похоже ]
```

Positive selection uses success styling and acknowledgement. Negative selection reveals inline reason chips, no modal and no submit button. In Sprint 1 it remains UI/in-memory only; persistent feedback belongs to Sprint 3 and must be tied to a durable render/job id.

## Implementation handoff

Before Sprint 2 implementation, Codex must treat this document, `docs/product-roadmap.md`, the Fitment ADRs, schema, API contract, and the approved Sprint 2 HTML prototype as mandatory references. Preserve existing upload design. Do not turn prototype mock data into a frontend source of truth. Do not implement Fitment Verdict, provider lookup, Wheel Size integration, detailed fitment form, or wheel brand-recognition UI in Sprint 2.
