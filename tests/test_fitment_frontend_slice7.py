from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
JOBS_API = (ROOT / "src" / "jobs_api.py").read_text(encoding="utf-8")


def test_transient_fitment_draft_is_bounded_session_scoped_and_safe() -> None:
    assert "FITMENT_TRANSIENT_DRAFT_STORAGE_PREFIX" in APP_JS
    assert "FITMENT_TRANSIENT_DRAFT_TTL_MS = 30 * 60 * 1000" in APP_JS
    assert "expiresAt: now + FITMENT_TRANSIENT_DRAFT_TTL_MS" in APP_JS
    assert "sessionStorage.setItem(key, JSON.stringify(fitmentDraftPayload(reason)))" in APP_JS
    assert "raw provider payload" not in APP_JS
    assert "check technical result" not in APP_JS


def test_restore_compares_authoritative_revisions_before_merging() -> None:
    assert "function fitmentRevisionBaseline(" in APP_JS
    assert "function fitmentDraftMatchesOverview(" in APP_JS
    assert "function fitmentDraftVehicleMatchesOverview(" in APP_JS
    assert "frontSourceFingerprint" in APP_JS
    assert "rearSourceFingerprint" in APP_JS
    assert "if (!fitmentDraftMatchesOverview(draft, overview))" in APP_JS
    assert "state.fitmentRestoreConflict" in APP_JS
    assert "vehicleConflict: !fitmentDraftVehicleMatchesOverview(draft, overview)" in APP_JS
    assert "data-fitment-restore-conflict-apply" in INDEX_HTML


def test_stale_conflict_keeps_server_modification_and_drops_stale_sku() -> None:
    safe_conflict = APP_JS.split("function fitmentSafeConflictDraft(")[1].split(
        "function fitmentDraftPayload("
    )[0]
    assert "const authoritative = fitmentFormFromOverview(overview);" in safe_conflict
    assert "safe.vehicle = authoritative.vehicle;" in safe_conflict
    assert 'safe.rim.sku = ""' in safe_conflict


def test_rim_save_has_an_isolated_vehicle_mutation_boundary() -> None:
    payload = APP_JS.split("function fitmentPayload(")[1].split("function fitmentValuesEqual")[0]
    save = APP_JS.split("async function saveFitment(")[1].split(
        "async function fetchRenderHistory"
    )[0]
    assert "fitmentVehicleDirty" in APP_JS
    assert "function markVehicleFieldEdited(path)" in APP_JS
    assert "if (includeVehicle)" in payload
    assert "fitmentPayload({ includeVehicle: state.fitmentVehicleDirty })" in save
    assert "demoServerTransition(transition, fitmentPayload())" in save
    assert "state.fitmentVehicleDirty = false;" in save
    assert "state.fitmentVehicleDirty = true" in APP_JS


def test_ordinary_return_is_silent_but_401_restoration_is_explicit() -> None:
    open_fitment = APP_JS.split("function openFitmentView(")[1].split("function closeFitmentView")[
        0
    ]
    assert 'restoreReason: "navigation"' in open_fitment
    assert "Данные восстановлены" not in open_fitment
    resume = APP_JS.split("async function resumeFitmentAfterLogin()")[1].split(
        "function logoutWebsiteAuth"
    )[0]
    assert "Данные восстановлены" in resume
    assert 'restoreReason: "reauth"' in resume


def test_401_stops_requests_and_never_replays_a_mutation() -> None:
    auth = APP_JS.split("function showFitmentAuthRequired()")[1].split(
        "function logoutWebsiteAuth"
    )[0]
    assert "clearFitmentRuntimeRequests();" in auth
    assert 'persistFitmentTransientDraft("reauth")' in auth
    resume = APP_JS.split("async function resumeFitmentAfterLogin()")[1].split(
        "function logoutWebsiteAuth"
    )[0]
    for forbidden in (
        "saveFitment(",
        "runFitmentCheck(",
        "loadFitmentVehicleVariants(",
        "resolveFitmentRimSource(",
    ):
        assert forbidden not in resume


def test_navigation_tears_down_requests_and_resumes_only_current_pending_check() -> None:
    assert "function clearFitmentRuntimeRequests()" in APP_JS
    assert "state.fitmentSourceController?.abort?.()" in APP_JS
    assert 'persistFitmentTransientDraft("navigation")' in APP_JS
    assert "if (fitmentCheckIsPending(state.fitmentCheck)) pollFitmentCheck" in APP_JS
    assert (
        "if (response.status === 401) {\n                showFitmentAuthRequired();\n                return;"
        in APP_JS
    )


def test_render_cta_and_fitment_entry_are_independent_of_render_completion() -> None:
    assert "function fitmentReturnAction(overview)" in APP_JS
    assert "current_check" in APP_JS
    assert 'setView("create")' in APP_JS
    assert (
        "WHEN jobs.status = 'completed'"
        not in JOBS_API.split("def _fitment_available_clause()")[1].split(
            "def _job_assets_join_clause()"
        )[0]
    )
    assert "Fitment overview is available only for completed jobs" not in JOBS_API


def test_source_conflicts_and_staggered_draft_are_part_of_semantic_restore() -> None:
    payload = APP_JS.split("function fitmentDraftPayload(")[1].split(
        "function persistFitmentTransientDraft"
    )[0]
    assert "source:" in payload
    assert "conflicts:" in payload
    assert "cloneFitmentForm(state.fitmentForm)" in payload
    assert "setup_mode" in APP_JS
