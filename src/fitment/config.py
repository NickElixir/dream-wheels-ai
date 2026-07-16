"""Env-конфигурация fitment-пайплайна.

Все os.getenv для fitment — здесь (по аналогии с src/config.py).
Версии движка/допусков живут в коде (rules/tolerances.py), не в env:
они являются свойством кода и должны меняться вместе с ним.
"""

import os

FITMENT_VERDICT_ENABLED = os.getenv("FITMENT_VERDICT_ENABLED", "false").lower() == "true"

# Durable-хранение в Postgres (требует применённой migrations/0017_fitment_verdict.sql).
# false → InMemory-репозиторий: работает без миграций, данные живут до рестарта.
FITMENT_DB_PERSISTENCE = os.getenv("FITMENT_DB_PERSISTENCE", "false").lower() == "true"

# Wheel-Size API v2 (https://developer.wheel-size.com/)
WHEEL_SIZE_API_KEY = os.getenv("WHEEL_SIZE_API_KEY", "")
WHEEL_SIZE_BASE_URL = os.getenv("WHEEL_SIZE_BASE_URL", "https://api.wheel-size.com/v2").rstrip("/")
WHEEL_SIZE_REGION_DEFAULT = os.getenv("WHEEL_SIZE_REGION_DEFAULT", "russia")
WHEEL_SIZE_TIMEOUT_CONNECT_SEC = float(os.getenv("WHEEL_SIZE_TIMEOUT_CONNECT_SEC", "5"))
WHEEL_SIZE_TIMEOUT_READ_SEC = float(os.getenv("WHEEL_SIZE_TIMEOUT_READ_SEC", "20"))
WHEEL_SIZE_MAX_RETRIES = int(os.getenv("WHEEL_SIZE_MAX_RETRIES", "3"))

# Кэш провайдера. Cataloging-методы (/makes/, /models/, ...) можно кэшировать
# агрессивно (разрешено ToS); search-результаты — только как побочный продукт
# запроса реального пользователя, с коротким TTL.
FITMENT_CATALOG_CACHE_TTL_SEC = int(os.getenv("FITMENT_CATALOG_CACHE_TTL_SEC", str(7 * 86400)))
FITMENT_PROFILE_CACHE_TTL_SEC = int(os.getenv("FITMENT_PROFILE_CACHE_TTL_SEC", str(86400)))
FITMENT_NEGATIVE_CACHE_TTL_SEC = int(os.getenv("FITMENT_NEGATIVE_CACHE_TTL_SEC", "300"))
FITMENT_PROVIDER_CACHE_BACKEND = os.getenv("FITMENT_PROVIDER_CACHE_BACKEND", "redis").strip().lower()

# VLM (OpenAI-compatible AITUNNEL endpoint). В тестах подменяется стабом.
FITMENT_VLM_BASE_URL = os.getenv("FITMENT_VLM_BASE_URL", "https://api.aitunnel.ru/v1").rstrip("/")
FITMENT_VLM_API_KEY = os.getenv("FITMENT_VLM_API_KEY", "")
FITMENT_VLM_MODEL = os.getenv("FITMENT_VLM_MODEL", "gpt-4.1-mini")
FITMENT_VLM_MIN_CONFIDENCE = float(os.getenv("FITMENT_VLM_MIN_CONFIDENCE", "0.4"))
FITMENT_VLM_TIMEOUT_SEC = float(os.getenv("FITMENT_VLM_TIMEOUT_SEC", "60"))
FITMENT_VLM_MAX_RETRIES = int(os.getenv("FITMENT_VLM_MAX_RETRIES", "3"))

# Preliminary image intake.
FITMENT_IMAGE_MAX_BYTES = int(os.getenv("FITMENT_IMAGE_MAX_BYTES", str(10 * 1024 * 1024)))
FITMENT_IMAGE_LONG_SIDE_PX = int(os.getenv("FITMENT_IMAGE_LONG_SIDE_PX", "1536"))
FITMENT_IMAGE_MAX_PIXELS = int(os.getenv("FITMENT_IMAGE_MAX_PIXELS", "40000000"))
