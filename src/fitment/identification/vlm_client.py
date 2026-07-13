"""VLM-клиент: строгий JSON по схеме через OpenAI-совместимый Chat Completions API.

Контракт VlmClient позволяет подменять реализацию в тестах стабом
(в тестах живой VLM не вызывается — см. tests/test_fitment_identification.py).

Параметры инференса: temperature=0 (детерминизм), response_format=json_schema
strict — модель обязана вернуть валидный объект по схеме.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Protocol

import httpx

from src.fitment.config import (
    FITMENT_VLM_API_KEY,
    FITMENT_VLM_BASE_URL,
    FITMENT_VLM_MAX_RETRIES,
    FITMENT_VLM_MODEL,
    FITMENT_VLM_TIMEOUT_SEC,
)

logger = logging.getLogger(__name__)


class VlmError(Exception):
    """Технический сбой VLM (сеть/квота/невалидный JSON после ретрая)."""


class VlmClient(Protocol):
    async def complete_json(
        self,
        *,
        prompt: str,
        image_b64: str,
        image_mime: str,
        schema_name: str,
        json_schema: dict[str, Any],
    ) -> dict[str, Any]:
        """Вернуть dict, соответствующий json_schema."""
        ...


class OpenAICompatibleVlmClient:
    """Реализация поверх /chat/completions (OpenAI-совместимые провайдеры)."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key if api_key is not None else FITMENT_VLM_API_KEY
        self._base_url = (base_url or FITMENT_VLM_BASE_URL).rstrip("/")
        self._model = model or FITMENT_VLM_MODEL
        self._client = client

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def complete_json(
        self,
        *,
        prompt: str,
        image_b64: str,
        image_mime: str,
        schema_name: str,
        json_schema: dict[str, Any],
    ) -> dict[str, Any]:
        if not self._api_key:
            raise VlmError("FITMENT_VLM_API_KEY is not configured")

        body = {
            "model": self._model,
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{image_mime};base64,{image_b64}"},
                        },
                    ],
                }
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": json_schema,
                    "strict": True,
                },
            },
        }

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(
            timeout=httpx.Timeout(FITMENT_VLM_TIMEOUT_SEC),
            trust_env=False,
        )
        try:
            last_error: Exception | None = None
            attempts = max(1, FITMENT_VLM_MAX_RETRIES)
            for attempt in range(attempts):
                try:
                    response = await client.post(
                        f"{self._base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self._api_key}",
                            "Content-Type": "application/json",
                        },
                        json=body,
                    )
                except httpx.HTTPError as exc:
                    last_error = exc
                    if attempt + 1 < attempts:
                        await asyncio.sleep(0.5 * (2**attempt))
                    continue

                if response.status_code == 429 or response.status_code >= 500:
                    last_error = VlmError(f"VLM HTTP {response.status_code}")
                    if attempt + 1 < attempts:
                        await asyncio.sleep(0.5 * (2**attempt))
                    continue
                if response.status_code >= 400:
                    raise VlmError(f"VLM HTTP {response.status_code}")

                try:
                    payload = response.json()
                    content = payload["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                except (KeyError, IndexError, TypeError, ValueError) as exc:
                    raise VlmError(f"VLM invalid response shape: {exc}") from exc
                if not isinstance(parsed, dict):
                    raise VlmError("VLM structured output must be a JSON object")
                return parsed

            raise VlmError(f"VLM request failed after retries: {type(last_error).__name__}")
        except (KeyError, IndexError, ValueError) as exc:
            raise VlmError(f"VLM invalid response shape: {exc}") from exc
        except httpx.HTTPError as exc:
            raise VlmError(f"VLM request failed: {exc}") from exc
        finally:
            if owns_client:
                await client.aclose()
