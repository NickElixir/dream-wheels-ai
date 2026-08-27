import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
STYLE_CSS = (ROOT / "webapp" / "style.css").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
JOBS_API = (ROOT / "src" / "jobs_api.py").read_text(encoding="utf-8")
VERCEL_JSON = json.loads((ROOT / "webapp" / "vercel.json").read_text(encoding="utf-8"))
VERSION_JSON = json.loads((ROOT / "webapp" / "version.json").read_text(encoding="utf-8"))
MIGRATION_0019 = (ROOT / "migrations" / "0019_fitment_identity_candidates.sql").read_text(
    encoding="utf-8"
)
MIGRATION_0020 = (ROOT / "migrations" / "0020_fitment_change_events.sql").read_text(
    encoding="utf-8"
)
MIGRATION_0023 = (ROOT / "migrations" / "0023_enable_credit_accounts_rls.sql").read_text(
    encoding="utf-8"
)
MIGRATION_0026 = (ROOT / "migrations" / "0026_fitment_rim_setup_schema_compat.sql").read_text(
    encoding="utf-8"
)
SMOKE_CHECKLIST = (ROOT / "docs" / "sprint-1-dashboard-smoke-checklist.md").read_text(
    encoding="utf-8"
)


def test_dashboard_uses_balance_from_cabinet_api() -> None:
    assert 'view: "dashboard"' in APP_JS
    assert "data-dashboard-balance" in INDEX_HTML
    assert "/payments/cabinet" in APP_JS
    assert "state.balance = cabinet.balance ?? 0" in APP_JS


def test_latest_completed_render_uses_durable_history_api() -> None:
    assert 'apiUrl("/jobs"' in APP_JS
    assert "fetchRenderHistory" in APP_JS
    assert "state.renderHistory = Array.isArray(history.jobs)" in APP_JS
    assert 'assetUrlForJob(latest, "result")' in APP_JS
    assert "assets?.result?.url" in APP_JS


def test_history_does_not_use_recent_render_local_storage_as_source() -> None:
    assert "RECENT_RENDERS_STORAGE_KEY" not in APP_JS
    assert "dreamWheelsRecentRenders" not in APP_JS
    assert "loadRecentRenders" not in APP_JS
    assert "recentRenders" not in APP_JS


def test_empty_processing_and_failed_states_are_user_safe() -> None:
    assert "Ваша первая примерка" in INDEX_HTML
    assert "Создаём результат" in APP_JS
    assert "Не удалось создать результат" in APP_JS
    assert "Failed to fetch" not in APP_JS


def test_history_opens_completed_card_on_a_dedicated_detail_screen() -> None:
    assert "renderDetailJobId" in APP_JS
    assert "function openRenderDetail(jobId" in APP_JS
    assert 'setView("render-detail")' in APP_JS
    assert 'const canOpen = status === "completed";' in APP_JS
    assert 'const hasResult = hasAssetSource(job, "result");' in APP_JS


def test_expanded_images_are_not_cropped() -> None:
    assert ".render-full-image" in STYLE_CSS
    render_full_block = STYLE_CSS.split(".render-full-image", 1)[1].split("}", 1)[0]
    assert "width: 100%" in render_full_block
    assert "height: auto" in render_full_block
    assert "object-fit: contain" in render_full_block


def test_frontend_does_not_offer_cross_owner_query_inputs() -> None:
    assert "getIdentitySearchParams" in APP_JS
    assert "withAuthHeaders" in APP_JS
    assert "telegram_user_id" in APP_JS
    assert "tgUser" in APP_JS
    assert "WEBAPP_DEV_AUTH_ENABLED" not in APP_JS
    assert "owner_user_id" not in APP_JS


def test_unauthenticated_state_prompts_telegram_login() -> None:
    assert "data-website-auth-button" in INDEX_HTML
    assert "Войдите, чтобы увидеть баланс" in INDEX_HTML
    assert "data-dashboard-auth-login" in INDEX_HTML
    assert "telegram-button-icon" in INDEX_HTML
    assert "wallet.authRequired" in APP_JS


