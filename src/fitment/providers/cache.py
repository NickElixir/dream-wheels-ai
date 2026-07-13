"""TTL-кэш ответов провайдера.

ToS Wheel-Size: cataloging-методы можно кэшировать агрессивно, search-результаты —
только как побочный продукт запроса реального пользователя (без префетча).
Интерфейс асинхронный, чтобы позже заменить in-memory на Postgres/Redis без
изменения адаптера.
"""

from __future__ import annotations

import json
import time
from typing import Any, Protocol


class ProviderCache(Protocol):
    async def get(self, key: str) -> Any | None: ...

    async def set(self, key: str, value: Any, ttl_sec: int) -> None: ...


class InMemoryProviderCache:
    """Процесс-локальный кэш. Достаточен для одного инстанса; при
    горизонтальном масштабировании заменить на Redis-имплементацию."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[float, Any]] = {}

    async def get(self, key: str) -> Any | None:
        entry = self._data.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() >= expires_at:
            self._data.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: Any, ttl_sec: int) -> None:
        self._data[key] = (time.monotonic() + ttl_sec, value)


class RedisProviderCache:
    """Distributed JSON cache for horizontally scaled API instances."""

    def __init__(self, client: Any, *, key_prefix: str = "fitment:provider:") -> None:
        self._client = client
        self._key_prefix = key_prefix

    async def get(self, key: str) -> Any | None:
        raw = await self._client.get(f"{self._key_prefix}{key}")
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            await self._client.delete(f"{self._key_prefix}{key}")
            return None

    async def set(self, key: str, value: Any, ttl_sec: int) -> None:
        await self._client.set(
            f"{self._key_prefix}{key}",
            json.dumps(value, separators=(",", ":"), ensure_ascii=False),
            ex=max(1, ttl_sec),
        )
