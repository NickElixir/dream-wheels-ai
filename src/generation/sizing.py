"""Explicit vehicle-derived output sizing for Wan image editing."""

from __future__ import annotations

from dataclasses import dataclass

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
    """Return the largest supported integer size preserving the vehicle ratio."""
    if width <= 0 or height <= 0:
        raise GenerationProviderError("provider_input_error", "Vehicle dimensions are invalid")
    ratio = width / height
    if max(ratio, 1 / ratio) > MAX_OUTPUT_ASPECT:
        raise GenerationProviderError(
            "provider_input_error", "Vehicle aspect ratio exceeds Wan limits"
        )

    scale = (MAX_OUTPUT_PIXELS / (width * height)) ** 0.5
    if scale > 1:
        scale = (MIN_OUTPUT_PIXELS / (width * height)) ** 0.5
    scale = min(scale, 1.0 if width * height >= MIN_OUTPUT_PIXELS else scale)
    out_width = max(1, round(width * scale))
    out_height = max(1, round(height * scale))
    while out_width * out_height > MAX_OUTPUT_PIXELS:
        if out_width >= out_height:
            out_width -= 1
        else:
            out_height -= 1
    while out_width * out_height < MIN_OUTPUT_PIXELS:
        next_width = out_width + 1
        next_height = out_height + 1
        if next_width * next_height > MAX_OUTPUT_PIXELS:
            break
        if abs(next_width / next_height - ratio) <= abs(out_width / out_height - ratio):
            out_width, out_height = next_width, next_height
        else:
            break
    return OutputSize(out_width, out_height)


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