def test_website_login_warms_popup_dependencies_before_first_click() -> None:
    assert 'href="https://oauth.telegram.org"' in INDEX_HTML
    assert 'href="//oauth.telegram.org"' in INDEX_HTML
    assert 'src="https://oauth.telegram.org/js/telegram-login.js?5"' in INDEX_HTML
    assert "data-telegram-login-library" in INDEX_HTML
    assert "WEBSITE_LOGIN_NONCE_MAX_AGE_MS" in APP_JS
    assert "auth.preparing" in APP_JS
    assert "function warmWebsiteLoginResources()" in APP_JS
    assert "websiteLoginWarmupPending" in APP_JS
    assert "button.disabled = state.websiteLoginPending;" in APP_JS
    assert "Promise.allSettled([loadTelegramLoginLibrary(), fetchWebsiteLoginNonce()])" in APP_JS
    assert '["pointerdown", "mouseenter", "focus"]' in APP_JS
    assert "warmWebsiteLoginResources();" in APP_JS
    assert "Promise.all([fetchWebsiteLoginNonce(), loadTelegramLoginLibrary()])" in APP_JS
    assert "warmWebsiteLoginResources();" in APP_JS.split("function warmWebsiteLoginResources()")[1]
    assert "WEBSITE_LOGIN_NONCE_RETRY_DELAYS_MS" in APP_JS
    assert "for (const delayMs of WEBSITE_LOGIN_NONCE_RETRY_DELAYS_MS)" in APP_JS


def test_stale_website_auth_is_cleared_and_identity_login_never_clicks_logout() -> None:
    assert "function clearWebsiteAuthSession" in APP_JS
    assert 'throw new Error("identity_auth_required")' in APP_JS
    identity_action = APP_JS.split(
        'document.querySelector("[data-identity-error-action]")?.addEventListener'
    )[1].split("});", 1)[0]
    assert "getWebsiteAuthToken()" in identity_action
    assert "loginWithTelegram()" in identity_action
    assert "website-auth-button" not in identity_action


def test_open_tabs_detect_a_new_frontend_build() -> None:
    build = VERSION_JSON["build"]
    assert f'data-app-build="{build}"' in INDEX_HTML
    assert f"/style.css?v={build}" in INDEX_HTML
    assert f"/app.js?v={build}" in INDEX_HTML
    assert "function checkCurrentBuild()" in APP_JS
    assert 'cache: "no-store"' in APP_JS
    version_headers = next(
        item["headers"] for item in VERCEL_JSON["headers"] if item["source"] == "/version.json"
    )
    assert {"key": "Cache-Control", "value": "no-store, max-age=0"} in version_headers


def test_desktop_layout_reserves_sidebar_gutter() -> None:
    assert "--desktop-sidebar-width" in STYLE_CSS
    assert "--desktop-content-gap" in STYLE_CSS
    assert "margin-left: calc(" in STYLE_CSS
    assert "var(--desktop-sidebar-width)" in STYLE_CSS
    assert "var(--desktop-content-gap)" in STYLE_CSS


def test_photo_guide_caption_uses_i18n_key_without_hyphen() -> None:
    assert 'state.view === "photo-guide" ? "photoGuide" : state.view' in APP_JS
    assert "caption.photo-guide" not in INDEX_HTML
    assert "caption.photo-guide" not in APP_JS


def test_existing_create_and_payment_flows_remain_wired() -> None:
    assert '@router.post("/upload"' in JOBS_API
    assert "/identity/resolve" in APP_JS
    assert "/jobs/from-assets" in APP_JS
    assert "/payments/topups" in APP_JS
    for icon in ("⚡", "🏁", "💎", "👑"):
        assert icon in INDEX_HTML
    assert "Робокассу" in INDEX_HTML


def test_sprint_2_create_flow_preserves_upload_and_adds_identity_islands() -> None:
    assert 'titleLine1: "Примерьте"' in APP_JS
    assert 'titleLine2: "новые диски"' in APP_JS
    assert 'titleLine3: "на своём автомобиле"' in APP_JS
    assert "Фото автомобиля" in INDEX_HTML
    assert "Фото колесного диска" in INDEX_HTML
    assert 'detectIdentity: "Определить автомобиль"' in APP_JS
    assert "Определяем автомобиль" in INDEX_HTML
    assert "Мы определили автомобиль" in INDEX_HTML
    assert "Ссылка на товар" in INDEX_HTML
    assert "Фото колесного диска добавлено" in INDEX_HTML
    assert "Проверка совместимости еще не проведена" in APP_JS
    assert "Проверка совместимости — скоро" not in INDEX_HTML
    assert "future-stage-island" not in INDEX_HTML
    assert "data-create-render" not in INDEX_HTML
    assert "data-detect-identity" not in INDEX_HTML
    assert "data-rim-product-url" in INDEX_HTML
    assert "data-manual-rim-fields" not in INDEX_HTML


