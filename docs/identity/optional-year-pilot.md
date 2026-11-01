# Optional-year recognition pilot

Prompt revision: dominant-vehicle-v3-optional-year. Identifiable make/model may be
returned with year/year_start/year_end all null. All fields remain required, partial
ranges and coerced types remain invalid. User confirms the exact catalogue year.
Two choices maximum: primary plus one alternative for the same foreground vehicle.
Completion logs contain only status, abstention reason, prompt version and correlation
IDs; provider metadata retains latency. Never log image bytes or response bodies.

Controlled live validation proposal (not executed): six calls maximum, staging only.
Use three photographs with independently confirmed labels, two calls per photograph.
Include the existing BMW and two cases from the previous dataset after checking their
actual year labels. Do not treat visual guesses or generation ranges as exact-year truth.
Measure make/model accuracy, exact-year accuracy where truth exists, range overlap,
range width, yearless fraction, abstention reason and latency. Compare previous saved
answers before spending on repeat calls. Existing pilot labels were audited for
make/model, not exact year: year labels must be confirmed before scoring.
Live calls require a separately agreed budget; no calls made by this patch.
