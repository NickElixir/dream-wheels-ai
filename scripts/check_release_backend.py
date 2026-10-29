"""Read-only backend gate for manual production frontend publication."""

import json
import re
import sys
import urllib.request

URL = "https://dream-wheels-ai-prod-vnext.onrender.com/health/release"


def verify_release(data: dict[str, object], sha: str) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full commit SHA")
    if data.get("status") != "ok" or data.get("commit") != sha:
        raise ValueError("Production backend is not serving the requested commit")
    if data.get("payments_enabled") is not False:
        raise ValueError("Production frontend publication requires payments to be disabled")
    if not isinstance(data.get("payments_test_mode"), bool):
        raise ValueError("Production payment mode must be reported")
    if data.get("maintenance") is not True or any(
        data.get(key) is not False
        for key in ("worker_enabled", "bot_enabled", "payment_timeout_enabled")
    ):
        raise ValueError("Production backend must remain quiescent during frontend publication")


if __name__ == "__main__":
    with urllib.request.urlopen(URL, timeout=30) as response:
        payload = json.load(response)
    verify_release(payload, sys.argv[1])
    print("Production backend commit and maintenance profile verified")
