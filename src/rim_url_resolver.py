"""Safe extraction of rim specifications from public product pages.

The resolver deliberately returns a draft.  Callers must show its provenance
and let a user confirm values before persisting them as fitment input.
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any
from urllib.parse import SplitResult, urljoin, urlsplit, urlunsplit

import aiohttp
from aiohttp.abc import AbstractResolver

from src.rim_url_extract import ExtractedCandidate, ExtractedPage, extract_rim_document


class RimUrlError(RuntimeError):
    """A product page could not be fetched or parsed safely."""


class RimUrlSecurityError(RimUrlError):
    """The submitted URL violates the outbound network policy."""


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
class RimUrlVariant:
    sku: str | None
    values: dict[str, str | int | float]
    candidates: tuple[RimUrlCandidate, ...]
    conflicts: tuple[RimUrlConflict, ...] = ()


@dataclass(frozen=True, slots=True)
class RimUrlResolution:
    requested_url: str
    final_url: str
    values: dict[str, str | int | float]
    candidates: tuple[RimUrlCandidate, ...]
    conflicts: tuple[RimUrlConflict, ...]
    variants: tuple[RimUrlVariant, ...] = ()
    selection_required: bool = False
    selected_variant_sku: str | None = None


@dataclass(frozen=True, slots=True)
class PublicHttpsPolicy:
    """Universal outbound policy without a merchant allowlist.

    Hostnames are deliberately accepted only after the connector resolves them
    and proves that every answer is publicly routable.  IP literals are never
    accepted: this avoids bypassing the DNS and redirect protections.
    """

    allowed_ports: frozenset[int] = field(default_factory=lambda: frozenset({443}))

    def permits(self, host: str, port: int) -> bool:
        if port not in self.allowed_ports:
            return False
        try:
            ipaddress.ip_address(host)
        except ValueError:
            return True
        return False


@dataclass(frozen=True, slots=True)
class FetchLimits:
    max_redirects: int = 3
    max_body_bytes: int = 2 * 1024 * 1024
    total_timeout_seconds: float = 15.0


_HOST_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")
_SPACE = re.compile(r"\s+")
_SIZE = re.compile(
    r"\b(?P<width>\d{1,2}(?:[.,]\d)?)\s*[Jj]\s*[xх×*]?\s*[Rr]?(?P<diameter>1[3-9]|2[0-4])\b"
)
_PCD = re.compile(r"\b(?P<bolt_count>[3-8])\s*[xх×*]\s*(?P<pcd>\d{2,3}(?:[.,]\d)?)\b", re.I)
_ET = re.compile(r"\bET\s*(?P<et>[+-]?\d{1,3})\b", re.I)
_BORE = re.compile(r"\b(?:DIA|CB)\s*(?P<bore>\d{2,3}(?:[.,]\d)?)\b", re.I)
_FIELD_PATTERNS = {
    "brand": re.compile(
        r"\b(?:brand|manufacturer|бренд|производитель)\s*[:\-]\s*([^\n|;]{2,80})", re.I
    ),
    "model": re.compile(r"\b(?:model|модель)\s*[:\-]\s*([^\n|;]{2,120})", re.I),
    "sku": re.compile(
        r"\b(?:sku|артикул|part\s*(?:no|number))\s*[:#\-]\s*([A-Z0-9._/ -]{2,64})", re.I
    ),
}
_MARKETING_MODEL_TERMS = re.compile(
    r"\b(?:купить|цена|доставка|в наличии|литые|кованые|диски|колесные|wheel|r\d{2}|"
    r"\d(?:[.,]\d)?j|\d\s*[xх×*]\s*\d{2,3}|\bet\s*[+-]?\d|\bdia\s*\d)\b",
    re.I,
)
_KNOWN_FIELDS = (
    "brand",
    "model",
    "sku",
    "bolt_count",
    "pcd_mm",
    "center_bore_mm",
    "wheel_diameter_in",
    "wheel_width_j",
    "offset_et_mm",
)


def _normalize_host(host: str) -> str:
    candidate = host.rstrip(".")
    if not candidate or "\x00" in candidate or "%" in candidate:
        raise RimUrlSecurityError("URL host is invalid")
    try:
        normalized = candidate.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise RimUrlSecurityError("URL host is invalid") from exc
    try:
        ipaddress.ip_address(normalized)
        return normalized
    except ValueError:
        pass
    labels = normalized.split(".")
    if len(normalized) > 253 or any(not _HOST_LABEL.fullmatch(label) for label in labels):
        raise RimUrlSecurityError("URL host is invalid")
    return normalized


def _is_public(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address.split("%", 1)[0])
    except ValueError:
        return False
    return ip.is_global and not any(
        (ip.is_private, ip.is_loopback, ip.is_link_local, ip.is_multicast, ip.is_reserved)
    )


def validate_product_url(url: str, policy: PublicHttpsPolicy) -> str:
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as exc:
        raise RimUrlSecurityError("URL is malformed") from exc
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise RimUrlSecurityError("Only public HTTPS product URLs are allowed")
    if parsed.username is not None or parsed.password is not None:
        raise RimUrlSecurityError("URL credentials are not allowed")
    host = _normalize_host(parsed.hostname)
    effective_port = port or 443
    if not policy.permits(host, effective_port):
        raise RimUrlSecurityError("Product host or port is not allowed")
    netloc = host if port is None else f"{host}:{port}"
    return urlunsplit(SplitResult("https", netloc, parsed.path or "/", parsed.query, ""))


class _PublicResolver(AbstractResolver):
    def __init__(self, policy: PublicHttpsPolicy) -> None:
        self._policy = policy

    async def resolve(
        self, host: str, port: int = 0, family: int = socket.AF_INET
    ) -> list[dict[str, Any]]:
        normalized = _normalize_host(host)
        effective_port = port or 443
        if not self._policy.permits(normalized, effective_port):
            raise OSError("Host or port is not allowed")
        try:
            ipaddress.ip_address(normalized)
            addresses = [(socket.AF_INET6 if ":" in normalized else socket.AF_INET, normalized)]
        except ValueError:
            infos = await asyncio.get_running_loop().getaddrinfo(
                normalized, effective_port, family=family, type=socket.SOCK_STREAM
            )
            addresses = [(info[0], info[4][0]) for info in infos]
        if not addresses or any(not _is_public(address) for _, address in addresses):
            raise OSError("Host has a non-public DNS answer")
        return [
            {
                "hostname": normalized,
                "host": address,
                "port": effective_port,
                "family": address_family,
                "proto": socket.IPPROTO_TCP,
                "flags": 0,
            }
            for address_family, address in dict.fromkeys(addresses)
        ]

    async def close(self) -> None:
        return None


class _ProductHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.json_ld: list[str] = []
        self.meta: list[tuple[str, str]] = []
        self.text: list[str] = []
        self._json_depth = 0
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}
        if tag == "script":
            if attributes.get("type", "").split(";", 1)[0].lower() == "application/ld+json":
                self._json_depth += 1
            else:
                self._ignored_depth += 1
        elif tag in {"style", "noscript", "template"}:
            self._ignored_depth += 1
        elif tag == "meta":
            key = attributes.get("property") or attributes.get("name")
            if key and attributes.get("content"):
                self.meta.append((key.lower(), attributes["content"]))

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            if self._json_depth:
                self._json_depth -= 1
            elif self._ignored_depth:
                self._ignored_depth -= 1
        elif tag in {"style", "noscript", "template"} and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._json_depth:
            self.json_ld.append(data)
        elif not self._ignored_depth:
            self.text.append(data)


def _clean(value: Any, *, sku: bool = False) -> str | None:
    if not isinstance(value, str | int | float):
        return None
    result = _SPACE.sub(" ", str(value)).strip(" \t\r\n|")
    if not result:
        return None
    return re.sub(r"\s+", "-", result).upper() if sku else result[:160]


def _clean_model(value: Any) -> str | None:
    """Accept only an explicit, compact product-model value.

    Product ``name`` and OpenGraph titles are frequently marketing headlines
    that include size and commercial text.  They are useful as page context,
    but must not overwrite the editable model field.
    """
    model = _clean(value)
    if not model or len(model) > 80 or _MARKETING_MODEL_TERMS.search(model):
        return None
    return model


def _products(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [product for item in value for product in _products(item)]
    if not isinstance(value, dict):
        return []
    item_type = value.get("@type")
    types = [item_type] if isinstance(item_type, str) else item_type or []
    found = (
        [value]
        if any(isinstance(item, str) and item.lower() == "product" for item in types)
        else []
    )
    for key in ("@graph", "mainEntity", "itemListElement"):
        found.extend(_products(value.get(key)))
    return found


def _technical_candidates(text: str, source: str, confidence: float) -> list[RimUrlCandidate]:
    candidates: list[RimUrlCandidate] = []
    for match in _SIZE.finditer(text):
        candidates.extend(
            (
                RimUrlCandidate(
                    "wheel_width_j", float(match["width"].replace(",", ".")), source, confidence
                ),
                RimUrlCandidate("wheel_diameter_in", float(match["diameter"]), source, confidence),
            )
        )
    for match in _PCD.finditer(text):
        candidates.extend(
            (
                RimUrlCandidate("bolt_count", int(match["bolt_count"]), source, confidence),
                RimUrlCandidate(
                    "pcd_mm", float(match["pcd"].replace(",", ".")), source, confidence
                ),
            )
        )
    for pattern, field_name, group_name in (
        (_ET, "offset_et_mm", "et"),
        (_BORE, "center_bore_mm", "bore"),
    ):
        for match in pattern.finditer(text):
            candidates.append(
                RimUrlCandidate(
                    field_name, float(match[group_name].replace(",", ".")), source, confidence
                )
            )
    return candidates


def extract_product_page(html: str) -> tuple[RimUrlCandidate, ...]:
    return _to_url_candidates(extract_rim_document(html).candidates)


def _to_url_candidates(
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


def _values_and_conflicts(
    candidates: tuple[RimUrlCandidate, ...],
) -> tuple[dict[str, str | int | float], tuple[RimUrlConflict, ...]]:
    values: dict[str, str | int | float] = {}
    conflicts: list[RimUrlConflict] = []
    for field_name in _KNOWN_FIELDS:
        matches = tuple(item for item in candidates if item.field == field_name)
        if not matches:
            continue
        best_confidence = max(item.confidence for item in matches)
        relevant = tuple(item for item in matches if item.confidence >= best_confidence - 0.03)
        identities = {
            str(item.value).casefold().replace(" ", "")
            if field_name in {"brand", "model", "sku"}
            else item.value
            for item in relevant
        }
        if len(identities) > 1:
            conflicts.append(RimUrlConflict(field_name, relevant))
            continue
        values[field_name] = max(
            relevant,
            key=lambda item: (item.confidence, item.source == "html_specifications"),
        ).value
    return values, tuple(conflicts)


def _build_variants(extracted: ExtractedPage) -> tuple[RimUrlVariant, ...]:
    primary_candidates = _to_url_candidates(extracted.candidates)
    primary_values, _ = _values_and_conflicts(primary_candidates)
    by_identity: dict[str, list[RimUrlCandidate]] = {}
    for index, extracted_variant in enumerate(extracted.variants):
        candidates = list(_to_url_candidates(extracted_variant.candidates))
        for field_name in ("brand", "model"):
            if field_name in primary_values and not any(
                item.field == field_name for item in candidates
            ):
                candidates.append(
                    RimUrlCandidate(
                        field=field_name,
                        value=primary_values[field_name],
                        source="product_group",
                        confidence=0.98,
                    )
                )
        sku = next((item.value for item in candidates if item.field == "sku"), None)
        identity = str(sku) if sku is not None else extracted_variant.source_url or str(index)
        by_identity.setdefault(identity, []).extend(candidates)

    variants: list[RimUrlVariant] = []
    for variant_candidates in by_identity.values():
        candidates = tuple(dict.fromkeys(variant_candidates))
        values, conflicts = _values_and_conflicts(candidates)
        variants.append(
            RimUrlVariant(
                sku=str(values["sku"]) if values.get("sku") is not None else None,
                values=values,
                candidates=candidates,
                conflicts=conflicts,
            )
        )
    return tuple(variants)


def _resolve_document(
    requested_url: str,
    final_url: str,
    extracted: ExtractedPage,
) -> RimUrlResolution:
    candidates = _to_url_candidates(extracted.candidates)
    values, conflicts = _values_and_conflicts(candidates)
    variants = _build_variants(extracted)
    if len(variants) == 1:
        selected = variants[0]
        return RimUrlResolution(
            requested_url,
            final_url,
            selected.values,
            selected.candidates,
            selected.conflicts,
            variants,
            False,
            selected.sku,
        )
    if len(variants) > 1:
        for field_name in (
            "sku",
            "bolt_count",
            "pcd_mm",
            "center_bore_mm",
            "wheel_diameter_in",
            "wheel_width_j",
            "offset_et_mm",
        ):
            values.pop(field_name, None)
        candidates = tuple(
            item
            for item in candidates
            if item.field
            not in {
                "sku",
                "bolt_count",
                "pcd_mm",
                "center_bore_mm",
                "wheel_diameter_in",
                "wheel_width_j",
                "offset_et_mm",
            }
        )
    return RimUrlResolution(
        requested_url, final_url, values, candidates, conflicts, variants, bool(variants)
    )


async def resolve_rim_product_url(
    url: str, *, policy: PublicHttpsPolicy | None = None, limits: FetchLimits | None = None
) -> RimUrlResolution:
    limits = limits or FetchLimits()
    policy = policy or PublicHttpsPolicy()
    current_url = validate_product_url(url, policy)
    timeout = aiohttp.ClientTimeout(total=limits.total_timeout_seconds)
    connector = aiohttp.TCPConnector(resolver=_PublicResolver(policy), use_dns_cache=False)
    try:
        async with aiohttp.ClientSession(
            connector=connector, timeout=timeout, trust_env=False
        ) as session:
            for redirect_count in range(limits.max_redirects + 1):
                async with session.get(current_url, allow_redirects=False, proxy=None) as response:
                    if response.status in {301, 302, 303, 307, 308}:
                        if redirect_count >= limits.max_redirects or not response.headers.get(
                            "Location"
                        ):
                            raise RimUrlError("Product page redirect failed")
                        current_url = validate_product_url(
                            urljoin(current_url, response.headers["Location"]), policy
                        )
                        continue
                    if not 200 <= response.status < 300 or (
                        response.content_type.lower()
                        not in {"text/html", "application/xhtml+xml", "application/json"}
                        and not response.content_type.lower().endswith("+json")
                    ):
                        raise RimUrlError("Product page is not available as a supported document")
                    body = await response.content.read(limits.max_body_bytes + 1)
                    if len(body) > limits.max_body_bytes:
                        raise RimUrlError("Product page is too large")
                    content_type = response.content_type.lower()
                    if content_type.endswith("+json"):
                        content_type = "application/json"
                    extracted = extract_rim_document(
                        body.decode(response.charset or "utf-8", errors="replace"),
                        content_type=content_type,
                    )
                    return _resolve_document(url, current_url, extracted)
    except (aiohttp.ClientError, TimeoutError) as exc:
        raise RimUrlError("Product page fetch failed") from exc
    raise RimUrlError("Product page redirect failed")
