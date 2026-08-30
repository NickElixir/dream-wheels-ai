"""Versioned baseline prompt for the production Wan rendering path."""

PROMPT_VERSION = "P0_API_SPIKE"
BASELINE_PROMPT = (
    "Replace only the visible wheel rims on the vehicle in image 1 using the supplied rim "
    "reference in image 2. Preserve the vehicle identity, body shape, paint and color, camera "
    "viewpoint and perspective, background and scene, tyre and wheel-arch geometry as much as "
    "possible. Use the supplied rim design faithfully. Return one photorealistic edited photo."
)
