from pathlib import Path


def test_rim_source_variant_picker_preserves_manual_values() -> None:
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")
    index_html = Path("webapp/index.html").read_text(encoding="utf-8")

    assert "data-fitment-rim-variant-picker" in index_html
    assert "function selectFitmentRimVariant(index)" in app_js
    assert "state.fitmentSourceVariants = result.selection_required" in app_js
    assert "!state.fitmentRimManualFields.includes(fieldName)" in app_js
    assert "data-fitment-rim-variant" in app_js


def test_manual_rim_edits_clear_source_identity_for_authoritative_save() -> None:
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")

    assert "function markRimFieldEdited(path)" in app_js
    assert 'sourceFingerprint: null' in app_js
    assert 'variantState: "none"' in app_js
    assert 'markRimFieldEdited(input.dataset.fitmentInput)' in app_js
    assert 'markRimFieldEdited(path)' in app_js
    assert 'markRimFieldEdited("rim.product_url")' in app_js
