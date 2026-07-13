"""Wheel-Size cataloging endpoints with local cache."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from fitment_verdict.config import FitmentConfig
from fitment_verdict.providers.cache import FileCache
from fitment_verdict.utils import fuzzy_ratio

logger = logging.getLogger(__name__)


class WheelSizeCatalog:
    def __init__(self, client: Any, config: FitmentConfig, cache: FileCache) -> None:
        self._client = client
        self._config = config
        self._cache = cache

    async def _get_cached(self, namespace: str, key: str, fetcher) -> Any:
        cached = self._cache.get(namespace, key)
        if cached is not None:
            return cached
        data = await fetcher()
        self._cache.set(
            namespace,
            key,
            data,
            ttl=timedelta(days=self._config.catalog_cache_ttl_days),
        )
        return data

    async def list_makes(self, region: str) -> list[dict[str, Any]]:
        key = f"makes:{region}"
        return await self._get_cached(
            "catalog",
            key,
            lambda: self._client.get_json("/makes/", {"region": region}),
        )

    async def list_models(self, make_slug: str, region: str) -> list[dict[str, Any]]:
        key = f"models:{region}:{make_slug}"
        return await self._get_cached(
            "catalog",
            key,
            lambda: self._client.get_json("/models/", {"make": make_slug, "region": region}),
        )

    async def list_years(self, make_slug: str, model_slug: str, region: str) -> list[Any]:
        key = f"years:{region}:{make_slug}:{model_slug}"
        return await self._get_cached(
            "catalog",
            key,
            lambda: self._client.get_json(
                "/years/",
                {"make": make_slug, "model": model_slug, "region": region},
            ),
        )

    async def list_generations(
        self,
        make_slug: str,
        model_slug: str,
        year: int,
        region: str,
    ) -> list[dict[str, Any]]:
        key = f"generations:{region}:{make_slug}:{model_slug}:{year}"
        return await self._get_cached(
            "catalog",
            key,
            lambda: self._client.get_json(
                "/generations/",
                {
                    "make": make_slug,
                    "model": model_slug,
                    "year": year,
                    "region": region,
                },
            ),
        )

    async def list_modifications(
        self,
        make_slug: str,
        model_slug: str,
        year: int,
        generation_slug: str,
        region: str,
    ) -> list[dict[str, Any]]:
        key = f"mods:{region}:{make_slug}:{model_slug}:{year}:{generation_slug}"
        return await self._get_cached(
            "catalog",
            key,
            lambda: self._client.get_json(
                "/modifications/",
                {
                    "make": make_slug,
                    "model": model_slug,
                    "year": year,
                    "generation": generation_slug,
                    "region": region,
                },
            ),
        )

    async def resolve_make_slug(self, make: str, region: str) -> str | None:
        makes = await self.list_makes(region)
        best_slug = None
        best_score = 0.0
        for item in makes:
            for field in ("name", "name_en", "slug"):
                candidate = item.get(field)
                if not candidate:
                    continue
                score = fuzzy_ratio(make, str(candidate))
                if score > best_score:
                    best_score = score
                    best_slug = item.get("slug") or str(candidate)
        return best_slug if best_score >= 85 else None

    async def resolve_model_slug(self, make_slug: str, model: str, region: str) -> str | None:
        models = await self.list_models(make_slug, region)
        best_slug = None
        best_score = 0.0
        for item in models:
            for field in ("name", "name_en", "slug"):
                candidate = item.get(field)
                if not candidate:
                    continue
                score = fuzzy_ratio(model, str(candidate))
                if score > best_score:
                    best_score = score
                    best_slug = item.get("slug") or str(candidate)
        return best_slug if best_score >= 85 else None
