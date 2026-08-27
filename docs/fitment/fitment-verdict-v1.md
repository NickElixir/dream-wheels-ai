# 07 — Fitment Verdict V1

## Status and authority

This is the canonical product contract for Fitment Verdict V1. It defines product behaviour, safety boundaries and UI states; it does not claim that every described future state is already implemented. The engineering status, verification record and next delivery pass are kept separately in the [07 handoff](../handoffs/07-fitment-verdict.md).

`STANDARD_FITMENT_ARCHITECTURE = FROZEN`

`ARCHITECTURE_BLOCKERS_FOR_UI = NONE`

New Standard Fitment architectural changes require a separate deliberate
decision. The next stage is Fitment UI/state design; Extended Fitment remains
future scope.

**Safety rule:** a false positive (`compatible`) is worse than `unknown`. The system must therefore prefer a safe, explained `unknown` whenever the evidence cannot support a positive technical conclusion.

## 1. Deterministic architecture

```text
Confirmed VehicleIdentity
  → Wheel Size API v2
  → Vehicle Fitment Reference
  → confirmed RimSetup
  → deterministic CompatibilityEngine
  → field-level verdicts and explanations
  → overall Fitment Verdict
```

- RAG and LLMs do not determine compatibility and are not planned for that purpose.
- A user-confirmed `RimSpec` is the authoritative wheel input.
- Compatibility is based only on supported technical values and intervals. The engine must not invent tolerances, clearance assumptions, spacer advice, or a positive result from nearby sizes.
- A provider failure is an operational failure, not technical `unknown`.

The V1 critical wheel fields are PCD, DIA, diameter, width and ET. The engine returns a field-level result with an explanation and combines those results conservatively into the overall verdict.

## 2. Standard Fitment — the default free check

**Standard Fitment** is the free, full preliminary deterministic check. It uses all already confirmed input and returns a verdict when the evidence is sufficient. A visual try-on is useful context but is never a precondition for technical checking.

If the system does not have enough trustworthy data, Standard Fitment returns a safe `unknown` with the concrete missing reason. It never converts missing data into a compatible result.

Standard Fitment must not request an Extended check merely because an external service is temporarily unavailable. For provider timeout, network/proxy failure, 5xx, quota/rate limit, authentication failure or malformed response, the user retries Standard Fitment when the service is available.

## 3. Modification selection and the Standard flow

Wheel Size data must be resolved for the currently entered vehicle, not a stale server-side identity.

```text
Validate current form
  → save current make / model / year / region
  → after a successful save, load Wheel Size modifications
```

Local validation is local: it sends no provider request. The interface highlights the exact fields and gives a short explanation.

### Region

`region` means the vehicle's sales market, **not** the user's current geolocation. The current Russian product default is `Russia+`; the user can edit it. Changing make, model, year or region invalidates the selected modification, Vehicle Fitment Reference and current verdict. It preserves the already confirmed RimSpec.

### Selecting a modification

- The modification selection state is explicit:

  ```text
  modification_state: none | suggested | confirmed
  selection_source: wheel_size_single | user | vehicle_recognition (future)
  ```

- When Wheel Size returns exactly one modification, it may be selected
  automatically with `modification_state = confirmed` and
  `selection_source = wheel_size_single`. The UI still explicitly shows the
  selected modification.
- When Wheel Size returns several modifications, the first/recommended item
  may be displayed first or visually suggested, but Wheel Size ordering is not
  a probabilistic ranking and is not authoritative. The initial state is
  `modification_state = suggested`.
- After the user explicitly selects a modification, set
  `modification_state = confirmed` and `selection_source = user`.
- Only a `confirmed` modification may become the authoritative Vehicle
  Fitment Reference for a positive Standard verdict. `none` and `suggested`
  must resolve safely rather than yield a positive result.
- `MULTIPLE_MODIFICATIONS` is a normal selection state, not an error.

## 4. RimSpec confirmation

Show `Подтверждено пользователем` only when every critical V1 field is both present and confirmed: PCD, DIA, diameter, width and ET.

Otherwise show `Требует уточнения` and name the omissions, for example: `Не заполнены: ET, DIA`.

A partial RimSpec does not necessarily block Standard Fitment. The engine may evaluate the available evidence, but critical missing fields produce a safe `unknown` and are included in its explanation.

### Standard V1 ET rule

Evaluate ET per exact axle, diameter and width against the provider-derived Wheel Size interval:

```text
inside provider-derived interval
  → compatible for the ET field

outside provider-derived interval
  → unknown
  → reason: et_outside_reference_range
  → advisory: требуется проверка внутреннего и внешнего зазора

missing rim ET or provider interval
  → unknown
```

