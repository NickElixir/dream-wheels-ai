"""Generic remote image download used by the active generation runtime."""

from __future__ import annotations

import aiohttp


async def fetch_image_bytes(url: str) -> tuple[bytes, str]:
    """Download an image URL without coupling the runtime to a provider client."""
    timeout = aiohttp.ClientTimeout(total=30.0)
    async with aiohttp.ClientSession(timeout=timeout, trust_env=False) as session:
        async with session.get(url) as response:
            if response.status != 200:
                raise RuntimeError(f"Image download failed: HTTP {response.status}")
            return await response.read(), response.headers.get("content-type", "image/jpeg")
