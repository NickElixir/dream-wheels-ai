# P0.5-C0 WHEEL-SIZE LIVE PROVIDER SPIKE

Date: 2026-10-04. Investigation only. **Status: BLOCKED / partial evidence.**
This is the final delivery of this investigation attempt, not a completed live spike.
No authenticated provider samples were collected. No claim below substitutes documentation or source inspection for live evidence.

## 1. Repo/provider state

Repository: NickElixir/dream-wheels-ai. Inspected staging base:
`9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a`.
Branch: `docs/p05c0-wheel-size-live-spike`.

Source authorities:
- `src/fitment/config.py`: key/base URL, timeout/retry/cache settings.
- `src/fitment/providers/wheel_size.py`: WheelSizeProvider, HTTP client, catalogue projection, profile normalization.
- `src/fitment/schemas.py`: VehicleIdentity, FitmentProfile, AxleFitment, OffsetReference.
- `src/jobs_api.py`: VehicleVariantResponse, FitmentSelectedModificationResponse, canonical selection/readback.
- `webapp/app.js`: fitmentVariantDisplayName, fitmentVariantTechnicalSeries, variant model projection.
- `webapp/vnext/views/fitment.js`: variantChooser renderer.

There is no separate ProviderVehicleIdentity DTO in this inspected path. Variants are dictionaries before the API model. Runtime, database, verdict and UI were not changed.

## 2. Endpoints used

Current implementation uses base `https://api.wheel-size.com/v2`, query authentication `user_key`, and catalogue paths `regions`, `makes`, `models`, `years`, `generations`, `modifications`.
Exact lookup filters year/region and fetches modifications separately per generation slug.
Profile lookup uses `search/by_model` with make/model/year/region/modification; generation slug is required in the persisted mapping but is not sent in that search request.

