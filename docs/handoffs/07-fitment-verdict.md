# 07 — Fitment Verdict V1 — Engineering Handoff

## Final status

`FITMENT_BETA_READY: NO`

The deterministic V1 implementation and automated verification are complete.
The beta gate remains **NO** because an authenticated staging end-to-end check
against the configured Wheel Size API has not been run in this worktree. No
production rollout was attempted.

## Branch and commits

- Branch: `codex/fitment-verdict-v1`
- Base: `origin/staging @ bed5c4cd1ff0f9b9d585e525b56e39fd43739794`
- Final implementation commit: `d02b79e6257e24c8626601080631d0935dbfd035`
- Handoff documentation commit: this document's commit

## Delivered V1 pipeline

```text
Confirmed VehicleIdentity
  → Wheel Size API exact selected variant
  → normalized Vehicle Fitment Reference
  → confirmed canonical RimSpec (front and rear)
  → deterministic CompatibilityEngine
  → axle/field-level RuleResults
  → conservative overall FitmentVerdict
```

No RAG, LLM compatibility reasoning, tyre fitment, 3D clearance calculation,
spacers/modifications recommendation, payment logic, or rollout work was
added.

## Reused and retained components

- `src/fitment/providers/wheel_size.py`: the existing user-initiated Wheel
  Size v2 adapter and exact vehicle-variant mappings.
- `src/fitment/schemas.py`: canonical `VehicleIdentity`, provenance-aware
  `RimSpec`, `RimSetup`, `FitmentProfile`, and immutable API snapshots.
- `src/fitment_checks_api.py`: authenticated ownership checks, idempotency,
  durable `fitment_checks` persistence, and separate failed operational state.
- Existing Mini App warning blocks and their approved copy:
  `warnings.fitment` and `warnings.missingData`. They were already in current
  scope and remain presentation-only; the code now also explains the new
  `size_not_in_reference` machine code.

Historical fitment branches were inspected for context only. They were not
merged or replayed wholesale.

## Wheel Size reference fields

The adapter resolves and persists only provider mappings for an explicitly
selected make/model/year/region/generation/modification. It normalizes:

- `technical.stud_holes`, `technical.pcd`, `technical.centre_bore`;
- `technical.fasteners.type`, `thread_size`, and tightening torque when the
  provider supplies them;
- per-axle `wheels[].front|rear.{rim_diameter,rim_width,offset,is_stock,tire}`;
- exact-size, per-axle ET reference intervals derived from provider offsets.

Raw provider payloads remain out of normal API responses. The evaluation
snapshot keeps the normalized reference, provider mapping and versions.

## Rules and safety behavior

- Bolt count/PCD mismatch and a wheel bore smaller than the hub are
  `incompatible` only with trusted RimSpec evidence (E3+).
- A larger known bore is `compatible_with_conditions` with the explicit
  centering-ring condition.
- Diameter/width must match an explicit allowed Wheel Size reference for that
  axle. A different/adjacent size is `unknown`, not an invented hard conflict
  or positive result.
- ET must be present and trusted and is evaluated only against Wheel Size's
  exact interval for the matching axle/size. Outside that interval is
  `compatible_with_conditions` requiring physical inner/outer clearance
  verification; no local ET tolerance, hard ET limit, spacer, or clearance
  guess exists in V1.
- Missing provider fields, missing RimSpec fields, low-evidence conflicts and
  unconfirmed parser/product-page values resolve to `unknown` for critical
  fields. They cannot yield `compatible`.
- Staggered checks load and snapshot independent front/rear RimSpec rows, then
  evaluate both axles. A rear conflict cannot be masked by the front result.
- Aggregation precedence is `incompatible` → critical `unknown` →
  `compatible_with_conditions` → `compatible`.

## Benchmark and tests

- Versioned fixture: `tests/fixtures/fitment/benchmark_v1.json`
- Runner: `scripts/fitment_benchmark.py`
- Benchmark version: `fitment_verdict_v1_2026-08-20`
- Cases: 33 (compatible, conditions, confirmed conflicts, missing evidence,
  raw parser evidence, size outside reference, ET reference gaps, and
  staggered rear cases)
- Primary safety metric: false-compatible rate = `0 / 33 = 0.0%`
- Expected-status mismatches: `0`

Automated verification:

- `ruff check .` — passed
- `ruff format --check .` — passed
- `pytest -q` — `237 passed, 3 skipped`
- Benchmark runner — passed, 0.0% false-compatible rate

## Staging E2E status

Not run. The remaining beta-gate check must use an authenticated staging user
who has selected an exact Wheel Size vehicle variant and a confirmed RimSpec.
It should verify at least: exact compatible, larger-bore conditional, PCD
mismatch incompatible, missing ET unknown, and Wheel Size outage → operational
`failed` (not `unknown`).

## Known limitations

- Wheel Size coverage and provider availability determine whether a profile is
  available; timeout/rate-limit/invalid response stays operational `failed`.
- No tyre package, brake/X-factor, load-rating requirement, exact fastener
  hardware package, vehicle modification, spacer, or physical 3D clearance
  claim is made by V1.
- A `compatible` result is preliminary technical assessment only, never an
  installation guarantee.
