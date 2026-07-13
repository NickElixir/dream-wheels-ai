"""Provider abstraction."""

from __future__ import annotations

from typing import Protocol

from fitment_verdict.schemas import FitmentProfile, VehicleQuery


class FitmentProvider(Protocol):
    async def resolve_and_fetch_profile(
        self,
        vehicle: VehicleQuery,
        *,
        user_initiated: bool,
    ) -> FitmentProfile | None: ...