def test_selected_vehicle_choice_uses_selected_status_not_correctness_claim() -> None:
    assert 'selected ? "✓ Выбрано" : "Выбрать"' in APP_JS
    assert "✓ Верно" not in APP_JS
    selected_choice_css = STYLE_CSS.split('.identity-choice[data-selected="true"] small', 1)[
        1
    ].split("}", 1)[0]
    assert "color: var(--success)" in selected_choice_css


def test_sprint_4_fitment_flow_is_wired_with_verdict_entrypoint() -> None:
    assert 'data-view="fitment"' in INDEX_HTML
    assert "data-open-fitment-result" in INDEX_HTML
    assert "data-fitment-form" in INDEX_HTML
    assert "data-fitment-readiness" in INDEX_HTML
    assert "data-fitment-card-vehicle-meta" in INDEX_HTML
    assert "data-fitment-card-rim-meta" in INDEX_HTML
    assert "data-fitment-preview-badge" in INDEX_HTML
    assert "data-fitment-preview-note" in INDEX_HTML
    assert "/fitment`" in APP_JS
    assert "data-open-fitment" in APP_JS
    assert "data-fitment-candidate" in APP_JS
    assert "expected_vehicle_revision" in APP_JS
    assert "expected_rim_revision" in APP_JS
    assert "fitment_available" in APP_JS
    assert "readinessUnconfirmed" in APP_JS
    assert 'params.get("preview") === "fitment"' in APP_JS
    assert "FITMENT_PREVIEW_STORAGE_KEY" in APP_JS
    assert "buildDefaultDemoFitmentOverview" in APP_JS
    assert "applyDemoFitmentSave(fitmentPayload())" in APP_JS
    assert "persistDemoFitmentOverview(overview);" in APP_JS
    assert "job_id: GUEST_FITMENT_DEMO_JOB_ID" in APP_JS
    assert "fitment_available: true" in APP_JS
    assert "fitment/history" in JOBS_API
    assert "runFitmentCheck" in APP_JS
    assert "data-fitment-check" in INDEX_HTML
    assert 'apiUrl("/fitment/checks"' in APP_JS
    assert "compatible_with_conditions" in APP_JS
    assert "demoLiveActionsUnavailable" in APP_JS
    assert "data-fitment-demo-live-note" in INDEX_HTML
    assert "shouldUseDemoFitment(state.fitmentJobId)" in APP_JS
    assert "[data-fitment-verdict-blocking-list]" in APP_JS
    assert "`${target}-list`" not in APP_JS
    assert "state.fitmentCheck = null;" in APP_JS
    assert "source_summary" not in APP_JS
    assert "vehicle?.summary" not in APP_JS


def test_saved_rim_source_is_resolved_when_fitment_opens() -> None:
    assert "state.fitmentSourceAutoResolvedForJob !== jobId" in APP_JS
    assert "void resolveFitmentRimSource({ automatic: true });" in APP_JS
    assert 'state.fitmentSourceAutoResolvedForJob = "";' in APP_JS
    assert "Сохранить и получить вывод" in APP_JS
    assert "await runFitmentCheck();" not in APP_JS
    assert "You can start the compatibility check separately." in APP_JS
    assert "function fitmentSourceBrand(overview)" in APP_JS
    assert "new URL(productUrl).hostname" in APP_JS
    assert "state.fitmentSourceOpen = true;" in APP_JS
    assert "state.fitmentMessage = state.fitmentSourceStatus;" in APP_JS
    assert "No wheel parameters could be recognised from this link" in APP_JS
    assert "state.fitmentSourceOpen = !resolvedEntries.length ? true" in APP_JS
    assert "const RIM_SOURCE_RESOLVE_TIMEOUT_MS = 20 * 1000;" in APP_JS
    assert "const controller = new AbortController();" in APP_JS
    assert "signal: controller.signal," in APP_JS
    assert "window.clearTimeout(requestTimeout);" in APP_JS


