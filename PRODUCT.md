# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

### Primary Release 1 user

An automotive enthusiast or pre-purchase wheel buyer who wants to understand how a specific wheel may look on their own vehicle before making a purchase decision. They arrive with a vehicle photo and a wheel image or product reference, often with uncertainty about visual outcome and technical compatibility.

### Confirmed additional audiences

- Wheel retailers and e-commerce partners seeking a visual decision aid and lower return risk.
- Tuning/detailing services seeking an upsell and consultation aid.

Release 1 product work is centred on the individual user flow; partner/catalog recommendation work requires audited structured data and remains separate.

## Product Purpose

Dream Wheels AI creates a photorealistic **Visual Try-on**: a user supplies a vehicle image and wheel image/reference, and the product returns a generated view of that wheel on that vehicle.

It also supports a separate **Technical Fitment** capability: a preliminary assessment of whether structured, confirmed vehicle and wheel specifications can be compatible. It exists to support a more informed decision, not to replace physical installation checks, OEM approval or a wheel specialist.

Success means a user can move from “I cannot picture this wheel on my car” to a clear visual result and, when sufficient structured evidence exists, an explicitly qualified technical assessment.

## Positioning

Dream Wheels combines a photorealistic wheel-on-car visual result with a separate evidence-based Technical Fitment assessment. The render answers appearance; deterministic technical rules answer preliminary installation possibility. A competing image-only visualizer cannot truthfully make the same technical distinction, and a pure specification checker cannot show the user's vehicle transformation.

## Operating Context

### Landing objective

The Landing is a **Persuade** surface. It explains the visual try-on value, shows the quality/role of the product through automotive imagery and Catalog interaction, and sends a prospective user into the application. It must not present an image as proof of Technical Fitment.

### Approved Russian Landing Hero copy

**[APPROVED PRODUCT COPY]** The production Russian Hero uses these exact formulations and line breaks:

- headline: `Добро пожаловать` / `Dream Wheels`;
- supporting copy: `Посмотрите выбранные диски` / `на своём автомобиле`;
- right caption: `ВАШ АВТОМОБИЛЬ` / `ВАШИ ДИСКИ` / `ВАША УВЕРЕННОСТЬ`;
- CTA: `Попробовать`.

User-edited or removed Hero copy must not be automatically restored in later design reconstruction, QA or integration passes. The current approved production copy takes precedence over older raster/reference wording; the reference remains useful for geometry and composition.

### WebApp objective

The WebApp is an **Operate** surface. It helps a user upload/select source material, confirm or correct relevant context, start a generation, understand job/result status, review a result and take the next safe action. It prioritizes task completion, data legibility, recovery and accessible controls over editorial composition.

### Visual Try-on flow

```text
Vehicle photo + wheel image/reference
→ upload / identity and context confirmation where available
→ generated visual try-on job
→ queued / processing / completed or failed state
→ visual result, history and repeat/share actions
```

Visual Try-on remains available when Technical Fitment is not available, `unknown` or `incompatible`; the two outcomes are independent.

### Technical Fitment role

```text
Confirmed vehicle profile + structured wheel specifications
→ deterministic compatibility rules
→ compatible / compatible_with_conditions / unknown / incompatible
```

Technical Fitment uses structured data such as diameter, width, PCD, ET and DIA. Image analysis, OCR or an LLM may suggest/explain values but do not decide compatibility. A missing critical value returns `unknown`, not confidence inferred from a photograph.

## Capabilities and Constraints

- **Visual Try-on ≠ Technical Fitment.** A successful render is never proof that a wheel fits physically.
- Technical verdict wording is preliminary and evidence-based. Do not claim “fits 100%” or an equivalent guarantee.
- Technical Fitment does not block the visual try-on flow.
- Known compatible/conditional/unknown/incompatible status meaning follows the Fitment domain contracts; frontend must not create a parallel readiness model.
- User-facing rendering terms distinguish `примерка` (visual process/result), `рендер` (commercial unit) and `генерация` (technical image-creation action).
- Main source/result images preserve full composition with `object-fit: contain`; the product must not crop the vehicle result merely to fill a frame.
- In Release 1, data-driven catalog recommendations or specific “compatible product” claims require a structured, auditable catalog/feed. Until then, visual exploration and qualified consultation/fitment pathways remain distinct.

