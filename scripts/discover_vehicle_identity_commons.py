"""Discover attributed, freely licensed Wikimedia Commons benchmark candidates."""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "DreamWheelsVehicleIdentityBenchmark/1.0"
REQUEST_PAUSE_SECONDS = 5.0
MAX_RATE_LIMIT_RETRIES = 2
ALLOWED_LICENSE_MARKERS = ("CC0", "CC BY", "CC-BY", "PUBLIC DOMAIN", "PD")
DISALLOWED_LICENSE_MARKERS = ("NC", "ND")
_YEAR_PATTERN = re.compile(r"(?<!\d)(?:19|20)\d{2}(?!\d)")


def _request(params: dict[str, str]) -> dict[str, Any]:
    query = urllib.parse.urlencode({"format": "json", **params})
    request = urllib.request.Request(
        f"{COMMONS_API_URL}?{query}", headers={"User-Agent": USER_AGENT}
    )
    for attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == MAX_RATE_LIMIT_RETRIES:
                raise
            retry_after = exc.headers.get("Retry-After")
            wait_seconds = int(retry_after) if retry_after and retry_after.isdigit() else 60
            time.sleep(wait_seconds)
    raise RuntimeError("Unreachable")


def _is_allowed_license(value: str) -> bool:
    normalized = value.upper()
    return any(marker in normalized for marker in ALLOWED_LICENSE_MARKERS) and not any(
        marker in normalized for marker in DISALLOWED_LICENSE_MARKERS
    )


def _matches_target_title(title: str, target: dict[str, Any]) -> bool:
    """Require a filename to explicitly support the requested model year and model."""
    expected_year = target["ground_truth"]["year_start"]
    if not isinstance(expected_year, int):
        return False
    title_tokens = set(re.findall(r"[a-z0-9]+", title.lower()))
    query_tokens = set(re.findall(r"[a-z0-9]+", target["query"].lower()))
    title_years = _YEAR_PATTERN.findall(title)
    return (
        query_tokens.issubset(title_tokens)
        and bool(title_years)
        and title_years[0] == str(expected_year)
    )


def discover(
    targets_path: Path,
    output_path: Path,
    *,
    max_targets: int | None,
    clean_only: bool,
) -> None:
    """Create a reviewable candidate manifest; files are not downloaded here."""
    targets = json.loads(targets_path.read_text())["targets"]
    targets_by_slug = {target["slug"]: target for target in targets}
    existing = json.loads(output_path.read_text()) if output_path.exists() else {"cases": []}
    cases: list[dict[str, object]] = []
    seen_case_ids: set[str] = set()
    for case in existing["cases"]:
        case_id = case.get("case_id")
        source = case.get("source")
        if not isinstance(case_id, str) or not isinstance(source, dict):
            continue
        slug = case_id.rsplit("-", 1)[0].removeprefix("commons-")
        filename = source.get("commons_file_name")
        target = targets_by_slug.get(slug)
        if (
            target is not None
            and isinstance(filename, str)
            and _matches_target_title(filename, target)
            and case_id not in seen_case_ids
        ):
            cases.append(case)
            seen_case_ids.add(case_id)
    if clean_only:
        output_path.write_text(
            json.dumps({"dataset_version": "vehicle-identity-commons-v1", "cases": cases}, indent=2)
        )
        return
    seen_files = {f"File:{case['source']['commons_file_name']}" for case in cases}
    discovered_counts: dict[str, int] = {}
    for case in cases:
        slug = case["case_id"].rsplit("-", 1)[0].removeprefix("commons-")
        discovered_counts[slug] = discovered_counts.get(slug, 0) + 1
    for target in targets[:max_targets]:
        if discovered_counts.get(target["slug"], 0) >= target["count"]:
            continue
        search = _request(
            {
                "action": "query",
                "list": "search",
                "srnamespace": "6",
                "srlimit": "12",
                "srsearch": target["query"],
            }
        )
        titles = [item["title"] for item in search["query"]["search"]]
        if not titles:
            continue
        time.sleep(REQUEST_PAUSE_SECONDS)
        metadata = _request(
            {
                "action": "query",
                "prop": "imageinfo",
                "iiprop": "extmetadata",
                "titles": "|".join(titles),
            }
        )
        selected = discovered_counts.get(target["slug"], 0)
        for page in metadata["query"]["pages"].values():
            title = page.get("title")
            image_info = page.get("imageinfo", [])
            if not isinstance(title, str) or not image_info or title in seen_files:
                continue
            if not _matches_target_title(title.removeprefix("File:"), target):
                continue
            extmetadata = image_info[0].get("extmetadata", {})
            license_name = extmetadata.get("LicenseShortName", {}).get("value", "")
            if not isinstance(license_name, str) or not _is_allowed_license(license_name):
                continue
            filename = title.removeprefix("File:")
            case_id = f"commons-{target['slug']}-{selected + 1:02d}"
            cases.append(
                {
                    "case_id": case_id,
                    "image_path": f"downloaded/{case_id}.jpg",
                    "ground_truth": target["ground_truth"],
                    "recognizable": True,
                    "source": {
                        "commons_file_name": filename,
                        "page_url": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title)}",
                        "author": extmetadata.get("Artist", {}).get("value", "Unknown"),
                        "license": license_name,
                    },
                }
            )
            seen_files.add(title)
            selected += 1
            discovered_counts[target["slug"]] = selected
            if selected == target["count"]:
                break
        time.sleep(REQUEST_PAUSE_SECONDS)
        output_path.write_text(
            json.dumps({"dataset_version": "vehicle-identity-commons-v1", "cases": cases}, indent=2)
        )
    output_path.write_text(
        json.dumps({"dataset_version": "vehicle-identity-commons-v1", "cases": cases}, indent=2)
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("targets", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--max-targets", type=int, default=None)
    parser.add_argument("--clean-only", action="store_true")
    args = parser.parse_args()
    discover(
        args.targets,
        args.output,
        max_targets=args.max_targets,
        clean_only=args.clean_only,
    )


if __name__ == "__main__":
    main()
