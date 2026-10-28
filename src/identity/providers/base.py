"""Provider-neutral vehicle resolver interface and typed failures."""

from __future__ import annotations

from typing import Protocol

from src.identity.schemas import VehicleIdentityResolution
from src.vision.image_normalization import NormalizedImage


class VehicleIdentityResolver(Protocol):
    async def resolve(self, image: NormalizedImage) -> VehicleIdentityResolution:
        """Resolve one normalized vehicle image."""


class VehicleIdentityProviderError(RuntimeError):
    error_code = "vehicle_identity_provider_unavailable"
    retryable = True


class VehicleIdentityProviderConfigurationError(VehicleIdentityProviderError):
    error_code = "vehicle_identity_provider_configuration_error"
    retryable = False


class VehicleIdentityProviderInvalidResponseError(VehicleIdentityProviderError):
    error_code = "vehicle_identity_provider_invalid_response"
    retryable = False
