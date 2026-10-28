import json
from pathlib import Path

from tests.helpers.source_extract import extract_function

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
COPY = json.loads(
    (ROOT / "webapp/vnext/copy.mjs")
    .read_text(encoding="utf-8")
    .split("export const COPY = ", 1)[1]
    .split(";\n\n", 1)[0]
)
STYLE_CSS = (ROOT / "webapp" / "style.css").read_text(encoding="utf-8")


def _scope(source: str, start: str, end: str) -> str:
    return source.split(start, 1)[1].split(end, 1)[0]


def test_vehicle_editor_uses_required_and_optional_variant_workspace_modes() -> None:
    assert "function fitmentVehicleWorkspaceMode(" in APP_JS
    mode = extract_function(APP_JS, "deriveVehicleWorkspaceMode")
    assert 'mode: "variant_select_required", collapsible: false' in mode
    assert 'mode: "variant_reselect", collapsible: true' in mode
    assert 'mode: "base_edit", collapsible: false' in mode
    render = extract_function(APP_JS, "renderFitment")
    assert 'vehicleWorkspaceMode === "base_edit"' in render
    assert 'vehicleWorkspaceMode === "variant_reselect"' in render
    assert (
        'modificationSummary.hidden = !canShowModificationRow || vehicleWorkspaceMode === "base_edit";'
        in render
    )
    assert "vehicleSection.dataset.vehicleWorkspaceMode = vehicleWorkspaceMode;" in render


def test_vehicle_editor_order_is_make_model_year_then_conditional_market_on_all_viewports() -> None:
    editor = _scope(
        INDEX_HTML,
        'class="fitment-form-grid" data-fitment-vehicle-editor',
        "data-fitment-modification-summary",
    )
    fields = [
        editor.index('data-fitment-input="vehicle.make"'),
        editor.index('data-fitment-input="vehicle.model"'),
        editor.index('data-fitment-input="vehicle.year"'),
        editor.index('data-fitment-input="vehicle.market"'),
    ]
    assert fields == sorted(fields)
    assert "data-fitment-market-field" in editor
    assert "data-fitment-market-resolution" in editor
    assert 'data-fitment-catalogue-state="makes"' in editor
    assert 'data-fitment-catalogue-state="models"' in editor
    assert 'data-fitment-catalogue-state="years"' in editor
    assert ".fitment-form-grid { grid-template-columns: 1fr; }" in STYLE_CSS


def test_catalogue_field_states_are_explicit_and_accessible() -> None:
    field_state = extract_function(APP_JS, "fitmentCatalogueFieldState")
    for state in (
        "idle_parent_missing",
        "loading",
        "loaded_unselected",
        "selected",
        "no_data",
        "failed",
    ):
        assert f'state: "{state}"' in field_state
    assert any(pair["ru"] == "Сначала выберите марку" for pair in COPY.values())
    assert any(pair["ru"] == "Сначала выберите модель" for pair in COPY.values())
    assert any(pair["ru"] == "Загружаем марки…" for pair in COPY.values())
    assert any(pair["ru"] == "Загружаем модели…" for pair in COPY.values())
    assert any(pair["ru"] == "Загружаем годы…" for pair in COPY.values())
    assert any(pair["ru"] == "Нет доступных марок" for pair in COPY.values())
    assert any(pair["ru"] == "Нет доступных моделей" for pair in COPY.values())
    assert any(pair["ru"] == "Нет доступных годов" for pair in COPY.values())
    assert any(pair["ru"] == "Не удалось загрузить марки" for pair in COPY.values())
    assert any(pair["ru"] == "Не удалось загрузить модели" for pair in COPY.values())
    assert any(pair["ru"] == "Не удалось загрузить годы" for pair in COPY.values())
    assert 'select.setAttribute("aria-busy", String(fieldState.state === "loading"));' in APP_JS
    assert 'data-fitment-catalogue-retry="makes"' in INDEX_HTML
    assert 'data-fitment-catalogue-retry="markets"' in INDEX_HTML


