"""Backend-owned make-first Vehicle Catalogue aggregation.

The provider catalogue is region-aware, while the user-facing editor is not.
This module keeps that provider topology behind a small, provider-neutral
service boundary.  Cataloging calls remain cacheable at the Wheel-Size
adapter; only the short-lived aggregate option set is assembled here.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Sequence
from typing import Any

from src.fitment.providers.base import ProviderError
from src.fitment.providers.wheel_size import WheelSizeProvider

AGGREGATION_CONCURRENCY = 4


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _entry_value(entry: dict[str, Any]) -> str:
    for key in ("slug", "code", "id", "value", "name", "name_en"):
        value = _text(entry.get(key))
        if value:
            return value
    return ""


def _entry_label(entry: dict[str, Any], value: str) -> str:
    for key in ("display", "name", "name_en", "label"):
        label = _text(entry.get(key))
        if label:
            return label
    return value


def _region_values(raw: Any, known_regions: Sequence[str]) -> list[str]:
    known = {region.casefold(): region for region in known_regions}
    values: list[str] = []
    if isinstance(raw, str):
        raw = [part.strip() for part in raw.split(",")]
    if not isinstance(raw, list | tuple | set):
        return values
    for item in raw:
        if isinstance(item, dict):
            value = _entry_value(item)
        else:
            value = _text(item)
        canonical = known.get(value.casefold())
        if canonical and canonical not in values:
            values.append(canonical)
    return values


def _identity(region: str, provider_id: str) -> dict[str, str]:
    return {"region": region, "provider_id": provider_id}


def _aggregate_rows(
    rows_by_region: Sequence[tuple[str, Sequence[dict[str, Any]]]],
    *,
    known_regions: Sequence[str] = (),
) -> list[dict[str, Any]]:
    """Group only identical provider IDs and labels, retaining each region."""
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for requested_region, rows in rows_by_region:
        for row in rows:
            provider_id = _entry_value(row)
            if not provider_id:
                continue
            label = _entry_label(row, provider_id)
            key = (provider_id.casefold(), label)
            option = grouped.setdefault(
                key,
                {
                    "value": provider_id,
                    "label": label,
                    "provider_id": provider_id,
                    "identities": [],
                },
            )
            region_scope = known_regions or [requested_region]
            row_regions = _region_values(row.get("regions"), region_scope)
            evidence_regions = row_regions or [requested_region]
            for region in evidence_regions:
                identity = _identity(region, provider_id)
                if identity not in option["identities"]:
                    option["identities"].append(identity)
    return sorted(
        grouped.values(),
        key=lambda option: (option["label"].casefold(), option["value"].casefold()),
    )


def _aggregate_year_rows(
    rows_by_region: Sequence[tuple[str, Sequence[dict[str, Any]]]],
) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for region, rows in rows_by_region:
        for row in rows:
            raw_year = row.get("year", row.get("name", row.get("slug", row.get("value"))))
            try:
                year = str(int(raw_year))
            except (TypeError, ValueError):
                continue
            option = grouped.setdefault(
                year,
                {
                    "value": year,
                    "label": year,
                    "provider_id": year,
                    "identities": [],
                },
            )
            identity = _identity(region, year)
            if identity not in option["identities"]:
                option["identities"].append(identity)
    return sorted(grouped.values(), key=lambda option: int(option["value"]), reverse=True)


class VehicleCatalogueAggregator:
    """Expose a make-first aggregate over the provider's full region universe."""

    def __init__(
        self,
        provider: WheelSizeProvider | None = None,
        *,
        concurrency: int = AGGREGATION_CONCURRENCY,
    ) -> None:
        self.provider = provider or WheelSizeProvider()
        self.concurrency = max(1, concurrency)

    async def _regions(self) -> list[str]:
        entries = await self.provider.catalogue_regions()
        regions: list[str] = []
        for entry in entries:
            value = _entry_value(entry)
            if value and value.casefold() not in {item.casefold() for item in regions}:
                regions.append(value)
        return regions

    async def _fanout(
        self,
        regions: Sequence[str],
        call: Callable[[str], Awaitable[list[dict[str, Any]]]],
    ) -> list[tuple[str, Sequence[dict[str, Any]]]]:
        semaphore = asyncio.Semaphore(self.concurrency)

        async def one(region: str):
            async with semaphore:
                try:
                    return region, await call(region)
                except ProviderError:
                    raise
                except Exception as exc:  # pragma: no cover - defensive adapter boundary
                    raise ProviderError("vehicle catalogue aggregation failed") from exc

        results = await asyncio.gather(*(one(region) for region in regions))
        return list(results)

    async def _multi_rows(
        self,
        regions: Sequence[str],
        call: Callable[[Sequence[str]], Awaitable[list[dict[str, Any]]]],
        per_region: Callable[[str], Awaitable[list[dict[str, Any]]]],
    ) -> list[tuple[str, Sequence[dict[str, Any]]]]:
        """Use documented multi-region cataloging, falling back only if needed.

        Makes and models expose region membership in Wheel-Size's catalog
        records.  If a compatible adapter/test double omits that evidence, a
        bounded region fan-out obtains exact membership instead of assuming
        that one label exists everywhere.
        """
        try:
            rows = await call(regions)
        except TypeError:
            # Keep the service compatible with older local provider doubles;
            # production Wheel-Size uses the documented repeated region query.
            return await self._fanout(regions, per_region)
        if rows and all(_region_values(row.get("regions"), regions) for row in rows):
            return [("__aggregate__", rows)]
        return await self._fanout(regions, per_region)

    @staticmethod
    def _find_option(options: Sequence[dict[str, Any]], value: str) -> dict[str, Any] | None:
        wanted = _text(value).casefold()
        if not wanted:
            return None
        return next(
            (
                option
                for option in options
                if _text(option.get("value")).casefold() == wanted
                or _text(option.get("provider_id")).casefold() == wanted
            ),
            None,
        )

    async def makes(self) -> list[dict[str, Any]]:
        regions = await self._regions()
        if not regions:
            return []
        rows = await self._multi_rows(
            regions,
            lambda selected: self.provider.catalogue_makes(region=selected),
            lambda region: self.provider.catalogue_makes(region=region),
        )
        return _aggregate_rows(rows, known_regions=regions)

    async def _models_for_make(
        self,
        make_option: dict[str, Any],
        regions: Sequence[str],
    ) -> list[dict[str, Any]]:
        identities = make_option.get("identities") or []
        make_ids_by_region = {
            _text(item.get("region")): _text(item.get("provider_id"))
            for item in identities
            if _text(item.get("region")) and _text(item.get("provider_id"))
        }
        if not make_ids_by_region:
            return []
        make_ids = set(make_ids_by_region.values())
        if len(make_ids) == 1:
            make_id = next(iter(make_ids))
            rows = await self._multi_rows(
                list(make_ids_by_region),
                lambda selected: self.provider.catalogue_models(make=make_id, region=selected),
                lambda region: self.provider.catalogue_models(
                    make=make_ids_by_region[region], region=region
                ),
            )
        else:
            rows = await self._fanout(
                list(make_ids_by_region),
                lambda region: self.provider.catalogue_models(
                    make=make_ids_by_region[region], region=region
                ),
            )
        return _aggregate_rows(rows, known_regions=regions)

    async def models(self, make: str) -> list[dict[str, Any]]:
        regions = await self._regions()
        if not regions:
            return []
        make_option = self._find_option(await self.makes(), make)
        if make_option is None:
            return []
        return await self._models_for_make(make_option, regions)

    async def years(self, make: str, model: str) -> list[dict[str, Any]]:
        regions = await self._regions()
        if not regions:
            return []
        make_option = self._find_option(await self.makes(), make)
        if make_option is None:
            return []
        model_option = self._find_option(await self._models_for_make(make_option, regions), model)
        if model_option is None:
            return []
        make_ids_by_region = {
            _text(item.get("region")): _text(item.get("provider_id"))
            for item in make_option.get("identities") or []
        }
        model_ids_by_region = {
            _text(item.get("region")): _text(item.get("provider_id"))
            for item in model_option.get("identities") or []
        }
        pairs = {
            region: (make_ids_by_region[region], model_ids_by_region[region])
            for region in model_ids_by_region
            if region in make_ids_by_region
        }
        rows = await self._fanout(
            list(pairs),
            lambda region: self.provider.catalogue_years(
                make=pairs[region][0], model=pairs[region][1], region=region
            ),
        )
        return _aggregate_year_rows(rows)

    async def markets(self, make: str, model: str, year: int) -> dict[str, Any]:
        years = await self.years(make, model)
        year_option = self._find_option(years, str(year))
        if year_option is None:
            return {
                "outcome": "no_data",
                "resolution": "no_data",
                "resolved_market": None,
                "items": [],
            }
        region_entries = await self.provider.catalogue_regions()
        labels = {
            _entry_value(entry).casefold(): _entry_label(entry, _entry_value(entry))
            for entry in region_entries
            if _entry_value(entry)
        }
        items: list[dict[str, Any]] = []
        for item in year_option.get("identities") or []:
            region = _text(item.get("region"))
            if not region or any(option.get("value") == region for option in items):
                continue
            items.append(
                {
                    "value": region,
                    "label": labels.get(region.casefold(), region),
                    "provider_id": region,
                    "identities": [_identity(region, region)],
                }
            )
        items.sort(key=lambda option: option["label"].casefold())
        if not items:
            return {
                "outcome": "no_data",
                "resolution": "no_data",
                "resolved_market": None,
                "items": [],
            }
        if len(items) == 1:
            return {
                "outcome": "success",
                "resolution": "single",
                "resolved_market": items[0],
                "items": [],
            }
        return {
            "outcome": "success",
            "resolution": "selection_required",
            "resolved_market": None,
            "items": items,
        }

    async def resolve_exact(
        self,
        *,
        make: str,
        model: str,
        year: int,
        region: str,
    ) -> dict[str, str | int] | None:
        makes = await self.makes()
        make_option = self._find_option(makes, make)
        if make_option is None:
            return None
        models = await self._models_for_make(make_option, await self._regions())
        model_option = self._find_option(models, model)
        if model_option is None:
            return None
        market = await self.markets(make_option["value"], model_option["value"], year)
        wanted = _text(region).casefold()
        candidates = market.get("items") or (
            [] if market.get("resolved_market") is None else [market["resolved_market"]]
        )
        market_option = next(
            (item for item in candidates if _text(item.get("value")).casefold() == wanted),
            None,
        )
        if market_option is None:
            return None
        make_identity = next(
            (
                item
                for item in make_option.get("identities") or []
                if _text(item.get("region")).casefold() == wanted
            ),
            None,
        )
        model_identity = next(
            (
                item
                for item in model_option.get("identities") or []
                if _text(item.get("region")).casefold() == wanted
            ),
            None,
        )
        if not make_identity or not model_identity:
            return None
        return {
            "make": make_option["label"],
            "model": model_option["label"],
            "year": year,
            "region": market_option["value"],
            "make_slug": make_identity["provider_id"],
            "model_slug": model_identity["provider_id"],
        }
