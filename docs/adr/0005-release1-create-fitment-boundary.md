# ADR 0005 — Release 1 Create / Fitment ownership boundary

## Status

Accepted for Release 1.

This ADR defines the current Release 1 product boundary and the explicitly deferred
post-release direction. Where older Sprint 2 / Fitment documents describe vehicle
recognition or quick vehicle confirmation inside Create, that behavior is historical
and is superseded for the Release 1 target by this ADR.

## Context

Dream Wheels AI has two independent product outcomes:

- **Visual Try-on** answers how a specific wheel looks on the user's vehicle photo.
- **Technical Fitment** answers what is known about preliminary technical compatibility.

The current codebase grew from an earlier Assisted Identity Flow in which Create also
recognized a vehicle, asked the user to choose/confirm it, and persisted that identity
before creating a render job. Technical Fitment later became a separate, richer flow
with catalogue selection, exact variant confirmation and deterministic compatibility
checks.

Keeping both identity flows in Release 1 creates duplicate ownership and contradictory
UI states: Create can call a vehicle "confirmed" while Fitment correctly still requires
catalogue/variant confirmation.

Release 1 therefore has one owner for visual rendering and one owner for technical
identity/compatibility.

## Decision

### Release 1

```text
Create owns:
- car photo
- wheel photo/source
- consent required for visual processing
- render creation

Fitment owns:
- vehicle recognition
- vehicle catalogue
- exact variant
- wheel technical parameters
- compatibility check
```

### Create

Create is the entry point for visual try-on.

Its Release 1 responsibility is to collect the visual inputs and start a render. Vehicle
make/model/year/market/modification confirmation is not a Create prerequisite.

Create must not expose or require:

- AI vehicle candidate selection;
- "confirm vehicle" semantics;
- manual make/model/year editing for render permission;
- exact vehicle variant selection;
- a user-facing state that claims the vehicle is technically confirmed.

A visual render must not depend on a confirmed `VehicleIdentity`.

This does not remove durable assets, provenance, render snapshots, or other internal
metadata required to audit a RenderJob. It removes vehicle-identity confirmation as a
**user-facing render gate**.

Wheel photo/source remains a Create concern because it identifies the visual wheel
reference. Technical Wheel/RimSpec confirmation remains a Fitment concern.

### Fitment

Fitment is the only Release 1 owner of technical vehicle/wheel preparation:

```text
Recognize vehicle
-> choose proposal
-> catalogue Make / Model / Year / Market
-> Confirm details
-> choose exact variant
-> Confirm configuration
-> confirm wheel technical parameters
-> run compatibility check
```

The existing invariant remains:

```text
FITMENT_VERDICT != RENDER_PERMISSION
```

An incompatible, unknown, failed, stale or absent Fitment verdict never invalidates a
visual render.

### Release 1 navigation order

Pre-render Fitment is intentionally **not** part of Release 1.

The supported Release 1 order is:

```text
Create
-> RenderJob
-> Result / History
-> optional Technical Fitment
```

Fitment may reuse the durable `car_original` and `rim_original` assets already attached
to the RenderJob.

Create does not need to expose a pre-render "Check compatibility" action in Release 1.

## Deferred post-release: Fitment before Render

The user need is valid: a person may want to check technical compatibility before
spending a render.

Implementing that correctly requires a durable entity that exists before either a
RenderJob or FitmentCheck. This is deliberately deferred until after Release 1.

The target architecture is:

```text
Pair / Project
├── car_original / vehicle media
├── rim_original / wheel source
├── current technical identity/setup
├── RenderJob [0..N]
└── FitmentCheck [0..N]
```

`Pair` / `Project` becomes the parent entity. `RenderJob` and `FitmentCheck` become
children.

Create and Fitment become two entry points to the same Pair:

```text
Create entry
-> upload/select pair
-> Create image
-> optionally Check compatibility

Fitment entry
-> upload/select pair
-> Check compatibility
-> optionally Create image
```

A Pair may therefore exist with:

- no render yet;
- one or more renders;
- no FitmentCheck yet;
- one or more FitmentChecks.

The final entity name (`Pair`, `Project`, or another product/domain term) is not frozen
by this ADR.

## History consequence

Release 1 history remains RenderJob-oriented.

A future pre-render Fitment flow should not be forced into "My renders" merely to make
it persistent. Pair/Project-oriented history/navigation is part of the deferred
architecture decision.

## Landing / marketing

This ADR does **not** authorize a landing-page copy change.

Current landing copy remains unchanged. Future marketing may explicitly promote
"check compatibility before rendering" only after the pre-render Pair/Project flow is
implemented and released.

## Consequences

- Release 1 removes duplicate vehicle-confirmation ownership from Create.
- Fitment becomes the single source of user-confirmed technical vehicle identity.
- Visual rendering remains independent of Fitment.
- Release 1 scope does not expand to pre-render Fitment.
- The post-release Pair/Project model provides a clean path to Fitment-before-Render,
  multiple renders per pair and shared history without duplicating upload flows.
- Older Sprint 2 Assisted Identity documents remain useful as historical implementation
  records but are not the Release 1 product contract where they conflict with this ADR.

## Non-goals for Release 1

- Pair/Project persistence.
- FitmentCheck creation without an existing RenderJob context.
- a second upload flow inside Fitment.
- multiple RenderJobs grouped under a Pair.
- Pair-centric history.
- using Fitment verdict as render permission.