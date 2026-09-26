import asyncio
import io
from types import SimpleNamespace

import pytest
from aiohttp import StreamReader
from PIL import Image

from src import rim_url_resolver
from src.rim_url_extract import extract_rim_document
from src.rim_url_resolver import (
    PublicHttpsPolicy,
    RimUrlSecurityError,
    _resolve_document,
    extract_product_page,
    fetch_public_rim_image,
    validate_product_url,
)
from src.vision.image_normalization import normalize_image


def _fragmented_stream(data: bytes, split: int) -> StreamReader:
    loop = asyncio.get_running_loop()
    reader = StreamReader(SimpleNamespace(_reading_paused=False), 65536, loop=loop)
    reader.feed_data(data[:split])

    def finish() -> None:
        reader.feed_data(data[split:])
        reader.feed_eof()

    loop.call_later(0.001, finish)
    return reader


@pytest.mark.parametrize("media_type", ["image/jpeg", "text/html"])
def test_fetcher_consumes_fragmented_product_and_image_responses(monkeypatch, media_type) -> None:
    image_buffer = io.BytesIO()
    Image.new("RGB", (1000, 1000), "gray").save(image_buffer, format="JPEG")
    image_bytes = image_buffer.getvalue()
    html = (
        "<html>"
        + " " * 8192
        + '<script type="application/ld+json">'
        + '{"@type":"Product","brand":"BBS","model":"CH-R","image":"/wheel.jpg"}'
        + "</script></html>"
    ).encode()
    data = image_bytes if media_type.startswith("image/") else html

    class Response:
        status = 200
        headers = None
        content_type = media_type
        content_length = None
        charset = "utf-8"

        async def __aenter__(self):
            self.content = _fragmented_stream(data, 4096)
            return self

        async def __aexit__(self, *args):
            pass

    class Session:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        def get(self, *args, **kwargs):
            return Response()

    monkeypatch.setattr(rim_url_resolver.aiohttp, "TCPConnector", lambda **kwargs: None)
    monkeypatch.setattr(rim_url_resolver.aiohttp, "ClientSession", Session)

    async def check() -> None:
        if media_type.startswith("image/"):
            result = await fetch_public_rim_image("https://shop.example/wheel.jpg")
            assert result.data == image_bytes
            normalized = normalize_image(result.data, max_image_edge=1600, max_pixels=40000000)
            assert (normalized.width, normalized.height) == (1000, 1000)
        else:
            result = await rim_url_resolver.resolve_rim_product_url("https://shop.example/product")
            assert result.values["model"] == "CH-R"
            assert result.image_urls == ("https://shop.example/wheel.jpg",)

    asyncio.run(check())


@pytest.mark.parametrize("data,limit", [(b"", 8), (b"12345678", 8), (b"123456789abcdef", 8)])
def test_bounded_reader_preserves_empty_exact_limit_and_oversize_detection(data, limit) -> None:
    async def check() -> None:
        result = await rim_url_resolver._read_bounded_body(_fragmented_stream(data, 2), limit)
        assert result == data[: limit + 1]

    asyncio.run(check())


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


def test_product_image_is_extracted_from_product_metadata() -> None:
    document = extract_rim_document(
        """
        <meta property="og:image" content="/media/wheel.webp">
        <script type="application/ld+json">
          {"@type":"Product","brand":"BBS","model":"CH-R",
           "image":[{"url":"https://cdn.example.test/chr.png"}]}
        </script>
        """
    )

    assert document.image_urls == ("https://cdn.example.test/chr.png", "/media/wheel.webp")


def test_product_image_fetch_rejects_non_public_or_non_https_urls_before_network() -> None:
    with pytest.raises(RimUrlSecurityError):
        asyncio.run(fetch_public_rim_image("http://127.0.0.1/wheel.png"))
