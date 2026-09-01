# Standard Fitment V2 — Final Product Review and Repository Handoff

## Review status

```text
FINAL_PRODUCT_REVIEW = COMPLETE
PRODUCT_APPROVAL = COMPLETE
DOCUMENTATION_SYNC = COMPLETE
DESKTOP_1280 = PASS
DESKTOP_1440 = PASS
MOBILE_390 = PASS
UX_SEMANTICS = PASS
BLOCKERS_BEFORE_FREEZE = NONE
NON_BLOCKING_POLISH = 1
RUNTIME_VALIDATION_ITEMS = 2
STANDARD_FITMENT_V2_REFERENCE = FROZEN
STANDARD_FITMENT_V2_REFERENCE_STATUS = APPROVED
STANDARD_FITMENT_UI_V2 = FROZEN
UI_V2_FROZEN = YES
PRODUCT_APPROVAL_DATE = 2026-08-29
```

This review records the explicit product approval of the Standard Fitment V2
UI/UX contract and prototype reference. It does not approve a runtime
implementation.

## Repository baseline

- Feature branch: `codex/fitment-v2-prototype-visual-qa`
- Frozen prototype commit: `c66f286ceebf0650895b38ffb75de8aa36f017dd`
- Current `origin/staging` checked: `f3d067d659a4c93eb2c4827928c60338275f9786`
- Frozen prototype: [`docs/references/standard-fitment-v2-realistic-prototype.html`](../references/standard-fitment-v2-realistic-prototype.html)
- Frozen V2 contract: [`docs/ui/fitment-ui-state-spec-v2.md`](../ui/fitment-ui-state-spec-v2.md)

## Product review verdict

Product approval is complete. No blocker remains after the responsive
navigator correction recorded in the frozen prototype commit.

### Blockers before freeze

`BLOCKERS_BEFORE_FREEZE = NONE`

The only issue found during the review was that `Колесный диск` could be
visually clipped in the 390 px Section Navigator. The fix is limited to the
mobile tab scale/padding; the approved copy, three-section composition and
free-navigation semantics are unchanged. The corrected render was rechecked
in the browser.

### Non-blocking polish

1. Ready/Result content continues below the first 390 px viewport. The primary
   actions and disclosure are fully reachable after scroll, so this is normal
   content flow rather than a freeze blocker.

No additional redesign is requested by this review.

## Phase 07B-G2 pre-change audit — 2026-08-31

| Authoritative state / condition | Expected UI action | Pre-change finding | G2 correction |
| --- | --- | --- | --- |
| `complete_vehicle_details` | `Подтвердить данные автомобиля` | Detected values could be displayed with a modification prompt; an untouched detected vehicle was not included in the save payload | Show the three-line confirmation copy and include the vehicle payload on explicit confirmation |
| `select_vehicle_variant` | `Выбрать комплектацию` | The variant workspace could leave an empty picker/message when the catalogue had no candidates | Keep the workspace action-specific and show a dedicated no-match recovery surface |
| `confirmed_ready` | Continue to Rim / next server action | Vehicle confirmation and exact version selection were not visually separated enough | Preserve separate vehicle-confirmed and version-confirmed states; follow `overview.next_action.kind` |
| stale + `complete_vehicle_details` | `Подтвердить данные автомобиля` | Stale result had no focused recovery action | Focus Vehicle editing/confirmation without mutating or checking automatically |
| stale + `select_vehicle_variant` | `Выбрать комплектацию` | Stale result had no focused recovery action | Focus the Vehicle version workspace |
| stale + `complete_rim_specs` | `Уточнить параметры колесного диска` | Stale result had no focused recovery action | Focus Rim editing; the next check remains explicit |
| stale + `run_standard_check` | `Проверить совместимость` | Recheck remained explicit but stale context was not presented with the required recovery copy | Keep the explicit check boundary and present `Результат больше не актуален` |

Real Zeekr trace before the change: `GET /jobs/{id}/fitment` returned the
detected vehicle and field states; the explicit confirmation path in the UI
then sent only the Rim payload when `fitmentVehicleDirty` was false. As a
result, the authoritative vehicle revision/provenance and `next_action` did
not advance as expected, and the legacy `CN` value was not normalized to the
provider's canonical `chdm` catalogue region. G2 fixes both boundaries without
changing verdict semantics.

## Approved corrective amendment — 2026-08-31

