# Fitment Verdict Taxonomy and Evidence Rules

## Scope

This document defines the first safe rule boundary for a **preliminary** detailed fitment check. It is not a substitute for OEM approval, physical installation, brake-clearance measurement, wheel manufacturer instructions or local legal requirements.

## Standard Fitment V1 scope note

This is the broader evidence model. The canonical
[Fitment Verdict V1](fitment/fitment-verdict-v1.md) defines the conservative
subset and product behaviour for Standard Fitment V1. Its critical fields are
bolt count, PCD, DIA, diameter, width and ET. Tyre compatibility, load rating,
brakes/X-factor, and fastener hardware (bolt/nut type, thread size and tightening
torque) remain outside Standard Fitment V1.

**Owner clarification — P0.5-E, 2026-10-04:**

Diameter, Width, ET, PCD, Bolt count and DIA have independent field-level results. A field result must not be copied from another parameter.

Reference selection may depend on technical context. In Standard Fitment V1, ET reference is selected for the exact axle + submitted Diameter + submitted Width, using trusted saved values. Missing contextual reference gives `unknown / vehicle_reference_offset_missing`; outside the interval gives `unknown / et_outside_reference_range`, without a physical-clearance inference.

Independent Diameter and Width matches do not prove that their combination is present in the provider-approved size set. For references `19×8.5` and `20×9`, submitted `19×9` can have Diameter=pass and Width=pass, ET=unknown and overall=unknown. The conservative overall `size_offset` rule and `size_not_in_reference` explanation remain unchanged.

The presentation contract has six rows per axle: `wheel_diameter_in`, `wheel_width_j`, `offset_et_mm`, `pcd`, `bolt_count`, `center_bore_mm`. `pcd` is the numeric diameter in mm; bolt count is a separate row. Both factual conflicts are shown even if the persisted `bolt_pattern` rule has only one primary reason. Overall unknown does not mask individual row statuses.

Rows and diameter details use saved input/evaluation snapshots only, with existing evidence policy and tolerances. Discrete diameter/width matches can pass; being merely within bounds cannot. The diameter detail exact-match flag follows the same tolerance and trust check as its row; insufficient trusted evidence leaves it unknown (`null`). No live provider/current-input lookup, engine/version change or migration is introduced.

For Standard V1, ET is evaluated as its own field against the applicable
provider-derived ET reference for the confirmed vehicle/modification and axle
context. Outside the available reference is `unknown` with reason
`et_outside_reference_range` and an advisory to verify inner and outer
clearance; a missing rim ET or provider reference is also `unknown`. Standard
V1 does not calculate clearance, so an outside ET must not be returned as
`compatible_with_conditions`.

## Separate execution and verdict states

Execution status:

```text
queued | processing | completed | failed
```

Verdict is present only on a completed check:

```text
compatible | compatible_with_conditions | unknown | incompatible
```

A provider timeout, rate limit or parsing failure is `failed`, not `unknown`.

## Status precedence

```text
1. confirmed hard conflict                  -> incompatible
2. no hard conflict but critical evidence missing/conflicting -> unknown
3. sufficient evidence and required adaptation/verification   -> compatible_with_conditions
4. sufficient evidence and no conditions                      -> compatible
```

A photo inference or unconfirmed OCR value must never upgrade a result to `compatible`.

## Evidence levels

```text
E0 unknown
E1 VLM/OCR suggestion
E2 user input, not yet confirmed
E3 user-confirmed or trusted provider value
E4 manufacturer SKU/technical document or exact audited provider fitment profile
```

Hard conflicts require E3 or E4 evidence. `compatible` requires E3/E4 for the critical checked parameters. E1/E2 can create a question, a prompt for confirmation, or an `unknown` result.

## Parameter matrix

