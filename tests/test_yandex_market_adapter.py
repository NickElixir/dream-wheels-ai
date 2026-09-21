from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from src.rim_url_resolver import (
    FetchLimits,
    PublicHttpsPolicy,
    RimUrlError,
    RimUrlSecurityError,
    resolve_rim_product_url,
)
from src.yandex_market_adapter import (
    YANDEX_REQUEST_HEADERS,
    extract_yandex_document,
    is_yandex_market_host,
    product_anchored_by_id,
    resolve_yandex_product_url,
    resolve_yandex_product_url_with_diagnostics,
    yandex_product_id,
)

_RESULTS_AFTER = (
    Path(__file__).resolve().parents[1] / "analysis" / "marketplace_parser" / "results_after.json"
)


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
        self.created_with: dict[str, object] = {}

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

    def factory(*_args: object, **kwargs: object) -> _FakeSession:
        session.created_with = kwargs
        return session

    monkeypatch.setattr("src.rim_url_resolver.aiohttp.ClientSession", factory)
    return session


def _card_url(product_id: str = "5882809305") -> str:
    return (
        "https://business.market.yandex.ru/card/"
        f"ganz-disk-shtampovannyy-r15-6j-4x108651-et27-silver-grn15046/{product_id}"
    )


def _anchored_html(
    product_id: str,
    *,
    name: str = "GANZ 6Jx15 4x108 ET27 DIA65.1",
    extra_products: list[dict] | None = None,
) -> bytes:
    products = [
        {
            "@type": "Product",
            "url": f"https://market.yandex.ru/card/current/{product_id}",
            "brand": {"name": "GANZ"},
            "name": name,
            "description": name,
        }
    ]
    products.extend(extra_products or [])
    blocks = "".join(
        f'<script type="application/ld+json">{json.dumps(item, ensure_ascii=False)}</script>'
        for item in products
    )
    return f"<!DOCTYPE html><html><head>{blocks}</head><body>card</body></html>".encode()


def test_yandex_host_and_product_id_detection() -> None:
    assert is_yandex_market_host("business.market.yandex.ru")
    assert is_yandex_market_host("market.yandex.ru")
    assert not is_yandex_market_host("shop.example")
    assert yandex_product_id(_card_url()) == "5882809305"
    assert yandex_product_id("https://market.yandex.ru/card/no-id") is None


def test_sku_alone_is_not_an_anchor() -> None:
    product = {"@type": "Product", "sku": "5882809305", "name": "6Jx15 4x108 ET27 DIA65.1"}
    assert product_anchored_by_id(product, "5882809305") is False
    product["url"] = "https://market.yandex.ru/card/x/5882809305"
    assert product_anchored_by_id(product, "5882809305") is True


def test_id_anchored_name_extracts_marking() -> None:
    html = _anchored_html("5882809305").decode()
    extracted, anchored = extract_yandex_document(
        html, page_url=_card_url(), product_id="5882809305"
    )
    assert anchored is True
    values = {item.field: item.value for item in extracted.candidates}
    assert values["wheel_width_j"] == 6.0
    assert values["wheel_diameter_in"] == 15.0
    assert values["bolt_count"] == 4
    assert values["pcd_mm"] == 108.0
    assert values["offset_et_mm"] == 27.0
    assert values["center_bore_mm"] == 65.1


def test_recommendation_product_is_ignored() -> None:
    extra = [
        {
            "@type": "Product",
            "url": "https://market.yandex.ru/card/other/999",
            "name": "Related 8Jx19 5x114.3 ET40 DIA67.1",
        }
    ]
    html = _anchored_html("5882809305", extra_products=extra).decode()
    extracted, anchored = extract_yandex_document(
        html, page_url=_card_url(), product_id="5882809305"
    )
    assert anchored is True
    values = {item.field: item.value for item in extracted.candidates}
    assert values["pcd_mm"] == 108.0
    assert values["wheel_diameter_in"] == 15.0
    assert 114.3 not in values.values()
    assert 19.0 not in values.values()


def test_conflicting_anchors_yield_no_critical_values() -> None:
    extra = [
        {
            "@type": "Product",
            "url": "https://market.yandex.ru/offer/5882809305",
            "name": "Other 8Jx19 5x114.3 ET40 DIA67.1",
        }
    ]
    html = _anchored_html("5882809305", extra_products=extra).decode()
    extracted, anchored = extract_yandex_document(
        html, page_url=_card_url(), product_id="5882809305"
    )
    assert anchored is False
    assert not any(
        item.field in {"pcd_mm", "offset_et_mm", "wheel_diameter_in"}
        for item in extracted.candidates
    )


def test_width_by_diameter_is_not_interpreted_as_pcd() -> None:
    html = _anchored_html("5882809305", name="GANZ 6Jx15 ET27 DIA65.1").decode()
    extracted, anchored = extract_yandex_document(
        html, page_url=_card_url(), product_id="5882809305"
    )
    assert anchored is True
    values = {item.field: item.value for item in extracted.candidates}
    assert "pcd_mm" not in values
    assert values["wheel_width_j"] == 6.0
    assert values["wheel_diameter_in"] == 15.0