def test_catalogue_memory_is_job_scoped_bounded_expiring_and_nested() -> None:
    assert "FITMENT_CATALOGUE_MEMORY_STORAGE_PREFIX" in APP_JS
    assert "FITMENT_CATALOGUE_MEMORY_TTL_MS" in APP_JS
    assert "FITMENT_CATALOGUE_MEMORY_MAX_MARKETS" in APP_JS
    assert "FITMENT_CATALOGUE_MEMORY_MAX_MAKES_PER_MARKET" in APP_JS
    assert "FITMENT_CATALOGUE_MEMORY_MAX_MODELS_PER_MAKE" in APP_JS
    assert "jobId !== jobId" in APP_JS
    memory = extract_function(APP_JS, "fitmentRememberedVehicleChain")
    assert "lastMake" in memory
    assert "lastModel" in memory
    assert "lastYear" in memory
    assert "persistFitmentCatalogueDraftMemory();" in APP_JS
    assert "state.fitmentCatalogueDraftMemory = loadFitmentCatalogueDraftMemory(jobId);" in APP_JS


def test_parent_changes_abort_and_revalidate_only_current_dependency_chain() -> None:
    assert "function beginFitmentCatalogueContextChange()" in APP_JS
    assert "controller?.abort?.()" in extract_function(APP_JS, "beginFitmentCatalogueContextChange")
    request_guard = extract_function(APP_JS, "isCurrentFitmentCatalogueRequest")
    assert "request.version === state.fitmentCatalogueContextVersion" in request_guard
    assert "request.token === state.fitmentCatalogueRequestToken" in request_guard
    assert (
        "fitmentCatalogueDependencyKey(kind, params) === fitmentCatalogueDependencyKey(kind, fitmentCatalogueCurrentParams(kind))"
        in request_guard
    )
    chain = extract_function(APP_JS, "revalidateFitmentCatalogueChain")
    assert 'await loadFitmentCatalogue("makes"' in chain
    assert 'await loadFitmentCatalogue("models"' in chain
    assert 'await loadFitmentCatalogue("years"' in chain
    assert (
        chain.index('await loadFitmentCatalogue("makes"')
        < chain.index('await loadFitmentCatalogue("models"')
        < chain.index('await loadFitmentCatalogue("years"')
    )
    assert "currentMakeEntry || rememberedMakeEntry" in chain
    assert "currentModelEntry || rememberedModelEntry" in chain
    assert "currentYearEntry || rememberedYearEntry" in chain


def test_no_data_and_failure_have_different_rendering_paths_and_retry_uses_current_context() -> (
    None
):
    loader = extract_function(APP_JS, "loadFitmentCatalogue")
    assert 'state.fitmentCatalogue[kind] = { status: "failed", items: [] };' in loader
    assert 'result.outcome === "no_data"' in loader
    assert 'return { outcome: "failed", items: [] };' in loader
    retry = extract_function(APP_JS, "retryFitmentCatalogue")
    assert "beginFitmentCatalogueContextChange();" in retry
    assert "fitmentCatalogueCurrentParams(kind)" in retry
    assert 'result.outcome === "failed"' in retry
    assert 'retry.hidden = fieldState.state !== "failed";' in APP_JS


def test_save_is_disabled_until_all_four_current_catalogue_selections_are_valid() -> None:
    validation = extract_function(APP_JS, "validateFitmentForm")
    assert '"make", "model", "year"' in validation
    assert 'fitmentCatalogueFieldState(kind, value, locale).state === "selected"' in validation
    assert 'marketState.status === "resolved_single"' in validation
    assert 'marketState.status === "selected"' in validation
    render = extract_function(APP_JS, "renderFitment")
    assert 'state.fitmentFormState.validation !== "valid"' in render
    save = extract_function(APP_JS, "saveFitment")
    assert "state.fitmentFormState.invalidFields?.length" in save


def test_catalogue_values_are_deduplicated_by_canonical_value_and_years_are_deterministic() -> None:
    controls = extract_function(APP_JS, "renderFitmentControls")
    assert 'kind === "years"' in controls
    assert (
        "sort((left, right) => Number(fitmentOptionValue(right)) - Number(fitmentOptionValue(left)))"
        in controls
    )
    assert "value.trim().toLocaleLowerCase()" in controls
    assert "seen.has(key)" in controls
    assert "fitmentCatalogueSelectionItem(kind, value, items)" in APP_JS


def test_catalogue_interactions_have_no_vehicle_patch_and_memory_updates_on_year_change() -> None:
    bindings = APP_JS.rsplit(
        'document.querySelectorAll("[data-fitment-input]").forEach((input) => {', 1
    )[1].split('document.querySelectorAll("[data-fitment-custom]")', 1)[0]
    assert "revalidateFitmentCatalogueChain" in bindings
    assert "rememberFitmentVehicleCatalogueChain();" in bindings
    assert 'method: "PATCH"' not in bindings
    assert 'input.dataset.fitmentCatalogue === "years"' in bindings
    assert "VEHICLE_PATCH" not in bindings
