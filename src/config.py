"""Централизованный доступ к переменным окружения.

Все os.getenv() — здесь, чтобы:
- было одно место для документации/проверки переменных;
- удобно импортировать: `from src.config import DATABASE_URL`;
- легко подменять в тестах через monkeypatch.
"""

import os
from urllib.parse import urlparse

# Storage
DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
REDIS_KEY_PREFIX = os.getenv("REDIS_KEY_PREFIX", "")
REDIS_JOB_QUEUE = os.getenv("REDIS_JOB_QUEUE", "job_queue")
WORKER_ENABLED = os.getenv("WORKER_ENABLED", "true").lower() == "true"

# External APIs
REVE_API_KEY = os.getenv("REVE_API_KEY")
BOT_TOKEN = os.getenv("BOT_TOKEN")
API_INTERNAL_TOKEN = os.getenv("API_INTERNAL_TOKEN")


def _env_str(name: str) -> str:
    return os.getenv(name, "").strip()


# Active image generation provider. Runtime worker wiring is intentionally a
# single Wan provider with no legacy fallback.
WAN_API_KEY = _env_str("WAN_API_KEY")
WAN_REGION = _env_str("WAN_REGION") or "ap-southeast-1"
WAN_WORKSPACE_ID = _env_str("WAN_WORKSPACE_ID")
WAN_MODEL = _env_str("WAN_MODEL") or "wan2.7-image"
WAN_ESTIMATED_COST_USD = os.getenv("WAN_ESTIMATED_COST_USD", "0.03")
WAN_TASK_TIMEOUT_SEC = os.getenv("WAN_TASK_TIMEOUT_SEC", "300")
WAN_POLL_INITIAL_SEC = os.getenv("WAN_POLL_INITIAL_SEC", "2")
WAN_HTTP_TIMEOUT_SEC = os.getenv("WAN_HTTP_TIMEOUT_SEC", "30")
WAN_MAX_POLL_ERRORS = os.getenv("WAN_MAX_POLL_ERRORS", "3")
WAN_MAX_INPUT_BYTES = os.getenv("WAN_MAX_INPUT_BYTES", str(10 * 1024 * 1024))
WAN_MAX_OUTPUT_BYTES = os.getenv("WAN_MAX_OUTPUT_BYTES", str(20 * 1024 * 1024))
WAN_RESULT_MAX_REDIRECTS = os.getenv("WAN_RESULT_MAX_REDIRECTS", "3")
WAN_RESULT_ALLOWED_HOST_SUFFIXES = os.getenv("WAN_RESULT_ALLOWED_HOST_SUFFIXES", "aliyuncs.com")


# Vehicle visual identity. Disabled by default until the benchmark, privacy
# review and staged rollout are complete.
VEHICLE_IDENTITY_ENABLED = os.getenv("VEHICLE_IDENTITY_ENABLED", "false").lower() == "true"
VEHICLE_IDENTITY_PROVIDER = _env_str("VEHICLE_IDENTITY_PROVIDER") or "mock"
VEHICLE_IDENTITY_MODEL = _env_str("VEHICLE_IDENTITY_MODEL") or "gpt-4o-mini"
VEHICLE_IDENTITY_OPENAI_API_KEY = _env_str("VEHICLE_IDENTITY_OPENAI_API_KEY")
VEHICLE_IDENTITY_TIMEOUT_SEC = float(os.getenv("VEHICLE_IDENTITY_TIMEOUT_SEC", "20"))
VEHICLE_IDENTITY_MAX_RETRIES = int(os.getenv("VEHICLE_IDENTITY_MAX_RETRIES", "1"))
VEHICLE_IDENTITY_PROMPT_VERSION = (
    _env_str("VEHICLE_IDENTITY_PROMPT_VERSION") or "vehicle_identity_v1"
)
VEHICLE_IDENTITY_MAX_IMAGE_EDGE = int(os.getenv("VEHICLE_IDENTITY_MAX_IMAGE_EDGE", "1536"))
VEHICLE_IDENTITY_MAX_PIXELS = int(os.getenv("VEHICLE_IDENTITY_MAX_PIXELS", "12000000"))


def _infer_supabase_project_ref() -> str:
    project_ref = _env_str("SUPABASE_PROJECT_REF")
    if project_ref:
        return project_ref

    supabase_url = _env_str("SUPABASE_URL").rstrip("/")
    if not supabase_url:
        return ""

    host = urlparse(supabase_url).hostname or ""
    if not host.endswith(".supabase.co"):
        return ""

    return host.removesuffix(".supabase.co")


# Supabase
SUPABASE_URL = _env_str("SUPABASE_URL").rstrip("/")
SUPABASE_PROJECT_REF = _infer_supabase_project_ref()
SUPABASE_SERVICE_ROLE_KEY = _env_str("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_URL = (
    f"{SUPABASE_URL}/storage/v1"
    if SUPABASE_URL
    else (f"https://{SUPABASE_PROJECT_REF}.supabase.co/storage/v1" if SUPABASE_PROJECT_REF else "")
)

# URLs
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://dream-wheels-ai-tg.onrender.com").rstrip(
    "/"
)
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:10000").rstrip("/")


