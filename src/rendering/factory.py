"""Runtime selection of the configured image-generation provider."""

from src import config
from src.rendering.base import ImageGenerationProvider, ImageProviderConfigError
from src.rendering.reve import ReveImageProvider
from src.rendering.wan import WanImageConfig, WanImageProvider


def create_image_generation_provider() -> ImageGenerationProvider:
    provider = config.IMAGE_GENERATION_PROVIDER
    if provider == "reve":
        if not config.REVE_API_KEY:
            raise ImageProviderConfigError("REVE_API_KEY is required when provider is reve")
        return ReveImageProvider()
    if provider == "wan":
        return WanImageProvider(
            WanImageConfig(
                api_key=config.WAN_API_KEY,
                base_url=config.WAN_BASE_URL,
                model=config.WAN_MODEL,
                output_size=config.WAN_OUTPUT_SIZE,
                watermark=config.WAN_WATERMARK,
                poll_interval_seconds=config.WAN_POLL_INTERVAL_SEC,
                task_timeout_seconds=config.WAN_TASK_TIMEOUT_SEC,
                request_timeout_seconds=config.WAN_REQUEST_TIMEOUT_SEC,
                max_poll_errors=config.WAN_MAX_POLL_ERRORS,
                max_input_bytes=config.WAN_MAX_INPUT_BYTES,
                max_output_bytes=config.WAN_MAX_OUTPUT_BYTES,
                max_result_redirects=config.WAN_RESULT_MAX_REDIRECTS,
                result_allowed_host_suffixes=config.WAN_RESULT_ALLOWED_HOST_SUFFIXES,
            )
        )
    raise ImageProviderConfigError(f"Unknown IMAGE_GENERATION_PROVIDER: {provider}")
