import pytest

from src.rim_url_extract import extract_rim_document
from src.rim_url_resolver import (
    PublicHttpsPolicy,
    RimUrlSecurityError,
    _resolve_document,
    extract_product_page,
    validate_product_url,
)


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
