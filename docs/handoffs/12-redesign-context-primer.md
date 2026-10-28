# Redesign Context Primer

## Purpose

This is not a Codex ticket — it's a state-transfer document for a **new
chat session** picking up design/redesign work after the functional bug-fix
series (`09`–`11`). It captures live design findings and recommendations
from a browser-based design audit so they aren't lost across the session
boundary. Read this before starting design work; it replaces re-deriving
the same observations from scratch.

## Source of truth for the actual design contract

Do not treat this document as the design system — it is a set of
observations and recommendations layered on top of the real contract:

- `docs/ui-design-code.md` — `UI_DESIGN_BASELINE = FROZEN`, the canonical
  visual/terminology authority for cabinet, create flow, result detail,
  history, balance. Fitment UI specifically is **not yet covered** there;
  its own spec is meant to live at `docs/ui/fitment-ui-state-spec-v1.md`.
- Supporting references (not parallel authorities):
  `docs/references/sprint-1-dashboard.html`,
  `docs/references/sprint-2-create-flow.html`, `docs/sprint-3-ui.md`,
  `docs/references/fitment-verdict-fallbacks.html`,
  `docs/references/standard-extended-fitment-check.html`.

## Two surfaces, two visual languages, one product

The marketing landing (`колесамечты.рф` / `dreamwheels.pro`, per
`docs/architecture/release1-domain-app-auth-routing.md`) and the webapp
(`dream-wheels-ai-webapp-staging.vercel.app`) currently read as built by two
different teams. Live-inspected tokens, both surfaces:

| Token | Landing | WebApp |
|---|---|---|
| Background | `rgb(5,11,14)` ≈ `#050b0e` | `#070809` (per spec) |
| Font | `IBM Plex Sans`, h1 weight 300, ~65px, editorial | system stack (`-apple-system`/`Inter`) |
| Accent CTA | `#ddff00`, pill shape | `#ddff00`, pill 18-28px radius |
| Tone | cinematic photography (showroom + real garage/lift imagery) | flat dark cards, generic skeleton loaders |

The backgrounds and accent color already agree — that's a usable baseline.
Typography and "photographic vs flat-UI" tone are the actual gap.

### The landing already contains the "garage" narrative half-built

The landing's product-explainer section splits into two blocks:
- **"SYSTEM 01 — КАК БУДУТ СМОТРЕТЬСЯ"**: glossy showroom photography (brick
  wall, orange car, product-shot wheel) — this is the *visual try-on*
  register.
- **"SYSTEM 02 — ПОДХОДИТ ЛИ ПО ПАРАМЕТРАМ"**: a real mechanic's hands, a
  lift, a wheel being checked in an actual shop — this is the *technical
  verification* register, and it is exactly the "garage" image the product
  owner described wanting for the app (a real garage where cars get
  checked, not an abstract form).

The webapp's Fitment screen — which is literally the "SYSTEM 02" moment —
currently looks identical to every other screen: flat cards, generic
skeleton loaders, no texture. The recommendation below is to import that
already-designed garage register into the app rather than invent a new one.

### Recommended split, concretely

1. **Showroom register** (create-flow, visual-result screen): keep/lean
   into glossy photography, the landing's interactive before/after slider
   component (seen live on the landing under a "Geely Monjaro" example —
   draggable ДО/ПОСЛЕ handle over a real photo composite). The webapp's
   result screen currently shows static separate before/after cards
   instead of this — porting the landing's slider component directly would
   be a concrete, scoped first project.
2. **Garage register** (Fitment verdict flow specifically): replace flat
   skeleton loaders and generic cards with muted background
   textures/photography evoking the landing's SYSTEM 02 block — tools,
   lift, metal/rubber textures, kept subdued enough not to fight the actual
   PCD/ET data being the visual priority.
3. **Typography**: adopt `IBM Plex Sans` app-wide (currently only on the
   landing) and add `IBM Plex Mono` specifically for technical values
   (ET/PCD/diameter) so numbers read as data, not prose — right now they're
   set in the same face as surrounding copy.

## Concrete defects found (fold into the redesign pass, don't re-discover)

- **Focus ring is non-functional.** Live-inspected: a focused button has
  `outline-color`/`outline-width` set but `outline-style: none` overrides
  them — no visible focus indicator at all, keyboard/screen-reader
  navigation currently has zero visual feedback on this control. `ui-design-code.md`
  explicitly calls for "product-owned focus rings, not native" — right now
  there's neither. Fix this as part of the design-code pass, not as a
  separate ticket — it's a one-line CSS fix once someone's touching this
  component anyway.
- **Panel color drift.** Live-inspected webapp panel background:
  `rgba(23,25,30,.96)`. Spec (`ui-design-code.md`) says `#161a22`. Minor,
  but a real, measurable token drift — worth reconciling when doing a
  design-tokens pass (see below), not urgent on its own.

## Cross-repo design tokens

The landing is **not in this repository** (no `astro.config`, no
`package.json` references found here) — it's a separate codebase on the
same machine, confirmed by direct inspection, not documentation. This means
token drift between the two surfaces is structural, not accidental: there
is currently no single source of truth either repo reads from.

Two honest options, in order of effort:
1. **Manual sync checklist** — cheaper to start, but will drift again;
   accept this as the starting point only if a shared package isn't
   feasible soon.
2. **Shared design-tokens package** (small npm package or a synced
   `tokens.css` published somewhere both repos can pull from) — the real
   fix, do this before the token drift above (panel color) recurs in a
   worse form.

## Auth/attribution handoff between landing and app (verify, don't assume)

Per `docs/architecture/release1-domain-app-auth-routing.md`: the landing's
primary CTA (`Попробовать`) should route to `/app/new` with an auth gate
(Email OTP), preserving `market` + supported UTM params via a transient
`auth_intended_route`. **This was not independently verified working** in
this audit — it's documented intent, not confirmed behavior. Verify this
handoff actually works before/while doing redesign work that touches the
CTA, since a redesign is a natural time to also confirm the routing
contract hasn't drifted.

Separately: `колесамечты.рф` (RU) and `dreamwheels.pro` (global) are
different origins per that same doc — browser storage doesn't cross
between them. Any visual/product preference a user expresses on the RU
landing before auth won't survive the jump to the app origin without
explicit UTM/query-param passing — the attribution doc already has a
mechanism for this; reuse it rather than inventing a new one if the
redesign wants to carry any pre-auth signal into the app.

## What this document is not

- Not a pixel-accurate mockup or a finished design system — it's
  observations from live-inspecting both surfaces in a browser, meant to
  save re-discovery time.
- Not a claim that any of this is broken in a way blocking users today —
  the focus-ring and panel-color items are real but minor; everything else
  here is a recommendation, not a defect report.