def test_empty_shell_retries_same_url_then_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _patch_session(
        monkeypatch,
        [_FakeResponse(body=b"<!DOCTYPE html>"), _FakeResponse(body=b"<!DOCTYPE html>")],
    )
    with pytest.raises(RimUrlError) as error:
        asyncio.run(resolve_yandex_product_url(_card_url()))
    assert error.value.reason_code == "rim_source_empty_document"
    assert [url for url, _ in session.calls] == [_card_url(), _card_url()]
    headers = session.created_with.get("headers")
    assert headers is not None


def test_captcha_redirect_is_not_followed(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _patch_session(
        monkeypatch,
        [
            _FakeResponse(status=302, headers={"Location": "/showcaptcha?cc=1"}),
            _FakeResponse(status=302, headers={"Location": "/showcaptcha?cc=1"}),
        ],
    )
    result = asyncio.run(resolve_yandex_product_url_with_diagnostics(_card_url()))
    assert result.fetch.useful_document is False
    assert result.fetch.reason_code == "rim_source_challenge"
    assert result.fetch.secondary_request_used is True
    assert result.resolution.values == {}
    assert all("showcaptcha" not in url for url, _ in session.calls)
    assert [url for url, _ in session.calls] == [_card_url(), _card_url()]


def test_request_profile_uses_fixed_browser_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    html = _anchored_html("5882809305")
    session = _patch_session(monkeypatch, [_FakeResponse(body=html)])
    asyncio.run(resolve_yandex_product_url(_card_url()))
    assert session.created_with["headers"] == YANDEX_REQUEST_HEADERS
    assert session.created_with["trust_env"] is False


def test_yandex_host_uses_adapter_not_generic_extract(monkeypatch: pytest.MonkeyPatch) -> None:
    html = _anchored_html("5882809305")
    _patch_session(monkeypatch, [_FakeResponse(body=html)])
    resolution = asyncio.run(resolve_rim_product_url(_card_url()))
    assert resolution.values["pcd_mm"] == 108.0
    assert resolution.values["offset_et_mm"] == 27.0


def test_missing_product_id_is_empty_document() -> None:
    with pytest.raises(RimUrlError) as error:
        asyncio.run(resolve_yandex_product_url("https://market.yandex.ru/card/no-id"))
    assert error.value.reason_code == "rim_source_empty_document"


def test_adapter_rejects_ssrf_urls() -> None:
    policy = PublicHttpsPolicy()
    with pytest.raises(RimUrlSecurityError):
        asyncio.run(
            resolve_yandex_product_url(
                "https://127.0.0.1/card/x/5882809305",
                policy=policy,
                limits=FetchLimits(total_timeout_seconds=1),
            )
        )
    with pytest.raises(RimUrlSecurityError):
        asyncio.run(resolve_yandex_product_url("https://user:pass@market.yandex.ru/card/x/1"))
    with pytest.raises(RimUrlSecurityError):
        asyncio.run(resolve_yandex_product_url("https://market.yandex.ru:8443/card/x/1"))


def test_frozen_results_after_have_zero_critical_false_data() -> None:
    payload = json.loads(_RESULTS_AFTER.read_text(encoding="utf-8"))
    assert payload["metrics"]["critical_false_data_count"] == 0
    useful = [item for item in payload["observations"] if item["fetch"]["useful_document"]]
    assert len(useful) == 10
    for item in payload["observations"]:
        assert item["comparison"]["critical_false_data_count"] == 0
        html = _replay_html(item)
        extracted, anchored = extract_yandex_document(
            html,
            page_url=item["requested_url"],
            product_id=yandex_product_id(item["requested_url"]) or "",
        )
        values = {candidate.field: candidate.value for candidate in extracted.candidates}
        if item["ground_truth"].get("diameter") != 19:
            assert values.get("wheel_diameter_in") != 19.0
        if not item["fetch"]["useful_document"]:
            assert anchored is False
            continue
        assert anchored is True


def _replay_html(observation: dict) -> str:
    product_id = yandex_product_id(observation["requested_url"]) or "0"
    if not observation["fetch"]["useful_document"]:
        return "<!DOCTYPE html>"
    name = observation["ground_truth"]["title"]
    current = {
        "@type": "Product",
        "url": observation["requested_url"],
        "brand": {"name": observation["ground_truth"].get("brand")},
        "name": name,
        "description": name,
    }
    related = {
        "@type": "Product",
        "url": "https://market.yandex.ru/card/related/999",
        "name": "Related 8Jx19 5x114.3 ET40 DIA67.1",
    }
    return (
        "<!DOCTYPE html><html><head>"
        f'<script type="application/ld+json">{json.dumps(current, ensure_ascii=False)}</script>'
        f'<script type="application/ld+json">{json.dumps(related, ensure_ascii=False)}</script>'
        "</head><body>card "
        f"{product_id}</body></html>"
    )
