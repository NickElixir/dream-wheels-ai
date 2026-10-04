# P0.5-C0 WHEEL-SIZE LIVE PROVIDER SPIKE

## 1. Date / environment

2026-10-04 (Europe/Moscow). Live Wheel-Size v2 using configured staging credential; read-only GET requests. 38 successful responses, six vehicle names, seven vehicle/year/market cases. Individual UTC timestamps, safe parameters and hashes: [requests.jsonl](requests.jsonl). No staging/production DB, cache, queue, credits or render writes. Investigation only; no runtime implementation.

## 2. Current repo/provider pipeline

Staging base `d85beaf2d47c33bc277c2e2f013e6fa40db7708d`; main `c5a8524386182d540d77c636acc00f3941a52431`. The inspected VNext provider file is absent on current main; staging is the applicable implementation authority. Branch `docs/p05c0-provider-investigation`. PR #256 remains P0.5-B.

| Layer / exact source | Input → output | Preserved / discarded |
| --- | --- | --- |
| `src/fitment/config.py` | env → provider configuration | key used only in HTTP authentication |
| `src/fitment/providers/wheel_size.py:WheelSizeProvider._request` | GET → JSON | entire JSON; bounded retry for 429/5xx; safe error messages |
| `_cataloging` | payload.data → list / shared cache | catalogue response, not variant DTO; experiment bypassed cache |
| `find_vehicle_variants_exact` | years/generations/modifications → nine-key dictionaries | names/body/market/slugs retained; engine/power/years/trim detail discarded |
| `src/fitment/schemas.py:VehicleIdentity` | canonical vehicle + provider_mappings | no dedicated ProviderVehicleIdentity class in this path |
| `src/jobs_api.py:_canonical_selected_modification` | variant → selected mapping | nine-key allowlist; further enrichment would be discarded again |
| `_modification_from_row` | revision-bound provider mapping → selected response | confirmed source/revision required, same allowlist |
| `VehicleVariantResponse`, `FitmentSelectedModificationResponse` | dictionaries → API DTOs | same nine fields, no optional powertrain details |
| `webapp/app.js:fitmentVariantDisplayName` / `fitmentVariantTechnicalSeries` | API variant → label/technical | primary modification; secondary market/body-or-generation; helper accepts engine/years but API supplies neither |
| `webapp/vnext/views/fitment.js:variantChooser` | presentation model → card | label + optional technical string, no raw-provider fetch |
| `get_fitment_profile` / `_normalize_profile` | exact modification search → FitmentProfile | separate wheel geometry/technical profile, not variant identity |

## 3. Provider endpoints

Live: `/generations/`, `/modifications/`, `/search/by_model/`. Parameters make/model/year/region; generation-filtered modifications and modification-filtered search additionally tested. Authentication is excluded from captured params. Existing hierarchy also has `/makes/`, `/models/`, `/years/`, `/regions/`; those were inspected in code, not called in this bounded run.

The generations endpoint returned model history even with year supplied. Modifications respected the tested generation filter. Search with modification returned exactly one matching object in all eight exact requests. Current profile code requires generation_slug but sends make/model/year/region/modification, not generation.

## 4. Test vehicle matrix

| Vehicle/year | Market | Modifications | Coverage |
| --- | --- | ---: | --- |
| Porsche Cayenne 2021 | EUDM | 13 | current same-label defect reproduced, petrol/PHEV, Coupe derivative, staggered references |
| Porsche Cayenne 2021 | USDM | 13 | cross-market comparison |
| Tesla Model 3 2023 | EUDM | 6 | BEV, same-name/different-power, blank generation name, generation overlap |
| Volkswagen Golf 2020 | EUDM | 25 | petrol/diesel/hybrid, two generations, many engine choices |
| Toyota RAV4 2021 | EUDM | 5 | hybrid FWD/AWD attributes |
| BMW 3 Series 2020 | EUDM | 21 | diesel/petrol, power/engine/production distinctions |
| Toyota Corolla 1995 | EUDM | 8 | older nullable capacity/code, catalogue only |

Cayenne is a live provider reproduction through the current projection, not a claimed inspection of a particular authenticated user's stored job. No user job identity was supplied. This evidence proves the defect for selectable live variants without modifying user data.

