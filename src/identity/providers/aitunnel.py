"""AI Tunnel Chat Completions adapter with the existing strict identity contract."""

import base64
from typing import Any

from src.identity.prompts import VEHICLE_IDENTITY_JSON_SCHEMA, VEHICLE_IDENTITY_PROMPT
from src.identity.providers.base import VehicleIdentityProviderInvalidResponseError
from src.identity.providers.openai import OpenAIVehicleIdentityResolver
from src.vision.image_normalization import NormalizedImage


class AITunnelVehicleIdentityResolver(OpenAIVehicleIdentityResolver):
    provider_name = "aitunnel"
    endpoint = "https://api.aitunnel.ru/v1/chat/completions"

    def _payload(self, image: NormalizedImage) -> dict[str, Any]:
        image_data = base64.b64encode(image.bytes).decode("ascii")
        return {
            "model": self.model,
            "stream": False,
            "max_tokens": 2048,
            "messages": [
                {"role": "system", "content": VEHICLE_IDENTITY_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Resolve this vehicle image."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{image.content_type};base64,{image_data}",
                            },
                        },
                    ],
                },
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "vehicle_identity_resolution",
                    "strict": True,
                    "schema": VEHICLE_IDENTITY_JSON_SCHEMA,
                },
            },
        }

    def _output_text(self, response: dict[str, Any]) -> str:
        if not isinstance(response, dict):
            raise _invalid_envelope("response_not_object", {})
        choices = response.get("choices")
        if not isinstance(choices, list):
            raise _invalid_envelope("choices_missing_or_invalid", response)
        if not choices:
            raise _invalid_envelope("choices_empty", response)
        choice = choices[0]
        if not isinstance(choice, dict):
            raise _invalid_envelope("choice_not_object", response)
        message = choice.get("message")
        if not isinstance(message, dict):
            raise _invalid_envelope("message_missing_or_invalid", response)
        if message.get("refusal"):
            raise _invalid_envelope("refusal", response)
        finish = choice.get("finish_reason")
        if finish != "stop":
            reason = (
                f"finish_{finish}"
                if isinstance(finish, str)
                and finish in {"length", "content_filter", "tool_calls", "function_call"}
                else "finish_missing_or_other"
            )
            raise _invalid_envelope(reason, response)
        content = message.get("content")
        if not isinstance(content, str):
            raise _invalid_envelope("content_missing_or_nontext", response)
        if not content.strip():
            raise _invalid_envelope("content_empty", response)
        return content

    def _estimated_cost(self, response: dict[str, Any]) -> float | None:
        # Existing metadata uses USD; AI Tunnel prices in RUB must not be mislabeled.
        return None


def _invalid_envelope(
    reason: str, response: dict[str, Any]
) -> VehicleIdentityProviderInvalidResponseError:
    usage = response.get("usage")
    usage = usage if isinstance(usage, dict) else {}
    details = usage.get("completion_tokens_details")
    details = details if isinstance(details, dict) else {}

    def count(value: Any) -> int | str:
        return value if type(value) is int and 0 <= value <= 1_000_000_000 else "unavailable"

    return VehicleIdentityProviderInvalidResponseError(
        "aitunnel returned invalid structured vehicle identity"
        f" reason={reason} completion_tokens={count(usage.get('completion_tokens'))}"
        f" reasoning_tokens={count(details.get('reasoning_tokens'))}"
    )
