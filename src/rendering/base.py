"""Provider-neutral contracts for image editing."""

from dataclasses import dataclass, field
from typing import Any, Protocol


class ImageProviderError(RuntimeError):
    """An image provider rejected or failed a generation request."""


class ImageProviderConfigError(ImageProviderError):
    """The selected provider is not configured correctly."""


class ImageProviderInputError(ImageProviderError, ValueError):
    """The edit request cannot be sent to the selected provider."""


BoundingBox = tuple[int, int, int, int]
ImageBoundingBoxes = tuple[BoundingBox, ...]


@dataclass(frozen=True, slots=True)
class ImageEditRequest:
    prompt: str
    images: tuple[bytes, ...]
    size: str | None = None
    n: int = 1
    seed: int | None = None
    bbox_list: tuple[ImageBoundingBoxes, ...] | None = None

    def __post_init__(self) -> None:
        if not self.prompt.strip():
            raise ImageProviderInputError("Image edit prompt cannot be empty")
        if not self.images or any(not image for image in self.images):
            raise ImageProviderInputError("Image edit request requires non-empty images")
        if not 1 <= self.n <= 4:
            raise ImageProviderInputError("Image edit output count must be between 1 and 4")
        if self.seed is not None and not 0 <= self.seed <= 2_147_483_647:
            raise ImageProviderInputError("Image edit seed is outside the supported range")
        if self.bbox_list is not None and len(self.bbox_list) != len(self.images):
            raise ImageProviderInputError("bbox_list must match the number of input images")


@dataclass(frozen=True, slots=True)
class GeneratedImage:
    data: bytes
    content_type: str
    provider: str
    model: str
    request_id: str | None = None
    task_id: str | None = None
    usage: dict[str, Any] = field(default_factory=dict)


class ImageGenerationProvider(Protocol):
    @property
    def name(self) -> str: ...

    async def edit(self, request: ImageEditRequest) -> tuple[GeneratedImage, ...]: ...


WHEEL_FITMENT_PROMPT = (
    "Image 1 is the original car photograph. Image 2 is the exact wheel SKU reference. "
    "Replace only the visible wheel rims on the car in image 1 with the exact wheel design "
    "from image 2. Preserve the car body, tires, brakes, wheel arches, background, camera "
    "angle, spoke count, bolt holes, center cap and logo. Match perspective, scale, lighting, "
    "reflections, shadows and occlusions. Return one photorealistic edited photograph."
)


def wheel_fitment_request(car_image: bytes, wheel_image: bytes) -> ImageEditRequest:
    return ImageEditRequest(
        prompt=WHEEL_FITMENT_PROMPT,
        images=(car_image, wheel_image),
        n=1,
    )
