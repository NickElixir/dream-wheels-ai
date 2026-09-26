from pathlib import Path


def test_vnext_create_is_migrated_without_full_remount_updates() -> None:
    bootstrap = Path("webapp/vnext/bootstrap.js").read_text(encoding="utf-8")
    view = Path("webapp/vnext/views/create.js").read_text(encoding="utf-8")

    assert '"create"' in bootstrap
    assert 'window.addEventListener("dreamwheels:createchange"' in bootstrap
    assert "createSurface.update(legacyCreateSnapshot())" in bootstrap
    assert "mountSurface("create", { force: true })" not in bootstrap
    assert "Примерить диски" in bootstrap
    assert "Создать изображение" in view
    assert "Проверить совместимость" in view


def test_wheel_only_refresh_payload_preserves_vehicle_and_excludes_source_files() -> None:
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")
    start = app_js.index("async function refreshCreateWheelFromUrl(productUrl)")
    end = app_js.index("function formatVehicle", start)
    refresh = app_js[start:end]

    assert 'formData.append("draft_id", state.identityDraftId)' in refresh
    assert 'formData.append("rim_product_url", normalizedUrl)' in refresh
    assert 'formData.append("vehicle", JSON.stringify(correctedVehicle))' in refresh
    assert 'formData.append("vehicle_user_confirmed", "true")' in refresh
    assert 'formData.append("car_image"' not in refresh
    assert 'formData.append("wheel_image"' not in refresh
    assert 'state.identityProposal = {' in refresh
    assert "confirmedVehicle:" in refresh
    assert 'state.createParserStatus = "error"' in refresh
    assert "revokeResolvedRimPreviewUrl" in refresh


def test_create_uses_resolved_rim_data_and_manual_edits_for_render_snapshot() -> None:
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")

    start = app_js.index("function selectedRimProposal()")
    end = app_js.index("function emitVNextCreateChange", start)
    selected = app_js[start:end]

    for field in (
        "brand",
        "model",
        "sku",
        "wheel_diameter_in",
        "wheel_width_j",
        "bolt_count",
        "pcd_mm",
        "center_bore_mm",
        "offset_et_mm",
    ):
        assert field in selected

    assert 'variant_state: proposal.variant_state || "none"' in selected
    assert "selected_variant_sku" in selected
    assert "rim_user_confirmed: state.manualRimEdited" in app_js


def test_create_render_readiness_has_no_fitment_gate() -> None:
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")
    start = app_js.index("function vnextCreateSnapshot()")
    end = app_js.index("function saveCreateVehicle", start)
    snapshot = app_js[start:end]

    can_create = snapshot[snapshot.index("canCreate:"): snapshot.index("canCheckFitment:")]
    assert "fitment" not in can_create.lower()
    assert "state.identityDraftId" in can_create
    assert "state.photoConsentAccepted" in can_create


def test_parser_variant_state_is_presented_without_fabricating_values() -> None:
    view = Path("webapp/vnext/views/create.js").read_text(encoding="utf-8")

    assert 'model.rim?.variant_state === "selection_required"' in view
    assert "точные параметры не выбраны" in view
    assert "selected_variant_sku" not in view or "selected_variant_sku" in view
    assert "Параметры не указаны" in view


def test_create_mobile_contract_stacks_pair_and_actions() -> None:
    css = Path("webapp/vnext/styles/surfaces.css").read_text(encoding="utf-8")

    assert "@media (max-width: 700px)" in css
    assert ".vnext-create__pair { grid-template-columns: 1fr;" in css
    assert ".vnext-create__actions" in css
    assert "grid-template-columns: 1fr" in css
