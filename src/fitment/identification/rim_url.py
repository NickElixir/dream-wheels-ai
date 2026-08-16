"""Resolve a generic HTTPS rim product URL into products and variants."""

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urljoin, urlsplit, urlunsplit

from src.fitment.identification.rim_url_extract import (
    ExtractedCandidate,
    ExtractedPage,
    ExtractedVariant,
    extract_rim_document,
)
from src.fitment.identification.rim_url_fetch import (
    FetchedPage,
    FetchLimits,
    UrlAllowlistPolicy,
    fetch_product_page,
    validate_url,
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
_VARIANT_ACCEPT_SCORE = 5


@dataclass(frozen=True, slots=True)
class RimUrlCandidate:
    field: str
    value: str | int | float
    source: str
    confidence: float
    raw_value: str | None = None
    source_url: str | None = None


@dataclass(frozen=True, slots=True)
class RimUrlConflict:
    field: str
    candidates: tuple[RimUrlCandidate, ...]


@dataclass(frozen=True, slots=True)
class RimUrlVariant:
    rim: RimSpec
    source_url: str | None
    score: int
    confidence: float
    relation_sources: tuple[str, ...]
    candidates: tuple[RimUrlCandidate, ...]
    conflicts: tuple[RimUrlConflict, ...] = ()


@dataclass(frozen=True, slots=True)
class RimUrlResolution:
    requested_url: str
    final_url: str
    rim: RimSpec
    candidates: tuple[RimUrlCandidate, ...]
    conflicts: tuple[RimUrlConflict, ...]
    variants: tuple[RimUrlVariant, ...] = ()
    selection_required: bool = False
    selected_variant_sku: str | None = None


PageFetcher = Callable[..., Awaitable[FetchedPage]]


class RimProductPageAdapter(Protocol):
    """Extension point for deterministic host-specific product adapters."""

    def supports(self, page: FetchedPage) -> bool: ...

    def extract(self, page: FetchedPage) -> ExtractedPage: ...


class GenericProductPageAdapter:
    """Structured-data-first fallback for HTML and JSON product documents."""

    def supports(self, page: FetchedPage) -> bool:
        return page.content_type in {
            "text/html",
            "application/xhtml+xml",
            "application/json",
        }

    def extract(self, page: FetchedPage) -> ExtractedPage:
        return extract_rim_document(page.text(), content_type=page.content_type)


@dataclass(frozen=True, slots=True)
class _CachedExtraction:
    expires_at: float
    final_url: str
    extracted: ExtractedPage


class RimProductUrlResolver:
    """SSRF-safe product resolver with adapters and a bounded TTL cache."""

    def __init__(
        self,
        policy: UrlAllowlistPolicy,
        *,
        limits: FetchLimits | None = None,
        fetcher: PageFetcher = fetch_product_page,
        adapters: Sequence[RimProductPageAdapter] | None = None,
        cache_ttl_seconds: float = 300.0,
        cache_max_entries: int = 128,
    ) -> None:
        if cache_ttl_seconds < 0:
            raise ValueError("Rim URL cache TTL cannot be negative")
        if cache_max_entries < 0:
            raise ValueError("Rim URL cache size cannot be negative")
        self._policy = policy
        self._limits = limits or FetchLimits()
        self._fetcher = fetcher
        self._adapters = tuple(adapters or (GenericProductPageAdapter(),))
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache_max_entries = cache_max_entries
        self._cache: OrderedDict[str, _CachedExtraction] = OrderedDict()
        self._cache_lock = asyncio.Lock()

    async def resolve(self, url: str, *, selector: RimSpec | None = None) -> RimUrlResolution:
        final_url, extracted = await self._load_extracted(url)
        return _resolve_extracted(url, final_url, extracted, selector=selector)

    async def _load_extracted(self, url: str) -> tuple[str, ExtractedPage]:
        cache_key = validate_url(url, self._policy)
        now = time.monotonic()
        if self._cache_max_entries and self._cache_ttl_seconds:
            async with self._cache_lock:
                cached = self._cache.get(cache_key)
                if cached and cached.expires_at > now:
                    self._cache.move_to_end(cache_key)
                    return cached.final_url, cached.extracted
                if cached:
                    del self._cache[cache_key]

        page = await self._fetcher(cache_key, policy=self._policy, limits=self._limits)
        adapter = next((item for item in self._adapters if item.supports(page)), None)
        if adapter is None:
            extracted = ExtractedPage(())
        else:
            extracted = adapter.extract(page)

        if self._cache_max_entries and self._cache_ttl_seconds:
            async with self._cache_lock:
                self._cache[cache_key] = _CachedExtraction(
                    expires_at=time.monotonic() + self._cache_ttl_seconds,
                    final_url=page.final_url,
                    extracted=extracted,
                )
                self._cache.move_to_end(cache_key)
                while len(self._cache) > self._cache_max_entries:
                    self._cache.popitem(last=False)
        return page.final_url, extracted


async def resolve_rim_product_url(
    url: str,
    *,
    policy: UrlAllowlistPolicy,
    limits: FetchLimits | None = None,
    selector: RimSpec | None = None,
) -> RimUrlResolution:
    return await RimProductUrlResolver(policy, limits=limits).resolve(url, selector=selector)


def _to_url_candidates(
    extracted: tuple[ExtractedCandidate, ...],
) -> tuple[RimUrlCandidate, ...]:
    candidates: list[RimUrlCandidate] = []
    seen: set[tuple[str, str | int | float, str, str | None]] = set()
    for item in extracted:
        key = (item.field, item.value, item.source, item.source_url)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(
            RimUrlCandidate(
                field=item.field,
                value=item.value,
                source=item.source,
                confidence=item.confidence,
                raw_value=item.raw_value,
                source_url=item.source_url,
            )
        )
    return tuple(candidates)


def _normalized_identity(value: str | None) -> str | None:
    if not value:
        return None
    return "".join(character.lower() for character in value if character.isalnum()) or None


def _candidate_value(candidates: tuple[RimUrlCandidate, ...], field: str) -> str | None:
    candidate = next((item for item in candidates if item.field == field), None)
    return str(candidate.value) if candidate else None


def _same_path_prefix(left: str | None, right: str) -> bool:
    if not left:
        return False
    left_url = urlsplit(left)
    right_url = urlsplit(right)
    if left_url.hostname != right_url.hostname:
        return False
    left_parts = [part for part in left_url.path.split("/") if part]
    right_parts = [part for part in right_url.path.split("/") if part]
    return bool(left_parts and right_parts and left_parts[0] == right_parts[0])


def _safe_source_url(value: str | None, final_url: str) -> str | None:
    if not value:
        return None
    resolved = urlsplit(urljoin(final_url, value))
    if (
        resolved.scheme.lower() != "https"
        or not resolved.hostname
        or resolved.username is not None
        or resolved.password is not None
    ):
        return None
    return urlunsplit(("https", resolved.netloc, resolved.path or "/", resolved.query, ""))


def _sanitize_candidate_urls(
    candidates: tuple[RimUrlCandidate, ...], final_url: str
) -> tuple[RimUrlCandidate, ...]:
    return tuple(
        RimUrlCandidate(
            field=item.field,
            value=item.value,
            source=item.source,
            confidence=item.confidence,
            raw_value=item.raw_value,
            source_url=_safe_source_url(item.source_url, final_url),
        )
        for item in candidates
    )


def _variant_score(
    variant: ExtractedVariant,
    candidates: tuple[RimUrlCandidate, ...],
    *,
    group_ids: set[str],
    primary: RimSpec,
    final_url: str,
) -> int:
    score = 0
    relations = set(variant.relation_sources)
    if any("has_variant" in relation or relation.endswith("_variants") for relation in relations):
        score += 4
    if any("is_variant_of" in relation or "variantof" in relation for relation in relations):
        score += 4
    if group_ids and not group_ids.isdisjoint(variant.parent_ids):
        score += 5

    brand = _normalized_identity(_candidate_value(candidates, "brand"))
    primary_brand = _normalized_identity(primary.brand)
    model = _normalized_identity(_candidate_value(candidates, "model"))
    primary_model = _normalized_identity(primary.model)
    if brand and primary_brand:
        score += 1 if brand == primary_brand else -5
    if model and primary_model:
        score += 2 if model == primary_model else -4
    if _same_path_prefix(variant.source_url, final_url):
        score += 1
    return score


def _variant_group_key(variant: ExtractedVariant, index: int) -> tuple[object, ...]:
    candidates = _to_url_candidates(variant.candidates)
    sku = _normalized_identity(_candidate_value(candidates, "sku"))
    if sku:
        return ("sku", sku)
    if variant.source_url:
        return ("url", variant.source_url)
    technical = tuple(
        (field, next((item.value for item in candidates if item.field == field), None))
        for field in _TECHNICAL_FIELDS
    )
    if any(value is not None for _, value in technical):
        return ("technical", *technical)
    return ("anonymous", index)


def _merge_extracted_variants(
    variants: tuple[ExtractedVariant, ...],
) -> tuple[ExtractedVariant, ...]:
    groups: OrderedDict[tuple[object, ...], list[ExtractedVariant]] = OrderedDict()
    for index, variant in enumerate(variants):
        groups.setdefault(_variant_group_key(variant, index), []).append(variant)

    merged: list[ExtractedVariant] = []
    for items in groups.values():
        candidates: list[ExtractedCandidate] = []
        relation_sources: set[str] = set()
        parent_ids: set[str] = set()
        source_url = None
        for item in items:
            candidates.extend(item.candidates)
            relation_sources.update(item.relation_sources)
            parent_ids.update(item.parent_ids)
            source_url = source_url or item.source_url
        merged.append(
            ExtractedVariant(
                candidates=tuple(candidates),
                relation_sources=tuple(sorted(relation_sources)),
                parent_ids=tuple(sorted(parent_ids)),
                source_url=source_url,
            )
        )
    return tuple(merged)


def _build_variants(
    extracted: ExtractedPage,
    *,
    primary: RimSpec,
    final_url: str,
) -> tuple[RimUrlVariant, ...]:
    variants: list[RimUrlVariant] = []
    group_ids = set(extracted.product_group_ids)
    for extracted_variant in _merge_extracted_variants(extracted.variants):
        source_url = _safe_source_url(extracted_variant.source_url, final_url)
        extracted_variant = ExtractedVariant(
            candidates=extracted_variant.candidates,
            relation_sources=extracted_variant.relation_sources,
            parent_ids=extracted_variant.parent_ids,
            source_url=source_url,
        )
        candidates = _sanitize_candidate_urls(
            _to_url_candidates(extracted_variant.candidates), final_url
        )
        score = _variant_score(
            extracted_variant,
            candidates,
            group_ids=group_ids,
            primary=primary,
            final_url=final_url,
        )
        if score < _VARIANT_ACCEPT_SCORE:
            continue
        conflicts = _find_conflicts(candidates)
        rim = _clear_conflicts(_build_rim_spec(candidates, source_url), conflicts)
        confidence = min(
            0.99,
            max(
                0.0,
                sum(item.confidence for item in candidates) / len(candidates)
                if candidates
                else 0.0,
            ),
        )
        variants.append(
            RimUrlVariant(
                rim=rim,
                source_url=source_url,
                score=score,
                confidence=confidence,
                relation_sources=extracted_variant.relation_sources,
                candidates=candidates,
                conflicts=conflicts,
            )
        )
    return tuple(variants)


def _known_value(spec: RimSpec, field: str) -> object | None:
    value = getattr(spec, field)
    return value.value if isinstance(value, FieldValue) else value


def _values_equal(left: object, right: object) -> bool:
    if isinstance(left, int | float) and isinstance(right, int | float):
        return abs(float(left) - float(right)) <= 0.01
    return _normalized_identity(str(left)) == _normalized_identity(str(right))


def _selector_score(selector: RimSpec, variant: RimUrlVariant) -> int | None:
    if selector.sku:
        if not variant.rim.sku or not _values_equal(selector.sku, variant.rim.sku):
            return None
        return 100

    score = 0
    for field in ("brand", "model"):
        expected = _known_value(selector, field)
        actual = _known_value(variant.rim, field)
        if expected is not None and actual is not None:
            if not _values_equal(expected, actual):
                return None
            score += 1
    for field in _TECHNICAL_FIELDS:
        expected = _known_value(selector, field)
        actual = _known_value(variant.rim, field)
        if expected is None or actual is None:
            continue
        if not _values_equal(expected, actual):
            return None
        score += 2
    return score if score >= 3 else None


def _select_variant(
    variants: tuple[RimUrlVariant, ...],
    selector: RimSpec | None,
) -> RimUrlVariant | None:
    if len(variants) == 1:
        return variants[0]
    if selector is None:
        return None
    scored = [
        (score, variant)
        for variant in variants
        if (score := _selector_score(selector, variant)) is not None
    ]
    if not scored:
        return None
    best_score = max(score for score, _ in scored)
    winners = [variant for score, variant in scored if score == best_score]
    return winners[0] if len(winners) == 1 else None


def _resolve_extracted(
    requested_url: str,
    final_url: str,
    extracted: ExtractedPage,
    *,
    selector: RimSpec | None,
) -> RimUrlResolution:
    candidates = _sanitize_candidate_urls(_to_url_candidates(extracted.candidates), final_url)
    primary_conflicts = _find_conflicts(candidates)
    primary = _clear_conflicts(_build_rim_spec(candidates, final_url), primary_conflicts)
    variants = _build_variants(extracted, primary=primary, final_url=final_url)
    selected = _select_variant(variants, selector)

    if selected is not None:
        rim = selected.rim.model_copy(deep=True)
        if not rim.product_url:
            rim.product_url = final_url
        selected_sku = selected.rim.sku
        conflicts = selected.conflicts
        selected_candidates = selected.candidates
    else:
        rim = primary
        selected_sku = None
        conflicts = primary_conflicts
        selected_candidates = candidates
        if len(variants) > 1:
            rim = _clear_variant_specific_fields(rim)

    return RimUrlResolution(
        requested_url=requested_url,
        final_url=final_url,
        rim=rim,
        candidates=selected_candidates,
        conflicts=conflicts,
        variants=variants,
        selection_required=len(variants) > 1 and selected is None,
        selected_variant_sku=selected_sku,
    )


def _build_rim_spec(candidates: tuple[RimUrlCandidate, ...], final_url: str | None) -> RimSpec:
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
        if field_name in _METADATA_FIELDS and field_candidates:
            strongest_confidence = max(item.confidence for item in field_candidates)
            field_candidates = tuple(
                item
                for item in field_candidates
                if abs(item.confidence - strongest_confidence) <= 0.01
            )
        distinct_values = {
            _normalized_identity(str(item.value)) if field_name in _METADATA_FIELDS else item.value
            for item in field_candidates
        }
        if len(distinct_values) > 1:
            conflicts.append(RimUrlConflict(field=field_name, candidates=field_candidates))
    return tuple(conflicts)


def _clear_conflicts(rim: RimSpec, conflicts: tuple[RimUrlConflict, ...]) -> RimSpec:
    cleaned = rim.model_copy(deep=True)
    for conflict in conflicts:
        value = getattr(cleaned, conflict.field)
        setattr(cleaned, conflict.field, FieldValue() if isinstance(value, FieldValue) else None)
    return cleaned


def _clear_variant_specific_fields(rim: RimSpec) -> RimSpec:
    cleaned = rim.model_copy(deep=True)
    cleaned.sku = None
    for field_name in _TECHNICAL_FIELDS:
        setattr(cleaned, field_name, FieldValue())
    return cleaned
