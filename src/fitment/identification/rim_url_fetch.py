"""SSRF-safe HTTPS fetching for rim product pages."""

import asyncio
import ipaddress
import logging
import re
import socket
from collections.abc import Collection
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import SplitResult, urljoin, urlsplit, urlunsplit

import aiohttp
from aiohttp.abc import AbstractResolver

_DNS_LABEL_RE = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")
logger = logging.getLogger(__name__)


class RimUrlSecurityError(ValueError):
    """The requested URL violates the resolver network policy."""


class RimUrlFetchError(RuntimeError):
    """The remote page could not be fetched safely."""


@dataclass(frozen=True, slots=True)
class UrlAllowlistPolicy:
    """Host and port policy applied to the initial URL and every redirect."""

    allowed_hosts: frozenset[str] = field(default_factory=frozenset)
    allowed_host_suffixes: frozenset[str] = field(default_factory=frozenset)
    allowed_ports: frozenset[int] = field(default_factory=lambda: frozenset({443}))
    allow_all_public: bool = False

    def __post_init__(self) -> None:
        hosts = frozenset(normalize_hostname(host) for host in self.allowed_hosts)
        suffixes = frozenset(
            normalize_hostname(suffix.lstrip(".")) for suffix in self.allowed_host_suffixes
        )
        ports = frozenset(self.allowed_ports)
        if any(
            not isinstance(port, int) or isinstance(port, bool) or not 1 <= port <= 65535
            for port in ports
        ):
            raise ValueError("Allowed URL ports must be integers from 1 to 65535")
        object.__setattr__(self, "allowed_hosts", hosts)
        object.__setattr__(self, "allowed_host_suffixes", suffixes)
        object.__setattr__(self, "allowed_ports", ports)

    @classmethod
    def from_values(
        cls,
        *,
        allowed_hosts: Collection[str] = (),
        allowed_host_suffixes: Collection[str] = (),
        allowed_ports: Collection[int] = (443,),
        allow_all_public: bool = False,
    ) -> "UrlAllowlistPolicy":
        return cls(
            allowed_hosts=frozenset(normalize_hostname(host) for host in allowed_hosts),
            allowed_host_suffixes=frozenset(
                normalize_hostname(suffix.lstrip(".")) for suffix in allowed_host_suffixes
            ),
            allowed_ports=frozenset(allowed_ports),
            allow_all_public=allow_all_public,
        )

    def permits(self, host: str, port: int) -> bool:
        if port not in self.allowed_ports:
            return False
        if not self.allowed_hosts and not self.allowed_host_suffixes:
            return self.allow_all_public
        if host in self.allowed_hosts:
            return True
        return any(
            host == suffix or host.endswith(f".{suffix}") for suffix in self.allowed_host_suffixes
        )


@dataclass(frozen=True, slots=True)
class FetchLimits:
    max_redirects: int = 4
    max_body_bytes: int = 2 * 1024 * 1024
    connect_timeout_seconds: float = 5.0
    read_timeout_seconds: float = 10.0
    total_timeout_seconds: float = 15.0
    chunk_size: int = 64 * 1024
    max_retries: int = 2
    retry_backoff_seconds: float = 0.25
    user_agent: str = "DreamWheelsAI-Fitment/1.0"
    allowed_content_types: frozenset[str] = field(
        default_factory=lambda: frozenset(
            {"text/html", "application/xhtml+xml", "application/json"}
        )
    )

    def __post_init__(self) -> None:
        if self.max_retries < 0:
            raise ValueError("Fetch max_retries cannot be negative")
        if self.retry_backoff_seconds < 0:
            raise ValueError("Fetch retry_backoff_seconds cannot be negative")
        if not self.user_agent.strip():
            raise ValueError("Fetch user_agent cannot be empty")


