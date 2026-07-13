"""Адаптер Wheel-Size API v2 (https://developer.wheel-size.com/).

Факты API, на которых построен адаптер:
- база `https://api.wheel-size.com/v2`, auth — query-параметр `user_key`;
- cataloging-методы `/makes/`, `/models/`, `/years/` — кэшируемые (ToS);
- search `/search/by_model/?make=&model=&year=&region=[&modification=]` —
  только по действию реального пользователя, один регион на запрос;
- элемент `data[]` содержит `technical.{stud_holes,pcd,centre_bore,bolt_pattern,
  fasteners{type,thread_size,wheel_tightening_torque}}` и
  `wheels[].{front,rear}.{rim_diameter,rim_width,offset,is_stock}`;
- `centre_bore` может прийти строкой ("67.1") или "N/A";
- дневные квоты сбрасываются в 0:00 GMT; 429/5xx ретраим с backoff.

Лестница резолва: /makes/ → /models/ → /years/ → /generations/ →
/modifications/ → search/by_model. Slugs пишутся в
identity.provider_mappings["wheel_size"], канонические поля не подменяются.
"""

from __future__ import annotations

import asyncio
import difflib
import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from src.fitment.config import (
    FITMENT_CATALOG_CACHE_TTL_SEC,
    FITMENT_PROFILE_CACHE_TTL_SEC,
    WHEEL_SIZE_API_KEY,
    WHEEL_SIZE_BASE_URL,
    WHEEL_SIZE_MAX_RETRIES,
    WHEEL_SIZE_REGION_DEFAULT,
    WHEEL_SIZE_TIMEOUT_CONNECT_SEC,
    WHEEL_SIZE_TIMEOUT_READ_SEC,
)
from src.fitment.providers.base import ProviderError
from src.fitment.providers.cache import InMemoryProviderCache, ProviderCache
from src.fitment.schemas import (
    AxleFitment,
    FitmentProfile,
    VehicleIdentity,
    parse_bolt_pattern,
)

logger = logging.getLogger(__name__)

PROVIDER_NAME = "wheel_size"

# Рынок VLM/пользователя → регион Wheel-Size + fallback при пустом ответе.
MARKET_TO_REGION: dict[str, tuple[str, str | None]] = {
    "russia": ("russia", "chdm"),
    "chdm": ("chdm", "russia"),
    "europe": ("eudm", "usdm"),
    "eudm": ("eudm", "usdm"),
    "usa": ("usdm", "eudm"),
    "usdm": ("usdm", "eudm"),
    "japan": ("jdm", "eudm"),
    "jdm": ("jdm", "eudm"),
    "korea": ("kdm", "eudm"),
    "kdm": ("kdm", "eudm"),
}

_FUZZY_MATCH_THRESHOLD = 0.75


