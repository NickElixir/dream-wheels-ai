# P0.5-C FITMENT REFERENCE & VARIANT DETAILS REPORT

## 1. Base SHA

`28e2e8d` — staging after C0 PR #257 merge. Full base available in branch Git history.

## 2. Branch

`feature/p05c-fitment-reference-variant-details`.

## 3. PR

Delivery PR targets staging: `P0.5-C: improve Fitment reference and variant details`. PR URL is recorded in the delivery response/GitHub metadata; no merge authorized by this delivery.

## 4. HEAD

Use final GitHub headRefOid for full independent review and CI. This report ships in the commit it describes; it does not embed its own SHA.

## 5. C0 dependency / reviewed evidence

User confirmed C0 reviewed/READY YES. PR #257 is merged in base. Uses committed `docs/evidence/p05c0-wheel-size-live-spike/raw/` fixtures only; no new live provider calls. Six representative Cayenne/Golf/Tesla variants plus a long Cayenne hybrid label and exact Cayenne A/B profiles. C0 inventory/loss matrix/index remain authoritative; 38 raw captures not duplicated.

## 6. Runtime scope

Changes only provider variant display projection, additive variant/selected response details, existing JSON selected snapshot read/write, completed Check API diameter explanation, Fitment projection/rendering and tests. Payment/credits/render/Create recognition/History unchanged. No overall verdict/rule engine changes. CI adds the snapshot PostgreSQL test to the existing isolated provenance step.

## 7. F-17 adapter enrichment

`find_vehicle_variants_exact` extracts proven raw fields via `wheel_size_display_details`: modification start/end years, engine code/capacity/type, separate power kW/hp/PS, powertrain fuel/electrification, explicit trim attributes and body derivatives. No name parsing, random generation body, synthetic drivetrain or numeric ID. Optional invalid data degrades to absence, never makes valid core identity unselectable.

## 8. F-17 final DTO

Shared VariantDisplayDetails: optional production_year_from/to (int), engine_code/type (str), engine_capacity_l/power_kw/power_hp/power_ps (finite positive float), fuel_code/electrification_level (str), trim_attributes/trim_body_types (string arrays). API inherits it in VehicleVariantResponse and FitmentSelectedModificationResponse. Unavailable metadata is omitted on serialization; legacy API shape remains valid. No raw provider JSON is exposed.

## 9. Stable identity invariant

make_slug/model_slug/region/generation_slug/modification_slug matching unchanged, on both backend and frontend. Tests change power/years and assert identical matching. Display fields are never request identity requirements. Existing same-choice replace path still returns under lock before mutation; it does not rewrite display data or manufacture a Vehicle revision/confirmation.

## 10. Persistence/display snapshot

Canonical selected snapshot allowlist now adds validated optional display fields to existing identity/display fields. JSON provider_mappings supports additive data; no schema migration. Readback validates optional details separately and preserves base strings/source/revision gating. Save snapshots remain server-derived from revalidated provider results, not client-provided enrichment. No localized secondary string or wheel reference arrays persisted in identity.

## 11. Legacy compatibility

Legacy selection without enrichment loads existing labels. Local PostgreSQL roundtrip persists actual Cayenne Coupe/250kW/year metadata in JSONB, re-reads via `_modification_from_row`, and then verifies legacy selection readback and unchanged identity. Existing API/reselection/provenance suites pass. No forced provider refresh for existing saved labels.

## 12. Variant UI presentation

Primary remains modification. Secondary: explicit body derivative, one power (kW → PS → hp), explicit attributes, engine code and production interval, available pieces only; old technical fallback when empty. Uses `/` per existing Design Code separator contract. No xDrive/Quattro/etc inference. Slugs stay internal. Where provider display values still coincide, cards retain identities without fabricated labels; provider limitation remains documented in C0.

## 13. F-06 backend relation contract

Completed CheckResponse exposes additive `diameter_reference_details[]`: axle, rim_diameter_in, sorted/deduplicated reference_diameters_in, min/max, reference_relation, exact_diameter_match and reference_scope=normalized_allowed_wheels. Pure helper reads saved input_snapshot/evaluation_snapshot.normalized_profile, no current provider fetch or mutable canonical read.

## 14. exact_diameter_match decision

Exact public field is **exact_diameter_match**, not exact_reference_match. Relation enum below / within_bounds / above / unknown. Diameter membership and bounds do not inspect width. [18,20] / 19 gives within_bounds + false; missing/malformed reference gives unknown + null. Invalid submitted diameter safely gives unknown + null. Non-finite/non-positive/bool/string diameters are excluded; no width-derived result.

## 15. Reference scope

Same normalized allowed_wheels evidence as existing snapshot, all known rows; no stock-only switch. Reference sizes are discrete, not claimed complete physical clearance range. Known diameter match is not full reference-row approval or compatibility. Units remain inches.