### Release 1 constraints

- Current operating surface is a Telegram Mini App/WebApp with a backend job flow, durable result/history context and separate future Fitment integration.
- Current shared foundation includes authentication, wallet/payments, durable jobs/assets/history and a common create/result flow.
- No hard fitment guarantees, automatic training-data claim, or recommendation without auditable data.
- Landing is a standalone static surface and must not absorb WebApp routes or backend responsibilities.
- Existing frozen application UI/domain contracts remain authoritative for their feature states until separately changed.

### CTA destination

The approved Landing primary CTA enters the WebApp at:

```text
https://dreamwheels.pro/app/new
```

Landing attribution preserves supported `utm_*` and `market` query parameters when linking to this destination.

## Brand Commitments

- Product name: Dream Wheels AI.
- **[APPROVED PRODUCT/DESIGN] Domain-specific public branding:** `колесамечты.рф` uses the visible Russian brand `КОЛЕСА МЕЧТЫ` without an `AI` suffix or English subtitle; `dreamwheels.pro` uses the visible English/global brand `DREAM WHEELS`. This does not change the product name or internal identifiers.
- The visual/system contract is [`DESIGN.md`](DESIGN.md); the approved Landing-specific composition is [`docs/design/landing-v1-reference-reconstruction.md`](docs/design/landing-v1-reference-reconstruction.md).
- Dream Wheels communicates automotive confidence and precision without exaggerating what image generation proves.
- Important trust wording must preserve the distinction between visual appearance and preliminary technical compatibility.
- The Landing is photographic/editorial; the Application is task-first. They share product truth and system semantics but do not copy each other's layout composition.

## Evidence on Hand

- Approved visual source: `/Users/nikolai/Downloads/zeekr-styled-landing.png`.
- Approved Landing reconstruction: [`docs/design/landing-v1-reference-reconstruction.md`](docs/design/landing-v1-reference-reconstruction.md).
- Reference measurements: [`docs/design/landing-v1-reference-measurements.json`](docs/design/landing-v1-reference-measurements.json).
- System-level visual contract: [`DESIGN.md`](DESIGN.md).
- Product/delivery roadmap: [`docs/product-roadmap.md`](docs/product-roadmap.md).
- Fitment product/domain constraint: [`docs/fitment-compatibility.md`](docs/fitment-compatibility.md) and [`docs/fitment/fitment-verdict-v1.md`](docs/fitment/fitment-verdict-v1.md).
- Current product UI authority: [`docs/ui-design-code.md`](docs/ui-design-code.md) and frozen Fitment UI state contracts under [`docs/ui/`](docs/ui/).
- Architecture and current delivery boundaries: [`README.md`](README.md), [`docs/architecture.md`](docs/architecture.md) and [`landing/README.md`](landing/README.md).

No approved claim of a final production font, final exact CSS palette, full mobile Landing composition, or universal Landing/Application accent balance is present in the evidence.

## Product Principles

1. **Appearance and compatibility are separate truths.** Never use visual quality as technical proof.
2. **Preserve the user's vehicle and source context.** The product result is valuable only when the vehicle/wheel identity remains credible.
3. **Make uncertainty explicit.** Unknown, pending, conditional and failed states guide a safe next action rather than pretending certainty.
4. **Let the active surface serve its job.** Landing persuades through editorial automotive composition; WebApp helps users complete a precise task.
5. **Trust requires evidence.** Technical claims, catalog recommendations and product-fit statements require structured, auditable sources.

## Accessibility & Inclusion

- Target WCAG 2.2 AA for contrast and interaction where applicable.
- Provide semantic controls, visible focus, keyboard operation, usable touch targets and reduced-motion support.
- Do not use color as the only indicator for status, selection or error.
- Keep technical values and warnings readable; visual reference microtype never overrides accessibility.
- Preserve full source/result composition and provide useful alt text that distinguishes source, result and product imagery.

## Open Product Context

- The production font selection, exact system color values, accent balance across Landing/Application, full mobile Landing composition, motion timing and icon library remain **design decisions** recorded as `[OPEN]` in `DESIGN.md`.
- This product record does not close or reinterpret those decisions.