## 5. Sanitization method

Capture parsed HTTP JSON, preserving object names, arrays/order, nested fields, IDs, numbers, strings, nulls and empty values. Pretty-printing changes whitespace only. Do not replace raw with normalized projections. No HTTP headers/credential query strings recorded. All 38 bodies were checked against the configured key; sensitive payload-key scan found no credential fields needing removal. Thus zero redactions were required in these catalogue responses. Derived files are explicitly separated under comparison/normalized. Security results: [security-verification.json](security-verification.json).

## 6. Raw field inventory

Machine-readable path/type/null/examples inventory: [comparison/field-inventory.json](comparison/field-inventory.json). Counts include appearances in catalogue and search, not independent vehicles. Key observed paths:

- `slug`, `name`, `trim`, `generation.slug/name/platform/start/end/bodies[]`, modification `start_year/end_year`, `regions[]`.
- `engine.fuel/capacity/type/code/power.{kW,PS,hp}`.
- `powertrain.combustion_engine/electrification_level/primary_fuel/secondary_fuel/engine_power/system_power/engine_power_secondary/motors[]`.
- `trim_attributes[]`, `trim_body_types[]`, `trim_levels[]`; body and trim_scoring nullable.
- `technical.stud_holes/pcd/centre_bore/bolt_pattern/wheel_fasteners`, `technical.wheel_tightening_torque` and rear-axis technical keys.
- `wheels[].is_stock/showing_fp_only` and per-axle rim diameter/width/offset, tire/pressure/load flags.

No standalone numeric variant/modification ID, structured transmission, torque engine rating, wheelbase, doors count or facelift boolean found. Facelift and doors are present only in some human generation/body names; do not parse them into invented canonical values.

## 7. Current Dream Wheels mapping

Nine fields: make_slug, model_slug, region, generation, modification, body, market, generation_slug, modification_slug. Body is null in sampled modifications; current adapter checks singular body, not `generation.bodies` or `trim_body_types`. It therefore loses the explicitly supplied Coupe derivative. Names fall back to slug; frontend hides opaque hash-like generation text.

[normalized](normalized/) contains local projection equivalents and actual current `_normalize_profile` outputs for eight exact live responses. Profile normalizer was called locally with inert cache, no shared-cache or DB writes.

## 8. Field loss matrix

Central loss point for F-17: **provider → adapter** (`find_vehicle_variants_exact`). Persistence/API allowlists are additional boundaries that also need explicit enrichment later.

| Field / raw path | Raw provider | Adapter variant | Internal variant DTO | Stored selection | API variant | UI | Stable? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| modification slug / `slug` | yes | yes | yes | yes | yes | identity only | unchanged on repeat |
| numeric modification/variant ID | absent | no | no | no | no | no | no evidence |
| generation slug/name | yes | yes | yes | yes | yes | name secondary | slug unchanged on repeat |
| generation start/end | yes | no | no | no | no | no | display, not identity |
| modification start_year/end_year | yes | no | no | no | no | no | display snapshot |
| engine code/capacity/type | yes, nullable | no | no | no | no | no | display, not identity |
| engine.power hp/PS/kW | yes | no | no | no | no | no | mutable display |
| engine.fuel / primary_fuel code | yes | no | no | no | no | no | metadata/display |
| electrification_level | yes | no | no | no | no | no | optional display |
| trim_attributes FWD/AWD | yes on some rows | no | no | no | no | no | display, not universal drivetrain field |
| trim_body_types | yes; empty or Coupe | no | no | no | no | no | derivative distinction |
| trim_levels | yes, arrays | no | no | no | no | no | optional enrichment |
| body | key null in samples | yes, null→empty | yes | yes | yes | fallback generation | no usable singular label |
| generation.bodies names/slugs | yes | no | no | no | no | no | generation options, not chosen derivative |
| market/regions | yes | requested region copied | yes | yes | yes | market label | retain requested region in identity |
| transmission/wheelbase/engine torque | absent | no | no | no | no | no | do not add |
| diameter/width/ET/is_stock/tire | yes in search | separate profile | FitmentProfile | check profile snapshot | check path | reference path | not vehicle identity |
| PCD/DIA | yes in search | separate profile | FitmentProfile | check profile snapshot | check path | technical path | not vehicle identity |
| wheel_fasteners / tightening torque | yes | current parser uses different path | absent in tested normalized profiles | absent there | absent there | absent there | extra mapping limitation |