@dataclass(frozen=True, slots=True)
class FetchedPage:
    final_url: str
    body: bytes
    content_type: str
    charset: str | None

    def text(self) -> str:
        encoding = self.charset or "utf-8"
        try:
            return self.body.decode(encoding, errors="replace")
        except LookupError:
            return self.body.decode("utf-8", errors="replace")


def normalize_hostname(host: str) -> str:
    candidate = host.rstrip(".")
    if not candidate or "\x00" in candidate or "%" in candidate:
        raise RimUrlSecurityError("URL host is invalid")
    try:
        normalized = candidate.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise RimUrlSecurityError("URL host is not valid IDNA") from exc
    if _looks_like_ip(normalized):
        return normalized
    labels = normalized.split(".")
    if len(normalized) > 253 or any(not _DNS_LABEL_RE.fullmatch(label) for label in labels):
        raise RimUrlSecurityError("URL host is not a valid DNS name")
    return normalized


def _is_public_address(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address.split("%", 1)[0])
    except ValueError:
        return False
    return not (
        not ip.is_global
        or ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_url(url: str, policy: UrlAllowlistPolicy) -> str:
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as exc:
        raise RimUrlSecurityError("URL is malformed") from exc
    if parsed.scheme.lower() != "https":
        raise RimUrlSecurityError("Only HTTPS product URLs are allowed")
    if parsed.username is not None or parsed.password is not None:
        raise RimUrlSecurityError("URL userinfo is not allowed")
    if not parsed.hostname:
        raise RimUrlSecurityError("URL host is required")

    host = normalize_hostname(parsed.hostname)
    effective_port = port or 443
    if not policy.permits(host, effective_port):
        raise RimUrlSecurityError("URL host or port is not allowed")
    if _looks_like_ip(host) and not _is_public_address(host):
        raise RimUrlSecurityError("URL resolves to a non-public address")

    display_host = f"[{host}]" if ":" in host else host
    netloc = display_host if port is None else f"{display_host}:{port}"
    return urlunsplit(SplitResult("https", netloc, parsed.path or "/", parsed.query, ""))


def redact_url_for_log(url: str) -> str:
    """Remove query and fragment data before a URL is written to logs."""
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def _looks_like_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return False
    return True


class PublicAddressResolver(AbstractResolver):
    """Resolve hostnames while refusing every non-public answer."""

    def __init__(self, policy: UrlAllowlistPolicy) -> None:
        self._policy = policy

    async def resolve(
        self, host: str, port: int = 0, family: int = socket.AF_INET
    ) -> list[dict[str, Any]]:
        normalized_host = normalize_hostname(host)
        effective_port = port or 443
        if not self._policy.permits(normalized_host, effective_port):
            raise OSError("Host or port denied by URL policy")

        if _looks_like_ip(normalized_host):
            addresses = [
                (socket.AF_INET6 if ":" in normalized_host else socket.AF_INET, normalized_host)
            ]
        else:
            loop = asyncio.get_running_loop()
            infos = await loop.getaddrinfo(
                normalized_host,
                effective_port,
                family=family,
                type=socket.SOCK_STREAM,
            )
            addresses = [(info[0], info[4][0]) for info in infos]

        if not addresses or any(not _is_public_address(address) for _, address in addresses):
            raise OSError("Hostname has a non-public DNS answer")

        unique_addresses = dict.fromkeys(addresses)
        return [
            {
                "hostname": normalized_host,
                "host": address,
                "port": effective_port,
                "family": address_family,
                "proto": socket.IPPROTO_TCP,
                "flags": 0,
            }
            for address_family, address in unique_addresses
        ]

    async def close(self) -> None:
        return None


async def fetch_product_page(
    url: str,
    *,
    policy: UrlAllowlistPolicy,
    limits: FetchLimits | None = None,
    session_factory: Any = aiohttp.ClientSession,
    resolver: AbstractResolver | None = None,
) -> FetchedPage:
    """Fetch a product page with validated DNS, redirects, and body limits."""
    limits = limits or FetchLimits()
    current_url = validate_url(url, policy)
    timeout = aiohttp.ClientTimeout(
        total=limits.total_timeout_seconds,
        connect=limits.connect_timeout_seconds,
        sock_read=limits.read_timeout_seconds,
    )
    connector = aiohttp.TCPConnector(
        resolver=resolver or PublicAddressResolver(policy),
        use_dns_cache=False,
    )

    async with session_factory(
        connector=connector,
        connector_owner=True,
        timeout=timeout,
        trust_env=False,
        auto_decompress=True,
    ) as session:
        for attempt in range(limits.max_retries + 1):
            current_url = validate_url(url, policy)
            retry_delay: float | None = None
            try:
                for redirect_count in range(limits.max_redirects + 1):
                    logger.debug(
                        "🔥 Fetching rim product page url=%s",
                        redact_url_for_log(current_url),
                    )
                    async with session.get(
                        current_url,
                        allow_redirects=False,
                        proxy=None,
                        headers={
                            "Accept": "text/html, application/xhtml+xml, application/json",
                            "User-Agent": limits.user_agent,
                        },
                    ) as response:
                        if response.status in {301, 302, 303, 307, 308}:
                            location = response.headers.get("Location")
                            if not location:
                                raise RimUrlFetchError("Redirect response has no Location")
                            if redirect_count >= limits.max_redirects:
                                raise RimUrlFetchError("Redirect limit exceeded")
                            current_url = validate_url(urljoin(current_url, location), policy)
                            continue
                        if response.status in {408, 425, 429, 500, 502, 503, 504}:
                            if attempt >= limits.max_retries:
                                raise RimUrlFetchError(
                                    f"Unexpected HTTP status {response.status} after retries"
                                )
                            retry_after = response.headers.get("Retry-After")
                            retry_delay = _retry_delay(
                                retry_after,
                                attempt=attempt,
                                backoff_seconds=limits.retry_backoff_seconds,
                            )
                            break
                        if response.status < 200 or response.status >= 300:
                            raise RimUrlFetchError(f"Unexpected HTTP status {response.status}")

                        content_type = response.content_type.lower()
                        if not _content_type_allowed(content_type, limits.allowed_content_types):
                            raise RimUrlFetchError("Response content type is not allowed")
                        content_length = response.content_length
                        if content_length is not None and content_length > limits.max_body_bytes:
                            raise RimUrlFetchError("Response Content-Length exceeds limit")

                        body = bytearray()
                        async for chunk in response.content.iter_chunked(limits.chunk_size):
                            body.extend(chunk)
                            if len(body) > limits.max_body_bytes:
                                raise RimUrlFetchError("Decompressed response body exceeds limit")
                        logger.debug(
                            "✅ Fetched rim product page url=%s",
                            redact_url_for_log(current_url),
                        )
                        return FetchedPage(
                            final_url=current_url,
                            body=bytes(body),
                            content_type=content_type,
                            charset=response.charset,
                        )
            except (aiohttp.ClientError, TimeoutError) as exc:
                if attempt >= limits.max_retries:
                    raise RimUrlFetchError("HTTPS product page fetch failed") from exc
                retry_delay = _retry_delay(
                    None,
                    attempt=attempt,
                    backoff_seconds=limits.retry_backoff_seconds,
                )

            if retry_delay is not None:
                await asyncio.sleep(retry_delay)
                continue

    raise RimUrlFetchError("No terminal response received")


def _content_type_allowed(content_type: str, allowed_content_types: Collection[str]) -> bool:
    if content_type in allowed_content_types:
        return True
    return content_type.endswith("+json") and "application/json" in allowed_content_types


def _retry_delay(
    retry_after: str | None,
    *,
    attempt: int,
    backoff_seconds: float,
) -> float:
    if retry_after:
        try:
            return min(max(float(retry_after), 0.0), 30.0)
        except ValueError:
            pass
    return backoff_seconds * (2**attempt)
