from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
STYLE_CSS = (ROOT / "webapp" / "style.css").read_text(encoding="utf-8")


def test_slice6_has_one_authoritative_fitment_ui_adapter() -> None:
    assert "function fitmentUiState(" in APP_JS
    assert "nextAction: fitmentNextAction(overview)" in APP_JS
    assert "vehicle_state" in APP_JS
    assert "rim_setup_state" in APP_JS
    assert "isCurrent: check ? check.is_current !== false : true" in APP_JS
    assert "fitmentDraftMissingFields" not in APP_JS
    assert "fitmentProviderReady" not in APP_JS


def test_vehicle_uses_provider_backed_cascade_and_save_before_lookup() -> None:
    assert "catalogue/${kind}" in APP_JS
    for kind in ("regions", "makes", "models", "years"):
        assert f'loadFitmentCatalogue("{kind}"' in APP_JS
    assert "Save vehicle changes before finding a vehicle version." in APP_JS
    assert 'state.fitmentForm.vehicle.model = "";' in APP_JS
    assert 'state.fitmentForm.vehicle.year = "";' in APP_JS
    assert "new AbortController()" in APP_JS
    assert "expected_vehicle_revision: overview.vehicle_revision" in APP_JS


def test_region_selection_starts_provider_make_cascade() -> None:
    region_branch = APP_JS.split('input.dataset.fitmentCatalogue === "regions"')[1].split(
        "} else {", 1
    )[0]
    assert 'loadFitmentCatalogue("makes", { region: value })' in region_branch
    assert (
        'loadFitmentCatalogue("models", { region: value, make: state.fitmentForm.vehicle.make })'
        in region_branch
    )


def test_modification_outcomes_keep_multiple_choice_explicit() -> None:
    assert 'result.outcome === "multiple" ? (result.variants || []) : []' in APP_JS
    assert "Комплектация выбрана автоматически." in APP_JS
    assert "Для выбранного автомобиля данные о комплектации не найдены." in APP_JS
    assert "response.status === 409" in APP_JS
    assert "vehicle_revision_conflict" in (ROOT / "docs" / "fitment-api-contract-v1.md").read_text(
        encoding="utf-8"
    )


def test_exact_rim_controls_preserve_decimal_values_without_rounding() -> None:
    assert (
        "FITMENT_DIAMETER_PRESETS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]" in APP_JS
    )
    assert "11, 11.5, 12" in APP_JS
    for value in ("63.35", "66.45", "66.5", "66.6"):
        assert value in APP_JS
    assert 'replace(",", ".")' in APP_JS
    assert "toFixed(1)" not in APP_JS
    assert 'data-fitment-input="rim.offset_et_mm"' in INDEX_HTML
    assert 'inputmode="decimal"' in INDEX_HTML


def test_rim_source_suggestions_and_sku_selection_stay_explicit() -> None:
    assert "state.fitmentSourceVariants = result.selection_required" in APP_JS
    assert "selectedVariantSku: variant.sku || null" in APP_JS
    assert 'variantState: "selected"' in APP_JS
    assert "function renderFitmentParserConflicts()" in APP_JS
    assert "data-fitment-conflict-use" in APP_JS
    assert "data-fitment-parser-conflicts" in INDEX_HTML


def test_manual_save_and_staggered_payload_are_server_authoritative() -> None:
    save = APP_JS.split("async function saveFitment(")[1].split(
        "async function fetchRenderHistory"
    )[0]
    assert "await runFitmentCheck();" not in save
    assert "Details saved. You can start the compatibility check separately." in save
    assert "setup_mode: state.fitmentForm.setup_mode" in APP_JS
    assert "front_rim:" in APP_JS
    assert "rear_rim:" in APP_JS
    assert "data-fitment-rear-rim" in INDEX_HTML


def test_async_check_polling_and_failed_state_never_become_unknown() -> None:
    assert "function pollFitmentCheck(" in APP_JS
    assert "queued" in APP_JS and "processing" in APP_JS
    assert "window.setTimeout(poll, POLL_INTERVAL_MS)" in APP_JS
    assert 'execution_status === "failed"' in APP_JS
    assert "fitmentRetryMessage" in APP_JS
    assert "`failed` is operational" in (ROOT / "docs" / "fitment-api-contract-v1.md").read_text(
        encoding="utf-8"
    )


def test_verdict_currentness_session_and_visual_tryon_have_presentation_boundaries() -> None:
    assert "refreshFitmentCheckCurrentness" in APP_JS
    assert "data-fitment-currentness" in INDEX_HTML
    assert 'persistFitmentTransientDraft("reauth")' in APP_JS
    assert 'restoreReason: "reauth"' in APP_JS
    assert "data-fitment-create-image" in INDEX_HTML
    assert 'setView("create")' in APP_JS
    assert ".fitment-verdict-field" in STYLE_CSS


def test_fitment_overview_stacks_on_narrow_mobile_viewports() -> None:
    mobile = STYLE_CSS.split("@media (max-width: 760px)", 1)[1]
    assert ".fitment-overview-grid," in mobile
    assert '.fitment-overview-grid[data-collapsed="true"]' in mobile
    assert "grid-template-columns: minmax(0, 1fr);" in mobile
    assert ".fitment-panel > *," in mobile
    assert ".fitment-shell > *" in mobile
    assert ".fitment-context-row > button" in mobile
