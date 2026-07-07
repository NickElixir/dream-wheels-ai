import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
STYLE_CSS = (ROOT / "webapp" / "style.css").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
JOBS_API = (ROOT / "src" / "jobs_api.py").read_text(encoding="utf-8")
VERCEL_JSON = json.loads((ROOT / "webapp" / "vercel.json").read_text(encoding="utf-8"))
MIGRATION_0018 = (ROOT / "migrations" / "0018_fitment_identity_candidates.sql").read_text(
    encoding="utf-8"
)
MIGRATION_0019 = (ROOT / "migrations" / "0019_fitment_change_events.sql").read_text(
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
    assert "/jobs?" in APP_JS
    assert "fetchRenderHistory" in APP_JS
    assert "state.renderHistory = Array.isArray(history.jobs)" in APP_JS
    assert "resultUrlForJob(latest)" in APP_JS
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


def test_history_expands_only_one_completed_card() -> None:
    assert "expandedJobId" in APP_JS
    assert "state.expandedJobId === job.job_id" in APP_JS
    assert 'state.expandedJobId === jobId ? "" : jobId' in APP_JS
    assert 'status === "completed" && resultUrl' in APP_JS


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
    assert "Откройте Mini App в Telegram или войдите через Telegram на сайте" in INDEX_HTML
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
    assert "button.disabled = false;" in APP_JS
    assert "Promise.allSettled([loadTelegramLoginLibrary(), fetchWebsiteLoginNonce()])" in APP_JS
    assert '["pointerdown", "mouseenter", "focus"]' in APP_JS
    assert "warmWebsiteLoginResources();" in APP_JS
    assert "Promise.all([fetchWebsiteLoginNonce(), loadTelegramLoginLibrary()])" in APP_JS
    assert "warmWebsiteLoginResources();" in APP_JS.split("function warmWebsiteLoginResources()")[1]


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
    assert "Robokassa" in INDEX_HTML


def test_sprint_2_create_flow_preserves_upload_and_adds_identity_islands() -> None:
    assert "Загрузите фото машины и диска" in INDEX_HTML
    assert "Фото машины" in INDEX_HTML
    assert "Фото диска" in INDEX_HTML
    assert "Определить данные" in INDEX_HTML
    assert "Определяем автомобиль и диск" in INDEX_HTML
    assert "Проверьте AI-предложение" in INDEX_HTML
    assert "Параметры для рендера" in INDEX_HTML
    assert "Совместимость пока не проверена. Это визуальный рендер" in INDEX_HTML
    assert "Проверка совместимости — скоро" in INDEX_HTML
    assert "data-create-render" in INDEX_HTML
    assert 'data-rim-confirm="false"' in INDEX_HTML


def test_sprint_4_fitment_flow_is_wired_without_verdict_engine() -> None:
    assert 'data-view="fitment"' in INDEX_HTML
    assert "data-open-fitment-result" in INDEX_HTML
    assert "data-fitment-form" in INDEX_HTML
    assert "data-fitment-readiness" in INDEX_HTML
    assert "data-fitment-card-vehicle-meta" in INDEX_HTML
    assert "data-fitment-card-rim-meta" in INDEX_HTML
    assert "/fitment`" in APP_JS
    assert "data-open-fitment" in APP_JS
    assert "data-fitment-candidate" in APP_JS
    assert "expected_vehicle_revision" in APP_JS
    assert "expected_rim_revision" in APP_JS
    assert "fitment_available" in APP_JS
    assert "readinessUnconfirmed" in APP_JS
    assert "fitment/history" in JOBS_API
    assert "FitmentCheck" not in APP_JS
    assert "compatible_with_conditions" not in APP_JS
    assert "rerender" not in APP_JS.lower()
    assert "render_input_snapshot" not in APP_JS
    assert "source_summary" not in APP_JS
    assert "vehicle?.summary" not in APP_JS


def test_sprint_4_identity_candidates_migration_is_idempotent() -> None:
    assert "ALTER TABLE vehicle_identities" in MIGRATION_0018
    assert (
        "ADD COLUMN IF NOT EXISTS field_candidates JSONB NOT NULL DEFAULT '{}'::jsonb"
        in MIGRATION_0018
    )
    assert "ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1" in MIGRATION_0018
    assert "ALTER TABLE rim_specs" in MIGRATION_0018
    assert "vehicle_identities_revision_check" in MIGRATION_0018
    assert "rim_specs_revision_check" in MIGRATION_0018


def test_fitment_change_events_migration_is_append_only() -> None:
    assert "CREATE TABLE IF NOT EXISTS fitment_change_events" in MIGRATION_0019
    assert "actor_type" in MIGRATION_0019 and "TEXT NOT NULL" in MIGRATION_0019
    assert "changes" in MIGRATION_0019 and "JSONB NOT NULL DEFAULT '{}'::jsonb" in MIGRATION_0019
    assert "idx_fitment_change_events_job_created" in MIGRATION_0019


def test_sprint_2_reference_prototype_is_committed() -> None:
    reference = ROOT / "docs" / "references" / "sprint-2-create-flow.html"
    assert reference.exists()
    content = reference.read_text(encoding="utf-8")
    assert "Определить данные" in content
    assert "Проверка совместимости — скоро" in content


def test_identity_error_state_is_classified_as_critical_and_actionable() -> None:
    assert "tone-critical" in STYLE_CSS
    assert "identity-critical-card" in INDEX_HTML
    assert "identity-critical-head" in INDEX_HTML
    assert "Нужен вход в Telegram" in APP_JS
    assert "Войти через Telegram" in INDEX_HTML
    assert "Повторить" in INDEX_HTML
    assert "classifyIdentityError" in APP_JS
    assert "identityBackendTitle" in APP_JS
    assert "identityBackendBody" in APP_JS


def test_t_route_rewrites_to_shared_entrypoint_and_expiry_hidden() -> None:
    rewrites = VERCEL_JSON.get("rewrites", [])
    assert {"source": "/t", "destination": "/index.html"} in rewrites
    assert {"source": "/t/", "destination": "/index.html"} in rewrites
    assert not (ROOT / "webapp" / "t" / "index.html").exists()
    assert "Срок действия рендеров" not in INDEX_HTML
    assert "expiry" not in INDEX_HTML.lower()


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
