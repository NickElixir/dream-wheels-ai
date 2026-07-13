# Fitment Verdict Pipeline

Legacy standalone demo and recorded scenarios. The canonical production
implementation is `src/fitment`; new API, rules, providers and persistence
changes must be made there. For a production-like test, follow
[docs/fitment-production-test.md](../docs/fitment-production-test.md).

## Two-stage flow

```text
STAGE 1 — preliminary (photos only, VLM guess)
  G0 intake & normalize (car + rim photos)
  G1 vehicle VLM  -> make/model/year range + expected_oem prior
  G3 rim VLM      -> brand/model/style + size estimates
  P1 pseudo-profile from expected_oem (provider="vlm_prior")
  G4 rule engine against the VLM prior
  P2 preliminary verdict + fit_likelihood (0..1) + editable draft

STAGE 2 — confirmed (user-verified data, exact check)
  user confirms/corrects the draft: vehicle (make/model/year/body/
  generation/modification) + rim (brand/model/SKU/URL/diameter/width/
  PCD/ET/DIA/fastener seat/load rating, optional rear axle)
  G2 Wheel-Size /search/by_model/ -> FitmentProfile
  G4 rule engine per axle
  G5 verdict (is_preliminary=false)
  R1 weighted risk assessment + recommendations
```

API:

```python
service = FitmentVerdictService(config, vehicle_vlm=..., rim_vlm=...)

stage1 = await service.run_preliminary(
    PreliminaryCheckRequest(car_image_path=..., rim_image_path=...)
)
# stage1.prediction, stage1.verdict, stage1.fit_likelihood, stage1.draft

draft = stage1.draft            # user edits this in the UI
draft.rim.pcd_mm = 108.0        # confirmed values win

stage2 = await service.run_confirmed(draft)
# stage2.verdict, stage2.risk (score/level/blocking/recommendations)
```

The VLM never decides compatibility: stage 1 runs the same deterministic rule
engine against a VLM-known prior ("vlm_prior" profile), stage 2 against
Wheel-Size data. Risk levels: low / moderate / elevated / high / critical
(any blocking mismatch -> critical).

## Environment

```bash
WHEEL_SIZE_API_KEY=...
WHEEL_SIZE_BASE_URL=https://api.wheel-size.com/v2
FITMENT_CACHE_DIR=.cache/fitment_verdict
OPENAI_API_KEY=...              # only for live VLM runs
FITMENT_VLM_MODEL=gpt-4.1-mini
```

## CLI

```bash
python -m fitment_verdict.cli \
  --make Haval --model Chitu --year 2022 --region chdm \
  --rim-diameter 18 --rim-width 7 --rim-offset 40 \
  --rim-bolt-pattern 5x114.3 --rim-center-bore 66.6 \
  --user-initiated
```

## Tests

```bash
pytest tests/fitment_verdict -q
```

VLM is not called in tests. Use `MockVehicleVLM` / `MockRimVLM` with deterministic outputs.

## Integration note

Wheel-Size **search** endpoints must only be called for real user-initiated checks (ToS). Cataloging
endpoints may be cached locally.
