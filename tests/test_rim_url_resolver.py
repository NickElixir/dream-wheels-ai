import pytest

from src.rim_url_resolver import (
    PublicHttpsPolicy,
    RimUrlSecurityError,
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
