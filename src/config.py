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


def _env_bool(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(name: str, default: str = "") -> tuple[str, ...]:
    raw_value = os.getenv(name, default)
    return tuple(item.strip() for item in raw_value.split(",") if item.strip())


# Image generation provider. Keep Reve as the default until Wan is benchmarked and configured.
IMAGE_GENERATION_PROVIDER = _env_str("IMAGE_GENERATION_PROVIDER").lower() or "reve"
WAN_API_KEY = _env_str("WAN_API_KEY") or _env_str("DASHSCOPE_API_KEY")
WAN_BASE_URL = _env_str("WAN_BASE_URL").rstrip("/")
WAN_MODEL = _env_str("WAN_MODEL") or "wan2.7-image"
WAN_OUTPUT_SIZE = _env_str("WAN_OUTPUT_SIZE") or "2K"
WAN_WATERMARK = _env_bool("WAN_WATERMARK")
WAN_POLL_INTERVAL_SEC = float(os.getenv("WAN_POLL_INTERVAL_SEC", "5"))
WAN_TASK_TIMEOUT_SEC = float(os.getenv("WAN_TASK_TIMEOUT_SEC", "300"))
WAN_REQUEST_TIMEOUT_SEC = float(os.getenv("WAN_REQUEST_TIMEOUT_SEC", "30"))
WAN_MAX_POLL_ERRORS = int(os.getenv("WAN_MAX_POLL_ERRORS", "3"))
WAN_MAX_INPUT_BYTES = int(os.getenv("WAN_MAX_INPUT_BYTES", str(10 * 1024 * 1024)))
WAN_MAX_OUTPUT_BYTES = int(os.getenv("WAN_MAX_OUTPUT_BYTES", str(20 * 1024 * 1024)))
WAN_RESULT_MAX_REDIRECTS = int(os.getenv("WAN_RESULT_MAX_REDIRECTS", "2"))
WAN_RESULT_ALLOWED_HOST_SUFFIXES = _env_csv(
    "WAN_RESULT_ALLOWED_HOST_SUFFIXES",
    "aliyuncs.com",
)
RESULT_IMAGE_MAX_BYTES = int(os.getenv("RESULT_IMAGE_MAX_BYTES", str(5 * 1024 * 1024)))


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
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://dream-wheels-ai-webapp.vercel.app").rstrip("/")
LEGAL_BASE_URL = os.getenv("LEGAL_BASE_URL", "https://dream-wheels-ai-legal.vercel.app").rstrip("/")

# Billing / credits
STARTER_GRANT_CREDITS = int(os.getenv("STARTER_GRANT_CREDITS", "3"))
STARTER_GRANT_TTL_DAYS = int(os.getenv("STARTER_GRANT_TTL_DAYS", "30"))
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
TELEGRAM_AUTH_TOKEN_TTL_SEC = int(os.getenv("TELEGRAM_AUTH_TOKEN_TTL_SEC", "3600"))
TELEGRAM_LOGIN_NONCE_TTL_SEC = int(os.getenv("TELEGRAM_LOGIN_NONCE_TTL_SEC", "600"))

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
        "image_generation_provider": IMAGE_GENERATION_PROVIDER,
        "wan_model": WAN_MODEL if IMAGE_GENERATION_PROVIDER == "wan" else None,
        "wan_configured": bool(WAN_API_KEY and WAN_BASE_URL),
    }
