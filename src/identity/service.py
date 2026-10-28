"""Resolver selection and conversion into the existing draft proposal."""

from __future__ import annotations

from src.config import (
    VEHICLE_IDENTITY_ENABLED,
    VEHICLE_IDENTITY_MAX_RETRIES,
    VEHICLE_IDENTITY_MODEL,
    VEHICLE_IDENTITY_OPENAI_API_KEY,
    VEHICLE_IDENTITY_PROVIDER,
    VEHICLE_IDENTITY_TIMEOUT_SEC,
)
from src.identity.providers.base import (
    VehicleIdentityProviderConfigurationError,
    VehicleIdentityResolver,
)
from src.identity.providers.mock import MockVehicleIdentityResolver
from src.identity.providers.openai import OpenAIVehicleIdentityResolver
from src.identity.schemas import VehicleIdentityResolution
from src.vision.image_normalization import NormalizedImage


class InvalidVehicleIdentityResolver:
    def __init__(self, provider: str) -> None:
        self.provider = provider

    async def resolve(self, image: NormalizedImage) -> VehicleIdentityResolution:
        raise VehicleIdentityProviderConfigurationError(
            f"Unsupported vehicle identity provider: {self.provider}"
        )


def get_vehicle_identity_resolver() -> VehicleIdentityResolver:
    """Return the selected resolver; disabled flows abstain through the mock adapter."""
    if not VEHICLE_IDENTITY_ENABLED or VEHICLE_IDENTITY_PROVIDER == "mock":
        return MockVehicleIdentityResolver()
    if VEHICLE_IDENTITY_PROVIDER == "openai":
        return OpenAIVehicleIdentityResolver(
            api_key=VEHICLE_IDENTITY_OPENAI_API_KEY,
            model=VEHICLE_IDENTITY_MODEL,
            timeout_sec=VEHICLE_IDENTITY_TIMEOUT_SEC,
            max_retries=VEHICLE_IDENTITY_MAX_RETRIES,
        )
    return InvalidVehicleIdentityResolver(VEHICLE_IDENTITY_PROVIDER)