Standard V1 does not calculate physical clearance. ET outside the interval is therefore not `compatible_with_conditions`: there is insufficient evidence for that positive conditional statement. The rule introduces no local ET tolerance.

## 5. Overall verdict and field explanations

The user receives both the overall state and per-field reasoning. At minimum, the explanation identifies the compared input, the confirmed reference (when available), the outcome and any required next action.

`compatible` is a preliminary technical assessment, not an installation guarantee. It does not cover tyre package, brakes/X-factor, load rating, fastener hardware, spacers, vehicle changes or physical 3D clearance unless a future contract explicitly adds that evidence.

For `unknown` caused by an unconfirmed vehicle modification, keep the visual result available and offer this non-alarmist next step:

```text
Standard → modification_required / unknown → visual remains available
         → offer Extended: «Проверить все найденные комплектации»
```

## 6. Extended Fitment — documented future scope

Extended Fitment starts only after the user has explicitly accepted the remaining uncertainty after Standard Fitment. It reuses existing evidence and performs an additional lookup; it is not a mechanical repeat of Standard.

### All-modifications sweep

For a confirmed make/model/year/region, Extended Fitment may obtain every eligible Wheel Size modification and produce a result matrix:

| Modification | Verdict | Why |
| --- | --- | --- |
| Modification A | compatible / conditional / incompatible / unknown | field-level explanation |
| Modification B | compatible / conditional / incompatible / unknown | field-level explanation |
| Modification C | compatible / conditional / incompatible / unknown | field-level explanation |

The first investigation must be whether one user-initiated `/search/by_model/` request, with local processing of its records, provides the needed modifications. The implementation must not fan out into N requests when one correct request is sufficient.

Any later fanout needs a bounded maximum. **The maximum is intentionally not
chosen yet.** Standard Fitment V1 first collects the required real-traffic
telemetry; a later Extended decision sets the cap from that distribution. If a
cap leaves records unchecked, results are marked `incomplete`; the UI must not
claim universal compatibility or incompatibility.

The Extended summary distinguishes:

- uniform result across every checked modification, only when the set is complete;
- result depends on the modification;
- incomplete check, with its coverage made clear.

Mixed results must never collapse to `compatible`.

### Future intelligent preselection

When Vehicle Recognition has validated, sufficiently accurate engine/trim/modification output, it may rank or preselect a modification and reduce user actions. Before that validation, uncertain recognition is only a recommendation: it never silently confirms a modification or its fitment reference.

`selection_source = vehicle_recognition` is therefore future-only and, before
the separate quality gate, may mean only `modification_state = suggested`; it
cannot silently change a modification to `confirmed`.

## 7. Standard Fitment telemetry and operational logging

Standard Fitment V1 defines two separate, privacy-safe measurement layers.
Neither requires preserving raw provider responses merely for analysis.

### Product telemetry

Product telemetry answers how the Standard flow behaves across real Dream
Wheels AI traffic and provides the evidence for a later Extended cap decision.
For each lookup, record at minimum:

- `modification_count`;
- modification-list lookup latency;
- lookup result: `single`, `multiple` or `no_match`;
- whether `MULTIPLE_MODIFICATIONS` occurred;
- the user-selected position/variant when a choice is made;
- `selection_source`;
- whether the initially suggested variant was changed;
- provider failure reason category, if applicable;
- `provider_requests_count`;
- provider-supplied total-result count and pagination/page count, when
  available.

Do not store unnecessary personal data, URLs, provider credentials or raw
engine/trim strings only for the fanout benchmark.

### Operational logging

Operational logging diagnoses an individual request: timeout, network, proxy,
quota, provider authentication, malformed response or provider 5xx; request
duration; and the safe machine-readable reason code. It must not be the sole
source for the product benchmark.

Product telemetry, by contrast, answers how many modifications are normally
found, how often multiple choices occur, what users choose, what cap coverage
would be achieved, and the latency/request/quota cost envelope.

## 8. Session restoration

Use the term **«восстановление сессии»**, not “recovery”. This mechanism is for Dream Wheels authentication and applies consistently to every authenticated fitment request, including loading Wheel Size modifications.

```text
Dream Wheels 401
  → persist a short-lived transient draft
  → show that the session has expired
  → repeat Telegram login
  → restore the same step and entered values
  → delete the transient draft
```

After restoration, do not replay the previous action automatically. Give a subtle confirmation that values were restored and let the user press the CTA again. This is distinct from Wheel Size `AUTHENTICATION_FAILED`, which is a Dream Wheels infrastructure problem and never exposes provider credentials or internal details.

## 9. Error taxonomy and user behaviour

The state returned to the UI must preserve the distinction between insufficient technical evidence and an operational failure.

