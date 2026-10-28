# Phase 08C — Wan Model Selection Closeout

```ini
SLICE_08C = COMPLETE
WAN_PRODUCTION_MODEL = wan2.7-image
WAN_PRO_CHALLENGER = wan2.7-image-pro
HUMAN_SCORING = DEFERRED
FULL_DATASET_EVALUATION = DEFERRED_TO_FOLLOW-UP
```

## Decision

Select `wan2.7-image` as the current production baseline. Do not select
`wan2.7-image-pro` merely because it carries the Pro name.

The Phase 08C controlled spike produced the same provider success rate for
both models: 4/5 successful runs and one failed Pontiac Vibe task per model.
The baseline was faster and cheaper in the observed sample:

| Metric | `wan2.7-image` | `wan2.7-image-pro` |
| --- | ---: | ---: |
| Successful runs | 4/5 | 4/5 |
| Provider failure rate | 20% | 20% |
| Mean latency | 12,852.75 ms | 15,527.75 ms |
| P50 latency | 12,904.5 ms | 15,401 ms |
| Estimated cost for successful outputs | $0.12 | $0.30 |

No quality advantage for Pro was established. The available score manifest
does not contain human-entered scores, so no automated or inferred visual
quality judgement is used for this decision.

## Scope boundary

This closeout records provider selection only. It does not integrate Wan into
the Dream Wheels runtime and does not change worker, Redis, Supabase, jobs,
credits, Fitment, deployment, or provider routing.

The full-dataset evaluation remains a separate follow-up using a stronger
human scoring system. Existing Phase 08C benchmark outputs and evidence remain
available under `/tmp/dream-wheels-wan-08c`.

After human scores are entered, recalculate local metrics only with:

```bash
python scripts/wan_benchmark.py \
  --summary-only \
  --manifest scripts/wan_benchmark_cases.json \
  --output-dir /tmp/dream-wheels-wan-08c \
  --scores scripts/wan_benchmark_scores.json
```
