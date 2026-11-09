"""Validate browser attribution independently of account authentication."""

import json
from datetime import UTC, datetime, timedelta

UTM_KEYS = ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term")


def parse_registration_touch(raw: str | None) -> dict | None:
    if not raw or len(raw) > 8192:
        return None
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return None
        if data.get("source") not in ("landing", "catalog") or data.get("locale") not in (
            "ru",
            "en",
        ):
            return None
        touched_at = datetime.fromisoformat(data["touched_at"])
        age = datetime.now(UTC) - touched_at
        if not timedelta(0) <= age <= timedelta(hours=24):
            return None
    except (ValueError, TypeError, KeyError, OverflowError, RecursionError):
        return None
    return {
        "source": data["source"],
        "locale": data["locale"],
        "touched_at": touched_at,
        "utm": {
            key: value.strip()[:200].replace("\x00", "").encode("utf-8", "replace").decode("utf-8")
            for key in UTM_KEYS
            if isinstance(value := data.get(key), str) and value.strip()
        },
    }
