"""Reve adapter for the provider-neutral rendering contract."""

import base64
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from src.rendering.base import (
    GeneratedImage,
    ImageEditRequest,
    ImageProviderInputError,
)
from src.reve_client import remix_wheels_on_car


class ReveImageProvider:
    @property
    def name(self) -> str:
        return "reve"

    async def edit(self, request: ImageEditRequest) -> tuple[GeneratedImage, ...]:
        if len(request.images) != 2 or request.n != 1:
            raise ImageProviderInputError("Reve remix requires exactly two inputs and one output")
        car_b64, wheel_b64 = (base64.b64encode(image).decode("ascii") for image in request.images)
        data = await remix_wheels_on_car(
            car_b64,
            wheel_b64,
            prompt=request.prompt,
        )
        return (
            GeneratedImage(
                data=data,
                content_type=_detect_image_content_type(data),
                provider=self.name,
                model="reve-remix-latest",
            ),
        )


def _detect_image_content_type(data: bytes) -> str:
    try:
        with Image.open(BytesIO(data)) as image:
            image_format = (image.format or "").upper()
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageProviderInputError("Reve returned an invalid image") from exc
    content_type = {
        "JPEG": "image/jpeg",
        "PNG": "image/png",
        "WEBP": "image/webp",
    }.get(image_format)
    if content_type is None:
        raise ImageProviderInputError(f"Reve returned unsupported image format: {image_format}")
    return content_type
