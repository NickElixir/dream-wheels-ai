import asyncio
import base64
from io import BytesIO

import pytest
from PIL import Image

from src.generation.base import GenerationProviderError
from src.generation.inputs import build_generation_request, inspect_image
from src.generation.prompt import BASELINE_PROMPT
from src.generation.sizing import (
    MAX_OUTPUT_PIXELS,
    MIN_OUTPUT_PIXELS,
    validate_explicit_output_size,
    vehicle_output_size,
)
from tests.test_generation_wan import provider, successful_session


@pytest.mark.parametrize(
    "dimensions",
    [(1440, 1920), (1920, 1080), (2048, 2048), (768, 768), (1600, 1000), (2400, 600)],
)
def test_admissible_vehicle_dimensions_are_preserved_exactly(dimensions):
    size = vehicle_output_size(*dimensions)
    assert (size.width, size.height) == dimensions


@pytest.mark.parametrize(
    "dimensions",
    [
        (384, 384),
        (400, 600),
        (600, 400),
        (1, 8),
        (8, 1),
        (767, 768),
        (4096, 4096),
        (4000, 6000),
        (6000, 4000),
        (80000, 10000),
        (10000, 80000),
        (2049, 2048),
    ],
)
def test_out_of_range_sizes_obey_area_aspect_and_rounding(dimensions):
    width, height = dimensions
    size = vehicle_output_size(width, height)
    validate_explicit_output_size(size.width, size.height)
    assert MIN_OUTPUT_PIXELS <= size.width * size.height <= MAX_OUTPUT_PIXELS
    assert size.width / size.height == pytest.approx(width / height, rel=0.005)
    target = MIN_OUTPUT_PIXELS if width * height < MIN_OUTPUT_PIXELS else MAX_OUTPUT_PIXELS
    scale = (target / (width * height)) ** 0.5
    assert abs(size.width - width * scale) <= 1
    assert abs(size.height - height * scale) <= 1
    if width * height < MIN_OUTPUT_PIXELS:
        assert size.width >= width and size.height >= height
    else:
        assert size.width <= width and size.height <= height


def test_scaling_grid_cannot_produce_a_provider_rejected_size():
    for width in (1, 240, 767, 768, 769, 1440, 1920, 2048, 2049, 8000):
        for height in (1, 240, 767, 768, 769, 1080, 1920, 2048, 2049, 8000):
            if max(width / height, height / width) > 8:
                continue
            size = vehicle_output_size(width, height)
            validate_explicit_output_size(size.width, size.height)
            if MIN_OUTPUT_PIXELS <= width * height <= MAX_OUTPUT_PIXELS:
                assert (size.width, size.height) == (width, height)


@pytest.mark.parametrize("dimensions", [(0, 1920), (1440, 0), (-1, 768), (1, 9), (9, 1)])
def test_invalid_dimensions_are_rejected(dimensions):
    with pytest.raises(GenerationProviderError, match="dimensions|aspect"):
        vehicle_output_size(*dimensions)


@pytest.mark.parametrize("image_format", ["WEBP", "JPEG"])
def test_portrait_original_bytes_and_explicit_size_reach_provider_unchanged(image_format):
    def image_bytes(size, color):
        output = BytesIO()
        image = Image.new("RGB", size, color)
        kwargs = {}
        if image_format == "JPEG":
            exif = Image.Exif()
            exif[274] = 6
            kwargs["exif"] = exif
        image.save(output, format=image_format, **kwargs)
        return output.getvalue()

    car = image_bytes((1440, 1920), "navy")
    rim = image_bytes((750, 750), "silver")
    request = build_generation_request(
        vehicle=inspect_image(car, role="vehicle"),
        rim_reference=inspect_image(rim, role="rim reference"),
    )
    session = successful_session()
    asyncio.run(provider(session).edit(request))
    payload = session.post_calls[0][1]["json"]
    assert payload["model"] == "wan2.7-image"
    assert payload["parameters"] == {"size": "1440*1920", "n": 1, "watermark": False}
    content = payload["input"]["messages"][0]["content"]
    assert base64.b64decode(content[0]["image"].split(",", 1)[1]) == car
    assert base64.b64decode(content[1]["image"].split(",", 1)[1]) == rim
    assert content[2]["text"] == BASELINE_PROMPT
    assert request.prompt_version == "P1_WHEEL_IDENTITY"
    if image_format == "JPEG":
        # Sizing must not accidentally introduce a new EXIF-normalization policy.
        assert Image.open(BytesIO(request.vehicle_image)).getexif()[274] == 6
