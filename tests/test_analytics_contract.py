from pathlib import Path

from src import analytics_api

ROOT = Path(__file__).resolve().parents[1]


def test_product_analytics_migration_has_attribution_and_required_funnel_events() -> None:
    migration = (ROOT / "migrations" / "0025_product_analytics.sql").read_text(encoding="utf-8")
    for column in ("first_touch", "last_touch", "landing_url", "referrer", "first_seen_at", "last_seen_at"):
        assert column in migration
    for event_name in (
        "app_opened", "auth_completed", "render_started", "render_completed", "render_failed",
        "payment_started", "payment_completed", "payment_failed",
    ):
        assert f"'{event_name}'" in migration


def test_event_contract_is_allowlisted() -> None:
    assert set(analytics_api.EventName.__args__) == {
        "app_opened", "auth_completed", "upload_started", "upload_completed",
        "render_started", "render_completed", "render_failed", "result_opened",
        "feedback_submitted", "repeat_render_started", "payment_started",
        "payment_completed", "payment_failed",
    }


def test_webapp_preserves_attribution_and_uses_relative_api_route() -> None:
    app_js = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
    assert "ANALYTICS_ATTRIBUTION_STORAGE_KEY" in app_js
    assert "UTM_KEYS" in app_js
    assert 'apiUrl("/analytics/events")' in app_js
    assert "tg?.initDataUnsafe?.start_param" in app_js
    assert "staging" not in app_js.split("function trackEvent")[1].split("function checkCurrentBuild")[0]
