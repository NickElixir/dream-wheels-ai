"""Read-only exact-commit gate for staging WebApp publication."""

import json
import re
import sys
import urllib.request

URL = "https://dream-wheels-ai-robokassa-staging.onrender.com/health/release"


def verify_release(data: dict[str, object], sha: str) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full commit SHA")
    if data.get("status") != "ok" or data.get("commit") != sha:
        raise ValueError(
            "Staging backend is not serving the requested commit; deploy backend first"
        )


if __name__ == "__main__":
    with urllib.request.urlopen(URL, timeout=30) as response:
        payload = json.load(response)
    verify_release(payload, sys.argv[1])
    print("Staging backend commit verified")
