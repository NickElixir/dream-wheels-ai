# Fitment VNext — Comparison evidence contract

Dependency: Slice 5 PR #238. Separate proven API gap for Slice 6/spec §19.

The CheckResponse previously omitted successful rule results and persisted
reference/selected values, making the five-row historical table impossible.

Adds `field_results` to existing check create/detail/history responses. Completed
checks expose five ordered fields per axle. Values come only from saved input
and evaluation snapshots; statuses come from stored rule groups. No new rule,
verdict, admission, provider request or canonical mutation is introduced.

Diameter/width reference values are discrete provider choices, not an invented
continuous range. ET uses the saved reference matching that axle's diameter and
width, preserving decimals. Missing evidence remains null/unknown; pending and
failed checks expose no comparison rows. Stale checks retain saved values.

Verification: 31 Standard Check API tests, including persisted JSONB snapshots,
front/rear isolation, exact ET, stale preservation and legacy missing evidence.
Ruff passed. No schema migration/env/deployment. Staging E2E remains BLOCKED.