def normalize_origin_url(value: str, *, name: str) -> str:
    """Validate and normalize an absolute HTTP(S) origin URL."""
    normalized = value.rstrip("/")
    parsed = urlparse(normalized)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.path
        or parsed.params
        or parsed.query
        or parsed.fragment
        or "?" in normalized
        or "#" in normalized
    ):
        raise ValueError(f"{name} must be an origin without a path, e.g. https://example.com")
    return normalized


WEBAPP_URL = normalize_origin_url(
    os.getenv("WEBAPP_URL", "https://dream-wheels-ai-webapp.vercel.app"),
    name="WEBAPP_URL",
)
LEGAL_BASE_URL = os.getenv("LEGAL_BASE_URL", "https://dream-wheels-ai-legal.vercel.app").rstrip("/")

# Billing / credits
STARTER_GRANT_CREDITS = int(os.getenv("STARTER_GRANT_CREDITS", "3"))
STARTER_GRANT_TTL_DAYS = int(os.getenv("STARTER_GRANT_TTL_DAYS", "30"))
PURCHASE_GRANT_TTL_DAYS = int(os.getenv("PURCHASE_GRANT_TTL_DAYS", "30"))
JOB_CREDIT_COST = int(os.getenv("JOB_CREDIT_COST", "1"))
PAYMENTS_ENABLED = os.getenv("PAYMENTS_ENABLED", "true").lower() == "true"
WEBAPP_DEV_AUTH_ENABLED = os.getenv("WEBAPP_DEV_AUTH_ENABLED", "false").lower() == "true"
TELEGRAM_LOGIN_CLIENT_ID = _env_str("TELEGRAM_LOGIN_CLIENT_ID")
TELEGRAM_LOGIN_CLIENT_SECRET = _env_str("TELEGRAM_LOGIN_CLIENT_SECRET")
TELEGRAM_LOGIN_ISSUER = _env_str("TELEGRAM_LOGIN_ISSUER") or "https://oauth.telegram.org"
TELEGRAM_LOGIN_JWKS_URL = (
    _env_str("TELEGRAM_LOGIN_JWKS_URL") or "https://oauth.telegram.org/.well-known/jwks.json"
)
TELEGRAM_AUTH_TOKEN_SECRET = _env_str("TELEGRAM_AUTH_TOKEN_SECRET")
TELEGRAM_AUTH_TOKEN_TTL_SEC = int(os.getenv("TELEGRAM_AUTH_TOKEN_TTL_SEC", "28800"))
TELEGRAM_LOGIN_NONCE_TTL_SEC = int(os.getenv("TELEGRAM_LOGIN_NONCE_TTL_SEC", "600"))

# Rim product pages are fetched only from the compatibility screen of a user's
# completed render. The resolver accepts any *public* HTTPS host and applies
# SSRF controls at every DNS lookup and redirect; it must never rely on a
# manually maintained store allowlist.
RIM_URL_RESOLVER_ENABLED = os.getenv("RIM_URL_RESOLVER_ENABLED", "false").lower() == "true"
RIM_URL_RESOLVER_MAX_REDIRECTS = int(os.getenv("RIM_URL_RESOLVER_MAX_REDIRECTS", "3"))
RIM_URL_RESOLVER_MAX_BODY_BYTES = int(
    os.getenv("RIM_URL_RESOLVER_MAX_BODY_BYTES", str(2 * 1024 * 1024))
)
RIM_URL_RESOLVER_TIMEOUT_SEC = float(os.getenv("RIM_URL_RESOLVER_TIMEOUT_SEC", "15"))

# Robokassa
ROBOKASSA_MERCHANT_LOGIN = os.getenv("ROBOKASSA_MERCHANT_LOGIN", "")
ROBOKASSA_PASSWORD1 = os.getenv("ROBOKASSA_PASSWORD1", "")
ROBOKASSA_PASSWORD2 = os.getenv("ROBOKASSA_PASSWORD2", "")
ROBOKASSA_PASSWORD3 = os.getenv("ROBOKASSA_PASSWORD3", "")
ROBOKASSA_TEST_PASSWORD1 = os.getenv("ROBOKASSA_TEST_PASSWORD1", "")
ROBOKASSA_TEST_PASSWORD2 = os.getenv("ROBOKASSA_TEST_PASSWORD2", "")
ROBOKASSA_PAYMENT_URL = os.getenv(
    "ROBOKASSA_PAYMENT_URL", "https://auth.robokassa.ru/Merchant/Index.aspx"
)
ROBOKASSA_HASH_ALGO = os.getenv("ROBOKASSA_HASH_ALGO", "md5").lower()
ROBOKASSA_IS_TEST = os.getenv("ROBOKASSA_IS_TEST", "false").lower() == "true"


def runtime_env_summary() -> dict[str, str | bool | None]:
    supabase_host = urlparse(SUPABASE_URL).hostname if SUPABASE_URL else None
    return {
        "supabase_project_ref": SUPABASE_PROJECT_REF or None,
        "supabase_host": supabase_host,
        "storage_configured": bool(SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY),
        "payments_test_mode": ROBOKASSA_IS_TEST,
        "vehicle_identity_enabled": VEHICLE_IDENTITY_ENABLED,
        "vehicle_identity_provider": VEHICLE_IDENTITY_PROVIDER,
        "vehicle_identity_model": VEHICLE_IDENTITY_MODEL,
    }
