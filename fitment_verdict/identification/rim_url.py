"""Rim product URL resolution hook.

Stage 2 lets the user paste a product link instead of typing specs. A real
resolver (catalog scraper / partner feed) plugs in here later; the null
implementation keeps the pipeline flow intact until then.
"""

from __future__ import annotations

from typing import Protocol

from fitment_verdict.schemas import RimSpec


class RimUrlResolver(Protocol):
    async def resolve(self, url: str) -> RimSpec | None: ...


class NullRimUrlResolver:
    """Default resolver: no catalog integration available."""

    async def resolve(self, url: str) -> RimSpec | None:
        return None
