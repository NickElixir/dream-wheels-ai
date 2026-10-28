"""Safe local/test resolver; it never invents a vehicle."""

from __future__ import annotations

from datetime import UTC, datetime

from src.identity.prompts import PROMPT_VERSION, RESOLVER_VERSION
from src.identity.schemas import (
    AbstentionReason,
    ResolutionStatus,
    VehicleIdentityResolution,
    VehicleResolutionMetadata,
)
from src.vision.image_normalization import NormalizedImage


class MockVehicleIdentityResolver:
    async def resolve(self, image: NormalizedImage) -> VehicleIdentityResolution:
        return VehicleIdentityResolution(
            status=ResolutionStatus.unknown,
            abstention_reason=AbstentionReason.provider_returned_no_candidates,
            metadata=VehicleResolutionMetadata(
                provider="mock",
                model="mock",
                prompt_version=PROMPT_VERSION,
                resolver_version=RESOLVER_VERSION,
                normalized_input_sha256=image.sha256,
                captured_at=datetime.now(UTC),
            ),
        )
