"""Download real car and rim photos for fitment verdict demo / integration tests.

Vehicle sources: Pexels (royalty-free). Rim sources: bundled real product
photos supplied for functional testing. Re-run to refresh scenario assets:

    python -m fitment_verdict.prepare_demo_assets
"""

from __future__ import annotations

import logging
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "demo_assets"
CARS = ASSETS / "cars"
RIMS = ASSETS / "rims"

USER_AGENT = "Mozilla/5.0 DreamWheelsDemo/1.0"

# Pexels CDN for vehicle photos.
CAR_URLS: dict[str, str] = {
    "suv_white_side.jpg": (
        "https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg"
        "?auto=compress&cs=tinysrgb&w=1280"
    ),
    "crossover_dark.jpg": (
        "https://images.pexels.com/photos/2449456/pexels-photo-2449456.jpeg"
        "?auto=compress&cs=tinysrgb&w=1280"
    ),
}

LOCAL_RIM_SOURCES: dict[str, str] = {
    "rim_oem_match.jpg": "rim.jpg",
    "rim_wrong_pcd.jpg": "disc_1.webp",
    "rim_needs_rings.jpg": "rim.jpg",
    "rim_oversize.jpg": "disc_1.webp",
    "rim_no_marking.jpg": "rim.jpg",
}


def _download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    if len(data) < 10_000:
        raise RuntimeError(f"Download too small ({len(data)} bytes): {url}")
    dest.write_bytes(data)
    logger.info("saved %s (%d bytes)", dest.name, len(data))


def _assert_jpeg(path: Path) -> None:
    from PIL import Image

    with Image.open(path) as img:
        img.verify()
    with Image.open(path) as img:
        w, h = img.size
        if min(w, h) < 400:
            raise RuntimeError(f"{path.name}: image too small ({w}x{h})")


def _prepare_real_rim_asset(source: Path, destination: Path) -> None:
    from PIL import Image

    with Image.open(source) as opened:
        image = opened.convert("RGBA")
    background = Image.new("RGB", image.size, "white")
    background.paste(image, mask=image.getchannel("A"))
    background.thumbnail((900, 900), Image.Resampling.LANCZOS)
    if min(background.size) < 600:
        scale = 600 / min(background.size)
        background = background.resize(
            (round(background.width * scale), round(background.height * scale)),
            Image.Resampling.LANCZOS,
        )
    background.save(destination, format="JPEG", quality=95, optimize=True)
    logger.info("prepared real rim photo %s from %s", destination.name, source.name)


def prepare(*, skip_cars: bool = False) -> None:
    CARS.mkdir(parents=True, exist_ok=True)
    RIMS.mkdir(parents=True, exist_ok=True)

    if not skip_cars:
        for name, url in CAR_URLS.items():
            dest = CARS / name
            _download(url, dest)
            _assert_jpeg(dest)

    for name, source_name in LOCAL_RIM_SOURCES.items():
        dest = RIMS / name
        _prepare_real_rim_asset(RIMS / source_name, dest)
        _assert_jpeg(dest)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    prepare()
    print(f"Assets ready under {ASSETS}")


if __name__ == "__main__":
    main()
