"""Provider-neutral image generation boundary."""

from src.generation.base import (
    GenerationProvider,
    GenerationProviderError,
    GenerationRequest,
    GenerationResult,
    ProviderDiagnostics,
)
from src.generation.config import WanImageConfig
from src.generation.inputs import GenerationInput, build_generation_request, inspect_image
from src.generation.prompt import BASELINE_PROMPT, PROMPT_VERSION
from src.generation.wan_image_provider import WanImageProvider

__all__ = [
    "BASELINE_PROMPT",
    "PROMPT_VERSION",
    "GenerationInput",
    "GenerationProvider",
    "GenerationProviderError",
    "GenerationRequest",
    "GenerationResult",
    "ProviderDiagnostics",
    "WanImageConfig",
    "WanImageProvider",
    "build_generation_request",
    "inspect_image",
]
