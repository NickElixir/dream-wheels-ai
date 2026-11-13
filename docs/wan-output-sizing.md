# Wan output sizing correction

For explicit `parameters.size`, preserve vehicle dimensions when the input area is
already within `[768², 2048²]`. Scale up only below the minimum and down only above
the maximum, preserving the original aspect ratio subject to integer rounding.
Validate rounded area and the 8:1 aspect bound. This is a total-pixel constraint,
not a per-side 2048 limit.

Regression: 1440×1920 previously requested 665×887 due to scaling an admissible
input toward the minimum. It now requests **1440×1920**. 1920×1080 is likewise
preserved. Input bytes, EXIF policy, image order, P1, model, seed/bbox defaults and
billing semantics are unchanged. Do not replace explicit dimensions with `2K`:
provider tier sizing can use the last reference image's aspect rather than the car's.

Release to staging first. Verify the tested deployment SHA and worker startup.
After separately authorizing one paid acceptance render, use the same original car
and rim, then compare input/request/provider/stored sizes and output hashes using
generation diagnostics. Provider rounding must be measured independently. Larger
pixel budget is not a guarantee of exact spoke geometry or Model Studio parity.

No paid generation or production deployment is part of the corrective PR.
