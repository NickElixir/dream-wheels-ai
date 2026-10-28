"""Validated application return routes for browser payment redirects."""

from urllib.parse import parse_qsl, unquote, urlencode, urlsplit

PAYMENT_CLIENT_CHANNEL_WEB = "web"
PAYMENT_CLIENT_CHANNEL_TELEGRAM = "telegram"
PAYMENT_CLIENT_CHANNELS = frozenset({PAYMENT_CLIENT_CHANNEL_WEB, PAYMENT_CLIENT_CHANNEL_TELEGRAM})

DEFAULT_RETURN_BY_CHANNEL = {
    PAYMENT_CLIENT_CHANNEL_WEB: "/app",
    PAYMENT_CLIENT_CHANNEL_TELEGRAM: "/t/",
}

WEB_PAYMENT_RETURN_PATHS = frozenset({"/app", "/app/new", "/app/history", "/app/wallet"})
TELEGRAM_PAYMENT_RETURN_PATHS = frozenset({"/t", "/t/"})
PAYMENT_RETURN_QUERY_KEYS = (
    "market",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
)


class PaymentReturnValidationError(ValueError):
    """The requested payment return context is outside the internal contract."""


def normalize_client_channel(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized not in PAYMENT_CLIENT_CHANNELS:
        raise PaymentReturnValidationError("client_channel must be web or telegram")
    return normalized


def normalize_return_to(value: str, *, client_channel: str) -> str:
    channel = normalize_client_channel(client_channel)
    raw = str(value or "").strip()
    if not raw or any(ord(char) < 0x20 for char in raw):
        raise PaymentReturnValidationError("return_to must be a non-empty internal route")
    if "\\" in raw:
        raise PaymentReturnValidationError("return_to must not contain backslashes")

    try:
        parsed = urlsplit(raw)
    except ValueError as exc:
        raise PaymentReturnValidationError("return_to must be a relative internal route") from exc
    if parsed.scheme or parsed.netloc or raw.startswith("//"):
        raise PaymentReturnValidationError("return_to must be a relative internal route")
    if parsed.fragment or not parsed.path.startswith("/"):
        raise PaymentReturnValidationError("return_to must be a relative internal route")
    if "%" in parsed.path or unquote(parsed.path) != parsed.path:
        raise PaymentReturnValidationError("return_to must not contain encoded path segments")

    path = parsed.path.rstrip("/") or "/"
    if any(segment in {".", ".."} for segment in parsed.path.split("/")):
        raise PaymentReturnValidationError("return_to contains a path traversal segment")

    allowed_paths = (
        WEB_PAYMENT_RETURN_PATHS
        if channel == PAYMENT_CLIENT_CHANNEL_WEB
        else TELEGRAM_PAYMENT_RETURN_PATHS
    )
    if path not in allowed_paths:
        raise PaymentReturnValidationError("return_to is not an allowed route for client_channel")
    if channel == PAYMENT_CLIENT_CHANNEL_TELEGRAM:
        path = "/t/"

    try:
        pairs = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    except ValueError as exc:
        raise PaymentReturnValidationError("return_to contains an invalid query") from exc
    if channel == PAYMENT_CLIENT_CHANNEL_TELEGRAM and pairs:
        raise PaymentReturnValidationError("telegram return_to must not contain a query")

    values: dict[str, str] = {}
    for key, query_value in pairs:
        if key not in PAYMENT_RETURN_QUERY_KEYS or key in values or not query_value:
            raise PaymentReturnValidationError("return_to contains an unsupported query")
        if len(query_value) > 256 or any(ord(char) < 0x20 for char in query_value):
            raise PaymentReturnValidationError("return_to query value is invalid")
        values[key] = query_value

    query = urlencode([(key, values[key]) for key in PAYMENT_RETURN_QUERY_KEYS if key in values])
    return f"{path}{f'?{query}' if query else ''}"


def safe_payment_return_context(
    *, client_channel: str | None, return_to: str | None
) -> tuple[str, str, bool]:
    """Return a safe channel/route pair, falling back without reflecting DB data."""
    try:
        channel = normalize_client_channel(client_channel or "")
    except PaymentReturnValidationError:
        channel = PAYMENT_CLIENT_CHANNEL_WEB
        return DEFAULT_RETURN_BY_CHANNEL[channel], channel, True

    try:
        route = normalize_return_to(return_to or "", client_channel=channel)
    except PaymentReturnValidationError:
        return DEFAULT_RETURN_BY_CHANNEL[channel], channel, True
    return route, channel, False


def build_payment_return_url(
    *,
    base_origin: str,
    client_channel: str | None,
    return_to: str | None,
    payment_state: str,
    invoice_id: int,
) -> tuple[str, bool]:
    if payment_state not in {"success", "fail"}:
        raise ValueError("unsupported payment return state")
    if invoice_id <= 0:
        raise ValueError("invoice_id must be positive")

    route, _channel, used_fallback = safe_payment_return_context(
        client_channel=client_channel,
        return_to=return_to,
    )
    query = urlencode({"payment": payment_state, "invoice_id": invoice_id})
    return f"{base_origin.rstrip('/')}{route}{'&' if '?' in route else '?'}{query}", used_fallback