Phase 07B-G2 applies a runtime-state correction to the approved V2 reference.
The amendment does not reopen the visual approval: Vehicle confirmation,
vehicle-version selection, and Ready for Check remain distinct server-owned
states; `Вывод` is still rendered from server state and is now always
navigable before a current or historical result exists; and an empty version
picker is not shown when the catalogue returns no candidates.

The runtime now uses the exact recognized Vehicle copy as three separate
lines, sends an explicit vehicle confirmation payload for prefilled detected
data, and keeps `Сохранить параметры` separate from
`Проверить совместимость`. Stale recovery maps the server `next_action` to a
focused confirmation/edit action before the user starts a new check.

The independent Render island remains outside the Fitment island as a DOM
sibling. Its normal heading/helper are `Визуальная примерка` and
`Посмотрите, как выбранный диск выглядит на вашем автомобиле`; its
`Создать изображение` CTA is secondary and outlined. The incompatible helper
remains `Вы все еще можете создать изображение, чтобы оценить внешний вид
дисков`.

`CANONICAL_INFO_TOKEN = NOT_FOUND`; the implementation uses the cabinet's
neutral info surface without adding a new token.

## Approved corrective amendment — 2026-08-31 (G2.1 implementation handoff)

G2.1 continues this same workstream and PR. It supersedes the earlier G2
pre-check Result-unavailable rule; it does not change backend domain
semantics, verdict classes or the `next_action` contract. Product approval for
this corrective pass remains pending until the requested visual and
authenticated staging review is completed.

The candidate implementation must preserve these boundaries:

- use `Выбрать комплектацию` everywhere in the variant flow;
- render variant technical context first and the selected variant name on its
  own final bold line, then keep that name visible in confirmed Vehicle;
- reread the overview after canonical variant confirmation and keep Vehicle
  active; Save and variant confirmation must not silently advance a valid
  current section;
- make Result a normal clickable navigator tab even with no Check/history;
  pre-check Result copy and recovery actions are derived from
  `overview.next_action` and navigation actions do not mutate state;
- show a readiness CTA only for `run_standard_check`, with
  `Проверить совместимость` as the sole explicit Check action;
- keep the source disclosure lightweight, unchanged in label, keyboard
  accessible and free of arrow-state decoration;
- keep preview copy left-aligned and Render as an independent neutral,
  outlined secondary sibling.

The old statement “`Вывод` is disabled before a current or historical
check/result exists” is superseded and must not be used as implementation or
QA authority.

```text
G2_1_PRODUCT_APPROVAL = PENDING
READY_FOR_PRODUCT_REVIEW = YES
READY_FOR_STAGING_MERGE = NO
DOMAIN_SEMANTICS_CHANGED = NO
```

### Approval record

`PRODUCT_APPROVAL = COMPLETE`

`PRODUCT_APPROVAL_DATE = 2026-08-29`

## Authenticated staging follow-up — 2026-09-01

The prior authenticated staging Result exposed `2026 / 63f2376b07` in the
Vehicle preview. The value was the persisted `vehicle.generation` field,
populated from a Wheel-Size generation slug when the catalogue response did
not provide a display name. It is an opaque catalogue identifier, not a
human-readable generation.

The frontend now applies a presentation-only filter to hash-like catalogue
identifiers in Vehicle specs, variant technical context, candidate labels and
the visible Vehicle generation input. The original value remains in the
server-owned form state and payload; no Vehicle identity, provider mapping,
verdict, `next_action` or Render behaviour is changed. A regression test covers
the mapping boundary.

Authenticated staging browser re-verification remains a separate release gate;
this follow-up must not be treated as evidence for a completed authenticated
E2E until the real staging session is rerun.

The same audit found that the Result adapter discarded backend
`blocking_issues` whenever secondary missing-field evidence was present. This
could hide a real blocking PCD mismatch on an `incompatible` result with a
missing ET. The adapter now keeps the backend blocking group first and renders
only non-duplicate supplemental field evidence after it. Verdict precedence
and all backend semantics remain unchanged.

No unresolved choice between competing UX variants was introduced. The
50/50 preview pair, compact navigator, one-workspace replacement model and
independent Render action are the approved frozen decisions.

## Screenshots and rendered states reviewed

Browser screenshots were reviewed for:

- Mobile `390 px`: Vehicle proposal, Vehicle editor, Rim editor, Ready for
  Check, Incompatible and Processing
