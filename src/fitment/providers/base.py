"""Провайдер-нейтральный контракт (ADR 0002).

Rules/service не знают, кто источник данных. Провайдер:
- резолвит каноническую идентичность в свои mappings (slugs);
- возвращает нормализованный FitmentProfile или None (нет покрытия).

Технический сбой (timeout, 5xx, rate limit) — исключение ProviderError:
на уровне проверки это operational `failed`, НЕ вердикт `unknown`.
"""

from __future__ import annotations

from typing import Protocol

from src.fitment.schemas import FitmentProfile, VehicleIdentity


class ProviderError(Exception):
    """Технический сбой провайдера (сеть/лимит/5xx/парсинг ответа)."""


class FitmentProvider(Protocol):
    name: str

    async def resolve_vehicle(self, identity: VehicleIdentity) -> VehicleIdentity | None:
        """Найти авто у провайдера; вернуть identity с provider_mappings или None."""
        ...

    async def get_fitment_profile(
        self,
        identity: VehicleIdentity,
        *,
        user_initiated: bool,
    ) -> FitmentProfile | None:
        """Вернуть нормализованный профиль для разрешённой identity или None."""
        ...
