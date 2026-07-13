"""VLM provider protocols."""

from __future__ import annotations

from typing import Protocol

from fitment_verdict.schemas import VehicleIdentificationResult


class VehicleVLMProvider(Protocol):
    async def identify(self, image_bytes: bytes) -> VehicleIdentificationResult: ...


class RimVLMProvider(Protocol):
    async def describe(self, image_bytes: bytes) -> dict: ...
