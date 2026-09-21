from __future__ import annotations

import asyncio

import pytest

from src.rim_url_extract import extract_rim_document
from src.rim_url_resolver import (
    FetchLimits,
    PublicHttpsPolicy,
    RimUrlError,
    RimUrlSecurityError,
    _resolve_document,
    detect_rim_source_host,
    extract_product_page,
    is_captcha_url,
    resolve_rim_product_url,
    unusable_document_reason,
    validate_product_url,
)


def _technical(values: dict) -> dict:
    return {
        key: values[key]
        for key in (
            "bolt_count",
            "pcd_mm",
            "center_bore_mm",
            "wheel_diameter_in",
            "wheel_width_j",
            "offset_et_mm",
        )
        if key in values
    }


class _FakeContent:
    def __init__(self, body: bytes) -> None:
        self._body = body

    async def read(self, n: int = -1) -> bytes:
        return self._body if n < 0 else self._body[:n]


class _FakeResponse:
    def __init__(
        self,
        *,
        status: int = 200,
        headers: dict[str, str] | None = None,
        body: bytes = b"",
        content_type: str = "text/html",
        charset: str = "utf-8",
    ) -> None:
        self.status = status
        self.headers = headers or {}
        self.content_type = content_type
        self.charset = charset
        self.content = _FakeContent(body)

    async def __aenter__(self) -> _FakeResponse:
        return self

    async def __aexit__(self, *_args: object) -> bool:
        return False


class _FakeSession:
    def __init__(self, responses: list[object]) -> None:
        self._responses = list(responses)
        self.calls: list[tuple[str, dict[str, object]]] = []

    async def __aenter__(self) -> _FakeSession:
        return self

    async def __aexit__(self, *_args: object) -> bool:
        return False

    def get(self, url: str, **kwargs: object) -> _FakeResponse:
        self.calls.append((url, kwargs))
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        assert isinstance(response, _FakeResponse)
        return response


def _patch_session(monkeypatch: pytest.MonkeyPatch, responses: list[object]) -> _FakeSession:
    session = _FakeSession(responses)
    monkeypatch.setattr(
        "src.rim_url_resolver.aiohttp.ClientSession",
        lambda *args, **kwargs: session,
    )
    return session