The last row is an additional source finding: current parser expects `technical.fasteners` with nested torque, whereas live uses `technical.wheel_fasteners` and top-level torque. It is recorded, not fixed in C0.

## 9. Problematic F-17 examples

[comparison/duplicate-pairs.json](comparison/duplicate-pairs.json) includes raw A/B and every differing leaf for 25 same-generation/name groups (first pair per group; all members remain in raw files).

| Case | Current UI A = B | Stable slugs | Actual distinctions |
| --- | --- | --- | --- |
| Cayenne 2021 | `3.0 Turbo` / market + E3 (9Y) | 117a52c786 / 19e5c5a357 | 2017–2023 vs 2019–2023; trim_body_types [] vs [Coupe]; same 335 hp / 340 PS / 250 kW |
| Golf Mk7 facelift | `1.5 TSI` / market + generation | ddeb5989b3 / 2a7b128d60 | 148 vs 129 hp; 110 vs 96 kW; DADA vs DACA |
| Model 3 | `Long Range` / market, opaque generation hidden | 5a081c2f38 / 0d7499344b | 456 vs 346 hp; 340 vs 258 kW; both AWD |
| RAV4 | `2.5` / market + generation | 497fad336e / ba0a95f8ef | 215 vs 219 hp; explicit FWD vs AWD attributes |
| BMW | `330d` / market + generation | 33e2e04077 / e5a4b5bc79 | 261 vs 282 hp; years 2019–2020 vs 2020–2022; capacity null vs 3.0 |

Do not invent a distinction if every available value matches. Preserve separate slugs and disclose provider limitation; wheel size is not a replacement identity key.

## 10. Stable IDs/slugs

Observed modification slug is unique within each sampled case, generation slug distinguishes same-name generations. Keep current make_slug/model_slug/region/generation_slug/modification_slug tuple; year remains bound vehicle context. No need to change selection matching for display enrichment. Repeated-call evidence demonstrates short-term stability, not a provider guarantee across future catalogue revisions.

## 11. Repeated-call stability

Cayenne, Model 3 and Golf: repeated modifications and search responses were JSON-equal, including IDs, ordering, labels, optional data and reference wheels. Six comparisons: [comparison/repeated-call-stability.json](comparison/repeated-call-stability.json). This rules out observed ordering noise in this capture window only.

## 12. Market differences

Cayenne EUDM/USDM returned same 13 IDs/order, same labels and wheel rows. Region arrays may reorder without semantic differences. [comparison/market-comparison.json](comparison/market-comparison.json). Therefore IDs can be shared across markets; retain requested region regardless. Do not claim all models/markets have equal references.

## 13. Optional/null/type differences

Tesla engine type/code/capacity null, combustion engine not_applicable, engine_power/system_power null and motors empty despite non-null headline engine.power. BMW/Golf/old Corolla capacity/code can be null; multiple engine codes arrive as one comma-separated string. Body null, arrays often empty. Tesla generation.name is empty. `powertrain` has explicit not_reported/not_applicable strings; do not collapse them into confident fuel/electrification claims.

No missing headline hp/PS/kW or modification year endpoints observed in this bounded sample, including eight older Corolla rows. This is not proof that optional fields are universally required. Entire engine/fuel absence was not found; future DTO must still tolerate absent optional keys. Corolla had catalogue-only evidence; no wheel reference claims for it.

## 14. Unit handling

Observed separate hp/PS/kW values, e.g. Golf 148 hp / 150 PS / 110 kW. Prefer explicit kW in minimal labels or PS with correct metric-horsepower wording; do not relabel 148 hp as 150 hp. For hybrid/EV engine.power is headline, not necessarily combustion-only power. Keep powertrain source distinctions; never sum motor powers.

