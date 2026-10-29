"""AI Tunnel Chat Completions adapter with the existing strict identity contract."""

import base64
from typing import Any

from src.identity.prompts import VEHICLE_IDENTITY_JSON_SCHEMA, VEHICLE_IDENTITY_PROMPT
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
        choice = response["choices"][0]
        message = choice["message"]
        if choice.get("finish_reason") != "stop" or message.get("refusal"):
            raise KeyError("incomplete_or_refused_response")
        content = message["content"]
        if not isinstance(content, str):
            raise TypeError("content must be JSON text")
        return content

    def _estimated_cost(self, response: dict[str, Any]) -> float | None:
        # Existing metadata uses USD; AI Tunnel prices in RUB must not be mislabeled.
        return None