def test_fitment_entrypoint_uses_compatibility_language() -> None:
    assert 'openFromResult: "Проверить совместимость"' in APP_JS
    assert 'openFromHistory: "Проверить совместимость"' in APP_JS
    assert "Проверить совместимость автомобиля и диска" not in APP_JS
    result_button = INDEX_HTML.split("data-open-fitment-result", 1)[1].split("</button>", 1)[0]
    assert "Уточнить параметры" not in result_button


def test_user_facing_ui_never_uses_middle_dot_as_separator() -> None:
    assert "middle dot (`·`)" in (ROOT / "docs" / "ui-design-code.md").read_text(encoding="utf-8")
    assert "·" not in INDEX_HTML
    assert "·" not in APP_JS


def test_fitment_panel_collapses_hidden_status_islands() -> None:
    assert '.fitment-panel > .wallet-status-island[data-visible="false"]' in STYLE_CSS
    assert (
        "display: none"
        in STYLE_CSS.split('.fitment-panel > .wallet-status-island[data-visible="false"]', 1)[
            1
        ].split("}", 1)[0]
    )


def test_detail_screen_has_one_fitment_editor_cta_and_no_duplicate_new_tryon() -> None:
    detail = APP_JS.split("function renderRenderDetail() {")[1].split("function openRenderDetail")[
        0
    ]
    assert 'openFromHistory: "Проверить совместимость"' in APP_JS
    assert detail.count("data-open-fitment") == 1
    assert "render-expanded-actions" in detail
    assert "Скачать результат" in detail
    assert "Повторить с этими фото" in detail
    assert "data-new-tryon" not in detail
    assert "data-new-tryon" not in INDEX_HTML


def test_latest_result_preview_and_actions_cannot_overflow_dashboard_card() -> None:
    assert ".latest-render-card [data-latest-content]" in STYLE_CSS
    latest_content_css = STYLE_CSS.split(".latest-render-card [data-latest-content]", 1)[1].split(
        "}", 1
    )[0]
    assert "min-width: 0" in latest_content_css
    assert "overflow: clip" in latest_content_css
    latest_image_css = STYLE_CSS.split(".latest-result-image,", 1)[1].split("}", 1)[0]
    assert "max-width: 100%" in latest_image_css
    assert "latest-render-actions" in APP_JS
    assert "latest-preview-layout" in APP_JS
    assert "grid-template-columns: minmax(160px, 0.85fr) minmax(0, 1.15fr)" in STYLE_CSS
    assert ".latest-render-actions.render-card-buttons" in STYLE_CSS
    assert ".latest-render-actions .compact-button" in STYLE_CSS
    assert "font-size: clamp(" in STYLE_CSS


def test_detail_screen_rerenders_after_history_refresh_and_can_fetch_missing_job() -> None:
    load_history = APP_JS.split("async function loadRenderHistory")[1].split(
        "async function loadDashboardData"
    )[0]
    assert 'state.view === "render-detail"' in load_history
    assert "renderRenderDetail()" in load_history
    assert "async function loadRenderDetailJob(jobId)" in APP_JS
    assert "fetchJobStatusForHistory(jobId)" in APP_JS
    assert "Загружаем примерку…" in APP_JS


def test_completed_history_rows_are_compact_and_do_not_show_ready_badge() -> None:
    history_card = APP_JS.split("function renderHistoryCard(job) {")[1].split(
        "function renderRenderDetail()"
    )[0]
    assert 'status === "completed"' in history_card
    assert 'const statusMarkup = status === "completed"' in history_card
    assert "grid-template-columns: minmax(160px, 30%) minmax(0, 1fr)" in STYLE_CSS


def test_photo_guide_uses_the_approved_car_example_and_has_a_create_cta() -> None:
    assert "/assets/photo-guide-car.jpg" in INDEX_HTML
    assert (ROOT / "webapp" / "assets" / "photo-guide-car.jpg").is_file()
    assert (ROOT / "webapp" / "assets" / "photo-guide-car-bad.jpg").is_file()
    assert (ROOT / "webapp" / "assets" / "photo-guide-wheel-product.jpg").is_file()
    assert (ROOT / "webapp" / "assets" / "photo-guide-wheel-real.jpg").is_file()
    assert "Диск снят прямо спереди" in INDEX_HTML
    assert 'data-i18n="photoGuide.readyAction">Начать примерку</button>' in INDEX_HTML
    assert "/assets/photo-guide-wheel-product.jpg" in INDEX_HTML
    assert "/assets/photo-guide-wheel-real.jpg" in INDEX_HTML
    assert "photo-guide-wheel-examples" in STYLE_CSS


