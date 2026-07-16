from src.fitment.providers.wheel_size import WheelSizeProvider


def test_default_provider_cache_is_shared_between_requests():
    first = WheelSizeProvider(api_key="test-key")
    second = WheelSizeProvider(api_key="test-key")

    assert first._cache is second._cache
