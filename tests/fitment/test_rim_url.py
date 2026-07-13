import asyncio
import socket
from typing import ClassVar
from unittest.mock import patch

import pytest

from src.fitment.identification.rim_url import RimProductUrlResolver
from src.fitment.identification.rim_url_extract import extract_rim_product
from src.fitment.identification.rim_url_fetch import (
    FetchedPage,
    FetchLimits,
    PublicAddressResolver,
    RimUrlFetchError,
    RimUrlSecurityError,
    UrlAllowlistPolicy,
    fetch_product_page,
    redact_url_for_log,
    validate_url,
)


def test_url_policy_rejects_ssrf_inputs_and_normalizes_idna() -> None:
    policy = UrlAllowlistPolicy.from_values(
        allowed_hosts={"xn--e1afmkfd.xn--p1ai"},
        allowed_ports={443},
    )

    assert validate_url("https://пример.рф/wheel?q=1#part", policy) == (
        "https://xn--e1afmkfd.xn--p1ai/wheel?q=1"
    )
    with pytest.raises(RimUrlSecurityError):
        validate_url("http://пример.рф/wheel", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_url("https://user:secret@пример.рф/wheel", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_url("https://пример.рф:8443/wheel", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_url("https://127.0.0.1/wheel", UrlAllowlistPolicy())
    with pytest.raises(RimUrlSecurityError):
        validate_url("https://[::1]/wheel", UrlAllowlistPolicy())
    with pytest.raises(RimUrlSecurityError):
        validate_url("https://public.example/wheel", UrlAllowlistPolicy())


def test_allowlist_suffix_requires_dns_label_boundary() -> None:
    policy = UrlAllowlistPolicy.from_values(allowed_host_suffixes={"shop.example"})

    assert validate_url("https://wheels.shop.example/item", policy)
    with pytest.raises(RimUrlSecurityError):
        validate_url("https://evilshop.example/item", policy)


def test_log_url_has_no_query_or_fragment() -> None:
    assert redact_url_for_log("https://shop.example/wheel?token=secret#x") == (
        "https://shop.example/wheel"
    )


def test_custom_resolver_rejects_any_private_dns_answer() -> None:
    class FakeLoop:
        async def getaddrinfo(self, *args, **kwargs):
            return [
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.8", 443)),
            ]

    resolver = PublicAddressResolver(UrlAllowlistPolicy(allow_all_public=True))

    async def run() -> None:
        with patch(
            "src.fitment.identification.rim_url_fetch.asyncio.get_running_loop",
            return_value=FakeLoop(),
        ):
            with pytest.raises(OSError, match="non-public"):
                await resolver.resolve("shop.example", 443)

    asyncio.run(run())


class _FakeContent:
    def __init__(self, chunks: list[bytes]) -> None:
        self._chunks = chunks

    async def iter_chunked(self, chunk_size: int):
        del chunk_size
        for chunk in self._chunks:
            yield chunk


class _FakeResponse:
    def __init__(
        self,
        *,
        status: int = 200,
        headers: dict[str, str] | None = None,
        content_type: str = "text/html",
        chunks: list[bytes] | None = None,
        content_length: int | None = None,
    ) -> None:
        self.status = status
        self.headers = headers or {}
        self.content_type = content_type
        self.content = _FakeContent(chunks or [b"<html></html>"])
        self.content_length = content_length
        self.charset = "utf-8"

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False


class _FakeSession:
    responses: ClassVar[list[_FakeResponse]] = []
    init_kwargs: ClassVar[dict] = {}
    requested_urls: ClassVar[list[str]] = []

    def __init__(self, **kwargs) -> None:
        type(self).init_kwargs = kwargs
        self._responses = iter(type(self).responses)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    def get(self, url: str, **kwargs):
        del kwargs
        type(self).requested_urls.append(url)
        return next(self._responses)


def test_fetch_validates_redirects_and_disables_environment_proxy() -> None:
    _FakeSession.responses = [
        _FakeResponse(status=302, headers={"Location": "https://cdn.shop.example/final"}),
        _FakeResponse(chunks=[b"<html>ok</html>"]),
    ]
    _FakeSession.requested_urls = []
    policy = UrlAllowlistPolicy.from_values(allowed_host_suffixes={"shop.example"})

    page = asyncio.run(
        fetch_product_page(
            "https://shop.example/start?tracking=1",
            policy=policy,
            session_factory=_FakeSession,
        )
    )

    assert page.final_url == "https://cdn.shop.example/final"
    assert _FakeSession.init_kwargs["trust_env"] is False
    assert _FakeSession.init_kwargs["auto_decompress"] is True
    assert _FakeSession.requested_urls == [
        "https://shop.example/start?tracking=1",
        "https://cdn.shop.example/final",
    ]


def test_fetch_rejects_redirect_to_private_ip_and_stream_overflow() -> None:
    _FakeSession.responses = [
        _FakeResponse(status=302, headers={"Location": "https://127.0.0.1/admin"})
    ]
    with pytest.raises(RimUrlSecurityError):
        asyncio.run(
            fetch_product_page(
                "https://shop.example/start",
                policy=UrlAllowlistPolicy(allow_all_public=True),
                session_factory=_FakeSession,
            )
        )

    _FakeSession.responses = [_FakeResponse(chunks=[b"a" * 5, b"b" * 6])]
    with pytest.raises(RimUrlFetchError, match="Decompressed"):
        asyncio.run(
            fetch_product_page(
                "https://shop.example/start",
                policy=UrlAllowlistPolicy.from_values(allowed_hosts={"shop.example"}),
                limits=FetchLimits(max_body_bytes=10),
                session_factory=_FakeSession,
            )
        )


def test_extracts_json_ld_then_opengraph_and_reports_conflicts() -> None:
    html = """
    <html><head>
      <script type="application/ld+json">
        {"@type":"Product","brand":{"name":"  BBS  "},"model":"CH-R",
         "sku":"ch r-01","description":"8.5Jx19 ET35 PCD 5x112 CB 66.6"}
      </script>
      <meta property="og:title" content="BBS CH-R II">
      <meta property="product:sku" content="other 02">
    </head><body>
      <dl><dt>Model:</dt><dd>CH-R III</dd></dl>
      Size: 8.5Jx19; ET35; 5x112; DIA 66.6
    </body></html>
    """
    extracted = extract_rim_product(html)
    assert extracted.candidates[0].value == "BBS"
    assert any(item.field == "pcd_mm" and item.value == 112.0 for item in extracted.candidates)

    async def fake_fetch(url: str, **kwargs) -> FetchedPage:
        del url, kwargs
        return FetchedPage(
            final_url="https://shop.example/final",
            body=html.encode(),
            content_type="text/html",
            charset="utf-8",
        )

    result = asyncio.run(
        RimProductUrlResolver(
            UrlAllowlistPolicy.from_values(allowed_hosts={"shop.example"}),
            fetcher=fake_fetch,
        ).resolve("https://shop.example/item")
    )

    assert result.rim.brand == "BBS"
    assert result.rim.model == "CH-R"
    assert result.rim.sku == "CH-R-01"
    assert result.rim.pcd_mm.value == 112.0
    assert {conflict.field for conflict in result.conflicts} >= {"model", "sku"}
