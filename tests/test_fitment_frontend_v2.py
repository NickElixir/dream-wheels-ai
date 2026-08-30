from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
STYLE_CSS = (ROOT / "webapp" / "style.css").read_text(encoding="utf-8")


def test_v2_shell_uses_context_pair_and_free_navigator() -> None:
    assert "data-fitment-context-pair" in INDEX_HTML
    assert 'data-fitment-section-tab="vehicle"' in INDEX_HTML
    assert 'data-fitment-section-tab="rim"' in INDEX_HTML
    assert 'data-fitment-section-tab="result"' in INDEX_HTML
    assert 'data-fitment-result-tab aria-selected="false" disabled' in INDEX_HTML
    assert 'class="fitment-steps"' not in INDEX_HTML
    assert "Demo" not in INDEX_HTML
    assert "Проверьте, подойдут ли диски" not in INDEX_HTML
    assert "Проверяем, как этот диск встанет на автомобиль" not in INDEX_HTML
    assert "Вернуться без изменений" not in INDEX_HTML
    assert "fitment-flow-index" not in INDEX_HTML


def test_frozen_composition_order_and_cta_hierarchy_are_preserved() -> None:
    context = INDEX_HTML.index("data-fitment-context-pair")
    navigator = INDEX_HTML.index("data-fitment-navigator")
    workspace = INDEX_HTML.index('data-fitment-section="vehicle"')
    render_action = INDEX_HTML.index("data-fitment-render-action")
    assert context < navigator < workspace < render_action
    assert INDEX_HTML.index("data-fitment-create-image") > INDEX_HTML.index("data-fitment-actions")
    assert 'class="primary-button" data-fitment-create-image' not in INDEX_HTML
    assert INDEX_HTML.count("data-fitment-source-disclosure") == 1


def test_result_gate_is_based_on_check_or_history_not_local_step() -> None:
    assert "function fitmentResultAvailable()" in APP_JS
    assert "return Boolean(state.fitmentCheck || state.fitmentCheckHistory.length);" in APP_JS
    assert "tab.disabled = isResult && !resultAvailable;" in APP_JS
    assert 'section === "result" && !fitmentResultAvailable()' in APP_JS
    assert "state.fitmentActiveSection = fitmentSectionForAction(overview);" in APP_JS
    assert "loadFitmentCheckHistory(overview)" in APP_JS


def test_next_action_is_server_owned_and_save_never_starts_check() -> None:
    assert "function validateFitmentOverview(overview)" in APP_JS
    assert 'return FITMENT_NEXT_ACTION_KINDS.has(kind) ? kind : "";' in APP_JS
    assert '|| "complete_vehicle_details"' not in APP_JS
    assert "const nextAction = fitmentNextAction(overview);" in APP_JS
    save = APP_JS.split("async function saveFitment(", 1)[1].split(
        "async function fetchRenderHistory", 1
    )[0]
    assert "await runFitmentCheck();" not in save
    assert "Проверку совместимости можно запустить отдельно" in save
    assert 'state.fitmentActiveSection = "rim";' in save
    assert "data-fitment-check-ready" in INDEX_HTML
    assert 'ui.nextAction === "run_standard_check"' in APP_JS


def test_f2_state_mappings_and_demo_server_transitions_are_explicit() -> None:
    assert 'empty: locale === "ru" ? "Не заполнен"' in APP_JS
    assert 'unconfirmed: locale === "ru" ? "Нужно подтвердить"' in APP_JS
    assert 'confirmed_incomplete: locale === "ru" ? "Нужно выбрать комплектацию"' in APP_JS
    assert 'partial: locale === "ru" ? "Нужно уточнить"' in APP_JS
    assert 'complete_unconfirmed: locale === "ru" ? "Нужно подтвердить"' in APP_JS
    assert 'if (!check) return locale === "ru" ? "Не выполнен"' in APP_JS
    assert 'compatible_with_conditions: locale === "ru" ? "Подходит с условиями"' in APP_JS
    assert (
        'if (check.is_current === false) return locale === "ru" ? "Нужно проверить заново"'
        in APP_JS
    )
    assert "demo_overview_version: FITMENT_DEMO_OVERVIEW_VERSION" in APP_JS
    assert 'vehicle_state: "unconfirmed"' in APP_JS
    assert 'next_action: { kind: "complete_vehicle_details" }' in APP_JS
    assert 'action === "confirm_vehicle"' in APP_JS
    assert 'action === "select_vehicle_variant"' in APP_JS
    assert 'action === "save_rim"' in APP_JS
    assert "function runDemoFitmentCheck()" in APP_JS
    assert 'execution_status: "queued"' in APP_JS
    assert 'execution_status: "processing"' in APP_JS


