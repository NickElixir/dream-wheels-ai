"""Explicit vehicle-derived output sizing for Wan image editing."""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil, floor

from src.generation.base import GenerationProviderError

MAX_OUTPUT_PIXELS = 2048 * 2048
MIN_OUTPUT_PIXELS = 768 * 768
MAX_OUTPUT_ASPECT = 8.0


@dataclass(frozen=True, slots=True)
class OutputSize:
    width: int
    height: int

    @property
    def value(self) -> str:
        return f"{self.width}*{self.height}"


def vehicle_output_size(width: int, height: int) -> OutputSize:
    """Preserve admissible input sizes; scale only outside the pixel bounds."""
    if width <= 0 or height <= 0:
        raise GenerationProviderError("provider_input_error", "Vehicle dimensions are invalid")
    ratio = width / height
    if max(ratio, 1 / ratio) > MAX_OUTPUT_ASPECT:
        raise GenerationProviderError(
            "provider_input_error", "Vehicle aspect ratio exceeds Wan limits"
        )

    pixels = width * height
    if MIN_OUTPUT_PIXELS <= pixels <= MAX_OUTPUT_PIXELS:
        return OutputSize(width, height)

    target = MIN_OUTPUT_PIXELS if pixels < MIN_OUTPUT_PIXELS else MAX_OUTPUT_PIXELS
    scale = (target / pixels) ** 0.5
    # Independent round() can cross a pixel or 8:1 aspect boundary. Choose the
    # closest valid integer neighbour instead of silently submitting an invalid size.
    candidates = [
        OutputSize(w, h)
        for w in {max(1, floor(width * scale)), max(1, ceil(width * scale))}
        for h in {max(1, floor(height * scale)), max(1, ceil(height * scale))}
        if MIN_OUTPUT_PIXELS <= w * h <= MAX_OUTPUT_PIXELS
        and max(w / h, h / w) <= MAX_OUTPUT_ASPECT
    ]
    if not candidates:
        raise GenerationProviderError("provider_input_error", "No valid rounded output size")
    return min(
        candidates,
        key=lambda size: (
            abs(size.width / size.height - ratio),
            abs(size.width * size.height - target),
            size.width,
            size.height,
        ),
    )


def validate_explicit_output_size(width: int, height: int) -> None:
    if width <= 0 or height <= 0:
        raise GenerationProviderError("provider_input_error", "Output dimensions are invalid")
    if width * height < MIN_OUTPUT_PIXELS or width * height > MAX_OUTPUT_PIXELS:
        raise GenerationProviderError(
            "provider_input_error", "Output dimensions are outside Wan editing limits"
        )
    ratio = width / height
    if max(ratio, 1 / ratio) > MAX_OUTPUT_ASPECT:
        raise GenerationProviderError(
            "provider_input_error", "Output aspect ratio exceeds Wan limits"
        )
