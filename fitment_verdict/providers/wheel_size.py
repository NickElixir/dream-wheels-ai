"""Wheel-Size API v2 adapter."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from fitment_verdict.config import FitmentConfig
from fitment_verdict.providers.cache import FileCache
from fitment_verdict.providers.catalog import WheelSizeCatalog
from fitment_verdict.schemas import AxleFitment, FitmentProfile, RimSpec, VehicleQuery
from fitment_verdict.utils import (
    market_to_region,
    normalize_bolt_pattern,
    region_fallback,
    to_float,
)

logger = logging.getLogger(__name__)


class WheelSizeApiError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class WheelSizeHttpClient:
    def __init__(self, config: FitmentConfig) -> None:
        if not config.wheel_size_api_key:
            raise WheelSizeApiError("WHEEL_SIZE_API_KEY is not configured")
        self._config = config
        self._timeout = httpx.Timeout(
            connect=config.http_connect_timeout_s,
            read=config.http_read_timeout_s,
            write=config.http_read_timeout_s,
            pool=config.http_read_timeout_s,
        )

    async def get_json(self, path: str, params: dict[str, Any]) -> Any:
        url = f"{self._config.wheel_size_base_url}{path}"
        query = {**params, "user_key": self._config.wheel_size_api_key}
        last_error: Exception | None = None

        for attempt in range(self._config.http_max_retries):
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    response = await client.get(url, params=query)
                if response.status_code == 429 or response.status_code >= 500:
                    raise WheelSizeApiError(
                        f"Wheel-Size transient error status={response.status_code}",
                        status_code=response.status_code,
                    )
                if response.status_code >= 400:
                    raise WheelSizeApiError(
                        f"Wheel-Size client error status={response.status_code}",
                        status_code=response.status_code,
                    )
                payload = response.json()
                data = payload.get("data", payload)
                return data
            except (httpx.HTTPError, WheelSizeApiError) as exc:
                last_error = exc
                delay = 0.5 * (2**attempt)
                logger.warning(
                    "🔥 Wheel-Size retry attempt=%s path=%s delay=%.1fs error=%s",
                    attempt + 1,
                    path,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)

        assert last_error is not None
        raise last_error


def _unwrap_list(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        return payload["data"]
    return []


def _profile_cache_key(vehicle: VehicleQuery) -> str:
    return (
        f"{vehicle.region}:{vehicle.make_slug}:{vehicle.model_slug}:"
        f"{vehicle.year}:{vehicle.modification_slug or vehicle.modification or 'none'}"
    )


def normalize_vehicle_payload(
    payload: dict[str, Any],
    *,
    provider: str,
    vehicle_query: VehicleQuery,
    raw_response_ref: str | None,
) -> FitmentProfile:
    technical = payload.get("technical") or {}
    bolt_pattern = technical.get("bolt_pattern") or payload.get("bolt_pattern") or None
    if not bolt_pattern and technical.get("stud_holes") and technical.get("pcd") is not None:
        bolt_pattern = f"{technical['stud_holes']}x{technical['pcd']}"

    center_bore = (
        to_float(technical.get("centre_bore"))
        or to_float(technical.get("center_bore"))
        or to_float(payload.get("centre_bore"))
        or to_float(payload.get("center_bore"))
    )

    fasteners = technical.get("fasteners") or {}
    allowed: list[AxleFitment] = []
    oem_offset_front: float | None = None
    oem_offset_rear: float | None = None

    for wheel_group in payload.get("wheels") or []:
        for axle in ("front", "rear"):
            axle_data = wheel_group.get(axle) or {}
            if not axle_data:
                continue
            diameter = to_float(axle_data.get("rim_diameter"))
            width = to_float(axle_data.get("rim_width"))
            if diameter is None or width is None:
                continue
            offset = to_float(axle_data.get("offset") or axle_data.get("et"))
            is_stock = axle_data.get("is_stock")
            allowed.append(
                AxleFitment(
                    axle=axle,
                    rim_diameter=diameter,
                    rim_width=width,
                    offset=offset,
                    is_stock=is_stock,
                    tire=axle_data.get("tire"),
                )
            )
            if is_stock and offset is not None:
                if axle == "front":
                    oem_offset_front = offset
                else:
                    oem_offset_rear = offset

    return FitmentProfile(
        provider=provider,
        provider_version="v2",
        fetched_at=datetime.now(UTC).isoformat(),
        raw_response_ref=raw_response_ref,
        bolt_pattern=normalize_bolt_pattern(bolt_pattern),
        stud_holes=technical.get("stud_holes"),
        pcd=to_float(technical.get("pcd")),
        center_bore=center_bore,
        fastener_type=fasteners.get("type"),
        thread_size=fasteners.get("thread_size"),
        tightening_torque=fasteners.get("wheel_tightening_torque"),
        allowed_wheels=allowed,
        oem_offset_front=oem_offset_front,
        oem_offset_rear=oem_offset_rear,
        vehicle_query=vehicle_query,
    )


class WheelSizeProvider:
    def __init__(self, config: FitmentConfig, cache: FileCache) -> None:
        self._config = config
        self._cache = cache
        self._client = WheelSizeHttpClient(config)
        self._catalog = WheelSizeCatalog(self._client, config, cache)

    async def resolve_vehicle_slugs(self, vehicle: VehicleQuery) -> VehicleQuery:
        resolved = vehicle.model_copy(deep=True)
        region = resolved.region or market_to_region(resolved.market)
        resolved.region = region

        if not resolved.make_slug and resolved.make:
            resolved.make_slug = await self._catalog.resolve_make_slug(resolved.make, region)
        if not resolved.model_slug and resolved.model and resolved.make_slug:
            resolved.model_slug = await self._catalog.resolve_model_slug(
                resolved.make_slug,
                resolved.model,
                region,
            )
        return resolved

    async def _search_by_model(self, vehicle: VehicleQuery) -> dict[str, Any] | None:
        if (
            not vehicle.make_slug
            or not vehicle.model_slug
            or vehicle.year is None
            or not vehicle.region
        ):
            return None

        params: dict[str, Any] = {
            "make": vehicle.make_slug,
            "model": vehicle.model_slug,
            "year": vehicle.year,
            "region": vehicle.region,
        }
        if vehicle.modification_slug:
            params["modification"] = vehicle.modification_slug
        elif vehicle.modification:
            params["modification"] = vehicle.modification

        data = await self._client.get_json("/search/by_model/", params)
        items = _unwrap_list(data)
        if not items:
            return None
        first = items[0]
        return first if isinstance(first, dict) else None

    async def resolve_and_fetch_profile(
        self,
        vehicle: VehicleQuery,
        *,
        user_initiated: bool,
    ) -> FitmentProfile | None:
        if not user_initiated:
            logger.warning("Wheel-Size search skipped: user_initiated=false")
            return None

        resolved = await self.resolve_vehicle_slugs(vehicle)
        cache_key = _profile_cache_key(resolved)
        cached = self._cache.get("profile", cache_key)
        if cached is not None:
            return FitmentProfile.model_validate(cached)

        regions = [resolved.region] if resolved.region else ["russia"]
        fallback = region_fallback(regions[0]) if regions else None
        if fallback:
            regions.append(fallback)

        raw_payload: dict[str, Any] | None = None
        used_vehicle = resolved
        for region in regions:
            candidate = resolved.model_copy(deep=True)
            candidate.region = region
            raw_payload = await self._search_by_model(candidate)
            if raw_payload is not None:
                used_vehicle = candidate
                break

        if raw_payload is None:
            return None

        raw_ref = f"wheel-size:{cache_key}:{datetime.now(UTC).isoformat()}"
        profile = normalize_vehicle_payload(
            raw_payload,
            provider=self._config.fitment_provider,
            vehicle_query=used_vehicle,
            raw_response_ref=raw_ref,
        )
        self._cache.set(
            "profile",
            cache_key,
            profile.model_dump(mode="json"),
            ttl=timedelta(hours=self._config.profile_cache_ttl_hours),
        )
        return profile

    async def search_by_rim(
        self,
        rim: RimSpec,
        *,
        regions: list[str],
        user_initiated: bool,
    ) -> list[dict[str, Any]]:
        """Wheel-Size /by_rim/search/ — vehicles that accept these rim parameters."""
        if not user_initiated:
            logger.warning("Wheel-Size by_rim search skipped: user_initiated=false")
            return []

        if rim.diameter is None or rim.width is None:
            return []

        bolt_pattern = rim.bolt_pattern
        if not bolt_pattern and rim.bolt_count and rim.pcd_mm:
            bolt_pattern = f"{rim.bolt_count}x{rim.pcd_mm}"

        if not bolt_pattern:
            return []

        cache_key = (
            f"{bolt_pattern}:{rim.diameter}:{rim.width}:{rim.offset or 'any'}:{','.join(regions)}"
        )
        cached = self._cache.get("by_rim", cache_key)
        if cached is not None:
            return cached

        params: dict[str, Any] = {
            "bolt_pattern": bolt_pattern,
            "rim_diameter": rim.diameter,
            "rim_width": rim.width,
            "mode": "both",
        }
        if rim.offset is not None:
            params["rim_offset_min"] = rim.offset - 2
            params["rim_offset_max"] = rim.offset + 2
        if rim.center_bore_mm is not None:
            params["cb_min"] = rim.center_bore_mm - 0.2
            params["cb_max"] = rim.center_bore_mm + 0.2

        region_list = regions or ["eudm"]
        if len(region_list) == 1:
            params["region"] = region_list[0]
        else:
            params["region"] = region_list

        data = await self._client.get_json("/by_rim/search/", params)
        items = _unwrap_list(data)
        self._cache.set(
            "by_rim",
            cache_key,
            items,
            ttl=timedelta(hours=self._config.profile_cache_ttl_hours),
        )
        return items


def vehicle_matches_by_rim_results(
    vehicle: VehicleQuery,
    items: list[dict[str, Any]],
) -> bool:
    """Return True if make/model/year appears in /by_rim/search/ results."""
    if not vehicle.make or not vehicle.model or vehicle.year is None:
        return False

    make_key = vehicle.make.lower().replace(" ", "-")
    model_key = vehicle.model.lower().replace(" ", "-")

    for item in items:
        make = item.get("make") or {}
        model = item.get("model") or {}
        make_slug = (make.get("slug") or make.get("name") or "").lower()
        model_slug = (model.get("slug") or model.get("name") or "").lower()
        if make_key not in make_slug and make_slug not in make_key:
            if vehicle.make.lower() not in (make.get("name") or "").lower():
                continue
        if model_key not in model_slug and model_slug not in model_key:
            if vehicle.model.lower() not in (model.get("name") or "").lower():
                continue

        year_from = item.get("year_from") or item.get("production_start_year")
        year_to = item.get("year_to") or item.get("production_end_year") or year_from
        if year_from is None:
            return True
        try:
            y_from = int(year_from)
            y_to = int(year_to) if year_to is not None else y_from
        except (TypeError, ValueError):
            return True
        if y_from <= vehicle.year <= y_to:
            return True
    return False