**Authenticated endpoints called during this attempt: none.** Official [API data documentation](https://developer.wheel-size.com/api-data) was read. The OpenAPI URL could not be retrieved through the web tool; that is a documentation retrieval limitation, not evidence of a provider outage.

## 3. Test vehicle matrix

| Required coverage | Live status |
| --- | --- |
| EV | Not collected |
| Petrol | Not collected |
| Diesel | Not collected |
| Hybrid | Not collected |
| Many engines / trims in one year | Not collected |
| Several generations | Not collected |
| Multiple markets | Not collected |
| Actual problematic near-duplicate example | Vehicle/year/market not established |

Do not promote existing mock Porsche/BYD fixtures to live evidence.

## 4. Sanitized raw samples

None. `WHEEL_SIZE_API_KEY` was absent from the execution environment and checked local source `.env` / `.env.local` configurations. Only key-presence booleans were printed; no values were printed or copied. User was asked for a configured credential file path and the problematic example, not for a secret in chat.

Resume requires staging/test key access. Capture unmodified response JSON except recursive removal of credentials/auth/signatures and unnecessary user data. Record safe endpoint/filter/status/time and hashes of sanitized files. Avoid logging full authenticated URLs and HTTP exceptions containing query credentials. Use bounded read-only requests; bypass shared provider-cache writes for the experiment.

## 5. Field inventory

Actual upstream availability is **unverified** for every requested field. Official documentation describes generation/production years, body/doors/platform, trim/region, engine/displacement/code, headline power, fuel/electrification and additional powertrain attributes. These claims do not establish exact JSON paths, nullability, plan availability or population for this account. Drivetrain/transmission/facelift/wheelbase and multiple engine codes still require sample-level verification.

Documentation also distinguishes headline/system/engine power and hp/PS/kW: do not flatten these into an unlabeled power number. The documentation contains more fields than the current variant DTO; which ones appear in catalogue versus search responses is still unknown.

## 6. Loss matrix

`Unverified` means no live response. `No` in parsing/storage columns means the current dedicated variant projection does not carry that field, not that upstream supplies it.

| Field | Provider has (live) | Adapter parses for variant | Selected snapshot stores | Variant API returns | Chooser shows |
| --- | --- | --- | --- | --- | --- |
| generation name | Unverified | Yes, name/name_en/slug fallback | Yes | Yes | Secondary fallback when body absent |
| generation slug | Unverified | Yes | Yes | Yes | Identity only |
| modification name | Unverified | Yes, name/name_en/trim/slug fallback | Yes | Yes | Primary label |
| modification slug | Unverified | Yes | Yes | Yes | Identity only |
| body | Unverified | Yes, string conversion / generation fallback | Yes | Yes | Secondary label |
| market/region | Unverified | Requested region copied | Yes | Yes | Secondary label |
| production start/end | Unverified | No | No | No | Helper supports years/year_range, API supplies neither |
| engine label/code/displacement | Unverified | No | No | No | Helper supports engine, API supplies none |
| hp/PS/kW and power source | Unverified | No | No | No | No |
| fuel/electrification | Unverified | No | No | No | No |
| drivetrain/transmission | Unverified | No | No | No | No |
| doors/facelift/wheelbase | Unverified | No | No | No | No |
| wheel geometry/reference set | Unverified | Separate profile path | Not selected-modification presentation | Profile/check path, not variant DTO | Not variant label |

Confirmed code-level limitation: fields outside the nine-key projection cannot reach the variant API or selected-modification snapshot, even if returned upstream. **Useful live distinguishing fields lost inside Dream Wheels are not yet proven.**

## 7. Duplicate variant analysis

No actual raw A/B pair captured. Current labels are modification plus market/body-or-generation; different stable keys can therefore produce identical labels if those displayed values coincide. This is a source-level possibility, not a demonstrated live pair. No invented TDI/TFSI/power examples are presented as evidence.

## 8. Stable identifiers

Current primary selection identity is the tuple make_slug/model_slug/region/generation_slug/modification_slug. Backend and frontend compare these fields, not labels. Retain this identity during C; verify upstream uniqueness/scope in live samples before changing it. Year is a lookup and revision-bound vehicle context and should remain associated with any persisted snapshot. Cross-time stability of upstream slugs has not been proven.

## 9. Optionality/unit issues

Current parsing supports missing names and stringifies body, which could display a structured body object as a Python dictionary string if upstream sends one; live shape unverified. Numeric profile parsing tolerates numeric strings, null and N/A; ET supports offset/et/rim_offset aliases, lists and endpoint ranges without interpolation. These are implementation behaviors, not observations of this run.

Still inspect localized values, number/string variation, missing power, multiple codes, hybrid system versus combustion power, market differences and explicit absence statuses. Do not equate unknown/not_reported/not_applicable.

## 10. Current DTO limitations

Vehicle variants and selected modification expose only make/model slugs, region, generation/modification labels and slugs, body and market. `_canonical_selected_modification` allowlists these fields; `_modification_from_row` returns the same allowlist only for valid revision-bound confirmed selections. Adding only frontend support cannot recover discarded provider attributes. VehicleIdentity has provider_mappings but no dedicated engine/power model.

## 11. Recommended DTO

No evidence-based new DTO can be finalized before live collection. Preserve existing stable identity. Candidate nullable presentation extension, **conditional on actual responses**: production interval, engine label, explicitly unit-labeled headline power, fuel/electrification, drivetrain and structured body label. Include only fields shown to distinguish sampled pairs. Do not add speculative fields or implement this candidate in C0.

## 12. Persistence recommendation

| Data | Proposed treatment |
| --- | --- |
| Existing provider identity tuple | Canonical/persist; preserve validation and revision binding |
| Verified distinguishing presentation values | Persist a versioned selected_modification snapshot once live shape is known |
| Provider/fetch time/schema version | Provider metadata associated with snapshot |
| Formatted compact label | Presentation-only, derived from saved values |
| Key/token/signature | Do not store |
| Unverified optional fields | Do not add yet |

History/Fitment later should render the verified saved snapshot without requiring a new fetch. Snapshot enrichment must not be interpreted as user confirmation or alter frozen confirmation semantics.

## 13. UI distinction recommendation

Keep modification primary; secondary text may combine verified engine, correctly labeled power, drivetrain and production interval, omitting absent values. EV/hybrid labels require provider power-source semantics; avoid synthesizing combustion labels or adding motor powers. Exact label content awaits actual duplicate pairs. No UI design or renderer changes made.

## 14. F-06 reference response

No live reference response collected. Existing normalizer reads technical PCD/stud holes/DIA/fasteners and wheel front/rear diameter/width/ET/stock/tire into a FitmentProfile. It preserves stock evidence and axle information, deduplicates normalized rows and copies front to rear only when no actual rear rows exist. OffsetReference groups exact axle/diameter/width/evidence, not a universal ET interval. This inspection cannot prove coverage/completeness of provider reference sets.

## 15. F-06 relation feasibility

**Conditionally feasible; live verification pending.** For a validated selected modification/market and explicit reference scope, collect finite positive diameters per axle and preserve stock/optional/aftermarket provenance. Exact membership means within_reference; below min / above max yields below_reference / above_reference. A value between extrema but absent from a discrete set must not be silently called an approved reference size: recommend not_comparable with a machine-readable gap reason, unless the frozen contract later explicitly defines a range relation. Empty/ambiguous sets, unknown units, unknown rear provenance or mixed variant/market must yield not_comparable.

These relations describe the known provider set, not physical compatibility, completeness or render permission. Do not change verdicts. The backend cannot yet be declared reliable on live provider inputs for F-06.

## 16. Provider limitations

Credential access blocks authenticated collection. Current problematic vehicle identity is unavailable. Docs do not prove live payload shape or account coverage. Stable IDs across time, optionality, reference completeness, response pagination and limits remain unverified. Past ET audit is historical evidence only, not a current substitute. No bulk provider sweep, render, credits, DB/schema changes, staging runtime mutation or runtime merge was performed.

## 17. READY FOR P0.5-C IMPLEMENTATION: NO

Before C: obtain the configured staging/test key; establish the real problematic vehicle; collect bounded vehicle-matrix catalogue and reference responses; sanitize/save them; complete field-path/type inventory and loss matrix; demonstrate actual duplicate pairs and per-axle reference relations. Stop after C0. This docs delivery does not authorize starting C.
