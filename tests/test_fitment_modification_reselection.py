from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
STYLE_CSS = (ROOT / "webapp" / "style.css").read_text(encoding="utf-8")


def test_confirmed_modification_uses_one_inline_toggle_and_no_extra_reselection_cta() -> None:
    assert "data-fitment-modification-toggle" in INDEX_HTML
    assert "data-fitment-modification-option" in APP_JS
    assert "data-fitment-modification-retry" in INDEX_HTML
    assert 'aria-controls="fitment-modification-options"' in INDEX_HTML
    assert "function toggleFitmentModificationPicker()" in APP_JS
    assert "function replaceFitmentVehicleVariant(variant)" in APP_JS
    assert "data-fitment-modification-name>Не выбрана" in INDEX_HTML
    assert "Текущая комплектация останется сохранённой" not in APP_JS
    assert "Оставить текущую" not in APP_JS


def test_reselection_is_read_only_until_a_different_canonical_candidate_is_clicked() -> None:
    reselect = APP_JS.split("async function loadFitmentVehicleVariantsForReselection", 1)[1].split(
        "function toggleFitmentModificationPicker", 1
    )[0]
    replacement = APP_JS.split("async function replaceFitmentVehicleVariant", 1)[1].split(
        "async function saveFitment", 1
    )[0]
    assert "/vehicle-variants/reselect" in reselect
    assert "/vehicle-variants/replace" in replacement
    assert "expected_current_selection" in replacement
    assert "new_selection" in replacement
    assert "fitmentVariantsMatch(current, variant)" in replacement
    assert "fitmentVariantPayload(variant)" in replacement
    assert "state.fitmentModificationPickerOpen = false" in replacement


def test_current_option_is_preselected_and_initial_flow_keeps_its_confirmation() -> None:
    render = APP_JS.split("function renderFitment()", 1)[1].split(
        "function renderFitmentRimVariants", 1
    )[0]
    assert "fitmentVariantsMatch(selectedVariant, variant)" in render
    assert 'button.setAttribute("aria-pressed", String(isSelected));' in render
    assert 'marker.textContent = isSelected ? "✓" : "";' in render
    assert 'state.fitmentModificationLookupMode === "initial"' in render
    assert 'confirm.dataset.fitmentConfirmVariant = "true"' in render
    assert 'state.fitmentModificationLookupMode === "reselect"' in APP_JS


def test_synthetic_demo_ids_never_use_the_real_fitment_jobs_api() -> None:
    assert 'const GUEST_FITMENT_DEMO_JOB_ID = "guest-demo-zeekr";' in APP_JS
    assert '"guest-demo-prius"' in APP_JS
    assert "function shouldUseDemoFitment(jobId = state.fitmentJobId)" in APP_JS
    should_use_demo = APP_JS.split("function shouldUseDemoFitment", 1)[1].split(
        "function fitmentPreviewProvenance", 1
    )[0]
    assert "hasFrontendAuth" not in should_use_demo
    overview = APP_JS.split("async function loadFitmentOverview", 1)[1].split(
        "async function loadFitmentVehicleCatalogue", 1
    )[0]
    assert overview.index("if (shouldUseDemoFitment(jobId))") < overview.index(
        "const response = await fetch"
    )
    assert "return { ...parsed, job_id: GUEST_FITMENT_DEMO_JOB_ID };" in APP_JS


def test_reselection_list_is_compact_and_mobile_safe() -> None:
    assert ".fitment-modification-option" in STYLE_CSS
    assert ".fitment-modification-option-marker" in STYLE_CSS
    mobile = STYLE_CSS.split("@media (max-width: 760px)", 1)[1]
    assert ".fitment-modification-row" in mobile
    assert ".fitment-modification-feedback" in mobile