def test_fitment_continue_opens_rim_step_without_waiting_for_catalogue() -> None:
    assert "const savedFromStep = state.fitmentActiveStep;" in APP_JS
    assert "if (savedFromStep === 1)" in APP_JS
    assert "state.fitmentActiveStep = 2;" in APP_JS
    assert "scrollFitmentTo('[data-fitment-section=\"rim\"]');" in APP_JS


def test_negative_feedback_reveals_reason_choices_before_submission() -> None:
    assert "feedbackReasonPickerByJob" in APP_JS
    assert "function feedbackReasonPickerVisible(job)" in APP_JS
    assert 'sentiment === "disliked"' in APP_JS
    assert "data-history-feedback-reason" in APP_JS


def test_sprint_4_identity_candidates_migration_is_idempotent() -> None:
    assert "ALTER TABLE vehicle_identities" in MIGRATION_0019
    assert (
        "ADD COLUMN IF NOT EXISTS field_candidates JSONB NOT NULL DEFAULT '{}'::jsonb"
        in MIGRATION_0019
    )
    assert "ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1" in MIGRATION_0019
    assert "ALTER TABLE rim_specs" in MIGRATION_0019
    assert "vehicle_identities_revision_check" in MIGRATION_0019
    assert "rim_specs_revision_check" in MIGRATION_0019


def test_fitment_change_events_migration_is_append_only() -> None:
    assert "CREATE TABLE IF NOT EXISTS fitment_change_events" in MIGRATION_0020
    assert "actor_type" in MIGRATION_0020 and "TEXT NOT NULL" in MIGRATION_0020
    assert "changes" in MIGRATION_0020 and "JSONB NOT NULL DEFAULT '{}'::jsonb" in MIGRATION_0020
    assert "idx_fitment_change_events_job_created" in MIGRATION_0020


def test_credit_accounts_migration_restores_backend_only_rls() -> None:
    assert "ALTER TABLE IF EXISTS user_credit_accounts ENABLE ROW LEVEL SECURITY;" in MIGRATION_0023
    assert "CREATE POLICY" not in MIGRATION_0023


def test_fitment_rim_setup_schema_migration_matches_slice_7_queries() -> None:
    assert "ADD COLUMN IF NOT EXISTS source_fingerprint TEXT" in MIGRATION_0026
    assert "ADD COLUMN IF NOT EXISTS selected_variant_sku TEXT" in MIGRATION_0026
    assert "ADD COLUMN IF NOT EXISTS source_revision INTEGER NOT NULL DEFAULT 1" in MIGRATION_0026
    assert "ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1" in MIGRATION_0026


def test_sprint_2_reference_prototype_is_committed() -> None:
    reference = ROOT / "docs" / "references" / "sprint-2-create-flow.html"
    assert reference.exists()
    content = reference.read_text(encoding="utf-8")
    assert "Определить данные" in content


def test_uploaded_photo_preview_preserves_image_ratio_without_cropping() -> None:
    assert 'data-preview-media="car"' in INDEX_HTML
    assert 'data-preview-media="wheel"' in INDEX_HTML
    assert "function syncPreviewGeometry(kind)" in APP_JS
    assert "--preview-aspect-ratio" in APP_JS
    assert ".preview-media" in STYLE_CSS
    assert "transition: aspect-ratio 320ms ease" in STYLE_CSS
    preview_block = STYLE_CSS.split(".preview img", 1)[1].split("}", 1)[0]
    assert "object-fit: contain" in preview_block


def test_design_code_defines_ui_separator_rules() -> None:
    design_code = (ROOT / "docs" / "ui-design-code.md").read_text(encoding="utf-8")
    assert "Never use a full stop, middle dot (`·`)" in design_code
    assert '20" / 8,5J / 5×114,3' in design_code
    assert "Russian decimal values use a comma" in design_code
    assert "Vehicle and rim names use spaces only" in design_code
    assert " · " not in APP_JS
    assert "formatRim(rim)" in APP_JS
    assert '" / "' in APP_JS


