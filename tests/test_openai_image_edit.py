import base64
from pathlib import Path

from PIL import Image

from src.openai_image_edit import (
    build_openai_edit_prompt,
    build_openai_image_edit_url,
    first_b64_image,
    make_openai_alpha_mask,
    make_openai_edit_source_png,
    normalize_openai_base_url,
    response_without_b64,
)


def test_make_openai_alpha_mask_makes_white_pixels_transparent(tmp_path: Path):
    binary_mask = tmp_path / "mask.png"
    Image.new("L", (2, 1), 0).save(binary_mask)
    image = Image.open(binary_mask).convert("L")
    image.putpixel((1, 0), 255)
    image.save(binary_mask)

    output = tmp_path / "openai-mask.png"
    make_openai_alpha_mask(binary_mask_path=binary_mask, output_path=output)

    rgba = Image.open(output).convert("RGBA")
    assert rgba.getpixel((0, 0))[3] == 255
    assert rgba.getpixel((1, 0))[3] == 0


def test_build_openai_edit_prompt_mentions_mask_reference_and_black_disk_failure():
    prompt = build_openai_edit_prompt(wheel_description="matte black multi-spoke rims")

    assert "transparent parts of the mask" in prompt
    assert "second input image" in prompt
    assert "matte black multi-spoke rims" in prompt
    assert "flat black disks" in prompt


def test_first_b64_image_and_sanitized_response():
    payload = base64.b64encode(b"fake-image").decode("ascii")
    result = {"data": [{"b64_json": payload, "revised_prompt": "x"}], "usage": {"total_tokens": 1}}

    assert first_b64_image(result) == payload
    assert response_without_b64(result) == {
        "data": [{"revised_prompt": "x"}],
        "usage": {"total_tokens": 1},
    }


def test_openai_compatible_base_url_helpers():
    assert normalize_openai_base_url("https://api.aitunnel.ru/v1/") == "https://api.aitunnel.ru/v1"
    assert (
        build_openai_image_edit_url("https://api.aitunnel.ru/v1/")
        == "https://api.aitunnel.ru/v1/images/edits"
    )


def test_make_openai_edit_source_png_converts_source_image(tmp_path: Path):
    source = tmp_path / "source.jpg"
    Image.new("RGB", (2, 2), (10, 20, 30)).save(source)

    output = make_openai_edit_source_png(
        source_image_path=source,
        output_path=tmp_path / "source.png",
    )

    assert output.suffix == ".png"
    assert Image.open(output).format == "PNG"