| Code / state | Classification | User-facing behaviour |
| --- | --- | --- |
| `LOCAL_VALIDATION` | local form issue | Highlight the exact field and explain briefly; do not call the provider. |
| `NO_MATCH` / `NOT_FOUND` | no technical record | `Для выбранного автомобиля данные о комплектации не найдены.` Offer to adjust the vehicle; keep visual try-on available; reference remains unavailable. |
| `MULTIPLE_MODIFICATIONS` | selection, not error | Show the selection screen; no positive Standard verdict before confirmation. |
| `WHEEL_SIZE_VALIDATION_ERROR` | invalid provider request | `Не удалось обработать данные автомобиля.` Keep a safe code in logs; never expose provider internals. |
| `AUTHENTICATION_FAILED` (Wheel Size) | Dream Wheels infrastructure failure | Say the technical check is temporarily unavailable; do not reveal provider key or internals. |
| `THROTTLED` / `QUOTA` | operational failure | Do not return fitment `unknown`. If known, show `retry_at`; otherwise do not invent a countdown. Quota reset is 00:00 GMT/UTC; the UI may convert that to local time, e.g. `Лимит запросов обновится в 03:00.` |
| `TIMEOUT`, `NETWORK`, `PROXY` | operational failure | `Не удалось связаться с сервисом технической проверки. Повторите попытку.` CTA: `Повторить`. |
| `PROVIDER_5XX` | operational failure | Say the service is temporarily unavailable and invite a later retry. |
| `MALFORMED_RESPONSE` | operational failure | Say the vehicle trim data could not be processed and invite a later retry; record a safe internal code. |
| `DREAM_WHEELS_401` | session expired | Start the session-restoration flow above, not a provider-error flow. |

`Retry-After` takes precedence when the provider supplies it. The quota-reset statement is documentation for the provider's daily quota; it is not a reason to display a fabricated timer when the actual retry time is unknown.

In contrast, `unknown` is only for lack of trustworthy technical fitment data: for example an unconfirmed modification, missing critical RimSpec field or a reference without a required technical value. A timeout, quota, proxy error, provider 5xx, authentication problem or malformed provider response is not such a lack of data—it is an operationally failed check.

### Rim URL parsing is separate

`rim-source/resolve` errors belong to the rim-source parser taxonomy, not the Wheel Size taxonomy. Preserve a safe machine-readable `RimUrlError`, a human-readable cause, a completed progress state and a manual RimSpec fallback.

## 10. Wheel Size API usage and sources

Wheel Size is the Vehicle Fitment Reference provider for this flow. Use the current official documentation as the source of integration behaviour:

- [Supported regions](https://developer.wheel-size.com/region-list) — the region is the sales-market data set and affects regional verified fitment records.
- [API Data](https://developer.wheel-size.com/api-data) — provider data and technical reference context.
- [API Updates](https://developer.wheel-size.com/api-updates) — current changes, including the v2 API and search pagination.
- [API FAQ](https://developer.wheel-size.com/api-faqs) — supported product regions, cacheable catalog data, search restrictions and quota reset.
- [API Terms](https://developer.wheel-size.com/api-tos) — catalog versus user-initiated search usage.
- [v2 Swagger / OpenAPI](https://api.wheel-size.com/v2/openapi/) and [OpenAPI JSON](https://api.wheel-size.com/v2/openapi.json) — the current endpoint and schema contract.

Provider constraints applied by this product:

- catalog endpoints may be cached locally;
- search endpoints are used only for a real user-initiated action, never by crawlers or background sweeping;
- the daily quota reset is 00:00 GMT/UTC;
- region changes the regional verified records consulted;
- `/search/by_model/` is the vehicle-search endpoint and supports pagination.

When the provider's terminology or path spelling changes, the current v2 OpenAPI contract is authoritative for the request shape; this product rule still requires a user-initiated search and a bounded, benchmarked sweep.

## 11. Delivery boundary and open decision

This specification is deliberately ahead of the current runtime in the areas of Fitment UI/state hardening and the future Extended all-modifications sweep. It is a product contract for the next implementation pass, not permission to change runtime code as part of this documentation update.

Standard Fitment V1 gathers the telemetry needed to determine an Extended
fanout limit later from real Dream Wheels AI traffic. The fanout limit and the
Extended sweep are not part of Standard Fitment V1 and do not block its
development or UI/state design. Before a concrete cap is selected, use the
accumulated `modification_count` distribution (`P50`, `P75`, `P90`, `P95`) and
consider coverage, provider request count, latency, API quota/cost and
pagination. Do not invent a cap before that sample exists.

**OPEN_DECISION — intelligent-preselection quality gate.** Define the measured recognition-quality threshold and monitoring criteria before Vehicle Recognition may preselect a modification. Until then it remains a visible recommendation. This also does not block the Standard flow.