- Laptop `1280 px`: Vehicle proposal, Vehicle editor, Rim editor and Ready for
  Check
- Desktop `1440 px`: compatible-with-conditions, Incompatible and Processing

The final 390 px pass also checked the corrected navigator label, preview pair,
bottom navigation, safe-area padding, vertical CTA reachability, long Russian
copy and absence of horizontal overflow.

## Interaction and semantic checks

- `Вывод` is clickable before a current or historical check/result exists and
  renders backend-derived readiness/recovery guidance
- Existing result states allow direct Vehicle → Rim → Result navigation
- Stale result remains available and reads `Нужно проверить заново`
- Vehicle make/model/year draft survives an unsaved Vehicle → Rim → Vehicle
  navigation loop
- Rim ET/DIA draft survives an unsaved Rim → Vehicle → Rim navigation loop
- Manual fallback replaces the warning workspace with one Rim editor, one
  primary CTA and one source disclosure
- `Сохранить параметры` reaches Ready state and does not enter Processing
- `Проверить совместимость` remains the separate explicit check action
- Processing has no verdict, disabled duplicate CTA or placeholder result
- Incompatible keeps the visual-render explanation and independent Render CTA
- Browser console contained no errors or warnings in the final pass

## Runtime validation items

These remain implementation/E2E work and are not prototype blockers:

1. Map server `next_action`, field provenance, exact provider-backed controls
   and persisted revisions directly into runtime UI without client-side
   readiness inference
2. Verify authenticated check lifecycle, current/stale snapshots, Fitment ↔
   Rendering return, draft restoration and 401 restoration without replay

## Repository updates

Changed files in this feature branch:

- `docs/references/standard-fitment-v2-realistic-prototype.html` — final
  prototype, including mobile navigator correction
- `docs/ui/fitment-ui-state-spec-v2.md` — frozen V2 contract,
  State/CTA and Copy/Error sync, runtime handoff boundary
- `docs/handoffs/standard-fitment-v2-product-review.md` — product review,
  QA evidence, blockers and approval gate

Production frontend, backend, API and domain files were not changed. The
branch is ready for the documentation/reference-only PR into `staging`.

## Approved Result simplification amendment — 2026-08-31 (G2.3)

Phase 07B-G2.3 is a corrective pass within PR #137. It simplifies only the
content hierarchy of the completed Result page and does not reopen the frozen
Fitment V2 architecture or change backend/domain behaviour.

The runtime Result now records these approved presentation decisions:

- removed the Result eyebrow `РЕЗУЛЬТАТ`;
- made the verdict the first and strongest Result message;
- placed one short human-readable explanation directly below it;
- kept one compact decision-relevant evidence group;
- removed the old main Result technical-details disclosure;
- removed the standalone generic `Обратите внимание` advisory layer;
- kept at most one visually accented condition island, with multiple
  conditions grouped inside it;
- moved the mandatory warning/disclaimer copy into one subdued footer-zone;
- moved `Проверить ещё раз` to the bottom as a secondary outlined action;
- kept stale, pre-check and operational-failure presentation distinct;
- used a presentation-only evidence mapper, with no frontend semantic
  invention;
- kept Render as a separate DOM sibling and preserved its approved copy/CTA.

The Result layout may move warning copy for hierarchy, but exact canonical
warning, legal and commercial wording remains governed by the higher-priority
commercial warning authority in
[`05-commercial-ux-warnings.md`](05-commercial-ux-warnings.md) and any
authority it references. This handoff does not define replacement legal copy.

`G2_3_PRODUCT_APPROVAL = PENDING`
`READY_FOR_PRODUCT_REVIEW = YES`
`READY_FOR_STAGING_MERGE = NO`
`DOMAIN_SEMANTICS_CHANGED = NO`
`VERDICT_SEMANTICS_CHANGED = NO`

## Approved corrective slice — 2026-09-01

This slice addresses the final confirmed-modification interaction and the
guest/demo UUID-cast defect. Confirmed Vehicle now exposes one inline
`Изменить` list: opening is read-only, the current candidate is preselected,
the current candidate closes without mutation, and a different candidate is
replaced through an atomic canonical-identity endpoint. The existing initial
suggested-variant flow remains separate. Vehicle base fields, Rim and Render
context remain unchanged; currentness and `next_action` remain backend-owned.