def _to_float(value: Any) -> float | None:
    """Безопасный парс: у Wheel-Size centre_bore бывает строкой или 'N/A'."""
    if value in (None, "", "N/A", "n/a"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _option_values(option: dict[str, Any]) -> set[str]:
    values: set[str] = set()
    for field in ("slug", "name", "name_en", "trim", "engine", "body"):
        value = option.get(field)
        if value:
            values.add(str(value))
    return values


def _match_score(query: str, option: dict[str, Any]) -> float:
    normalized_query = query.strip().lower()
    scores = [
        difflib.SequenceMatcher(None, normalized_query, candidate.strip().lower()).ratio()
        for candidate in _option_values(option)
    ]
    return max(scores, default=0.0)


def _fuzzy_pick(query: str, options: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Выбрать элемент каталога (slug/name/name_en) по нечёткому совпадению."""
    best: tuple[float, dict[str, Any]] | None = None
    for option in options:
        score = _match_score(query, option)
        if best is None or score > best[0]:
            best = (score, option)
    if best is None or best[0] < _FUZZY_MATCH_THRESHOLD:
        return None
    return best[1]


def _pick_specific_entry(
    options: list[dict[str, Any]],
    *hints: str | None,
) -> dict[str, Any] | None:
    if len(options) == 1:
        return options[0]
    for hint in hints:
        if hint:
            ranked = sorted(
                ((_match_score(hint, option), option) for option in options),
                key=lambda pair: pair[0],
                reverse=True,
            )
            if (
                ranked
                and ranked[0][0] >= _FUZZY_MATCH_THRESHOLD
                and (len(ranked) == 1 or ranked[0][0] > ranked[1][0])
            ):
                return ranked[0][1]
    return None


def _contains_year(options: list[Any], year: int) -> bool:
    for option in options:
        if isinstance(option, dict):
            value = option.get("year", option.get("name", option.get("slug")))
        else:
            value = option
        try:
            if int(value) == year:
                return True
        except (TypeError, ValueError):
            continue
    return False


def _consensus(values: list[Any]) -> Any | None:
    if not values or any(value is None for value in values):
        return None
    first = values[0]
    return first if all(value == first for value in values[1:]) else None


class WheelSizeProvider:
    """FitmentProvider поверх Wheel-Size v2. httpx-клиент инжектится для тестов."""

    name = PROVIDER_NAME

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        cache: ProviderCache | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key if api_key is not None else WHEEL_SIZE_API_KEY
        self._base_url = (base_url or WHEEL_SIZE_BASE_URL).rstrip("/")
        self._cache = cache or InMemoryProviderCache()
        self._client = client

    # -- HTTP core -----------------------------------------------------------

    async def _request(self, path: str, params: dict[str, Any]) -> Any:
        if not self._api_key:
            raise ProviderError("WHEEL_SIZE_API_KEY is not configured")

        request_params = {**params, "user_key": self._api_key}
        url = f"{self._base_url}/{path.strip('/')}/"
        timeout = httpx.Timeout(WHEEL_SIZE_TIMEOUT_READ_SEC, connect=WHEEL_SIZE_TIMEOUT_CONNECT_SEC)

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=timeout, trust_env=False)
        try:
            last_error: Exception | None = None
            attempts = max(1, WHEEL_SIZE_MAX_RETRIES)
            for attempt in range(attempts):
                try:
                    response = await client.get(url, params=request_params)
                except httpx.TransportError as exc:
                    last_error = exc
                    if attempt + 1 < attempts:
                        await asyncio.sleep(0.5 * (2**attempt))
                    continue

                if response.status_code == 429 or response.status_code >= 500:
                    last_error = ProviderError(f"wheel-size HTTP {response.status_code} on /{path}")
                    if attempt + 1 < attempts:
                        await asyncio.sleep(0.5 * (2**attempt))
                    continue
                if response.status_code >= 400:
                    # 4xx (кроме 429) — не ретраим: неверный запрос/ключ.
                    raise ProviderError(f"wheel-size HTTP {response.status_code} on /{path}")
                try:
                    return response.json()
                except ValueError as exc:
                    raise ProviderError(f"wheel-size invalid JSON on /{path}") from exc

            raise ProviderError(
                f"wheel-size request failed on /{path}: {type(last_error).__name__}"
            )
        finally:
            if owns_client:
                await client.aclose()

    async def _cataloging(self, path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        cache_key = f"ws:catalog:{path}:{sorted(params.items())}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached
        payload = await self._request(path, params)
        data = payload.get("data", payload) if isinstance(payload, dict) else payload
        if not isinstance(data, list):
            raise ProviderError(f"wheel-size unexpected cataloging payload on /{path}")
        await self._cache.set(cache_key, data, FITMENT_CATALOG_CACHE_TTL_SEC)
        return data

    # -- Resolution ladder ----------------------------------------------------

    def _regions_for(self, identity: VehicleIdentity) -> list[str]:
        market = (identity.market or "").strip().lower()
        region, fallback = MARKET_TO_REGION.get(market, (WHEEL_SIZE_REGION_DEFAULT, None))
        regions = [region]
        if fallback and fallback not in regions:
            regions.append(fallback)
        return regions

    async def resolve_vehicle(self, identity: VehicleIdentity) -> VehicleIdentity | None:
        if not identity.is_resolvable:
            return None

        region = self._regions_for(identity)[0]
        makes = await self._cataloging("makes", {"region": region})
        make_entry = _fuzzy_pick(identity.make, makes)
        if make_entry is None:
            logger.info("🔎 wheel-size: make '%s' не найден в каталоге", identity.make)
            return None
        make_slug = str(make_entry.get("slug") or "")
        if not make_slug:
            return None

        models = await self._cataloging("models", {"make": make_slug, "region": region})
        model_entry = _fuzzy_pick(identity.model, models)
        if model_entry is None:
            logger.info(
                "🔎 wheel-size: model '%s' не найден для make=%s", identity.model, make_slug
            )
            return None
        model_slug = str(model_entry.get("slug") or "")
        if not model_slug:
            return None

        base_params: dict[str, Any] = {
            "make": make_slug,
            "model": model_slug,
            "region": region,
        }
        years = await self._cataloging("years", base_params)
        if not _contains_year(years, identity.year):
            logger.info(
                "🔎 wheel-size: year=%s не найден для make=%s model=%s",
                identity.year,
                make_slug,
                model_slug,
            )
            return None

        vehicle_params = {**base_params, "year": identity.year}
        generations = await self._cataloging("generations", vehicle_params)
        generation_entry = _pick_specific_entry(
            generations,
            identity.generation,
            identity.body,
        )
        generation_slug = (
            str(generation_entry.get("slug") or "") if generation_entry is not None else ""
        )

        modification_slug = ""
        if generation_slug:
            modifications = await self._cataloging(
                "modifications",
                {**vehicle_params, "generation": generation_slug},
            )
            modification_entry = _pick_specific_entry(
                modifications,
                identity.modification,
                identity.body,
            )
            if modification_entry is not None:
                modification_slug = str(modification_entry.get("slug") or "")

        resolved = identity.model_copy(deep=True)
        mapping = {
            "make_slug": make_slug,
            "model_slug": model_slug,
            "region": region,
        }
        if generation_slug:
            mapping["generation_slug"] = generation_slug
        if modification_slug:
            mapping["modification_slug"] = modification_slug
        resolved.provider_mappings[PROVIDER_NAME] = mapping
        return resolved

    # -- Profile --------------------------------------------------------------

    async def _search_by_model(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        cache_key = f"ws:search:by_model:{sorted(params.items())}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached

        payload = await self._request("search/by_model", params)
        data = payload.get("data") if isinstance(payload, dict) else None
        if data is None and isinstance(payload, list):
            data = payload
        if not isinstance(data, list):
            raise ProviderError("wheel-size unexpected search payload on /search/by_model")
        await self._cache.set(cache_key, data, FITMENT_PROFILE_CACHE_TTL_SEC)
        return data

    async def get_fitment_profile(
        self,
        identity: VehicleIdentity,
        *,
        user_initiated: bool = True,
    ) -> FitmentProfile | None:
        if not user_initiated:
            logger.warning("🔥 wheel-size search skipped: user_initiated=false")
            return None

        mapping = identity.provider_mappings.get(PROVIDER_NAME)
        if not mapping or not identity.year:
            return None

        for region in self._regions_for(identity):
            params: dict[str, Any] = {
                "make": mapping["make_slug"],
                "model": mapping["model_slug"],
                "year": identity.year,
                "region": region,
            }
            if mapping.get("modification_slug"):
                params["modification"] = mapping["modification_slug"]

            cache_key = f"ws:profile:{sorted(params.items())}"
            cached = await self._cache.get(cache_key)
            if cached is not None:
                return FitmentProfile.model_validate(cached)

            data = await self._search_by_model(params)
            if not data:
                continue

            profile = self._normalize_profile(data)
            if profile is None:
                continue
            await self._cache.set(cache_key, profile.model_dump(), FITMENT_PROFILE_CACHE_TTL_SEC)
            return profile

        return None

    def _normalize_profile(self, data: list[dict[str, Any]]) -> FitmentProfile | None:
        """data[] → FitmentProfile.

        В data[] несколько модификаций. Крепёжная геометрия берётся только при
        консенсусе между модификациями: разные bolt pattern у разных моторов —
        это «неоднозначная модификация», честный None (unknown), не догадка.
        Allowed wheels мержатся по всем модификациям (это допустимые заводские
        конфигурации данной модели/года).
        """
        bolt_patterns: list[tuple[int, float] | None] = []
        center_bores: list[float | None] = []
        fastener_types: list[str | None] = []
        thread_sizes: list[str | None] = []
        torques: list[str | None] = []
        oem_front_offsets: list[float | None] = []
        oem_rear_offsets: list[float | None] = []
        allowed: list[AxleFitment] = []

        for item in data:
            technical = item.get("technical") or {}
            stud_holes = technical.get("stud_holes")
            pcd = _to_float(technical.get("pcd"))
            if stud_holes is None or pcd is None:
                parsed_count, parsed_pcd = parse_bolt_pattern(technical.get("bolt_pattern"))
                stud_holes = stud_holes if stud_holes is not None else parsed_count
                pcd = pcd if pcd is not None else parsed_pcd
            try:
                stud_holes_int = int(stud_holes) if stud_holes is not None else None
            except (TypeError, ValueError):
                stud_holes_int = None
            bolt_patterns.append(
                (stud_holes_int, pcd) if stud_holes_int is not None and pcd is not None else None
            )

            bore_raw = technical.get("centre_bore")
            if bore_raw is None:
                bore_raw = technical.get("center_bore")
            bore = _to_float(bore_raw)
            center_bores.append(bore)

            fasteners = technical.get("fasteners") or {}
            fastener_types.append(str(fasteners["type"]) if fasteners.get("type") else None)
            thread_sizes.append(
                str(fasteners["thread_size"]) if fasteners.get("thread_size") else None
            )
            torques.append(
                str(fasteners["wheel_tightening_torque"])
                if fasteners.get("wheel_tightening_torque")
                else None
            )

            item_oem_offsets: dict[str, set[float]] = {"front": set(), "rear": set()}
            for wheel_pair in item.get("wheels") or []:
                for axle in ("front", "rear"):
                    axle_data = wheel_pair.get(axle) or {}
                    diameter = _to_float(axle_data.get("rim_diameter"))
                    width = _to_float(axle_data.get("rim_width"))
                    if diameter is None or width is None:
                        continue
                    offset_raw = axle_data.get("offset")
                    if offset_raw is None:
                        offset_raw = axle_data.get("et")
                    offset = _to_float(offset_raw)
                    is_stock = axle_data.get("is_stock")
                    record = AxleFitment(
                        axle=axle,
                        rim_diameter=diameter,
                        rim_width=width,
                        offset=offset,
                        is_stock=is_stock,
                        tire=axle_data.get("tire"),
                    )
                    allowed.append(record)
                    if is_stock and offset is not None:
                        item_oem_offsets[axle].add(offset)
            oem_front_offsets.append(
                next(iter(item_oem_offsets["front"]))
                if len(item_oem_offsets["front"]) == 1
                else None
            )
            oem_rear_offsets.append(
                next(iter(item_oem_offsets["rear"])) if len(item_oem_offsets["rear"]) == 1 else None
            )

        if not allowed and not any(bolt_patterns):
            return None

        # Дедуп allowed по (axle, diameter, width, offset).
        seen: set[tuple] = set()
        unique_allowed: list[AxleFitment] = []
        for rec in allowed:
            key = (rec.axle, rec.rim_diameter, rec.rim_width, rec.offset)
            if key not in seen:
                seen.add(key)
                unique_allowed.append(rec)

        bolt_count: int | None = None
        pcd_mm: float | None = None
        bolt_pattern = _consensus(bolt_patterns)
        if bolt_pattern is not None:
            bolt_count, pcd_mm = bolt_pattern

        return FitmentProfile(
            provider=PROVIDER_NAME,
            provider_version="v2",
            fetched_at=datetime.now(UTC).isoformat(),
            bolt_count=bolt_count,
            pcd_mm=pcd_mm,
            center_bore_mm=_consensus(center_bores),
            fastener_type=_consensus(fastener_types),
            thread_size=_consensus(thread_sizes),
            tightening_torque=_consensus(torques),
            allowed_wheels=unique_allowed,
            oem_offset_front=_consensus(oem_front_offsets),
            oem_offset_rear=_consensus(oem_rear_offsets),
        )
