import pytest

from src.rim_url_resolver import (
    RimUrlSecurityError,
    UrlAllowlistPolicy,
    extract_product_page,
    validate_product_url,
)


def test_product_url_policy_requires_approved_https_host() -> None:
    policy = UrlAllowlistPolicy.from_values(allowed_host_suffixes={"shop.example"})

    assert validate_product_url("https://wheels.shop.example/item?a=1", policy).startswith(
        "https://wheels.shop.example/"
    )
    with pytest.raises(RimUrlSecurityError):
        validate_product_url("http://wheels.shop.example/item", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_product_url("https://wheels.evil.example/item", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_product_url("https://127.0.0.1/item", policy)


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
