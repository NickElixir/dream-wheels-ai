"""Read-only compatibility gate; never changes backend operational flags."""

import argparse
import json
import urllib.request

from scripts.check_release_backend import URL
from scripts.frontend_release_policy import git, verify_sources


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)


def verify_health(data: dict) -> str:
    if data.get("status") != "ok" or data.get("maintenance") is not False:
        raise ValueError("Frontend-only release requires a healthy active backend")
    for key in (
        "payments_enabled",
        "payments_test_mode",
        "worker_enabled",
        "bot_enabled",
        "payment_timeout_enabled",
    ):
        if not isinstance(data.get(key), bool):
            raise ValueError(f"Backend must report {key}")
    return data.get("commit", "")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate")
    parser.add_argument("--tested", required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    backend = verify_health(fetch_json(URL))
    verify_sources(backend, args.candidate, args.tested)
    version = fetch_json("https://app-test.dream-wheels.ru/version.json")
    if version.get("build") != args.tested or version.get("profile") != "ru-test":
        raise ValueError("Accepted staging source is not served by RU test")
    if not args.preflight:
        if git("rev-parse", "origin/main") != args.candidate:
            raise ValueError("Candidate is no longer current main")
        if "[skip render]" not in git("show", "-s", "--format=%B", args.candidate):
            raise ValueError("Frontend-only merge must use [skip render]")
    print(f"Frontend-only compatibility verified: backend={backend}, frontend={args.candidate}")


if __name__ == "__main__":
    main()