def test_fitment_entity_names_keep_specs_on_secondary_lines() -> None:
    assert "data-fitment-vehicle-specs" in INDEX_HTML
    assert "data-fitment-card-vehicle-specs" in INDEX_HTML
    assert "data-fitment-card-rim-specs" in INDEX_HTML
    assert "function fitmentVehicleSpecs(vehicle)" in APP_JS
    assert "function fitmentRimSpecs(rim)" in APP_JS
    assert "demoVehicleTitle(overview.vehicle)" in APP_JS
    assert "demoRimTitle(overview.rim)" in APP_JS


def test_fitment_editor_reduces_visual_competition_after_editing_starts() -> None:
    assert "data-fitment-overview-toggle" in INDEX_HTML
    assert "data-fitment-overview-grid" in INDEX_HTML
    assert "state.fitmentOverviewCollapsed" in APP_JS
    assert 'input.addEventListener("focus", () => setFitmentOverviewCollapsed(true))' in APP_JS
    assert "fitment-field.has-candidates" in STYLE_CSS
    assert "fitment-candidate-row" in STYLE_CSS
    assert "position: sticky" in STYLE_CSS
    assert "--desktop-content-max: 1080px" in STYLE_CSS
    assert "data-fitment-card-source-brand" in INDEX_HTML
    assert "data-fitment-card-source-sku" in INDEX_HTML


def test_fitment_uses_the_approved_three_step_progressive_flow() -> None:
    assert "Проверьте, подойдут ли диски" in INDEX_HTML
    assert 'data-fitment-step-indicator="1"' in INDEX_HTML
    assert 'data-fitment-step-indicator="2"' in INDEX_HTML
    assert 'data-fitment-step-indicator="3"' in INDEX_HTML
    assert "fitmentActiveStep" in APP_JS
    assert "vehicleSection.hidden = activeStep !== 1" in APP_JS
    assert "rimSection.hidden = activeStep !== 2" in APP_JS
    assert "verdictCard.hidden = activeStep !== 3" in APP_JS
    assert 'locale === "ru" ? "Продолжить"' in APP_JS
    assert "Сохранить и получить вывод" in APP_JS
    assert "Сохранить и выбрать комплектацию" in APP_JS
    assert "function fitmentNextAction" in APP_JS
    assert "function fitmentDraftMissingFields" not in APP_JS
    assert "function fitmentUiState" in APP_JS
    assert "function refreshFitmentSaveLabel" in APP_JS
    assert "useDraft: true" not in APP_JS
    assert "void loadFitmentVehicleVariants();" in APP_JS
    assert "Подтвердите автомобиль и выберите комплектацию" in APP_JS


def test_detail_feedback_uses_plain_outcome_language() -> None:
    assert "👍 Удачный результат" in APP_JS
    assert "👎 Нужна доработка" in APP_JS
    assert "Гостевой пример: оценка сохранится только в этом браузере" in APP_JS
    assert "Гостевой пример: фидбек" not in APP_JS


def test_fitment_context_and_render_status_have_one_clear_visual_marker() -> None:
    assert 'data-i18n="fitment.back"' in INDEX_HTML
    assert "Вернуться к примерке" in INDEX_HTML
    assert "Demo preview" not in INDEX_HTML
    assert "data-fitment-preview-badge hidden>Demo</span>" in INDEX_HTML
    assert "fitment-context-row" in STYLE_CSS
    assert 'data-i18n="fitment.preliminary"' not in INDEX_HTML
    assert "render-info-island" in APP_JS
    assert 'status === "completed"' in APP_JS
    assert ".render-info-island .status-pill" in STYLE_CSS
    assert "render-demo-note" in APP_JS
    assert "border: 1px solid rgba(255, 204, 86, 0.22)" in STYLE_CSS
    assert "background: rgba(255, 204, 86, 0.08)" in STYLE_CSS


def test_identity_error_state_is_classified_as_critical_and_actionable() -> None:
    assert "tone-critical" in STYLE_CSS
    assert "identity-critical-card" in INDEX_HTML
    assert "identity-critical-head" in INDEX_HTML
    assert "Нужно войти в аккаунт" in APP_JS
    assert "Войти через Telegram" in INDEX_HTML
    assert "Проверить ещё раз" in APP_JS
    assert "classifyIdentityError" in APP_JS
    assert "identityBackendTitle" in APP_JS
    assert "identityBackendBody" in APP_JS