| Parameter | Confirmed hard conflict -> incompatible | Possible condition -> compatible_with_conditions | Missing/conflicting evidence -> unknown |
|---|---|---|---|
| Bolt count | Bolt count differs from the vehicle hub | None in v1; adapters or redrilling are out of scope | Vehicle or rim bolt count unknown |
| PCD | PCD differs from the vehicle hub | None in v1; adapters or redrilling are out of scope | Vehicle or rim PCD unknown |
| Center bore / DIA | Wheel bore is smaller than hub bore | Wheel bore larger than hub bore: installation requires a correctly sized centering ring | Hub/bore value unknown |
| Diameter | Confirmed physical/OEM evidence proves the diameter cannot be installed | **Broader evidence model only:** a separately approved clearance rule may introduce an explicit condition | **Standard V1:** diameter absent from trustworthy reference evidence or outside known coverage without physical-clearance proof |
| Width | Confirmed physical/OEM evidence proves the width cannot be installed | **Broader evidence model only:** a separately approved clearance rule may introduce an explicit condition | **Standard V1:** width absent from trustworthy reference evidence or outside known coverage without physical-clearance proof |
| Offset / ET | Confirmed inner suspension/brake or outer body/steering interference | **Broader evidence model only:** a separately approved clearance rule may introduce an explicit condition | **Standard V1:** ET outside its applicable provider reference; ET unknown; or vehicle ET reference unavailable |
| Brake clearance | Confirmed wheel design/caliper conflict | Explicit wheel X-factor/caliper evidence says clearance is acceptable with listed configuration | No wheel-design/X-factor or vehicle brake data |
| Fasteners | Confirmed incompatible mounting hardware/seat with no supported hardware package | Confirmed alternative hardware package, correct seat, thread engagement and installation instructions | Hardware/seat unknown where it is required |
| Load rating | Wheel rating below the required axle/wheel load | None in v1 | Required or wheel load rating unavailable |
| Tyre compatibility | Confirmed tyre is outside wheel-manufacturer approved rim-width range or package creates confirmed interference | Tyre size differs from OEM but provider profile supports it; installation/clearance check remains required | Tyre dimensions absent when wheel fit depends on them |
| Front/rear setup | Front/rear spec conflicts with exact axle profile | Staggered configuration is validated per axle | Axle assignment or rear specification unknown |

## Practical rules

### Bolt count and PCD

Bolt count and PCD are separate checks even when they are presented together as a bolt-pattern label such as `5×112`. Each value must independently match the hub. v1 does not recommend wobble bolts, redrilling or multi-PCD adaptation. A mismatch is `incompatible` only when the conflicting value is confirmed.

### DIA / centre bore

A wheel bore smaller than the vehicle hub cannot mount and is `incompatible`. A larger bore is `compatible_with_conditions`: the user must install a correctly sized centering ring. The product does not infer market availability of that ring.

### Diameter, width and ET

For Standard V1, diameter, width and ET are three separate field checks. A diameter result must not depend on the submitted width; a width result must not depend on the submitted diameter; and ET must not inherit a combined diameter+width match.

ET is evaluated against its own applicable provider-derived reference for the confirmed vehicle/modification and exact axle + submitted Diameter + submitted Width context. This selects evidence; it does not copy another field status. ET inside that reference is compatible for the ET field. ET outside it is `unknown`, with reason `et_outside_reference_range` and an advisory to verify inner and outer clearance. Standard V1 does not calculate clearance, so it must not use `compatible_with_conditions` for that case. A missing rim ET or vehicle ET reference is `unknown`.

The broader evidence model may later introduce deliberately coupled physical-clearance rules. Such coupling is outside Standard V1 and requires a separate approved rule and evidence contract; it must not arise implicitly from the provider response shape.

### Fasteners and spacers

Fastener hardware — bolt/nut type, thread size and tightening torque — is **DEFERRED / POST-RELEASE** and is not an input to the Release 1 Standard Fitment verdict. The broader model may support it later.

Alternative hardware or spacers are conditions only where the exact required configuration is known. The engine must not infer safe thread engagement, seat type, spacer hub-centering or torque from photos.

### Modified vehicles

Lowered/lifted suspension, aftermarket brakes, body modifications and unknown suspension changes invalidate generic provider clearance assumptions. Return `unknown` unless a dedicated supported profile exists.

## Definitions

### compatible

Preliminarily compatible for the exact vehicle, axle and wheel/tyre inputs checked. It is not an installation guarantee.

### compatible_with_conditions

No confirmed hard conflict, but safe use depends on explicit listed conditions, such as a specified centering ring or a confirmed hardware package. Conditions are not recommendations to improvise.

### unknown

The system cannot make a positive or negative technical conclusion from available trusted evidence.

### incompatible

A confirmed physical or safety-critical conflict exists for the checked configuration.

## Source hierarchy

1. vehicle OEM documentation and vehicle placard/manual;
2. wheel manufacturer technical sheet / exact SKU;
3. audited provider vehicle profile and versioned rule result;
4. user-confirmed input;
5. OCR/VLM only as a prompt for confirmation.

## Research basis

- Tire Rack explains that offset and wheel width jointly affect clearances and incorrect offset can adversely affect handling.
- Tire Rack describes centre-bore rings as a way to reduce a larger wheel bore to match the vehicle hub; it does not make a smaller bore mountable.
- Tire Rack installation guidance explicitly requires checking staggered front/rear sizing and warns that modified vehicles may require further review.

Before enabling paid detailed checks, validate provider terms, regional applicability, wheel/tyre manufacturer sources, and an OEM sample set for each supported market.
