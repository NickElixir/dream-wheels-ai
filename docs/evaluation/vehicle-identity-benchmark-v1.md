# Vehicle identity benchmark v1

The benchmark uses only versioned consented, licensed, owned, or synthetic images. Do
not use production user traffic or save normalized debug images automatically.

Each manifest case records `case_id`, `image_path`, `recognizable`, and ground truth:
`make`, `model`, `year_start`, `year_end`. The JSON output records provider, model,
prompt version, dataset version, timestamp, aggregate metrics and per-case results.

Report make top-1, model top-1, model top-3, exact year, year-range overlap, unknown
precision/recall, schema-validation rate, latency p50/p95, average cost and provider
error rate. Initial pass thresholds, model, retries, payload size and cost ceiling are
TBD after the first baseline.
