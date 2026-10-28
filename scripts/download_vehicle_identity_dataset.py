"""Download licensed benchmark images listed in a vehicle identity manifest."""

from __future__ import annotations

import argparse
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)
_COMMONS_FILE_PATH = "https://commons.wikimedia.org/wiki/Special:FilePath/"
_COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
_MAX_RETRIES = 4
_METADATA_BATCH_SIZE = 10
_REQUEST_PAUSE_SECONDS = 5.0
_DOWNLOAD_PAUSE_SECONDS = 1.0


def download(manifest_path: Path, *, resolve_metadata: bool) -> None:
    """Download each Commons file to its manifest-relative local cache path."""
    manifest = json.loads(manifest_path.read_text())
    download_urls = _commons_download_urls(manifest["cases"]) if resolve_metadata else {}
    for case in manifest["cases"]:
        source = case.get("source", {})
        file_name = source.get("commons_file_name")
        if not isinstance(file_name, str) or not file_name:
            logger.warning("Skipping case without a Commons filename: %s", case["case_id"])
            continue
        destination = manifest_path.parent / case["image_path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            logger.info("Already downloaded: %s", destination)
            continue
        download_url = download_urls.get(file_name)
        if download_url is None:
            download_url = f"{_COMMONS_FILE_PATH}{urllib.parse.quote(file_name)}"
        request = urllib.request.Request(
            download_url,
            headers={"User-Agent": "DreamWheelsVehicleIdentityBenchmark/1.0"},
        )
        for attempt in range(_MAX_RETRIES + 1):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    destination.write_bytes(response.read())
                time.sleep(_DOWNLOAD_PAUSE_SECONDS)
                break
            except urllib.error.HTTPError as exc:
                if exc.code != 429 or attempt == _MAX_RETRIES:
                    logger.exception(
                        "Unable to download benchmark case",
                        extra={"case_id": case["case_id"]},
                    )
                    if destination.exists():
                        destination.unlink()
                    raise
                wait_seconds = 2**attempt
                logger.warning(
                    "Commons rate limit; retrying benchmark download in %s seconds",
                    wait_seconds,
                    extra={"case_id": case["case_id"]},
                )
                time.sleep(wait_seconds)
            except OSError:
                logger.exception(
                    "Unable to download benchmark case", extra={"case_id": case["case_id"]}
                )
                if destination.exists():
                    destination.unlink()
                raise


def _commons_download_urls(cases: list[dict[str, object]]) -> dict[str, str]:
    file_names = [
        source["commons_file_name"]
        for case in cases
        if isinstance((source := case.get("source")), dict)
        and isinstance(source.get("commons_file_name"), str)
    ]
    if not file_names:
        return {}
    urls: dict[str, str] = {}
    for start in range(0, len(file_names), _METADATA_BATCH_SIZE):
        batch = file_names[start : start + _METADATA_BATCH_SIZE]
        query = urllib.parse.urlencode(
            {
                "action": "query",
                "format": "json",
                "prop": "imageinfo",
                "iiprop": "url",
                "iiurlwidth": "1536",
                "titles": "|".join(f"File:{name}" for name in batch),
            }
        )
        request = urllib.request.Request(
            f"{_COMMONS_API_URL}?{query}",
            headers={"User-Agent": "DreamWheelsVehicleIdentityBenchmark/1.0"},
        )
        for attempt in range(_MAX_RETRIES + 1):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    pages = json.loads(response.read())["query"]["pages"]
                urls.update(
                    {
                        page["title"].removeprefix("File:"): page["imageinfo"][0].get(
                            "thumburl", page["imageinfo"][0]["url"]
                        )
                        for page in pages.values()
                        if page.get("imageinfo")
                    }
                )
                break
            except urllib.error.HTTPError as exc:
                if exc.code != 429 or attempt == _MAX_RETRIES:
                    logger.exception("Unable to resolve Wikimedia download URLs")
                    break
                wait_seconds = 2**attempt
                logger.warning(
                    "Commons rate limit; retrying metadata request in %s seconds", wait_seconds
                )
                time.sleep(wait_seconds)
            except (KeyError, OSError, json.JSONDecodeError):
                logger.exception("Unable to resolve Wikimedia download URLs")
                break
        if start + _METADATA_BATCH_SIZE < len(file_names):
            time.sleep(_REQUEST_PAUSE_SECONDS)
    return urls


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument(
        "--skip-metadata",
        action="store_true",
        help="Use Wikimedia Special:FilePath directly without API metadata queries.",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    download(args.manifest, resolve_metadata=not args.skip_metadata)


if __name__ == "__main__":
    main()
