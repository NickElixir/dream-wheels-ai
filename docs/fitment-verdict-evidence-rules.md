# Fitment Verdict Taxonomy and Evidence Rules

## Scope

This document defines the first safe rule boundary for a **preliminary** detailed fitment check. It is not a substitute for OEM approval, physical installation, brake-clearance measurement, wheel manufacturer instructions or local legal requirements.

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
| Bolt pattern / PCD | Bolt count or PCD differs from the vehicle hub | None in v1; adapters or redrilling are out of scope | Vehicle or rim PCD unknown |
| Center bore / DIA | Wheel bore is smaller than hub bore | Wheel bore larger than hub bore and a vehicle/wheel-specific centering-ring solution is confirmed | Hub/bore value unknown; no confirmed ring spec |
| Diameter / width | Provider/OEM profile confirms the wheel/tyre package cannot clear or is unsupported | Package is outside OEM catalogue but provider/rules have sufficient clearance and tyre evidence; requires physical installation check | No tyre/clearance/profile evidence |
| Offset / ET | Confirmed inner suspension/brake or outer body/steering interference | Non-OEM ET only when supported by a provider/rule profile and required spacer/clearance evidence is explicit | ET unknown; only generic offset arithmetic; no vehicle clearance profile |
| Brake clearance | Confirmed wheel design/caliper conflict | Explicit wheel X-factor/caliper evidence says clearance is acceptable with listed configuration | No wheel-design/X-factor or vehicle brake data |
| Fasteners | Confirmed incompatible mounting hardware/seat with no supported hardware package | Confirmed alternative hardware package, correct seat, thread engagement and installation instructions | Hardware/seat unknown where it is required |
| Load rating | Wheel rating below the required axle/wheel load | None in v1 | Required or wheel load rating unavailable |
| Tyre compatibility | Confirmed tyre is outside wheel-manufacturer approved rim-width range or package creates confirmed interference | Tyre size differs from OEM but provider profile supports it; installation/clearance check remains required | Tyre dimensions absent when wheel fit depends on them |
| Front/rear setup | Front/rear spec conflicts with exact axle profile | Staggered configuration is validated per axle | Axle assignment or rear specification unknown |

## Practical rules

### PCD

The bolt count and PCD must match the hub. v1 does not recommend wobble bolts, redrilling or multi-PCD adaptation. A mismatch is `incompatible` only when both values are confirmed.

### DIA / centre bore

A wheel bore smaller than the vehicle hub cannot mount and is `incompatible`. A larger bore is not automatically compatible: it becomes `compatible_with_conditions` only when a correct centering-ring solution is known. Otherwise it remains `unknown`.

### ET, width and diameter

Offset, width and tyre package must be evaluated together and per axle. v1 must not use generic numeric tolerance bands as a positive fitment guarantee. Any non-OEM combination without exact provider/OEM clearance evidence stays `unknown`; a confirmed requirement for a spacer or a clearance check produces `compatible_with_conditions`, not `compatible`.

### Fasteners and spacers

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
