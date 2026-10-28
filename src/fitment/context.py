"""Canonical identity for deciding whether a FitmentCheck is current."""

from __future__ import annotations

import hashlib
import json
from typing import Any

PROVIDER_REFERENCE_VERSION = "v2"


def context_identity(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    value = snapshot.get("context_identity")
    if isinstance(value, dict):
        return value
    # Legacy snapshots do not contain enough evidence to prove currentness.
    return None


def context_hash(snapshot: dict[str, Any]) -> str | None:
    identity = context_identity(snapshot)
    if identity is None:
        return None
    return hashlib.sha256(
        json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def is_current_snapshot(check_snapshot: object, current_snapshot: object) -> bool:
    if not isinstance(check_snapshot, dict) or not isinstance(current_snapshot, dict):
        return False
    left = context_hash(check_snapshot)
    right = context_hash(current_snapshot)
    return left is not None and left == right
