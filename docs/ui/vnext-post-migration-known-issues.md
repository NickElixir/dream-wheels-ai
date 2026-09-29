# VNext post-migration known issues

## FITMENT-POST-PR6-01

- **Status:** OPEN
- **Severity:** functional usability / progression
- **Observed on:** staging after PR5.2
- **Repair authority:** `docs/ui/fitment-flow-contract-v2.md`

Vehicle identity can be present while the modification / vehicle-variant progression is not surfaced clearly enough to advance to technical Fitment. In the observed case, a modification was not proposed, the technical check remained blocked, and the previous modification-selection path was unavailable or not discoverable.

This was intentionally deferred from PR6. The PR5.2 parity audit records the implementation checks at the time; this staging observation is a follow-up finding, not a retrospective change to that audit.

The repair must preserve vehicle-variant lookup and application, catalogue functions, manual recovery, Fitment save and resolver, check execution, and revision/currentness runtime.

Canonical repair progression:

```text
recognized / existing vehicle
→ base details
→ modification selection
→ confirmation
→ wheel parameters
→ technical check
→ result
```

The repair should compare the current screen with the formerly working staging/legacy business flow and restore discoverable progression without creating a duplicate Fitment state machine.

## UI-VS2-PHASE1

- **Status:** PLANNED
- **Severity:** pre-production visual refinement
- **Authority:** `docs/ui/vnext-visual-system-2.0-phase1.md`

Before the Fitment repair, apply the approved narrow typography/color/surface refinement. Do not expand this work into the larger B3/visual-rail/layout redesign.

## UI-VS2-POSTPROD

- **Status:** DEFERRED UNTIL AFTER PRODUCTION
- **Authority:** `docs/ui/vnext-visual-system-2.0-post-production-plan.md`

The larger desktop automotive environment, Dashboard hero, Fitment visual rail, modification thumbnails and broader tile/layout redesign are preserved as post-production work and must not delay the functional/release gates.
