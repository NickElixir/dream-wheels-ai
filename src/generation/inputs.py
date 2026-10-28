"""Image inspection and semantic request construction for the Wan runtime."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from src.generation.base import GenerationProviderError, GenerationRequest
from src.generation.prompt import BASELINE_PROMPT, PROMPT_VERSION
from src.generation.sizing import vehicle_output_size


@dataclass(frozen=True, slots=True)
class GenerationInput:
    data: bytes
    content_type: str
    width: int
    height: int


def inspect_image(data: bytes, *, role: str) -> GenerationInput:
    try:
        with Image.open(BytesIO(data)) as image:
            image.load()
            content_type = Image.MIME.get(image.format or "")
            if not content_type or not content_type.startswith("image/"):
                raise GenerationProviderError(
                    "provider_input_error", f"Unsupported {role} image format"
                )
            return GenerationInput(data, content_type, image.width, image.height)
    except GenerationProviderError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise GenerationProviderError("provider_input_error", f"Invalid {role} image") from exc


def build_generation_request(
    *, vehicle: GenerationInput, rim_reference: GenerationInput
) -> GenerationRequest:
    output_size = vehicle_output_size(vehicle.width, vehicle.height)
    return GenerationRequest(
        vehicle_image=vehicle.data,
        vehicle_content_type=vehicle.content_type,
        rim_reference_image=rim_reference.data,
        rim_reference_content_type=rim_reference.content_type,
        instruction=BASELINE_PROMPT,
        prompt_version=PROMPT_VERSION,
        output_width=output_size.width,
        output_height=output_size.height,
        edit_regions=None,
    )
