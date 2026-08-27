from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_fitment_event_allowlist_includes_all_live_modification_events() -> None:
    migration = (ROOT / "migrations" / "0028_fitment_change_event_allowlist.sql").read_text(
        encoding="utf-8"
    )
    for event_type in (
        "initial_prefill",
        "user_save",
        "user_confirm",
        "candidate_applied",
        "modification_auto_confirmed",
        "modification_suggested",
        "modification_invalidated",
        "modification_user_confirmed",
    ):
        assert f"'{event_type}'" in migration

    assert "DROP CONSTRAINT IF EXISTS fitment_change_events_event_type_check" in migration
    assert "ADD CONSTRAINT fitment_change_events_event_type_check CHECK" in migration
