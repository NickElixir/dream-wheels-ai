from src.fitment.context import context_hash, is_current_snapshot


def _snapshot(**identity):
    return {"context_identity": {"vehicle_revision": 4, "rim_setup_revision": 2, **identity}}


def test_currentness_uses_exact_context_identity_not_timestamp():
    first = _snapshot(engine_version="v2", rules_version="v2")
    same = _snapshot(engine_version="v2", rules_version="v2")
    changed = _snapshot(engine_version="v2", rules_version="v3")

    assert context_hash(first) == context_hash(same)
    assert is_current_snapshot(first, same)
    assert not is_current_snapshot(first, changed)


def test_legacy_snapshot_without_identity_is_conservatively_historical():
    assert context_hash({}) is None
    assert not is_current_snapshot({}, _snapshot(engine_version="v2"))