def test_f2_demo_ctas_are_transitions_and_result_precheck_copy_is_neutral() -> None:
    assert 'dataset.fitmentConfirmVariant = "true"' in APP_JS
    assert "data-fitment-vehicle-variant" in APP_JS
    assert "state.fitmentSelectedVehicleVariantIndex" in APP_JS
    assert "fitmentResultTitle(null)" in APP_JS
    assert 'data-fitment-flow-state="result">Не выполнен' in INDEX_HTML
    assert "Параметры сохранены. Проверку совместимости можно запустить отдельно" in APP_JS


def test_editors_replace_summaries_and_resolver_has_manual_fallback() -> None:
    assert "data-fitment-vehicle-summary" in INDEX_HTML
    assert "data-fitment-rim-summary" in INDEX_HTML
    assert 'data-fitment-edit="vehicle"' in INDEX_HTML
    assert 'data-fitment-edit="rim"' in INDEX_HTML
    assert "state.fitmentRimEditing = true;" in APP_JS
    assert "Заполните параметры вручную одним редактором" in APP_JS
    assert "data-fitment-source-disclosure" in INDEX_HTML
    assert "data-fitment-source-readonly" in INDEX_HTML


def test_check_states_keep_processing_and_provider_failure_distinct() -> None:
    assert 'check.execution_status === "queued"' in APP_JS
    assert 'check.execution_status === "processing"' in APP_JS
    assert 'check.execution_status === "failed"' in APP_JS
    assert 'check.verdict === "compatible_with_conditions"' in APP_JS
    assert 'check.verdict === "unknown"' in APP_JS
    assert 'check.verdict === "incompatible"' in APP_JS
    assert 'data-status="unknown"' not in INDEX_HTML
    assert 'fitmentVerdictMessage({ code: check.error?.code || "provider_unavailable" })' in APP_JS


def test_render_cta_remains_outside_fitment_result_workspace() -> None:
    assert "data-fitment-create-image" in INDEX_HTML
    assert 'setView("create")' in APP_JS
    assert "data-fitment-actions" in INDEX_HTML
    assert "independently from the fitment result" in APP_JS
    assert "data-fitment-render-action" in INDEX_HTML


def test_rim_preview_never_uses_the_vehicle_asset() -> None:
    preview = APP_JS.split("function fitmentPreviewAsset(job, kind)", 1)[1].split(
        "async function ensureFitmentPreviewAsset", 1
    )[0]
    assert 'kind === "vehicle" ? guestRenderAssetUrl(job, "original") : ""' in preview
    assert 'kind === "vehicle" ? "car_original" : "rim_original"' in preview
    assert 'kind === "vehicle" ? "original" : "original"' not in preview


def test_mobile_v2_keeps_pair_side_by_side_and_editors_single_column() -> None:
    assert ".fitment-pair {" in STYLE_CSS
    assert "grid-template-columns: repeat(2, minmax(0, 1fr));" in STYLE_CSS
    mobile = STYLE_CSS.split("@media (max-width: 760px)", 1)[-1]
    assert ".fitment-pair-media { min-height: 0; aspect-ratio: 1 / 1; }" in mobile
    assert ".fitment-form-grid { grid-template-columns: 1fr; }" in mobile
    assert ".fitment-flow-tab" in mobile


def test_draft_restores_v2_section_without_replaying_authoritative_actions() -> None:
    assert "activeSection: state.fitmentActiveSection" in APP_JS
    assert (
        'state.fitmentActiveSection = ["vehicle", "rim", "result"].includes(draft.activeSection)'
        in APP_JS
    )
    assert 'restoreReason: "reauth"' in APP_JS
    assert "function runFitmentCheck()" in APP_JS