def test_product_url_policy_accepts_any_public_hostname_but_not_unsafe_urls() -> None:
    policy = PublicHttpsPolicy()

    assert validate_product_url("https://rimzona.ru/diski/item?a=1", policy).startswith(
        "https://rimzona.ru/"
    )
    with pytest.raises(RimUrlSecurityError):
        validate_product_url("http://rimzona.ru/item", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_product_url("https://rimzona.ru:8443/item", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_product_url("https://127.0.0.1/item", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_product_url("https://user:password@rimzona.ru/item", policy)


def test_extractor_prefers_structured_product_data_and_reports_alternatives() -> None:
    html = """
    <script type="application/ld+json">
      {"@type":"Product","brand":{"name":"BBS"},"model":"CH-R",
       "sku":"chr 01","description":"8.5Jx19 5x112 ET35 DIA 66.6"}
    </script>
    <meta property="og:title" content="BBS CH-R II">
    <p>Size: 8.5Jx19; 5x112; ET35; DIA 66.6</p>
    """

    candidates = extract_product_page(html)
    values = {(candidate.field, candidate.value) for candidate in candidates}

    assert ("brand", "BBS") in values
    assert ("sku", "CHR-01") in values
    assert ("bolt_count", 5) in values
    assert ("pcd_mm", 112.0) in values
    assert ("offset_et_mm", 35.0) in values


def test_extractor_does_not_use_marketing_product_title_as_model() -> None:
    html = """
    <script type="application/ld+json">
      {"@type":"Product","brand":"В стиле BMW",
       "name":"Литые FlowForming диски В стиле BMW 826 STYLE R18 8J 5x112 ET30 dia 66.6 купить в Москве",
       "sku":"761476"}
    </script>
    <meta property="og:title" content="Литые FlowForming диски В стиле BMW 826 STYLE R18 8J 5x112 ET30 dia 66.6">
    """

    candidates = extract_product_page(html)

    assert not [candidate for candidate in candidates if candidate.field == "model"]
    assert ("sku", "761476") in {(candidate.field, candidate.value) for candidate in candidates}


def test_product_group_requires_explicit_variant_selection() -> None:
    document = extract_rim_document(
        """
        <script type="application/ld+json">
        {
          "@type": "ProductGroup",
          "brand": {"name": "Example"},
          "model": "Road",
          "hasVariant": [
            {"@type": "Product", "sku": "ROAD-17", "description": "7Jx17 ET40 5x112 DIA 66.6"},
            {"@type": "Product", "sku": "ROAD-18", "description": "8Jx18 ET35 5x112 DIA 66.6"}
          ]
        }
        </script>
        """
    )

    resolution = _resolve_document(
        "https://shop.example/road", "https://shop.example/road", document
    )

    assert resolution.selection_required is True
    assert resolution.values == {"brand": "Example", "model": "Road"}
    assert {variant.sku for variant in resolution.variants} == {"ROAD-17", "ROAD-18"}
    assert resolution.selected_variant_sku is None
    assert next(variant for variant in resolution.variants if variant.sku == "ROAD-18").values == {
        "brand": "Example",
        "model": "Road",
        "sku": "ROAD-18",
        "bolt_count": 5,
        "pcd_mm": 112.0,
        "center_bore_mm": 66.6,
        "wheel_diameter_in": 18.0,
        "wheel_width_j": 8.0,
        "offset_et_mm": 35.0,
    }


def test_incomplete_labelled_specification_stays_incomplete() -> None:
    document = extract_rim_document(
        """
        <main itemscope itemtype="https://schema.org/Product">
          <div><span>Диаметр</span><span>15</span></div>
          <div><span>Крепёж (PCD)</span><span>4x100</span></div>
          <div><span>Вылет, мм</span><span>35</span></div>
        </main>
        """
    )

    resolution = _resolve_document("https://shop.example/rim", "https://shop.example/rim", document)

    assert resolution.values["wheel_diameter_in"] == 15.0
    assert "wheel_width_j" not in resolution.values
    assert "center_bore_mm" not in resolution.values


def test_two_json_ld_products_do_not_take_first_match_technical_fields() -> None:
    html = """
    <script type="application/ld+json">
      {"@type":"Product","name":"Current","url":"https://shop.example/current",
       "description":"8.5Jx19 5x112 ET35 DIA66.6"}
    </script>
    <script type="application/ld+json">
      {"@type":"Product","name":"Related","url":"https://shop.example/related",
       "description":"7Jx17 5x114.3 ET40 DIA67.1"}
    </script>
    """
    document = extract_rim_document(html, page_url="https://shop.example/unknown")
    resolution = _resolve_document(
        "https://shop.example/unknown", "https://shop.example/unknown", document
    )
    assert _technical(resolution.values) == {}
    assert document.identity_proven is False


def test_related_only_markings_do_not_fill_current_product() -> None:
    html = """
    <script type="application/ld+json">
      {"@type":"Product","name":"Current wheel","url":"https://shop.example/current","sku":"CUR-1"}
    </script>
    <script type="application/ld+json">
      {"@type":"Product","name":"Related","url":"https://shop.example/related",
       "description":"7Jx17 5x114.3 ET40 DIA67.1"}
    </script>
    """
    document = extract_rim_document(html, page_url="https://shop.example/current")
    resolution = _resolve_document(
        "https://shop.example/current", "https://shop.example/current", document
    )
    assert _technical(resolution.values) == {}


def test_whole_document_visible_text_is_not_a_pcd_source() -> None:
    html = """
    <p>Recommendations: 7Jx17 5x114.3 ET40 DIA67.1</p>
    """
    document = extract_rim_document(html, page_url="https://shop.example/rim")
    resolution = _resolve_document("https://shop.example/rim", "https://shop.example/rim", document)
    assert _technical(resolution.values) == {}


def test_single_json_ld_product_still_extracts_ordinary_store_markings() -> None:
    html = """
    <script type="application/ld+json">
      {"@type":"Product","brand":{"name":"BBS"},"model":"CH-R",
       "sku":"chr 01","description":"8.5Jx19 5x112 ET35 DIA 66.6"}
    </script>
    """
    document = extract_rim_document(html, page_url="https://shop.example/bbs")
    resolution = _resolve_document("https://shop.example/bbs", "https://shop.example/bbs", document)
    assert resolution.values["brand"] == "BBS"
    assert resolution.values["wheel_diameter_in"] == 19.0
    assert resolution.values["offset_et_mm"] == 35.0


def test_host_detector_classifies_marketplace_hosts() -> None:
    assert detect_rim_source_host("https://www.wildberries.ru/catalog/1") == "wildberries"
    assert detect_rim_source_host("https://www.ozon.ru/product/1") == "ozon"
    assert detect_rim_source_host("https://ozon.by/product/1") == "ozon"
    assert detect_rim_source_host("https://market.yandex.ru/card/x/1") == "yandex"
    assert detect_rim_source_host("https://business.market.yandex.ru/card/x/1") == "yandex"
    assert detect_rim_source_host("https://shop.example/rim") == "generic"


def test_captcha_path_and_empty_shell_are_unusable() -> None:
    assert is_captcha_url("https://market.yandex.ru/showcaptcha?cc=1")
    assert (
        unusable_document_reason(
            final_url="https://shop.example/rim",
            status=200,
            body=b"<!DOCTYPE html>",
            text="<!DOCTYPE html>",
            content_type="text/html",
        )
        == "rim_source_empty_document"
    )
    ozon_html = "<html><body>Доступ ограничен. Похоже, нет соединения.</body></html>"
    assert (
        unusable_document_reason(
            final_url="https://shop.example/rim",
            status=403,
            body=ozon_html.encode(),
            text=ozon_html,
            content_type="text/html",
        )
        == "rim_source_challenge"
    )


def test_wildberries_host_fail_closed_without_extract(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _patch_session(monkeypatch, [])
    with pytest.raises(RimUrlError, match="challenge") as error:
        asyncio.run(resolve_rim_product_url("https://www.wildberries.ru/catalog/123/detail.aspx"))
    assert error.value.reason_code == "rim_source_challenge"
    assert session.calls == []


def test_ozon_host_fail_closed_without_extract(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _patch_session(monkeypatch, [])
    with pytest.raises(RimUrlError) as error:
        asyncio.run(resolve_rim_product_url("https://www.ozon.ru/product/wheel-1"))
    assert error.value.reason_code == "rim_source_challenge"
    assert session.calls == []


def test_empty_shell_is_empty_document_not_success(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_session(
        monkeypatch,
        [_FakeResponse(body=b"<!DOCTYPE html>")],
    )
    with pytest.raises(RimUrlError) as error:
        asyncio.run(resolve_rim_product_url("https://shop.example/rim"))
    assert error.value.reason_code == "rim_source_empty_document"


def test_captcha_redirect_is_not_followed(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _patch_session(
        monkeypatch,
        [_FakeResponse(status=302, headers={"Location": "/showcaptcha?cc=1"})],
    )
    with pytest.raises(RimUrlError) as error:
        asyncio.run(resolve_rim_product_url("https://shop.example/rim"))
    assert error.value.reason_code == "rim_source_challenge"
    assert [url for url, _kwargs in session.calls] == ["https://shop.example/rim"]


def test_ozon_like_403_html_is_challenge(monkeypatch: pytest.MonkeyPatch) -> None:
    body = "<html><body>Доступ ограничен. captcha</body></html>".encode()
    _patch_session(monkeypatch, [_FakeResponse(status=403, body=body)])
    with pytest.raises(RimUrlError) as error:
        asyncio.run(resolve_rim_product_url("https://shop.example/rim"))
    assert error.value.reason_code == "rim_source_challenge"


def test_ordinary_store_json_ld_still_resolves_after_quality_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    html = b"""<!DOCTYPE html><html><head>
    <script type="application/ld+json">
      {"@type":"Product","brand":{"name":"BBS"},"model":"CH-R",
       "sku":"chr 01","description":"8.5Jx19 5x112 ET35 DIA 66.6"}
    </script></head><body><h1>BBS CH-R</h1></body></html>"""
    _patch_session(monkeypatch, [_FakeResponse(body=html)])
    resolution = asyncio.run(resolve_rim_product_url("https://shop.example/bbs"))
    assert resolution.values["brand"] == "BBS"
    assert resolution.values["pcd_mm"] == 112.0


def test_resolver_fetch_still_rejects_non_public_urls() -> None:
    with pytest.raises(RimUrlSecurityError):
        asyncio.run(
            resolve_rim_product_url(
                "https://127.0.0.1/rim",
                policy=PublicHttpsPolicy(),
                limits=FetchLimits(max_redirects=1, total_timeout_seconds=1),
            )
        )