def test_t_route_rewrites_to_shared_entrypoint_and_wallet_summary_features_exist() -> None:
    rewrites = VERCEL_JSON.get("rewrites", [])
    backend_rewrites = [
        rewrite for rewrite in rewrites if rewrite["source"].startswith("/api/backend")
    ]
    assert backend_rewrites == [
        {
            "source": "/api/backend/jobs/:jobId/fitment/rim-source/resolve",
            "destination": "/api/rim-source-resolve-proxy?jobId=:jobId",
        },
        {
            "source": "/api/backend/jobs/:jobId/fitment",
            "destination": "/api/fitment-proxy?jobId=:jobId",
        },
        {
            "source": "/api/backend/jobs/:jobId/fitment/catalogue/:kind",
            "destination": "/api/fitment-proxy?jobId=:jobId&fitmentPath=catalogue/:kind",
        },
        {
            "source": "/api/backend/jobs/:jobId/fitment/vehicle-variants/apply",
            "destination": "/api/fitment-proxy?jobId=:jobId&fitmentPath=vehicle-variants/apply",
        },
        {
            "source": "/api/backend/jobs/:jobId/fitment/vehicle-variants",
            "destination": "/api/fitment-proxy?jobId=:jobId&fitmentPath=vehicle-variants",
        },
    ]
    assert {"source": "/t", "destination": "/index.html"} in rewrites
    assert {"source": "/t/", "destination": "/index.html"} in rewrites
    assert not (ROOT / "webapp" / "t" / "index.html").exists()
    assert "Срок действия" in INDEX_HTML
    assert "Сначала спишутся рендеры с ближайшим сроком действия" in APP_JS
    assert "data-dashboard-expiry" in INDEX_HTML
    assert "data-wallet-expiry-list" in INDEX_HTML


def test_website_flows_use_same_origin_rewrite_proxy_and_paginated_history() -> None:
    assert 'const WEBSITE_PROXY_BASE_URL = "/api/backend";' in APP_JS
    assert "function shouldUseBrowserApiProxy()" in APP_JS
    assert 'apiUrl("/jobs"' in APP_JS
    assert "apiUrl(`/jobs/${jobId}/fitment`, { includeIdentity: true })" in APP_JS
    assert "apiUrl(`/jobs/${state.fitmentJobId}/fitment`, { includeIdentity: true })" in APP_JS
    assert "withIdentityQuery(`${state.apiBaseUrl}/jobs/${jobId}/fitment`)" not in APP_JS
    assert (
        "withIdentityQuery(`${state.apiBaseUrl}/jobs/${state.fitmentJobId}/fitment`)" not in APP_JS
    )
    assert "walletHistoryPage" in APP_JS
    assert "PAYMENT_HISTORY_PAGE_SIZE = 10" in APP_JS
    assert "data-wallet-history-pager" in INDEX_HTML
    assert "data-wallet-history-prev" in INDEX_HTML
    assert "data-wallet-history-next" in INDEX_HTML
    assert "wallet-history-stack" in STYLE_CSS


def test_dashboard_uses_approved_auth_cta_skeletons_and_result_hierarchy() -> None:
    assert "data-dashboard-auth-login" in INDEX_HTML
    assert "Войдите, чтобы увидеть баланс" in INDEX_HTML
    assert "data-dashboard-balance-skeleton" in INDEX_HTML
    assert "data-dashboard-latest-skeleton" in INDEX_HTML
    assert "dashboard-card-skeleton" in STYLE_CSS
    assert "dashboard-skeleton-shimmer" in STYLE_CSS
    assert "data-dashboard-primary-action" in INDEX_HTML
    assert "data-dashboard-secondary-action" in INDEX_HTML
    assert "Открыть последний результат" in APP_JS
    assert "latest-preview-layout" in APP_JS
    assert "dashboard-fitment-context" in APP_JS
    assert "fitmentDashboardContext" in APP_JS


