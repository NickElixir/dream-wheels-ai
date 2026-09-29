# Dream Wheels AI — VNext Visual System 2.0, Phase 1

**Date:** 2026-09-29
**Status:** APPROVED DIRECTION — implementation pending
**Scope:** pre-production visual refinement only

## Purpose

Phase 1 is a deliberately narrow refinement of the completed VNext presentation migration.

The immediate goal is to improve readability, hierarchy and visual confidence before the Fitment repair and production-readiness work, without starting the larger desktop layout redesign explored in the 2026-09-29 reference concepts.

This document supplements:

- `docs/ui/dream-wheels-application-design-code-vnext-v0.1.md`;
- `docs/ui/dream-wheels-application-design-code-vnext-amendment-2026-09-27.md`.

Where this document is more specific about Phase 1 typography, colors and state treatment, it is the current implementation authority for that narrow scope.

## Phase 1 boundary

Phase 1 may change:

- typography hierarchy;
- neutral and semantic color tokens;
- surface contrast;
- selected / active state treatment;
- borders and dividers;
- text contrast;
- primary and secondary button treatment;
- status copy presentation where it can be changed without altering product flow.

Phase 1 must **not**:

- redesign page information architecture;
- introduce the B3 photographic garage background into the runtime UI;
- move major blocks into a new desktop composition;
- introduce a new visual rail;
- redesign Dashboard, Balance or Fitment layout architecture;
- add vehicle thumbnails to exact vehicle variant choices;
- redesign the logo;
- add new navigation items;
- add new product capabilities;
- change Fitment progression/runtime;
- change payment, credits, auth, render or API behavior.

The larger layout concepts are recorded separately and are intentionally deferred until after the production release.

---

## 1. Typography

Use IBM Plex Sans, or the already bundled equivalent authority, for application UI.

### Hierarchy

The UI should use fewer weak gray text levels and a clearer hierarchy:

1. **Primary heading / primary value** — near white, highest contrast.
2. **Primary body / control value** — high-contrast light gray.
3. **Secondary explanatory text** — cool medium-light gray.
4. **Tertiary / metadata** — muted gray, but still readable.

Use weight, scale and spacing before introducing color.

### Rules

- Page titles and major section headings must have stronger contrast than the current VNext desktop implementation.
- Input values, selected choices and important object names must not visually collapse into secondary copy.
- Avoid very low-contrast gray body text.
- All-caps is reserved for compact section labels or wordmark treatment, not ordinary copy.
- Do not use decorative display typography inside normal application controls.

---

## 2. Neutral color and surface hierarchy

The visual direction is dark cold graphite, not pure black.

Implementation may tune the exact existing tokens, but should converge on this semantic hierarchy:

| Token role | Reference value | Purpose |
| --- | --- | --- |
| Canvas | `#090D10` | deepest application background |
| Surface 1 | `#0D1317` | passive content grouping |
| Surface 2 | `#12191F` | interactive controls / active work areas |
| Surface selected | `#1A232A` | selected choice / active surface |
| Border subtle | `#263039` | normal dividers / input borders |
| Border strong | `#46525C` | selected / focused boundary |
| Text primary | `#F2F4F5` | headings / values |
| Text secondary | `#B7C0C6` | normal supporting copy |
| Text tertiary | `#7E8A92` | metadata / helper copy |
| Primary CTA | `#F1F2F2` | near-white action fill |
| Primary CTA text | `#111518` | dark text on primary CTA |

These values are starting references, not an instruction to bypass contrast testing. The implementation should preserve the cold graphite character and avoid accidental blue, purple or warm-black drift.

### Rules

- Create hierarchy primarily by surface lightness, text contrast, spacing and border strength.
- Do not make every section the same gray.
- Do not add glow.
- Do not add decorative gradients.
- Do not use glassmorphism.
- Do not create a generic dark SaaS card system.

---

## 3. Selected and active states

Selected state should be clear without iconography.

Use:

- a slightly lighter graphite surface;
- a stronger neutral border;
- stronger text;
- focus ring only when required for keyboard accessibility.

Do **not** require:

- radio-circle decoration for large selectable rows;
- checkmark circles;
- colored dots;
- bright brand accents;
- glow.

A package, vehicle-variant row, navigation item or other selected choice should remain understandable in grayscale.

---

## 4. Semantic color

Semantic color is allowed, but only when it communicates real state.

Reference direction:

- success: muted desaturated green;
- warning / attention: restrained amber;
- error: restrained red.

Use semantic color mainly on the relevant text.

Avoid:

- colored status dots;
- circular status icons;
- large colored badges;
- traffic-light UI;
- decorative status pills.

Examples:

Preferred:

`Оплачено` — muted green text.

`Уточните параметры колесного диска` — restrained amber text.

Avoid:

`● Оплачено`

`✓ Оплачено`

`⚠ Уточните параметры`

when the icon exists only as decoration.

---

## 5. Primary actions

Primary CTA:

- near-white fill;
- dark text;
- high contrast;
- restrained radius;
- no icon unless the icon is functionally necessary;
- no gradient;
- no glow.

Secondary actions:

- graphite surface or text action;
- lower visual weight than the primary CTA;
- explicit interactive affordance.

Primary and secondary actions must remain distinguishable without semantic color.

---

## 6. Navigation

Preserve the actual Release 1 information architecture.

Primary navigation:

- Главная
- Примерить диски
- Мои примерки
- Баланс

Secondary:

- Поддержка
- Как подготовить фото
- Документы

Rules:

- Fitment remains contextual and is not added to global navigation.
- No emoji in navigation.
- No decorative icons beside navigation labels in Phase 1.
- No left accent stripe for the active navigation item.
- Active state is expressed by a restrained lighter graphite surface and brighter text.
- Do not add `Избранное`, `Мои автомобили`, `Pro`, upgrade plans or any other unapproved product sections.

---

## 7. Fitment copy scope

Phase 1 is not a Fitment terminology redesign.

Approved copy change for `complete_vehicle_details`:

`Нужно уточнить данные автомобиля` → `Уточните данные автомобиля`.

Preserve existing user-facing terminology for exact vehicle variant selection in Phase 1. Do not replace `комплектация` with `модификация` as part of this visual task.

Preserve the distinction between state copy and action copy. For `run_standard_check`:

- State: `Данные готовы к проверке`.
- Primary action: `Проверить совместимость`.

Do not convert every Fitment state label into an imperative. The state still follows server-owned `next_action`; other terminology decisions belong to the dedicated `FITMENT-POST-PR6-01` repair/design pass.

---

## 8. Cards, tiles and grouping

Phase 1 does not authorize a structural tile redesign.

Keep the current runtime layout architecture and improve it with typography, surfaces and contrast.

General rule for future work:

- use a surface for actual object ownership, an active workspace, or a whole interactive choice;
- use flat rows / dividers for static technical information;
- avoid card-inside-card nesting.

Do not use Phase 1 as a reason to restructure every screen.

---

## 9. Mobile

Apply the same typography, neutral hierarchy and semantic-color rules to mobile.

Phase 1 does not add a photographic garage background on mobile.

Mobile keeps a solid cold graphite application background.

---

## 10. Existing invariants remain frozen

Phase 1 does not alter:

- `FITMENT_VERDICT != RENDER_PERMISSION`;
- `FITMENT_EXECUTION_FAILURE != UNKNOWN_VERDICT`;
- server ownership of Fitment readiness and verdict;
- server ownership of balance and payment state;
- client prohibition on authoritative credit calculation / credit granting;
- existing authentication and route ownership;
- payment-provider settlement semantics.

---

## 11. Implementation acceptance criteria

The Phase 1 implementation should demonstrate:

- stronger desktop text contrast;
- clearly different canvas / passive / interactive / selected graphite levels;
- selected package / selected choice legibility without radio/check decoration;
- near-white primary actions;
- semantic state text without decorative dots/icons;
- no new product IA;
- no layout redesign;
- no regression on 1440, 1024, 768 and 390 widths;
- no horizontal overflow;
- no new overlapping/fixed-height content problems.

A user-visible Phase 1 PR must use the independent UI reviewer protocol and include exact-HEAD browser evidence.