The demo fixture now accepts the current Zeekr sentinel and the legacy
`guest-demo-prius` alias locally, so synthetic IDs cannot reach real Fitment
Jobs routes. The shared Fitment row lookup rejects malformed IDs with a
controlled `422 invalid_job_id` before any PostgreSQL UUID cast.

Backend/API coverage includes read-only reselect, no-match/provider-failure
preservation, atomic A→B replacement, A→A idempotency, stale revision/current
selection conflicts, stale target rejection and malformed-ID protection.

Warning, legal and commercial copy remains governed by the higher-priority
commercial warning authority; this handoff records only the layout/placement
and does not redefine frozen wording.

`G2_FINAL_CORRECTIVE_SLICE = IMPLEMENTED`
`READY_FOR_PRODUCT_REVIEW = YES`
`READY_FOR_STAGING_MERGE = NO`
`BACKEND_CHANGED = YES (fitment API defense and replacement endpoints)`
`DOMAIN_SEMANTICS_CHANGED = NO`
`VERDICT_SEMANTICS_CHANGED = NO`
`NEXT_ACTION_SEMANTICS_CHANGED = NO`

## Approved Result disclaimer info-card amendment — 2026-08-31 (G2.3.1)

The completed Result now presents its canonical warning/disclaimer copy in
one separate calm blue informational card after the decision-relevant Result
content and before the bottom secondary `Проверить ещё раз` action. The card
has no thin separator lines and is not a warning, error, success state or CTA;
the condition island remains a separate semantic and visual element. No
standalone advisory heading or duplicate disclaimer is introduced.

This is a presentation-only amendment. Result layout may move warning copy,
but exact canonical warning, legal and commercial wording remains governed by
the higher-priority commercial warning authority in
[`05-commercial-ux-warnings.md`](05-commercial-ux-warnings.md) and any
authority it references. The wording, Fitment semantics, verdict semantics,
backend `next_action` contract and Render sibling architecture are unchanged.

`G2_3_1_PRODUCT_APPROVAL = PENDING`
`READY_FOR_PRODUCT_REVIEW = YES`
`READY_FOR_STAGING_MERGE = NO`
`BACKEND_CHANGED = NO`
`DOMAIN_SEMANTICS_CHANGED = NO`
`VERDICT_SEMANTICS_CHANGED = NO`

## Approved Vehicle UI clarification amendment — 2026-09-01

The Vehicle UI clarification is implemented as a fresh frontend slice from
the current `staging` baseline. It separates the confirmed workspace into
two independent groups: `Основные данные` with make/model/year/market and
`Изменить автомобиль`, and `Комплектация` with the selected catalogue variant
and `Изменить комплектацию`. The basic Vehicle editor no longer exposes body,
generation or modification controls, and the ordinary Vehicle payload sends
only the four base fields. Server-owned catalogue context and all Fitment
semantics remain unchanged.

Vehicle variant candidates are deduplicated in the presentation adapter using
canonical provider identity, with a safe display-only fallback for legacy
entries. Distinct canonical variants are preserved and the selected variant
payload is unchanged. The Render island remains an independent sibling.

This amendment does not change the backend, verdict semantics, `next_action`,
resolver behaviour or the confirmed modification replacement contract. The
exact warning, legal and commercial wording remains governed by the
higher-priority commercial warning authority in
[`05-commercial-ux-warnings.md`](05-commercial-ux-warnings.md) and any
authority it references.

`VEHICLE_UI_CLARIFICATION = IMPLEMENTED`
`PRODUCT_REVIEW_REQUIRED = YES`
`READY_FOR_STAGING_MERGE = NO`
`BACKEND_CHANGED = NO`
`DOMAIN_SEMANTICS_CHANGED = NO`
`VERDICT_SEMANTICS_CHANGED = NO`
`NEXT_ACTION_SEMANTICS_CHANGED = NO`

## Final handoff state

```text
STANDARD_FITMENT_V2_REFERENCE = FROZEN
STANDARD_FITMENT_V2_REFERENCE_STATUS = APPROVED
FINAL_PRODUCT_REVIEW = COMPLETE
PRODUCT_APPROVAL = COMPLETE
DOCUMENTATION_SYNC = COMPLETE
BLOCKERS_BEFORE_FREEZE = NONE
STANDARD_FITMENT_UI_V2 = FROZEN
UI_V2_FROZEN = YES
PRODUCT_APPROVAL_DATE = 2026-08-29
```
