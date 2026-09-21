"""Best-effort Yandex Market card fetch with current-product JSON-LD isolation.

FALSE DATA IS WORSE THAN MISSING DATA. Technical values are taken only from the
single JSON-LD Product whose URL contains the requested card ID. Captcha,
empty shells, and ambiguous anchors return an empty draft.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

from src.rim_url_extract import ExtractedPage, extract_rim_document, json_ld_product_nodes
from src.rim_url_resolver import (
    FetchedDocument,
    FetchLimits,
    PublicHttpsPolicy,
    RimUrlError,
    RimUrlResolution,
    _resolve_document,
    fetch_public_document,
    is_captcha_url,
    rim_source_fingerprint,
    unusable_document_reason,
    validate_product_url,
)

logger = logging.getLogger(__name__)

YANDEX_HOSTS = frozenset({"market.yandex.ru", "business.market.yandex.ru"})
YANDEX_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
    ),
}
YANDEX_RETRY_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ru,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
}
_PRODUCT_ID_RE = re.compile(r"^\d{5,}$")
_ID_BOUNDARY_RE_TEMPLATE = r"(?:^|[^0-9]){product_id}(?:[^0-9]|$)"


@dataclass(frozen=True, slots=True)
class YandexFetchObservation:
    status_code: int | None
    content_type: str | None
    response_size: int | None
    redirect_count: int
    useful_document: bool
    current_product_anchored: bool
    body_truncated_at_limit: bool
    secondary_request_used: bool
    reason_code: str | None = None


@dataclass(frozen=True, slots=True)
class YandexAdapterResult:
    fetch: YandexFetchObservation
    resolution: RimUrlResolution


def is_yandex_market_host(host: str) -> bool:
    return host.lower().removeprefix("www.") in YANDEX_HOSTS


def yandex_product_id(url: str) -> str | None:
    segments = [segment for segment in urlsplit(url).path.split("/") if segment]
    for segment in reversed(segments):
        if _PRODUCT_ID_RE.fullmatch(segment):
            return segment
    return None


def _id_in_text(product_id: str, value: str) -> bool:
    return bool(re.search(_ID_BOUNDARY_RE_TEMPLATE.format(product_id=re.escape(product_id)), value))


def _offer_urls(product: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    offers = product.get("offers")
    values = offers if isinstance(offers, list) else ([] if offers is None else [offers])
    for offer in values:
        if isinstance(offer, dict) and isinstance(offer.get("url"), str):
            urls.append(offer["url"])
        elif isinstance(offer, str):
            urls.append(offer)
    return urls


def _anchor_texts(product: dict[str, Any]) -> list[str]:
    texts: list[str] = []
    for key in ("url", "sameAs"):
        value = product.get(key)
        if isinstance(value, str):
            texts.append(value)
        elif isinstance(value, list):
            texts.extend(item for item in value if isinstance(item, str))
    texts.extend(_offer_urls(product))
    return texts


def product_anchored_by_id(product: dict[str, Any], product_id: str) -> bool:
    """SKU alone is not an anchor; the requested ID must appear in a product/offer URL."""
    return any(_id_in_text(product_id, text) for text in _anchor_texts(product))


def _yandex_redirect_allowed(product_id: str, _current_url: str, next_url: str) -> bool:
    if is_captcha_url(next_url):
        return False
    host = (urlsplit(next_url).hostname or "").lower().removeprefix("www.")
    if host not in YANDEX_HOSTS:
        return False
    return product_id in urlsplit(next_url).path.split("/")


def _empty_resolution(requested_url: str, final_url: str) -> RimUrlResolution:
    return RimUrlResolution(
        requested_url=requested_url,
        final_url=final_url,
        values={},
        candidates=(),
        conflicts=(),
        source_fingerprint=rim_source_fingerprint(final_url),
    )


def _document_reason(document: FetchedDocument) -> str | None:
    if is_captcha_url(document.final_url) or document.status in {401, 403, 429}:
        return "rim_source_challenge"
    if document.status in {301, 302, 303, 307, 308}:
        return (
            "rim_source_challenge"
            if is_captcha_url(document.final_url)
            else "rim_source_empty_document"
        )
    return unusable_document_reason(
        final_url=document.final_url,
        status=document.status,
        body=document.body,
        text=document.text,
        content_type=document.content_type,
    )


def _challenge_status(document: FetchedDocument) -> bool:
    return is_captcha_url(document.final_url) or document.status in {401, 403, 429}


def _is_useful(document: FetchedDocument) -> bool:
    return (
        _document_reason(document) is None and 200 <= document.status < 300 and bool(document.text)
    )


def extract_yandex_document(
    html: str, *, page_url: str, product_id: str
) -> tuple[ExtractedPage, bool]:
    products = json_ld_product_nodes(html)
    anchored = [product for product in products if product_anchored_by_id(product, product_id)]
    if len(anchored) != 1:
        return extract_rim_document("<html></html>", page_url=page_url), False

    product = anchored[0]
    variants = product.get("hasVariant")
    variant_items = (
        variants if isinstance(variants, list) else ([] if variants is None else [variants])
    )
    anchored_variants = [
        item
        for item in variant_items
        if isinstance(item, dict) and product_anchored_by_id(item, product_id)
    ]
    if len(anchored_variants) > 1:
        isolated = {
            "@type": "ProductGroup",
            "brand": product.get("brand"),
            "model": product.get("model"),
            "hasVariant": [
                {
                    "@type": "Product",
                    "sku": item.get("sku"),
                    "name": item.get("name"),
                    "description": item.get("description"),
                    "url": item.get("url"),
                    "brand": item.get("brand") or product.get("brand"),
                }
                for item in anchored_variants
            ],
        }
        html_isolated = (
            '<script type="application/ld+json">'
            + json.dumps(isolated, ensure_ascii=False)
            + "</script>"
        )
        return extract_rim_document(html_isolated, page_url=page_url), True

    isolated = {
        "@type": "Product",
        "name": product.get("name"),
        "description": product.get("description"),
        "brand": product.get("brand"),
        "url": product.get("url"),
    }
    html_isolated = (
        '<script type="application/ld+json">'
        + json.dumps(isolated, ensure_ascii=False)
        + "</script>"
    )
    return extract_rim_document(html_isolated, page_url=page_url), True


def _observation(
    document: FetchedDocument,
    *,
    useful: bool,
    anchored: bool,
    secondary: bool,
    reason_code: str | None,
) -> YandexFetchObservation:
    return YandexFetchObservation(
        status_code=document.status,
        content_type=document.content_type or None,
        response_size=len(document.body),
        redirect_count=document.redirect_count,
        useful_document=useful,
        current_product_anchored=anchored,
        body_truncated_at_limit=document.body_truncated,
        secondary_request_used=secondary,
        reason_code=reason_code,
    )


async def _fetch_card(
    url: str,
    *,
    product_id: str,
    policy: PublicHttpsPolicy,
    limits: FetchLimits,
    headers: dict[str, str],
) -> FetchedDocument:
    return await fetch_public_document(
        url,
        policy=policy,
        limits=limits,
        headers=headers,
        redirect_allowed=lambda current, nxt: _yandex_redirect_allowed(product_id, current, nxt),
    )


async def resolve_yandex_product_url_with_diagnostics(
    url: str,
    *,
    policy: PublicHttpsPolicy | None = None,
    limits: FetchLimits | None = None,
) -> YandexAdapterResult:
    limits = limits or FetchLimits()
    policy = policy or PublicHttpsPolicy()
    requested = validate_product_url(url, policy)
    product_id = yandex_product_id(requested)
    if product_id is None:
        empty = _empty_resolution(url, requested)
        return YandexAdapterResult(
            fetch=YandexFetchObservation(
                status_code=None,
                content_type=None,
                response_size=None,
                redirect_count=0,
                useful_document=False,
                current_product_anchored=False,
                body_truncated_at_limit=False,
                secondary_request_used=False,
                reason_code="rim_source_empty_document",
            ),
            resolution=empty,
        )

    document = await _fetch_card(
        requested,
        product_id=product_id,
        policy=policy,
        limits=limits,
        headers=YANDEX_REQUEST_HEADERS,
    )
    secondary = False
    if not _is_useful(document):
        document = await _fetch_card(
            requested,
            product_id=product_id,
            policy=policy,
            limits=limits,
            headers=YANDEX_RETRY_HEADERS,
        )
        secondary = True

    reason = (
        None
        if _is_useful(document)
        else (
            "rim_source_challenge"
            if _challenge_status(document) or is_captcha_url(document.final_url)
            else "rim_source_empty_document"
        )
    )
    if reason:
        logger.warning(
            "yandex_market_adapter_empty reason_code=%s product_id=%s",
            reason,
            product_id,
        )
        return YandexAdapterResult(
            fetch=_observation(
                document,
                useful=False,
                anchored=False,
                secondary=secondary,
                reason_code=reason,
            ),
            resolution=_empty_resolution(url, document.final_url or requested),
        )

    extracted, anchored = extract_yandex_document(
        document.text, page_url=document.final_url, product_id=product_id
    )
    resolution = _resolve_document(url, document.final_url, extracted)
    if not anchored:
        resolution = _empty_resolution(url, document.final_url)
    return YandexAdapterResult(
        fetch=_observation(
            document,
            useful=True,
            anchored=anchored,
            secondary=secondary,
            reason_code=None,
        ),
        resolution=resolution,
    )


async def resolve_yandex_product_url(
    url: str,
    *,
    policy: PublicHttpsPolicy | None = None,
    limits: FetchLimits | None = None,
) -> RimUrlResolution:
    result = await resolve_yandex_product_url_with_diagnostics(url, policy=policy, limits=limits)
    if not result.fetch.useful_document:
        reason = result.fetch.reason_code or "rim_source_empty_document"
        message = (
            "Yandex product page returned a challenge document"
            if reason == "rim_source_challenge"
            else "Yandex product page did not contain a useful document"
        )
        raise RimUrlError(message, reason_code=reason)
    return result.resolution
