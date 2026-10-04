# Deferred Fitment domain/provider backlog

## EXISTING SIZE RULE SEMANTICS — separate engine-semantics follow-up

Current `src/fitment/rules/checks.py:_best_size_match` couples diameter + width in one provider row. Target product contract treats diameter/width independently. P0.5-C diameter explanation does not use that function and does not canonicalize its coupled behavior as the diameter contract. Full width/size engine semantics require a separate task and review. Status: DEFERRED. No rule/verdict changes in C.

## Wheel-Size live fastener parser mismatch — separate provider follow-up

C0 live payloads use `technical.wheel_fasteners` and `technical.wheel_tightening_torque`; current `_normalize_profile` uses `technical.fasteners` and nested torque. Scope for a future task: inspect exact paths with C0 sanitized fixtures, update parser with compatibility/provenance tests, verify affected technical DTOs independently. Do not redesign Standard verdict or add mandatory fastener gating without its own approved contract. Status: DEFERRED. Not fixed in C.
