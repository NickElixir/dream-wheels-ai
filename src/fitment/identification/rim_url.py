"""Resolve a generic HTTPS rim product URL into structured candidates."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from src.fitment.identification.rim_url_extract import (
    ExtractedCandidate,
    extract_rim_product,
)
from src.fitment.identification.rim_url_fetch import (
    FetchedPage,
    FetchLimits,
    UrlAllowlistPolicy,
    fetch_product_page,
)
from src.fitment.schemas import FieldValue, RimSpec, Source

_METADATA_FIELDS = ("brand", "model", "sku")
_TECHNICAL_FIELDS = (
    "bolt_count",
    "pcd_mm",
    "center_bore_mm",
    "wheel_diameter_in",
    "wheel_width_j",
    "offset_et_mm",
)


@dataclass(frozen=True, slots=True)
class RimUrlCandidate:
    field: str
    value: str | int | float
    source: str
    confidence: float


@dataclass(frozen=True, slots=True)
class RimUrlConflict:
    field: str
    candidates: tuple[RimUrlCandidate, ...]


@dataclass(frozen=True, slots=True)
class RimUrlResolution:
    requested_url: str
    final_url: str
    rim: RimSpec
    candidates: tuple[RimUrlCandidate, ...]
    conflicts: tuple[RimUrlConflict, ...]


PageFetcher = Callable[..., Awaitable[FetchedPage]]


class RimProductUrlResolver:
    """SSRF-safe product-page resolver with an explicit host policy."""

    def __init__(
        self,
        policy: UrlAllowlistPolicy,
        *,
        limits: FetchLimits | None = None,
        fetcher: PageFetcher = fetch_product_page,
    ) -> None:
        self._policy = policy
        self._limits = limits or FetchLimits()
        self._fetcher = fetcher

    async def resolve(self, url: str) -> RimUrlResolution:
        page = await self._fetcher(url, policy=self._policy, limits=self._limits)
        extracted = extract_rim_product(page.text())
        candidates = _deduplicate_candidates(extracted.candidates)
        rim = _build_rim_spec(candidates, page.final_url)
        return RimUrlResolution(
            requested_url=url,
            final_url=page.final_url,
            rim=rim,
            candidates=candidates,
            conflicts=_find_conflicts(candidates),
        )


async def resolve_rim_product_url(
    url: str,
    *,
    policy: UrlAllowlistPolicy,
    limits: FetchLimits | None = None,
) -> RimUrlResolution:
    return await RimProductUrlResolver(policy, limits=limits).resolve(url)


def _deduplicate_candidates(
    extracted: tuple[ExtractedCandidate, ...],
) -> tuple[RimUrlCandidate, ...]:
    candidates: list[RimUrlCandidate] = []
    seen: set[tuple[str, str | int | float, str]] = set()
    for item in extracted:
        key = (item.field, item.value, item.source)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(
            RimUrlCandidate(
                field=item.field,
                value=item.value,
                source=item.source,
                confidence=item.confidence,
            )
        )
    return tuple(candidates)


def _build_rim_spec(candidates: tuple[RimUrlCandidate, ...], final_url: str) -> RimSpec:
    rim = RimSpec(product_url=final_url)
    for field_name in _METADATA_FIELDS:
        winner = next((item for item in candidates if item.field == field_name), None)
        if winner:
            setattr(rim, field_name, str(winner.value))

    for field_name in _TECHNICAL_FIELDS:
        winner = next((item for item in candidates if item.field == field_name), None)
        if winner:
            setattr(
                rim,
                field_name,
                FieldValue(
                    value=winner.value,
                    source=Source.product_page,
                    confidence=winner.confidence,
                ),
            )
    return rim


def _find_conflicts(
    candidates: tuple[RimUrlCandidate, ...],
) -> tuple[RimUrlConflict, ...]:
    conflicts: list[RimUrlConflict] = []
    for field_name in (*_METADATA_FIELDS, *_TECHNICAL_FIELDS):
        field_candidates = tuple(item for item in candidates if item.field == field_name)
        distinct_values = {item.value for item in field_candidates}
        if len(distinct_values) > 1:
            conflicts.append(RimUrlConflict(field=field_name, candidates=field_candidates))
    return tuple(conflicts)
