from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
STYLE_CSS = (ROOT / "webapp" / "style.css").read_text(encoding="utf-8")


def test_website_login_keeps_the_auth_label_element_for_logout_state() -> None:
    login = APP_JS.split("async function loginWithTelegram() {")[1].split(
        "function logoutWebsiteAuth()"
    )[0]

    assert "button.textContent" not in login
    assert "websiteAuthLabel.textContent = label" in APP_JS
    assert 'state.websiteAuth\n            ? t("auth.logout")' in APP_JS


def test_history_rating_is_optimistic_and_rolls_back_on_request_error() -> None:
    feedback = APP_JS.split("async function submitHistoryFeedback(")[1].split(
        "function renderHistoryCard"
    )[0]

    assert "const optimisticFeedback" in feedback
    assert "setFeedbackRecord(jobId, optimisticFeedback);" in feedback
    assert "setFeedbackRecord(jobId, currentFeedback);" in feedback
    assert "if (state.feedbackBusyByJob[job.job_id]) return;" in APP_JS


def test_dashboard_actions_are_equal_columns_and_detail_has_no_new_tryon_action() -> None:
    assert INDEX_HTML.count('class="ghost-button" data-dashboard-') == 2
    assert "grid-template-columns: repeat(2, minmax(0, 1fr));" in STYLE_CSS
    assert "data-new-tryon" not in INDEX_HTML


def test_dashboard_balance_uses_a_rounded_sub_island_and_topbar_uses_24px_caption() -> None:
    assert ".dashboard-balance-display" in STYLE_CSS
    assert "min-height: 164px;" in STYLE_CSS
    assert "border-radius: var(--radius-lg);" in STYLE_CSS
    assert ".topbar-caption {\n    font-size: 24px;" in STYLE_CSS


def test_fitment_reauth_prompt_preserves_the_unsaved_form_for_the_same_job() -> None:
    assert "data-fitment-auth-required" in INDEX_HTML
    assert "FITMENT_TRANSIENT_DRAFT_STORAGE_PREFIX" in APP_JS
    assert 'persistFitmentTransientDraft("reauth")' in APP_JS
    assert 'restoreReason: "reauth"' in APP_JS
    assert "Данные восстановлены" in APP_JS
    assert "response.status === 401" in APP_JS


def test_rim_source_errors_are_safe_and_visible_from_the_first_step() -> None:
    assert 'reasonCode === "rim_source_fetch_failed"' in APP_JS
    assert "state.fitmentMessage = state.fitmentSourceStatus;" in APP_JS
    assert 'state.fitmentMessageTone = "warning";' in APP_JS