## 16. Front/rear semantics

For staggered setup return separate front/rear detail; square returns front explanation. Axle filter never merges both sets. Existing normalizer's front-to-rear derivation behavior is unchanged. C0 rear provenance limitation remains explicit; this PR does not invent independent rear data.

## 17. Verdict preservation

No checks/engine/verdict modules modified. CheckResponse verdict/reasons/blockers remain existing stored result. Diameter explanation is separate and does not emit diameter_out_of_range as a reason. Below/above never upgrades to incompatible. Representative API from current rule replay still unknown / size_not_in_reference. UI labels disclaimer that diameter alone does not prove overall compatibility.

## 18. Cayenne cross-integration case

C0 exact 117a52c786: [19,20,21,22]; 19e5c5a357: [20,21,22]. Submitted 19 → A within_bounds/true, B below/false. Width 8.5/10/null cannot change either result. Raw derivatives [] vs [Coupe] and production years distinguish chooser; selected snapshot retains Coupe. Submitted 16 is below for both and keeps unknown verdict in representative response. See representative-api.json and backend tests.

## 19. Missing/optional provider data

Null capacity/code, empty arrays, not_applicable flags and blank generation remain valid. Malformed optional nested structures, NaN and overflow degrade safely. No entire variant rejection due to display metadata. Synthetic malformed/gap tests are clearly tests, not invented C0 live payloads.

## 20. RU/EN UI

All new factual explanation copy goes through existing app I18N/t. View renders prepared strings without recomputing relation or using width. Tests verify RU/EN below/above/gap/exact/unknown presentation. Existing localization/render system remains; no separate dictionary introduced. Power units are explicit kW/PS/hp, never conflated.

## 21. 390/1440 QA

Local URL: http://127.0.0.1:8776/tests/browser-fixtures/p05c-fitment-details.html. Production projection functions + production view, generated backend DTO fixture. Playwright used because Browser plugin skill unavailable. Four cases RU/EN × 390/1440: meaningful page, no overlay, zero relevant console errors, no horizontal overflow, selection pressed and confirmation enabled, reference list/submitted size/unknown verdict visible. External bootstrap calls stubbed with empty JSON; no checkout/provider calls. Screenshots show wrapped Coupe/engine/year details and long hybrid label; controls remain visible. This is local browser QA, not full authenticated staging E2E.

## 22. Backend tests

Full suite: 693 PASS / 6 skipped with isolated local payment/provenance PostgreSQL URLs. Focused new variant/diameter and existing real provenance: 13 PASS. New tests cover finite references, missing/malformed data, discrete gap, width independence, axle scope, C0 exact Cayenne sets, full/partial/EV/ICE metadata and stable selection.

## 23. Frontend tests

212 PASS. Transition/boot: 133 PASS. Build PASS. New tests assert actual production projection helpers and i18n strings, power fallback, no invented drivetrain, empty-piece omission, legacy technical fallback and backend-driven relation unaffected by width. Existing isolated snapshot harness includes the new helper. Initial failures from Design Code middle-dot prohibition and sliced harness omission were corrected; final tests green.

## 24. PostgreSQL tests

Real isolated loopback database, no staging mutation. New snapshot JSONB roundtrip and existing provenance transaction/readback suites pass. Existing payment real tests also exercised in full local run. CI explicit provenance step includes new snapshot test; standard CI does not require live Wheel-Size. Six other optional tests remain skipped and are not claimed executed.

## 25. CI exact HEAD

PENDING at delivery; verify GitHub checks on final published headRefOid. Local tests are not a substitute for final-head CI. No auto-merge.

## 26. Migration impact

NO migration. Additive selected_modification JSON fields and CheckResponse detail; legacy JSON remains valid. No backfill, synthetic metadata or staging data writes.

## 27. Fastener finding status

FASTENER MISMATCH: DEFERRED. Separate backlog item in deferred-findings.md (live technical.wheel_fasteners/top-level torque vs current parser path). No fastener parser change here.

## 28. New findings

No new blocker/high/medium/low identified by this implementation's local validation. This is not an independent review verdict. Optional metadata field omissions remain expected limitations, not fabricated replacements.

## 29. Deferred findings

EXISTING SIZE RULE SEMANTICS: `_best_size_match` couples diameter+width in one row; target product treats dimensions independently. F-06 does not use this coupled rule as diameter authority. DEFERRED separate engine-semantics follow-up; see deferred-findings.md. Fastener mismatch separately DEFERRED. P0.5-D/P1 untouched. Original authenticated staging E2E not claimed complete.

## 30. READY FOR INDEPENDENT REVIEW

YES for full independent review after push. Stable identity PRESERVED; verdict semantics PRESERVED; exact field exact_diameter_match; legacy PASS; local 390/1440 PASS. Await exact-head CI/review; do not merge or proceed to D automatically.