def test_generation_errors_use_actionable_copy_without_exposing_internal_messages() -> None:
    assert "classifyGenerationError" in APP_JS
    assert "Не удалось обработать изображение диска" in APP_JS
    assert "Не удалось распознать автомобиль на фото" in APP_JS
    assert "Сервис временно недоступен" in APP_JS
    assert "data-error-action" in INDEX_HTML
    assert "data-error-copy" in INDEX_HTML


def test_rim_source_progress_uses_explicit_user_facing_steps() -> None:
    assert "data-fitment-source-steps" in INDEX_HTML
    assert "Ссылка сохранена" in INDEX_HTML
    assert "Извлекаем параметры" in INDEX_HTML
    assert "Проверьте найденные значения" in INDEX_HTML
    assert "renderFitmentSourceSteps" in APP_JS
    assert "fitment-source-steps" in STYLE_CSS


def test_website_auth_does_not_inline_private_asset_urls() -> None:
    assert "function proxiedAssetUrl(asset)" in APP_JS
    assert 'if (getWebsiteAuthToken()) return "";' in APP_JS
    assert "Website auth lives in Authorization header" in APP_JS
    assert "function assetDownloadUrlForJob(job, kind)" in APP_JS
    assert "return getWebsiteAuthToken()" in APP_JS
    assert "if (getWebsiteAuthToken()) return resultUrlForJob(job);" in APP_JS


def test_secondary_action_family_uses_shared_island_button_style() -> None:
    assert ".payment-card-action," in STYLE_CSS
    assert ".website-auth-button," in STYLE_CSS
    assert ".summary-action" in STYLE_CSS
    assert "min-height: 44px" in STYLE_CSS
    assert "background: rgba(255, 255, 255, 0.03);" in STYLE_CSS
    assert "background: rgba(255, 255, 255, 0.04);" in STYLE_CSS
    assert "color: var(--accent-strong);" in STYLE_CSS


def test_focus_visible_style_covers_button_and_navigation_families() -> None:
    assert ".brand-button:focus-visible," in STYLE_CSS
    assert ".sidebar-item:focus-visible," in STYLE_CSS
    assert ".bottom-nav-item:focus-visible," in STYLE_CSS
    assert ".website-auth-button:focus-visible," in STYLE_CSS
    assert ".support-link:focus-visible," in STYLE_CSS
    assert (
        "box-shadow: 0 0 0 2px rgba(7, 8, 9, 0.92), 0 0 0 4px rgba(221, 255, 0, 0.3);" in STYLE_CSS
    )


def test_mobile_fallback_cta_is_placed_above_fixed_navigation() -> None:
    assert "The primary mobile navigation is fixed at the viewport bottom." in STYLE_CSS
    assert "bottom: calc(82px + var(--safe-bottom));" in STYLE_CSS


def test_dashboard_summary_cards_use_container_responsive_headers() -> None:
    assert "container-type: inline-size;" in STYLE_CSS
    assert "grid-template-columns: minmax(0, 1fr) auto;" in STYLE_CSS
    assert "@container (max-width: 640px)" in STYLE_CSS
    assert "justify-self: start;" in STYLE_CSS


def test_topbar_actions_split_caption_left_and_login_right() -> None:
    assert "justify-content: space-between;" in STYLE_CSS
    assert "margin-left: auto;" in STYLE_CSS
    assert ".topbar-caption {" in STYLE_CSS
    assert "font-size: 18px;" in STYLE_CSS
    assert "text-align: left;" in STYLE_CSS
    topbar_actions = INDEX_HTML.split('<div class="topbar-actions">', 1)[1].split("</header>", 1)[0]
    assert topbar_actions.index('class="topbar-caption"') < topbar_actions.index(
        'class="website-auth-button"'
    )


def test_visual_smoke_checklist_covers_key_viewports_and_screens() -> None:
    assert "## Visual smoke screenshots" in SMOKE_CHECKLIST
    assert "Desktop `1280px` dashboard unauthorized state" in SMOKE_CHECKLIST
    assert "Desktop `1024px` dashboard unauthorized state" in SMOKE_CHECKLIST
    assert "Mobile `390px` dashboard unauthorized state" in SMOKE_CHECKLIST
    assert "Desktop `1280px` wallet unauthorized state" in SMOKE_CHECKLIST
    assert "Mobile `390px` renders/history unauthorized state" in SMOKE_CHECKLIST
    assert "Mobile `390px` photo-guide with `Ещё` sheet open" in SMOKE_CHECKLIST