Rim strings `8.5Jx19 ET47` and numeric 8.5/19/47 agree. Diameter/width inches, offset/DIA/PCD mm; bore numeric string, ET float. Tire diameter_mm is a separate field, never wheel diameter. Pressure has explicitly bar/psi/kPa. Official [data documentation](https://developer.wheel-size.com/api-data) is secondary unit/power semantics support; raw fixtures are shape evidence.

## 15. Recommended F-17 identity fields

Preserve existing provider=wheel_size and identity tuple. Persist no display text/power as identity. Slugs are the available provider identifiers; no invented numeric ID. Display changes must not alter `_variant_selection_matches`.

## 16. Recommended F-17 display fields

Minimal nullable extension based on actual distinctions: production_year_from/to from start_year/end_year; engine_code; engine_capacity_l; engine_type; headline_power_kw/hp/ps separately; fuel_code; electrification_level; trim_attributes[] and trim_body_types[]. Primary remains modification. Optional trim_levels[] only where it adds useful distinctions. Do not add a synthetic engine_label/drivetrain derived from modification text. A drivetrain label may use explicitly returned FWD/AWD attributes only, with provenance indicating trim attribute.

## 17. Persistence recommendation

| Data | Treatment | Why |
| --- | --- | --- |
| existing identity tuple | persist canonical | validated selection, revision binding |
| generation/modification display names | persist selected snapshot | current behavior/history |
| production interval, engine data, headline unit values | persist optional display snapshot | stable later UI without fetch |
| fuel/electrification/trim attributes/body derivative | persist optional display snapshot | distinguish variants honestly |
| provider/schema/fetch timestamp | provider metadata | interpret future snapshots |
| formatted secondary label | presentation-only | locale and omission rules |
| raw response/images/unused reference data | do not persist in selection | unnecessary coupling; wheel profile stays separate |
| credentials | never persist | security boundary |

Legacy snapshots without enrichment keep existing label. New display snapshot must not be treated as new confirmation evidence or change vehicle revisions by itself.

## 18. UI distinction recommendation

Primary modification; secondary only available pieces. Real examples: Golf `110 kW · DADA · 2017–2020`; Model 3 `340 kW · AWD · 2018–2023`; Cayenne `Coupe · 250 kW · 2019–2023` versus `250 kW · 2017–2023`. Do not imply [] means non-Coupe or a specific drivetrain. Body derivative must come from trim_body_types, not selecting a random generation body. Omit missing pieces/separators. Future implementation still needs 390px QA; C0 does not redesign or edit UI.

## 19. Wheel reference response structure

Search records attach `technical` and discrete `wheels[]`, each containing front/rear objects plus pair-level is_stock and other flags. No min/max diameter interval upstream in these fixtures. Rear object can be present with all geometry null. Staggered is observable as explicit differing front/rear widths, not a universal boolean. Stock=false rows are non-stock references; do not assume they are all manufacturer-approved merely from that flag.

## 20. Variant-specific vs generation-specific references

Exact search returns one matching modification with its wheel rows. Cayenne same-generation 3.0 Turbo slugs 117a52c786 and 19e5c5a357 have different sets (19–22 vs 20–22). Exact responses retained under raw prove this is modification-specific, not one generation-wide range. Selecting the wrong visually identical variant changes reference evidence.

## 21. Reference diameter sets

[comparison/reference-sets.json](comparison/reference-sets.json): 83 variant/market records, separate explicit axle sets and stock sets. Examples:
- Cayenne 117a52c786: front/rear all [19,20,21,22], stock [19].
- Cayenne 19e5c5a357: front/rear all [20,21,22], stock [20].
- Tesla 5a081c2f38: front all [18,19,20], rear explicit [19,20]; front stock [20], no explicit stock rear.
- Golf ddeb5989b3: front all [15,16,17,18,19], stock [16,17], rear empty.
- RAV4 a7bd8e0eec: front all [17,18,19], stock [17,18], rear empty.

Current normalizer copies front to rear only if no actual rear rows exist anywhere. Preserve this provenance distinction; absence is not independent rear evidence. For explanation use the same normalized allowed_wheels scope as the current rule, with explicit stock/all metadata; do not silently switch to stock-only.

## 22. below/above/within feasibility

YES for exact selected modification/market, specified axle and usable known numeric set. Backend compares submitted finite positive diameter to bounds; absent/malformed/ambiguous data → unknown. Explanation is relative to known records, not complete physical compatibility. No source-data writes needed for feasibility analysis.

## 23. exact-match vs range semantics

Recommend independent `reference_relation: below | within_bounds | above | unknown` and `exact_reference_match: true | false | null`. Preserve discrete list. No internal diameter gaps found in these captured sets; theoretical [18,20] / 19 remains within_bounds but exact=false, never implied approval. Current rule requires diameter AND width, so exact diameter alone cannot prove a complete reference-size match.

## 24. diameter_out_of_range assessment

Declared in `src/fitment/schemas.py:ReasonCode`; no current emitter found. The current `check_size_and_offset` emits unknown + size_not_in_reference and includes discrete diameter/width reference_sizes when no size match. **Do not reuse diameter_out_of_range as a replacement verdict reason.** Enrich existing detail or add an advisory/detail discriminator if needed; keep the existing reason/status unchanged. Physical clearance is absent. Local rule replay is saved in comparison/verdict-replay.json.

## 25. F-06 example cases

[comparison/f06-example-cases.json](comparison/f06-example-cases.json), real sets with explicitly hypothetical submissions:

| Exact variant / front all-reference set | Submitted | Relation | Exact diameter |
| --- | ---: | --- | --- |
| Cayenne 117a52c786 / [19,20,21,22] | 16 | below | false |
| Cayenne 19e5c5a357 / [20,21,22] | 19 | below | false |
| Tesla 5a081c2f38 / [18,19,20] | 19 | within_bounds | true |
| Golf ddeb5989b3 / [15,16,17,18,19] | 20 | above | false |
| RAV4 a7bd8e0eec / [17,18,19] | 18 | within_bounds | true |

Unknown branch is a safe input-handling requirement, not an invented live empty-reference vehicle. No captured exact profile had an empty overall wheel set.

## 26. Provider limitations

Some requested fields absent; array attributes, not structured drivetrain/transmission. Catalogue-generation response is broader than requested year. Some empty/null powertrain components even when headline output exists. No lifetime ID guarantee. Body options belong to generation; derivative attributes belong to modification. Cross-market equality demonstrated for one model only. Catalogue supplies headline power in all sampled rows; missing-power live example not found. Additional current normalizer fastener path mismatch recorded separately, outside F-06/F-17 implementation scope.

## 27. Security/sanitization verification

Credential value and sensitive payload-key scans on evidence; no key/token/signature/header retained. JSON parse/hash checks, file-size gate and docs-only final diff. No runtime test suite required for evidence-only changes. Local existing parser/rule replay does not mutate services. Commit hooks/diff check must pass before push; PR CI evaluated on final head. See security-verification.json for exact scan results.

## 28. Open questions

Independent investigation review should confirm recommended minimal DTO and stock/all explanatory scope. No new provider unknown blocks the scoped F-17/F-06 work: unavailable optional fields can remain absent, long-term drift is mitigated by snapshot/unchanged matching, rear derivation is explicitly retained. Exact original user's job was not identified; live current-projection Cayenne defect is independently reproducible. Future implementation must test missing optional fields synthetically because missing headline power was not observed live, and label such tests honestly.

## 29. F-17 READY FOR IMPLEMENTATION

**YES for evidenced optional display enrichment, stable identity unchanged.** Distinguishing power/engine/years/derivative/attributes are directly present in live catalogue, and loss boundaries are identified. No speculative transmission/AWD/name parsing.

## 30. F-06 READY FOR IMPLEMENTATION

**YES for structured relation to the existing reference scope, verdict unchanged.** Discrete per-modification/axle sets and raw exact filter behavior are proven. Preserve known-reference versus clearance distinction and exact diameter versus full size distinction.

## 31. READY FOR P0.5-C

**YES — subject to independent investigation review.** Stop after this docs/evidence delivery; C implementation has not begun.

```text
P0.5-C0 RESULT
F-17 LIVE PROVIDER EVIDENCE: SUFFICIENT
F-06 LIVE PROVIDER EVIDENCE: SUFFICIENT
F-17 READY FOR IMPLEMENTATION: YES
F-06 READY FOR IMPLEMENTATION: YES
BLOCKING PROVIDER UNKNOWN: none for the bounded recommendations; limitations above remain explicit
READY FOR P0.5-C: YES (independent investigation review required)
```
