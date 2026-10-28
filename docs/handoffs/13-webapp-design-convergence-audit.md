# WebApp × Landing Design Convergence Audit

## Purpose

Not a Codex ticket — a design-audit handoff. Answers a direct product
question: *should the whole webapp be redesigned into one visual language
with the landing, away from a generic-AI-SaaS feel* — grounded in the
actual, already-written design contract rather than re-deriving taste from
scratch.

## Source of truth

The landing branch (`feature/landing-v1-shell-catalog`, same repo,
diverged 185 commits behind / 5 ahead of `staging`, not merged) carries a
repo-root **`DESIGN.md`** (832 lines) — a real design-system draft, not a
CSS-inspection guess. This audit is a gap-check of the current webapp
(`webapp/index.html`, `webapp/style.css`) against that document. Supersedes
the CSS-inspection framing in
[docs/handoffs/12-redesign-context-primer.md](12-redesign-context-primer.md)
(that doc treated landing as a separate repo — it isn't; see "Correction"
below).

**Correction to primer #12:** the landing is not a separate codebase. Same
GitHub remote (`NickElixir/dream-wheels-ai`), unmerged branch. "Cross-repo
design tokens" is the wrong frame — this is a cross-*branch* merge/extract
problem, cheaper to fix than a shared npm package.

## The actual blocker: DESIGN.md leaves convergence explicitly open

`DESIGN.md` (line 742) states current webapp conventions are frozen
*on purpose*, and unifying them with the landing's system is **not yet
approved**:

> "Current frozen application conventions may intentionally use meaningful
> islands, stronger card radii and a more predictable navigation shell.
> Any convergence with the new system needs a separately approved
> application pass."

Open decision #4 in the same doc: *"Detailed application component-library
convergence, including when frozen existing card radii can evolve"* — still
`[OPEN]`. Open decision #2: whether Landing and Application share one
accent token or use related-but-different ones — also `[OPEN]`.

Per your instruction, this audit does **not** resolve that decision. Every
screen below is scored against two scenarios instead of one fixed target.

## What is NOT gated (applies either way)

DESIGN.md explicitly separates what the Application inherits unconditionally from what needs a
separate approval pass (line 740):

> "The Application inherits color roles, type roles, borders, imagery
> language, selection semantics, status semantics and button hierarchy."

So regardless of the radius/materiality decision, these gaps are real
today and worth closing on their own:

| Area | DESIGN.md says | Current webapp | Gap |
|---|---|---|---|
| Focus indicator | "Focus indication is independent from visual selection and must remain clearly visible for keyboard interaction" (line 580); WCAG 2.2 AA baseline (line 748) | `outline-style: none` overrides `outline-color`/`outline-width` — no visible focus ring at all (confirmed live in #12) | Accessibility violation against the doc's own baseline, not just cosmetic drift |
| Status semantics | Color never the only channel; every status needs icon + label (line 624) | Already followed in `.fitment-verdict-field[data-status]` (✓/!/?/×) | No gap — cite as the pattern to reuse elsewhere |
| Pills / button shape | "excessive pills" is a named anti-pattern (line 778); primary buttons get "minimal radius" (line 528) | `.primary-button`/`.compact-button`/`.ghost-button` and ~5 other rules use `border-radius: 999px` (full pill) app-wide | Direct anti-pattern hit, independent of the radius-convergence question — pills aren't "frozen card geometry," they're a named anti-pattern regardless of scenario |
| Selection indicators | No lime outlines/side-stripes/glow around selected cards (line 573-578) | Not audited screen-by-screen here — flag for the create/wallet variant-selection UI specifically (`fitmentVehicleVariants`, wheel/rim pickers) | Needs a follow-up pass reading the actual selection CSS |
| Imagery language | Photographic, editorial, "garage" register for technical verification (Non-negotiable product meaning, line 189) | Fitment verdict card now carries this ([PR #190](https://github.com/NickElixir/dream-wheels-ai/pull/190)) | Closed for Fitment; open everywhere else result/status imagery appears |
| Panel background | No fixed token cited in DESIGN.md yet (color system is `[PROPOSED]`), but internal spec `ui-design-code.md` says `#161a22` | Live-inspected `rgba(23,25,30,.96)` (per #12) | Drift confirmed, but against the *old* internal spec, not DESIGN.md — DESIGN.md hasn't finalized numeric tokens yet (open decision #1) |

## Current webapp pattern inventory (grep-grounded, not impression)

- 5 rules use `border-radius: 999px` (pill buttons/badges) — line hits in
  `webapp/style.css`: 540, 1137, 1392, 1648, 1711.
- Radius scale in use: `--radius-xl: 28px`, `--radius-lg: 22px`,
  `--radius-md: 18px`, `--radius-sm: 14px`, `--radius-xs: 12px` — all above
  DESIGN.md's reference range for default surfaces (0–4px; 8–12px only for
  Landing's own tactile selector exception, not declared universal).
- 18 `linear-gradient`/`radial-gradient` uses across the stylesheet —
  moderate, not saturating; DESIGN.md's "decorative gradients" anti-pattern
  target is more about ambient neon/purple-blue washes than the functional
  readability gradients used here (e.g. PR #190's overlay). Not flagged as
  a violation on inspection, but worth a second pass once someone is
  screen-by-screen in the CSS.
- `var(--accent)` referenced 20 times — needs a usage audit against "lime is
  scarce, high-signal" (line 307) once the shared/related-token open
  decision (#2) is resolved; premature to score before that.

## Per-screen gap audit

Ten `data-view` sections exist in `webapp/index.html`: `dashboard`,
`create`, `wallet`, `renders`, `render-detail`, `fitment`, `settings`,
`photo-guide`, `support`, `docs`.

For each: current-state notes (grounded in markup/class counts), then what
changes under **Scenario A** (full convergence — webapp adopts landing's
0–4px tactile-material system, garage/showroom imagery registers, and a
shared-density accent policy) vs **Scenario B** (keep frozen radius/card
geometry; inherit only what's already unconditional — color roles, type,
imagery language, status semantics, button *hierarchy* not button *shape*).

### `fitment` — partially done
Heaviest screen (27.7k chars of markup), already has one committed
convergence step ([PR #190](https://github.com/NickElixir/dream-wheels-ai/pull/190):
garage-photo texture on `.fitment-verdict-card`, kept at the existing
28px radius). This is a live example of Scenario B applied to imagery
only. Scenario A here would mean also flattening the card to near-0px
radius and moving the step indicator (`fitment-steps`, currently plain
numbered circles) toward the landing's `01/PHOTO … 04/RESULT` typographic
index style from `HowItWorks.astro`.

### `create` — highest imagery-language stakes
12 "card" class-name hits, 6 pills. This is where Visual Try-on happens —
the screen DESIGN.md's "Non-negotiable product meaning" section (line 189)
is most protective about: a realistic AI render must never visually imply
technical-fitment approval. Any redesign pass here needs the separation of
labels/regions DESIGN.md requires before touching visual polish. Landing's
`BeforeAfter.tsx` slider (primer #12's recommendation) is the natural
imagery-language donor regardless of scenario chosen.

### `wallet` — most card-heavy screen
13 "card" hits, 5 "panel" hits, 3 pills, 1 primary-button. Financial/balance
UI — DESIGN.md doesn't discuss commerce surfaces directly; closest
guidance is "Surface system" (avoid solving every grouping problem with a
rounded card, line 520). Scenario A would be the largest visual rewrite on
this screen of any in the app; Scenario B leaves it almost untouched
(wallet has no strong imagery-language claim in DESIGN.md to inherit).

### `dashboard` — skeleton-loader-heavy
14 "skeleton" hits (shared `dashboard-skeleton-*` shimmer components used
nowhere else) — this is the actual "generic skeleton loader" referenced
impressionistically in primer #12 (not the fitment screen, which has no
skeleton component of its own). 1 hero-panel, 1 pill. Under either
scenario, DESIGN.md's automotive-first hierarchy (line 717: "current
task/status + result > controls > supporting metadata") argues for
replacing shimmer placeholders with something that previews *shape* of the
real result rather than generic shimmer bars — independent of the
radius question.

### `renders` / `render-detail` — thin shells, need their own audit
198 and 149 chars respectively at the top-level view wrapper — actual
content renders dynamically via JS (`app.js`), not present in static
markup. Cannot be scored from `index.html` alone; needs a follow-up pass
reading the render functions in `webapp/app.js` before scenario-scoring.

### `settings` / `support` / `docs` — low imagery stakes
Minimal markup (1.4k–3.5k chars), mostly text/links, 0–3 pills, no cards.
Lowest priority for either scenario — these are utility screens where
DESIGN.md's Application-surface guidance ("task completion, data legibility
... primary," line 740) already roughly matches current flat-list
treatment. Convergence effort here is mostly the shared radius/pill fix,
not imagery.

### `photo-guide` — has its own reference imagery already
2 "card" hits, 1 primary-button, uses real photo examples
(`photo-guide-car.jpg`, `photo-guide-wheel-*.jpg`) — this screen already
partially follows "editorial photography over interface chrome" without
having been designed against DESIGN.md. Low-risk, low-effort convergence
target if Scenario A is chosen (mostly a radius/typography pass, imagery
is already there).

## Open decisions carried forward (not resolved here, per instruction)

From DESIGN.md, restated for this audit's context:

1. **Radius/materiality convergence** (open decision #4) — Scenario A vs B
   above, per screen or app-wide.
2. **Accent token relationship** (open decision #2) — one shared lime token
   at different density, or two related-but-distinct tokens.
3. **Exact numeric neutral palette / accent hex** (open decision #1) — both
   `ui-design-code.md` (`#161a22` panel) and this audit's live-inspected
   values (`rgba(23,25,30,.96)`) are candidates, neither finalized against
   DESIGN.md's `[PROPOSED]` token table.
4. Landing/Application motion timing values (open decision #5) — not
   audited here at all; no motion inventory done yet for the webapp side.

## What this document is not

- Not a mockup, not a component spec, not an implementation plan.
- Not a claim that Scenario A or B is correct — that's explicitly the
  product decision left open above.
- Not a full audit of `renders`/`render-detail` (needs a JS-reading pass)
  or of selection-state CSS across variant pickers (needs a targeted pass)
  — both flagged above as follow-ups, not covered here.
