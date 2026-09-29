# Dream Wheels AI — VNext Visual System 2.0 deferred reference plan

**Date:** 2026-09-29
**Status:** RECORDED — intentionally deferred until after the first production release

## Why this exists

The 2026-09-29 concept pass produced a stronger long-term visual direction, but implementing it now would expand pre-production scope from a token/typography refinement into a larger layout and asset program.

The approved release sequence is therefore:

```text
VNext Visual System 2.0 Phase 1
typography / colors / surfaces only
        ↓
FITMENT-POST-PR6-01 repair
restore the working progression and validate it
        ↓
Release Candidate / production readiness
WebApp / auth / payment / domain / runtime checks
        ↓
Production
        ↓
Post-production UX/UI expansion
using the recorded references below
```

The concepts below are explicitly preserved so they are not lost or re-invented after release.

---

# 1. Desktop automotive environment

Preferred long-term desktop identity:

```text
restrained application workspace
+
Dream Wheels B3 editorial garage
+
vehicle / wheel crop as a supporting environmental layer
```

Direction:

- use the established B3 garage rather than generating unrelated garages per screen;
- dark concrete, matte black metal and restrained architectural lighting;
- no neon;
- no generic luxury showroom;
- no cyberpunk;
- photography supports the application and does not reduce text readability.

### Dashboard

Use a full vehicle as the hero.

Preferred future candidate: the **Geely Monjaro used by the landing**, with an application-specific composition rather than reusing the exact landing crop.

Goal:

```text
Landing
→ App Dashboard
```

should feel like one product and one visual world.

### Fitment

Prefer an ambient crop such as:

- rear quarter;
- taillight;
- side/rear body surface.

The rear-light concept is preferred over a giant wheel occupying the visual rail because it keeps the automotive atmosphere without competing with the technical wheel object inside Fitment.

### Balance

A rear-quarter / visible wheel crop is appropriate because the page is commercial but still product-related.

---

# 2. Desktop visual rail

Long-term desktop layout may use a dedicated visual rail.

Reference proportion:

```text
working application: 65–75%
automotive visual:    25–35%
```

The visual rail must be a separate layout region rather than an absolutely positioned wallpaper over the application.

Preferred implementation concept:

```css
application:
  sidebar | page

page:
  workspace | visual-rail
```

The workspace stays in normal document flow.

The visual rail may be sticky / viewport-height on large desktop.

Do not implement page content with fixed `top/left` positioning.

---

# 3. Responsive policy

Large desktop:

```text
sidebar | workspace | automotive visual
```

Medium desktop/tablet:

- reduce the visual rail;
- prioritize the workspace;
- allow the environment to disappear when width becomes constrained.

Mobile:

- no photographic full-page garage background;
- solid cold graphite application surfaces;
- vehicle/wheel imagery appears only as actual object content.

The larger desktop concept must never be achieved at the expense of 1024/768/390 stability.

---

# 4. Dashboard expansion

Recorded direction:

- image-first automotive hero;
- Geely Monjaro from the landing ecosystem;
- large primary copy and near-white CTA;
- compact balance information;
- recent renders below;
- no dashboard-statistics aesthetic;
- no invented favorites / plans / vehicle library unless separately approved.

The current global information architecture remains authoritative unless explicitly changed later.

---

# 5. Fitment tile composition

Recorded preferred hierarchy:

```text
1 shared vehicle + wheel summary surface
+
1 active workspace surface
+
flat content inside
```

Avoid:

```text
card
  card
    card
      status card
```

The concepts showed that large, purposeful surfaces can work well without reintroducing generic SaaS card sprawl.

Long-term Fitment layouts should continue to follow the state contract in:

`docs/ui/fitment-flow-contract-v2.md`.

---

# 6. Vehicle-variant thumbnails

A future Fitment enhancement may expose vehicle reference imagery from the vehicle-data provider through the Dream Wheels adapter/API.

Rules already decided:

- repeated generation/reference images across several variant rows are acceptable;
- do not hide images merely because multiple variants share the same photo;
- images are presentation metadata only;
- image URL/reference must not become a canonical identity key;
- imagery must not affect Fitment evidence or verdict;
- missing images must not block selection.

This enhancement is deferred from the pre-production Fitment repair.

---

# 7. Logo / wordmark direction

The concept pass produced a compact two-line desktop wordmark:

```text
DREAM
WHEELS AI
```

This composition is worth preserving as a future brand reference because it works well inside a narrow desktop sidebar.

It is **not** approved as a production logo redesign in Phase 1.

Future brand work may define:

- compact two-line sidebar wordmark;
- wide horizontal landing/header variant;
- optional mobile mark if needed.

Application UI typography remains separate from the display character of the logo.

---

# 8. Navigation direction

Long-term and Phase 1 direction are aligned:

- typography-first navigation;
- no decorative icons / emoji beside menu entries;
- no left accent stripe;
- active state through restrained graphite surface + text contrast;
- no invented IA.

Fitment remains contextual and is not a global nav destination.

---

# 9. Status presentation direction

The concept pass initially introduced too many:

- circles;
- warning icons;
- check icons;
- dots;
- pills.

These are explicitly rejected as a general visual language.

Prefer:

- direct text;
- hierarchy;
- semantic text color;
- surface contrast;
- dividers.

Example:

`Оплачено`

not:

`✓ Оплачено`

Example:

`Уточните параметры колесного диска`

not:

`⚠ Нужно уточнить параметры`.

---

# 10. Production-readiness gate before this larger redesign

Do not begin the large visual expansion until the Release 1 production path is usable.

Before production:

1. complete Visual System 2.0 Phase 1;
2. repair and validate `FITMENT-POST-PR6-01`;
3. run the Release Candidate regression pass;
4. resolve current WebApp/runtime blockers found during real authenticated use;
5. verify production domain/auth/gateway configuration;
6. configure the production Robokassa path deliberately;
7. do **not** carry staging/demo Robokassa mode into production;
8. verify that payment settlement, credit granting and render-credit debiting use the intended production semantics;
9. perform production deploy + production smoke.

The current staging demo-payment setup is test infrastructure. It must not be treated as a production payment configuration merely because a demo payment can trigger real application credit changes.

Payment invariants remain:

```text
payment return != authoritative payment status
client != balance authority
client != credit-grant authority
```

---

# 11. Post-production implementation quality

When the larger visual redesign resumes, require:

- normal document flow for page sections;
- CSS Grid/Flex rather than absolute page positioning;
- content-driven height;
- no fixed-height Fitment workspace that clips long states;
- reserved image aspect ratios to avoid layout shift;
- QA with long variant lists, long metadata, conflicts, validation errors and staggered wheel data;
- 1440 / 1024 / 768 / 390 browser evidence.

The concept references are visual targets, not permission to copy impossible fixed screenshot geometry.
