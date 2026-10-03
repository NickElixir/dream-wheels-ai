import { buildFitmentRimReadiness } from "../webapp/vnext/fitment-readiness.mjs";
import { fitmentDisplayValue } from "../webapp/vnext/fitment-display.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { fitmentMarkup } from "../webapp/vnext/views/fitment.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "webapp", "app.js"), "utf8");
const APP_SOURCE_FOR_VM = APP_SOURCE.replace(
    /^import \{[\s\S]*?\} from "\.\/app-route\.mjs";\n\n/u,
    `const fitmentDisplayValue = ${fitmentDisplayValue.toString()};\nconst buildFitmentRimReadiness = ${buildFitmentRimReadiness.toString()};\n`,
).replace(/import \{ fitmentDisplayValue \} from "\.\/vnext\/fitment-display\.mjs";\nimport \{ buildFitmentRimReadiness \} from "\.\/vnext\/fitment-readiness\.mjs";\n\n/u, "");

function storage() {
    const values = new Map();
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
    };
}

function element() {
    return {
        dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {}, append() {}, appendChild() {}, remove() {},
        setAttribute() {}, removeAttribute() {}, querySelector() { return null; },
        querySelectorAll() { return []; },
    };
}

function workflowApi() {
    const document = {
        documentElement: { dataset: { appBuild: "transition-test" } },
        head: { append() {} }, body: element(), hidden: false,
        addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
        createElement: element,
    };
    const window = {
        Telegram: { Login: {} }, location: { search: "" }, innerWidth: 1280,
        setTimeout, clearTimeout, requestAnimationFrame(callback) { callback(); },
        addEventListener() {}, scrollTo() {}, open() {},
    };
    const context = {
        AbortController, URL, URLSearchParams, console, document, window,
        fetch: async () => ({ ok: true, status: 200, async json() { return {}; }, async text() { return "{}"; } }),
        localStorage: storage(), sessionStorage: storage(), navigator: { language: "ru-RU", userAgent: "test" },
        setTimeout, clearTimeout, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(`
const applicationRouteContext = () => null;
const isApplicationRoute = () => false;
const safeApplicationReturnPath = () => null;
${APP_SOURCE_FOR_VM}
globalThis.__workflowApi = { deriveFitmentNextIntent, deriveVehicleWorkspaceMode, deriveResultRecovery, deriveNavigatorPresentation, fitmentVerdictMessage };`, context);
    return context.__workflowApi;
}

const confirmed = {
    vehicle_state: "confirmed_ready",
    modification_state: "confirmed",
    selected_modification: { modification: "Electric Performance" },
    next_action: { kind: "run_standard_check" },
};

test("required variant selection is a non-collapsible workspace", () => {
    const api = workflowApi();
    const overview = { ...confirmed, modification_state: "none", selected_modification: null, next_action: { kind: "select_vehicle_variant" } };
    const workspace = api.deriveVehicleWorkspaceMode(overview, { vehicleEditing: false, pickerOpen: true });

    assert.equal(workspace.mode, "variant_select_required");
    assert.equal(workspace.collapsible, false);
    assert.equal(workspace.showHideAction, false);
});

test("stale result recovery follows next_action instead of exposing recheck early", () => {
    const api = workflowApi();
    const overview = { ...confirmed, modification_state: "none", selected_modification: null, next_action: { kind: "select_vehicle_variant" } };
    const recovery = api.deriveResultRecovery(overview, { execution_status: "completed", is_current: false });

    assert.deepEqual(JSON.parse(JSON.stringify(recovery)), {
        section: "vehicle", intent: "variant_select_required", label: "Выбрать комплектацию", canRunCheck: false,
    });
});

test("navigator never reports Vehicle confirmed while exact variant is required", () => {
    const api = workflowApi();
    const overview = { ...confirmed, modification_state: "none", selected_modification: null, next_action: { kind: "select_vehicle_variant" } };

    assert.equal(api.deriveNavigatorPresentation(overview, null).vehicle.label, "Нужно выбрать комплектацию");
});

test("confirmed optional reselection remains collapsible", () => {
    const api = workflowApi();
    const workspace = api.deriveVehicleWorkspaceMode(confirmed, { vehicleEditing: false, pickerOpen: true });

    assert.equal(workspace.mode, "variant_reselect");
    assert.equal(workspace.collapsible, true);
    assert.equal(workspace.showHideAction, true);
});

test("ET verdict copy uses one value when the reference interval is a single point", () => {
    const api = workflowApi();
    const message = api.fitmentVerdictMessage({
        code: "et_outside_reference_range",
        details: { rim_et_mm: 40, reference_et_min_mm: 50, reference_et_max_mm: 50 },
    });

    assert.match(message, /ET50\b/);
    assert.doesNotMatch(message, /ET50–50/);
});

test("ET verdict copy keeps both endpoints for a real interval", () => {
    const api = workflowApi();
    const message = api.fitmentVerdictMessage({
        code: "et_outside_reference_range",
        details: { rim_et_mm: 30, reference_et_min_mm: 35, reference_et_max_mm: 45 },
    });

    assert.match(message, /ET35–45/);
});

function response(status, body = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        async json() { return body; },
        async text() { return JSON.stringify(body); },
    };
}

function navigationApi({ routes = {}, vnext = false } = {}) {
    const calls = [];
    const localStorage = storage();
    const sessionStorage = storage();
    const document = {
        documentElement: { dataset: { appBuild: "navigation-test" } },
        head: { append() {} }, body: element(), hidden: false,
        addEventListener() {}, querySelector(selector) { return vnext && selector === "[data-vnext-fitment-root]" ? element() : null; }, querySelectorAll() { return []; },
        createElement: element,
    };
    const window = {
        Telegram: { Login: {} }, location: { search: "" }, innerWidth: 1280,
        setTimeout, clearTimeout, requestAnimationFrame(callback) { callback(); },
        addEventListener() {}, scrollTo() {}, open() {},
    };
    const context = {
        AbortController, URL, URLSearchParams, Blob, File, FormData, console, document, window,
        fetch: async (url, options = {}) => {
            const key = `${options.method || "GET"} ${new URL(url, "https://test.local").pathname}`;
            calls.push(key);
            const handler = routes[key];
            return typeof handler === "function" ? handler(options, url) : handler || response(404, { detail: key });
        },
        localStorage, sessionStorage, navigator: { language: "ru-RU", userAgent: "test" },
        setTimeout, clearTimeout, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(`
        const applicationRouteContext = () => null;
        const isApplicationRoute = () => false;
        const safeApplicationReturnPath = () => null;
        ${APP_SOURCE_FOR_VM}
        globalThis.__fitmentRenderedWorkspace = "";
        renderFitment = () => { globalThis.__fitmentRenderedWorkspace = state.fitmentActiveSection; };
        loadFitmentVehicleCatalogue = () => {};
        globalThis.__realEnsureRequiredFitmentVariantLookup = ensureRequiredFitmentVariantLookup;
        ensureRequiredFitmentVariantLookup = () => {};
        const realLoadFitmentCheckHistory = loadFitmentCheckHistory;
        const realRefreshFitmentCheckCurrentness = refreshFitmentCheckCurrentness;
        loadFitmentCheckHistory = async () => {};
        loadRenderHistory = async () => {};
        refreshFitmentCheckCurrentness = async () => {};
        globalThis.__realValidateFitmentForm = validateFitmentForm;
        validateFitmentForm = () => [];
        globalThis.__fitmentFormIsDirty = fitmentFormIsDirty;
        fitmentFormIsDirty = () => false;
        globalThis.__navigationApi = {
            state, humanRenderTitle, buildDefaultDemoFitmentOverview, fitmentFormFromOverview, cloneFitmentForm,
            fitmentCatalogueSelectionItem,
            awaitingVehicleConfirmation: () => Boolean(vnextFitmentSnapshot().vehicleAwaitingConfirmation),
            useRealValidation() { validateFitmentForm = globalThis.__realValidateFitmentForm; },
            fitmentEffectiveRim, fitmentRimSpecs, fitmentFormIsDirty: globalThis.__fitmentFormIsDirty, fitmentPayload, revalidateFitmentCatalogueChain,
            deriveVehicleWorkspaceMode, fitmentVehicleWorkspaceMode,
            persistFitmentTransientDraft, restoreFitmentTransientDraft, discardFitmentTransientDraft,
            rebaseFitmentTransientVehicleDraft,
            fitmentDraftMatchesOverview,
            openFitmentView,
            loadFitmentOverview, loadFitmentVehicleVariants, applyFitmentVehicleVariant,
            replaceFitmentVehicleVariant, saveFitment, setFitmentActiveSection, demoServerTransition,
            fitmentCanonicalRimConflicts, fitmentRimPendingProposalFields, fitmentRimSaveReadiness,
            applyRimSourceValues, markRimFieldEdited,
            selectFitmentRimVariant,
            bridge: window.dreamwheelsFitmentBridge, saveVnextFitment, setVnextFitmentField,
            snapshot: vnextFitmentSnapshot, fitmentWheelDraftIsDirty, fitmentWheelSource, buildRenderExpiryCohorts, vnextDashboardSnapshot,
            recognizeFitmentVehicle, useFitmentRecognitionProposal, setFitmentVehiclePhoto,
            runFitmentCheck, fitmentMutationsLocked, clearFitmentCheckPolling, clearFitmentRuntimeRequests, reconcileRequiredFitmentWorkspace,
            useRealVariantLookup() { ensureRequiredFitmentVariantLookup = globalThis.__realEnsureRequiredFitmentVariantLookup; },
            realLoadFitmentCheckHistory,
            refreshCurrentness: realRefreshFitmentCheckCurrentness,
            saveWithRealCurrentness(...args) {
                refreshFitmentCheckCurrentness = realRefreshFitmentCheckCurrentness;
                return saveFitment(...args).finally(() => { refreshFitmentCheckCurrentness = async () => {}; });
            },
            reselectionVariants: loadFitmentVehicleVariantsForReselection,
            toggleModificationPicker: toggleFitmentModificationPicker,
            resolveFitmentRimSource,
            navigateFitmentRecovery,
            renderedWorkspace: () => globalThis.__fitmentRenderedWorkspace
        };`, context);
    return { api: context.__navigationApi, calls, sessionStorage };
}

function pcdProjectionApi() {
    const pcdSelect = {
        ...element(),
        value: "",
        options: [
            { value: "" },
            { value: "4x100" },
            { value: "4x108" },
            { value: "5x112" },
            { value: "custom" },
        ],
    };
    const pcdCustom = {
        ...element(),
        dataset: { fitmentInput: "rim.pcd_mm" },
        hidden: true,
        value: "",
    };
    const document = {
        documentElement: { dataset: { appBuild: "pcd-projection-test" } },
        head: { append() {} }, body: element(), hidden: false,
        addEventListener() {},
        querySelector(selector) {
            if (selector === "[data-fitment-pcd-select]") return pcdSelect;
            if (selector === "[data-fitment-pcd-custom]") return pcdCustom;
            return null;
        },
        querySelectorAll(selector) {
            return selector === "[data-fitment-input]" ? [pcdCustom] : [];
        },
        createElement: element,
        createTextNode(value) { return { textContent: value }; },
    };
    const window = {
        Telegram: { Login: {} }, location: { search: "" }, innerWidth: 1280,
        setTimeout, clearTimeout, requestAnimationFrame(callback) { callback(); },
        addEventListener() {}, scrollTo() {}, open() {},
    };
    const calls = [];
    const context = {
        AbortController, URL, URLSearchParams, console, document, window,
        fetch: async (...args) => {
            calls.push(args);
            return response(200, {});
        },
        localStorage: storage(), sessionStorage: storage(), navigator: { language: "ru-RU", userAgent: "test" },
        setTimeout, clearTimeout, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(`
        const applicationRouteContext = () => null;
        const isApplicationRoute = () => false;
        const safeApplicationReturnPath = () => null;
        ${APP_SOURCE_FOR_VM}
        globalThis.__pcdProjectionApi = {
            state, buildDefaultDemoFitmentOverview, fitmentFormFromOverview,
            syncFitmentPcdControl, renderFitment,
        };`, context);
    return { api: context.__pcdProjectionApi, pcdSelect, pcdCustom, calls };
}

function renderV2RimEditor(api, rim) {
    const overview = api.buildDefaultDemoFitmentOverview();
    overview.front_rim = { rim };
    api.state.fitmentOverview = overview;
    api.state.fitmentForm = api.fitmentFormFromOverview(overview);
    api.state.fitmentActiveSection = "rim";
    api.state.fitmentActiveStep = 2;
    api.state.fitmentRimEditing = true;
    api.renderFitment();
}

function overviewFor(api, nextAction, { confirmedVariant = false } = {}) {
    const overview = JSON.parse(JSON.stringify(api.buildDefaultDemoFitmentOverview()));
    overview.job_id = "behavior-job";
    overview.next_action = { kind: nextAction };
    if (confirmedVariant) {
        overview.vehicle_state = "confirmed_ready";
        overview.modification_state = "confirmed";
        overview.selected_modification = variant("A");
        overview.modification_vehicle_revision = overview.vehicle_revision;
    }
    return overview;
}

function variant(name) {
    return {
        make_slug: "zeekr", model_slug: "007", region: "cn",
        generation_slug: "ev", modification_slug: name.toLowerCase(), modification: name,
    };
}

function seed(api, overview, section = "vehicle") {
    api.state.fitmentJobId = "behavior-job";
    api.state.fitmentOverview = overview;
    api.state.fitmentForm = api.fitmentFormFromOverview(overview);
    api.state.fitmentFormState = {
        status: "clean", validation: "valid", baseline: api.cloneFitmentForm(api.state.fitmentForm), missingFields: [], invalidFields: [],
    };
    api.state.fitmentActiveSection = section;
    api.state.fitmentActiveStep = section === "vehicle" ? 1 : section === "rim" ? 2 : 3;
    api.state.fitmentVehicleDirty = false;
    api.state.fitmentVehicleEditing = false;
    api.state.fitmentRimEditing = false;
}

test("Standard Check uses canonical IDs only, locks mutations and rejects duplicate start", async () => {
    let release, payload;
    const { api, calls } = navigationApi({ routes: {
        "POST /api/backend/fitment/checks": options => {
            payload = JSON.parse(options.body);
            return new Promise(resolve => { release = resolve; });
        },
    } });
    const overview = overviewFor(api, "run_standard_check");
    seed(api, overview, "result");
    api.state.fitmentForm.rim.offset_et_mm = "99,125";
    api.state.fitmentFormState.baseline = api.cloneFitmentForm(api.state.fitmentForm);
    const request = api.runFitmentCheck();
    assert.equal(api.fitmentMutationsLocked(), true);
    api.setVnextFitmentField("rim.offset_et_mm", "30");
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, "99,125");
    await api.saveFitment();
    await api.runFitmentCheck();
    assert.equal(calls.filter(call => call.startsWith("POST")).length, 1);
    assert.equal(calls.some(call => call.startsWith("PATCH")), false);
    assert.deepEqual(Object.keys(payload).sort(), ["mode", "render_job_id", "rim_setup_id", "trigger", "vehicle_identity_id"]);
    release(response(200, { id: "check", execution_status: "failed" }));
    await request;
    assert.equal(api.fitmentMutationsLocked(), false);
    assert.equal(api.state.fitmentOverview, overview);
});

test("Standard Check requires server progression and discards a response after navigation", async () => {
    let release;
    const { api, calls } = navigationApi({ routes: {
        "POST /api/backend/fitment/checks": () => new Promise(resolve => { release = resolve; }),
    } });
    seed(api, overviewFor(api, "complete_rim_specs"), "result");
    await api.runFitmentCheck();
    assert.equal(calls.includes("POST /api/backend/fitment/checks"), false);
    api.state.fitmentOverview.next_action = { kind: "run_standard_check" };
    const request = api.runFitmentCheck();
    api.clearFitmentCheckPolling();
    api.state.fitmentJobId = "another-job";
    api.state.fitmentChecking = false;
    release(response(200, { id: "obsolete", execution_status: "completed" }));
    await request;
    assert.equal(api.state.fitmentCheck, null);
    assert.equal(api.state.fitmentChecking, false);
    api.state.fitmentCheck = { execution_status: "queued" };
    assert.equal(api.fitmentMutationsLocked(), true, "poll transport failure must not unlock a pending snapshot");
});

test("history hydrates the current overview summary and ignores a late detail after navigation", async () => {
    let release;
    const detail = { id: "saved", execution_status: "completed", verdict: "compatible", field_results: [{ field: "offset_et_mm", rim_value: "33.275" }] };
    const { api } = navigationApi({ routes: {
        "GET /api/backend/fitment/checks": response(200, { checks: [{ id: "saved", execution_status: "completed", is_current: true }] }),
        "GET /api/backend/fitment/checks/saved": () => new Promise(resolve => { release = resolve; }),
    } });
    seed(api, overviewFor(api, "run_standard_check"), "result");
    api.state.fitmentCheck = { id: "saved", execution_status: "completed" };
    const read = api.realLoadFitmentCheckHistory();
    while (!release) await new Promise(resolve => setImmediate(resolve));
    release(response(200, detail));
    await read;
    assert.equal(api.state.fitmentCheck.field_results[0].rim_value, "33.275");
    release = null;
    const late = api.realLoadFitmentCheckHistory();
    while (!release) await new Promise(resolve => setImmediate(resolve));
    api.state.fitmentJobId = "another-job";
    api.state.fitmentCheck = null;
    release(response(200, detail));
    await late;
    assert.equal(api.state.fitmentCheck, null);
});

function sourceVariant(sku, values) { return { sku, values }; }

function seedSourceSelection(api, { acceptedBore = true, manualOffset = false } = {}) {
    const overview = overviewFor(api, "complete_rim_specs");
    seed(api, overview, "rim");
    const fields = {
        wheel_diameter_in: 19, wheel_width_j: 8.5, bolt_count: 5, pcd_mm: 112,
        center_bore_mm: acceptedBore ? 66.6 : "", offset_et_mm: 30,
    };
    Object.assign(api.state.fitmentForm.rim, fields, { product_url: "https://shop.example/wheel" });
    api.state.fitmentSourceIdentity = { sourceFingerprint: "source-fp", selectedVariantSku: "sku-a", variantState: "selection_required", sourceUrl: "https://shop.example/wheel" };
    api.state.fitmentSourceVariants = [sourceVariant("sku-b", {
        wheel_diameter_in: 19, wheel_width_j: 8.5, bolt_count: 5, pcd_mm: 112,
        center_bore_mm: acceptedBore ? 66.6 : 67.1, offset_et_mm: 45,
    })];
    api.state.fitmentSourceAcceptedContexts = acceptedBore ? {
        center_bore_mm: { sourceFingerprint: "source-fp", selectedVariantSku: "sku-a", value: 66.6 },
    } : {};
    if (manualOffset) {
        api.state.fitmentRimManualFields = ["offset_et_mm"];
        api.state.fitmentForm.rim.offset_et_mm = 30;
        api.state.fitmentSourceConflicts = [{ field: "offset_et_mm", current: 30, suggested: 30, origin: "manual" }];
    }
}

test("changing SKU keeps an identical accepted value pending for the new source context", () => {
    const { api } = navigationApi();
    seedSourceSelection(api);
    api.selectFitmentRimVariant(0);
    assert.deepEqual(JSON.parse(JSON.stringify(api.state.fitmentSourceProposalContexts.center_bore_mm)), {
        sourceFingerprint: "source-fp", selectedVariantSku: "sku-b", value: 66.6,
    });
    assert.ok(api.fitmentRimPendingProposalFields().includes("center_bore_mm"));
    assert.equal(api.state.fitmentSourceAcceptedContexts.center_bore_mm, undefined);
});

test("changing SKU clears an accepted field that the new SKU does not provide", () => {
    const { api } = navigationApi();
    seedSourceSelection(api);
    api.state.fitmentSourceVariants[0].values.center_bore_mm = null;
    api.selectFitmentRimVariant(0);
    assert.equal(api.state.fitmentForm.rim.center_bore_mm, "");
    assert.equal(api.state.fitmentSourceAcceptedContexts.center_bore_mm, undefined);
    assert.ok(api.fitmentRimSaveReadiness().missing.includes("rim.center_bore_mm"));
});

test("changing SKU leaves changed source values pending and preserves manual source conflicts", () => {
    const { api } = navigationApi();
    seedSourceSelection(api, { acceptedBore: false, manualOffset: true });
    api.selectFitmentRimVariant(0);
    assert.equal(api.state.fitmentForm.rim.center_bore_mm, 67.1);
    assert.ok(api.fitmentRimPendingProposalFields().includes("center_bore_mm"));
    assert.ok(api.state.fitmentSourceConflicts.some(conflict => conflict.field === "offset_et_mm" && conflict.origin === "manual"));
    assert.equal(api.fitmentRimSaveReadiness().ready, false);
});

test("bridge URL change clears old resolver provenance while preserving manual values and rear draft", () => {
    const { api } = navigationApi({ vnext: true });
    seedSourceSelection(api, { manualOffset: true });
    api.state.fitmentForm.rear_rim = { wheel_diameter_in: 20 };
    api.state.fitmentSourceProposalContexts = {
        wheel_diameter_in: { sourceFingerprint: "source-fp", selectedVariantSku: "sku-a", value: 19 },
    };
    api.state.fitmentForm.rim.wheel_diameter_in = 19;
    api.bridge.setSourceUrl("https://shop.example/another-wheel");
    assert.equal(api.state.fitmentSourceIdentity.sourceFingerprint, null);
    assert.equal(api.state.fitmentSourceIdentity.selectedVariantSku, null);
    assert.equal(api.state.fitmentSourceIdentity.variantState, "none");
    assert.equal(api.state.fitmentSourceProposalContexts.wheel_diameter_in, undefined);
    assert.equal(api.state.fitmentForm.rim.wheel_diameter_in, "");
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 30);
    assert.equal(api.state.fitmentForm.rear_rim.wheel_diameter_in, 20);
    assert.equal(api.state.fitmentSourceConflicts.length, 0);
});

test("URL replacement followed by the Save action cannot PATCH mixed old SKU provenance", async () => {
    let payload;
    let api;
    ({ api } = navigationApi({ vnext: true, routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": options => {
            payload = JSON.parse(options.body);
            return response(200, overviewFor(api, "complete_rim_specs"));
        },
    } }));
    seedSourceSelection(api, { manualOffset: true });
    for (const field of ["wheel_diameter_in", "wheel_width_j", "bolt_count", "pcd_mm", "center_bore_mm"]) {
        api.state.fitmentRimManualFields.push(field);
    }
    api.state.fitmentSourceAcceptedContexts = {};
    api.state.fitmentSourceProposalContexts = {};
    api.state.fitmentSourceAppliedFields = [];
    api.bridge.setSourceUrl("https://shop.example/another-wheel");
    api.bridge.action("save-rim");
    while (!payload) await new Promise(resolve => setImmediate(resolve));
    assert.equal(payload.rim.product_url, "https://shop.example/another-wheel");
    assert.equal(payload.rim.source_fingerprint, null);
    assert.equal(payload.rim.selected_variant_sku, null);
    assert.equal(payload.rim.variant_state, "none");
    assert.equal(Object.hasOwn(payload, "vehicle"), false);
});

for (const detailStatus of [503, 200]) {
    test(`mutation current_check false remains stale after detail refresh ${detailStatus}`, async () => {
        const prior = { id: "old-check", execution_status: "completed", is_current: true, verdict: "incompatible", field_results: [{ rim_value: 30 }] };
        let api;
        ({ api } = navigationApi({ routes: {
            "PATCH /api/backend/jobs/behavior-job/fitment": () => response(200, {
                ...overviewFor(api, "run_standard_check"), rim_revision: 3,
                current_check: { id: "old-check", execution_status: "completed", is_current: false },
            }),
            "GET /api/backend/fitment/checks/old-check": response(detailStatus, detailStatus === 200 ? { ...prior, is_current: true } : { detail: "unavailable" }),
        } }));
        const overview = overviewFor(api, "complete_rim_specs");
        overview.rim_revision = 2;
        seed(api, overview, "rim");
        api.state.fitmentCheck = prior;
        api.state.fitmentForm.rim.offset_et_mm = "31";
        await api.saveWithRealCurrentness(undefined, { owner: "rim", confirmWheelFields: true });
        assert.equal(api.state.fitmentCheck.is_current, false);
        assert.equal(api.state.fitmentCheck.verdict, "incompatible");
        assert.equal(api.state.fitmentCheck.field_results[0].rim_value, 30);
    });
}

test("mutation without canonical revision change does not mark a current check stale", async () => {
    let api;
    ({ api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": () => response(200, {
            ...overviewFor(api, "run_standard_check"), rim_revision: 2,
            current_check: { id: "old-check", execution_status: "completed", is_current: true },
        }),
        "GET /api/backend/fitment/checks/old-check": response(200, { id: "old-check", execution_status: "completed", is_current: true }),
    } }));
    const overview = overviewFor(api, "complete_rim_specs");
    overview.rim_revision = 2;
    seed(api, overview, "rim");
    api.state.fitmentCheck = { id: "old-check", execution_status: "completed", is_current: true };
    await api.saveWithRealCurrentness(undefined, { owner: "rim" });
    assert.equal(api.state.fitmentCheck.is_current, true);
});

function assertSection(api, section) {
    assert.equal(api.state.fitmentActiveSection, section);
    assert.equal(api.renderedWorkspace(), section);
}

function workspaceMode(api, overview = api.state.fitmentOverview) {
    return api.deriveVehicleWorkspaceMode(overview, {
        vehicleEditing: api.state.fitmentVehicleEditing || api.state.fitmentVehicleDirty,
        pickerOpen: api.state.fitmentModificationPickerOpen,
    }).mode;
}

function resetToAuthoritativeVehicle(api, overview) {
    api.state.fitmentOverview = overview;
    api.state.fitmentForm = api.fitmentFormFromOverview(overview);
    api.state.fitmentFormState = {
        status: "clean", validation: "valid", baseline: api.cloneFitmentForm(api.state.fitmentForm), missingFields: [], invalidFields: [],
    };
    api.state.fitmentVehicleDirty = false;
    api.state.fitmentVehicleEditing = false;
}

test("SAVE_VEHICLE_PRESERVES_SECTION", async () => {
    let api;
    const next = () => response(200, overviewFor(api, "select_vehicle_variant"));
    ({ api } = navigationApi({ routes: { "PATCH /api/backend/jobs/behavior-job/fitment": next } }));
    seed(api, overviewFor(api, "complete_vehicle_details"));
    await api.saveFitment();
    assertSection(api, "vehicle");
});

test("SINGLE_AUTO_VARIANT_PRESERVES_SECTION", async () => {
    let api;
    ({ api } = navigationApi({ routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants": response(200, { outcome: "single" }),
        "GET /api/backend/jobs/behavior-job/fitment": () => response(200, overviewFor(api, "complete_rim_specs", { confirmedVariant: true })),
    } }));
    seed(api, overviewFor(api, "select_vehicle_variant"));
    await api.loadFitmentVehicleVariants();
    assertSection(api, "vehicle");
    assert.equal(api.state.fitmentOverview.modification_state, "confirmed");
});

test("MANUAL_VARIANT_PRESERVES_SECTION", async () => {
    let api;
    ({ api } = navigationApi({ routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants/apply": response(200, {}),
        "GET /api/backend/jobs/behavior-job/fitment": () => {
            const authoritative = overviewFor(api, "complete_rim_specs", { confirmedVariant: true });
            authoritative.selected_modification = variant("B");
            return response(200, authoritative);
        },
    } }));
    seed(api, overviewFor(api, "select_vehicle_variant"));
    await api.applyFitmentVehicleVariant(variant("B"));
    assertSection(api, "vehicle");
});

test("RESELECT_PRESERVES_SECTION", async () => {
    let api;
    ({ api } = navigationApi({ routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants/replace": response(200, {}),
        "GET /api/backend/jobs/behavior-job/fitment": () => response(200, overviewFor(api, "run_standard_check", { confirmedVariant: true })),
    } }));
    seed(api, overviewFor(api, "complete_rim_specs", { confirmedVariant: true }));
    await api.replaceFitmentVehicleVariant(variant("B"));
    assertSection(api, "vehicle");
});

test("VARIANT_409_PRESERVES_SECTION", async () => {
    let api;
    ({ api } = navigationApi({ routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants/apply": response(409, { detail: "stale" }),
        "GET /api/backend/jobs/behavior-job/fitment": () => response(200, overviewFor(api, "select_vehicle_variant")),
    } }));
    seed(api, overviewFor(api, "select_vehicle_variant"));
    await api.applyFitmentVehicleVariant(variant("B"));
    assertSection(api, "vehicle");
    assert.equal(api.state.fitmentOverview.next_action.kind, "select_vehicle_variant");
});

test("SAVE_RIM_PRESERVES_SECTION", async () => {
    let api;
    ({ api } = navigationApi({ routes: { "PATCH /api/backend/jobs/behavior-job/fitment": () => response(200, overviewFor(api, "run_standard_check")) } }));
    seed(api, overviewFor(api, "complete_rim_specs"), "rim");
    await api.saveFitment();
    assertSection(api, "rim");
});

test("OVERVIEW_REFRESH_PRESERVES_USER_SECTION", async () => {
    let api;
    ({ api } = navigationApi({ routes: { "GET /api/backend/jobs/behavior-job/fitment": () => response(200, overviewFor(api, "select_vehicle_variant")) } }));
    seed(api, overviewFor(api, "run_standard_check", { confirmedVariant: true }), "result");
    await api.loadFitmentOverview("behavior-job");
    assertSection(api, "result");
});

test("EXPLICIT_NAVIGATION_CHANGES_SECTION", () => {
    const { api } = navigationApi();
    seed(api, overviewFor(api, "complete_rim_specs"));
    api.setFitmentActiveSection("result");
    assertSection(api, "result");
});

test("RESULT_RECOVERY_EXPLICIT_NAVIGATION", () => {
    const { api } = navigationApi();
    seed(api, overviewFor(api, "select_vehicle_variant"), "result");
    api.navigateFitmentRecovery("select_vehicle_variant");
    assertSection(api, "vehicle");
});

test("initial Fitment entry may choose its section from next_action", async () => {
    let api;
    ({ api } = navigationApi({ routes: { "GET /api/backend/jobs/behavior-job/fitment": () => response(200, overviewFor(api, "complete_rim_specs")) } }));
    api.state.fitmentJobId = "behavior-job";
    api.state.fitmentActiveSection = "";
    await api.loadFitmentOverview("behavior-job");
    assertSection(api, "rim");
});

test("CLEAN_CONFIRMED_LOAD_IS_SUMMARY", async () => {
    let api;
    ({ api } = navigationApi({ routes: {
        "GET /api/backend/jobs/behavior-job/fitment": () => response(200, overviewFor(api, "run_standard_check", { confirmedVariant: true })),
    } }));
    api.state.fitmentJobId = "behavior-job";
    api.state.fitmentActiveSection = "vehicle";
    api.state.fitmentVehicleEditing = true;
    api.state.fitmentVehicleDirty = false;

    await api.loadFitmentOverview("behavior-job");

    assert.equal(api.state.fitmentVehicleEditing, false);
    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(workspaceMode(api), "summary");
    assert.equal(api.state.fitmentOverview.modification_state, "confirmed");
    assert.ok(api.state.fitmentOverview.selected_modification);
});

test("REAL_VEHICLE_DRAFT_RESTORES_EDITOR", () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    seed(api, overview);
    api.state.fitmentForm.vehicle.model = "EC60";
    api.state.fitmentForm.vehicle.year = 2020;
    api.state.fitmentVehicleDirty = true;
    api.state.fitmentVehicleEditing = true;
    api.persistFitmentTransientDraft("navigation");

    resetToAuthoritativeVehicle(api, overview);
    assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview }), "restored");
    assert.equal(api.state.fitmentForm.vehicle.model, "EC60");
    assert.equal(api.state.fitmentForm.vehicle.year, 2020);
    assert.equal(api.state.fitmentVehicleDirty, true);
    assert.equal(workspaceMode(api), "base_edit");
});

test("LEGACY_FALSE_DIRTY_DRAFT_SELF_HEALS", () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.vehicle.market = "chdm";
    overview.front_rim.rim.offset_et_mm = 45;
    seed(api, overview);
    api.state.fitmentForm.vehicle.market = "CN";
    api.state.fitmentForm.rim.offset_et_mm = 46;
    api.state.fitmentVehicleDirty = true;
    api.persistFitmentTransientDraft("navigation");

    resetToAuthoritativeVehicle(api, overview);
    assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview }), "restored");

    assert.deepEqual(api.state.fitmentForm.vehicle, api.fitmentFormFromOverview(overview).vehicle);
    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(workspaceMode(api), "summary");
    assert.equal(api.state.fitmentOverview.modification_state, "confirmed");
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 46);
    assert.equal(api.fitmentFormIsDirty(), true);
});

test("LEGACY_FALSE_VEHICLE_DIRTY_PRESERVES_RIM_DRAFT", () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.front_rim.rim.offset_et_mm = 45;
    seed(api, overview);
    api.state.fitmentForm.rim.offset_et_mm = 46;
    api.state.fitmentVehicleDirty = true;
    api.persistFitmentTransientDraft("navigation");

    resetToAuthoritativeVehicle(api, overview);
    api.restoreFitmentTransientDraft({ reason: "navigation", overview });

    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 46);
    assert.equal(api.state.fitmentFormState.baseline.rim.offset_et_mm, 45);
    assert.equal(api.fitmentFormIsDirty(), true);
});

test("CANONICAL_ALIAS_ONLY_IS_NOT_DIRTY", async () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.vehicle = { make: "Yema", model: "EC70", year: 2019, market: "chdm" };
    overview.vehicle.market = "chdm";
    seed(api, overview);
    api.state.fitmentForm.vehicle.market = "CN";
    api.state.fitmentVehicleDirty = false;
    api.persistFitmentTransientDraft("navigation");

    resetToAuthoritativeVehicle(api, overview);
    assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview }), "restored");
    await api.revalidateFitmentCatalogueChain(0, { preloaded: cataloguePreload() });

    assert.equal(api.state.fitmentForm.vehicle.market, "chdm");
    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(api.fitmentFormIsDirty(), false);
    assert.equal(workspaceMode(api), "summary");
});

test("STALE_REVISION_DRAFT_NOT_APPLIED", () => {
    const { api } = navigationApi();
    const oldOverview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    oldOverview.vehicle_revision = 1;
    seed(api, oldOverview);
    api.state.fitmentForm.vehicle.model = "EC60";
    api.state.fitmentVehicleDirty = true;
    api.persistFitmentTransientDraft("navigation");

    const currentOverview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    currentOverview.vehicle_revision = 2;
    resetToAuthoritativeVehicle(api, currentOverview);
    assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview: currentOverview }), "replaced");

    assert.equal(api.state.fitmentForm.vehicle.model, currentOverview.vehicle.model);
    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(api.fitmentFormIsDirty(), false);
    assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview: currentOverview }), "restored");
    assert.equal(workspaceMode(api), "summary");
});

test("STALE_RIM_REVISION_DRAFT_IS_REPLACED_BY_CANONICAL_VALUES", () => {
    const { api } = navigationApi();
    const oldOverview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    oldOverview.rim_revision = 1;
    oldOverview.front_rim.rim_revision = 1;
    seed(api, oldOverview, "rim");
    api.state.fitmentForm.rim.offset_et_mm = 42;
    api.persistFitmentTransientDraft("navigation");

    const currentOverview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    currentOverview.rim_revision = 2;
    currentOverview.front_rim.rim_revision = 2;
    currentOverview.front_rim.rim.offset_et_mm = 38;
    currentOverview.rim.offset_et_mm = 38;
    resetToAuthoritativeVehicle(api, currentOverview);

    assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview: currentOverview }), "replaced");
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 38);
    assert.equal(api.fitmentFormIsDirty(), false);
});

for (const revision of ["vehicle_revision", "rim_setup_revision", "rim_revision"]) {
    test(`revision change ${revision} discards both branches and replaces stored baseline`, () => {
        const { api } = navigationApi();
        const old = overviewFor(api, "run_standard_check", { confirmedVariant: true });
        old[revision] = 1;
        seed(api, old);
        api.state.fitmentForm.vehicle.model = "OBSOLETE";
        api.state.fitmentForm.rim.offset_et_mm = 99;
        api.persistFitmentTransientDraft("navigation");
        const fresh = overviewFor(api, "run_standard_check", { confirmedVariant: true });
        fresh[revision] = 2;
        resetToAuthoritativeVehicle(api, fresh);
        assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview: fresh }), "replaced");
        assert.equal(api.state.fitmentForm.vehicle.model, fresh.vehicle.model);
        assert.notEqual(api.state.fitmentForm.rim.offset_et_mm, 99);
        assert.equal(api.fitmentFormIsDirty(), false);
        assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview: fresh }), "restored");
        assert.notEqual(api.state.fitmentForm.rim.offset_et_mm, 99);
    });
}

test("SAVE_SINGLE_CONFIRM_RELOAD_IS_SUMMARY", async () => {
    let api;
    let overviewGetCount = 0;
    ({ api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": () => {
            const saved = overviewFor(api, "select_vehicle_variant");
            saved.vehicle_revision = 2;
            saved.vehicle = { ...saved.vehicle, model: "EC60", year: 2020, market: "CN" };
            return response(200, saved);
        },
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants": response(200, { outcome: "single" }),
        "GET /api/backend/jobs/behavior-job/fitment": () => {
            overviewGetCount += 1;
            const confirmedOverview = overviewFor(api, "complete_rim_specs", { confirmedVariant: true });
            confirmedOverview.vehicle_revision = 2;
            confirmedOverview.vehicle = { ...confirmedOverview.vehicle, model: "EC60", year: 2020, market: "CN" };
            return response(200, confirmedOverview);
        },
    } }));
    seed(api, overviewFor(api, "complete_vehicle_details"));
    api.state.fitmentForm.vehicle.model = "EC60";
    api.state.fitmentForm.vehicle.year = 2020;
    api.state.fitmentForm.vehicle.market = "CN";
    api.state.fitmentVehicleDirty = true;
    api.state.fitmentVehicleEditing = true;
    api.persistFitmentTransientDraft("navigation");

    await api.saveFitment();
    await api.loadFitmentVehicleVariants();
    assert.equal(overviewGetCount, 1);
    assert.equal(api.state.fitmentOverview.modification_state, "confirmed");
    api.persistFitmentTransientDraft("navigation");
    await api.loadFitmentOverview("behavior-job", { restoreReason: "navigation", preserveActiveSection: "vehicle" });

    assert.equal(api.state.fitmentVehicleEditing, false);
    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(workspaceMode(api), "summary");
    assert.equal(api.state.fitmentForm.vehicle.model, "EC60");
    assert.equal(api.state.fitmentOverview.modification_state, "confirmed");
});

test("RIM_DRAFT_PRESERVED_AFTER_VEHICLE_REBASE", async () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.vehicle = { make: "Yema", model: "EC70", year: 2019, market: "CN" };
    overview.vehicle.market = "CN";
    overview.front_rim.rim.offset_et_mm = 45;
    seed(api, overview);
    api.state.fitmentForm.rim.offset_et_mm = 46;

    await api.revalidateFitmentCatalogueChain(0, { preloaded: cataloguePreload() });

    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 46);
    assert.equal(api.state.fitmentFormState.baseline.rim.offset_et_mm, 45);
    assert.equal(api.fitmentFormIsDirty(), true);
});

test("RIM_DRAFT_SURVIVES_VEHICLE_REBASE", () => {
    const { api } = navigationApi();
    const initial = overviewFor(api, "complete_vehicle_details");
    initial.vehicle = { make: "Yema", model: "EC70", year: 2019, market: "CN" };
    initial.front_rim.rim.offset_et_mm = 45;
    seed(api, initial);
    api.state.fitmentForm.vehicle.model = "EC60";
    api.state.fitmentVehicleDirty = true;
    api.state.fitmentForm.rim.offset_et_mm = 46;
    api.persistFitmentTransientDraft("navigation");

    const saved = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    saved.vehicle_revision = initial.vehicle_revision + 1;
    saved.vehicle = { ...initial.vehicle, model: "EC60" };
    saved.front_rim.rim.offset_et_mm = 45;
    assert.equal(api.rebaseFitmentTransientVehicleDraft(saved), true);

    resetToAuthoritativeVehicle(api, saved);
    assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview: saved }), "restored");
    assert.equal(api.state.fitmentForm.vehicle.model, "EC60");
    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 46);
    assert.equal(api.state.fitmentFormState.baseline.rim.offset_et_mm, 45);
    assert.equal(api.fitmentFormIsDirty(), true);
    assert.equal(workspaceMode(api), "summary");
});

function cataloguePreload() {
    return {
        makes: { outcome: "success", items: [{ value: "Yema", label: "Yema" }] },
        models: { outcome: "success", items: [{ value: "EC70", label: "EC70" }, { value: "EC60", label: "EC60" }] },
        years: { outcome: "success", items: [{ value: "2019", label: "2019" }, { value: "2020", label: "2020" }] },
        markets: {
            outcome: "success", resolution: "single",
            resolved_market: { value: "chdm", label: "Россия+" }, items: [],
        },
    };
}

test("PASSIVE_CATALOGUE_REVALIDATION_CREATES_DIRTY is NO", async () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.vehicle = { make: "Yema", model: "EC70", year: 2019, market: "CN" };
    seed(api, overview);
    await api.revalidateFitmentCatalogueChain(0, { preloaded: cataloguePreload() });

    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(api.fitmentFormIsDirty(), false);
    assert.equal(api.state.fitmentFormState.baseline.vehicle.market, "chdm");
    assert.equal(api.deriveVehicleWorkspaceMode(overview).mode, "summary");
});

test("USER_VEHICLE_EDIT_REMAINS_DIRTY_AFTER_REVALIDATION", async () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.vehicle = { make: "Yema", model: "EC70", year: 2019, market: "CN" };
    seed(api, overview);
    api.state.fitmentForm.vehicle.model = "EC60";
    api.state.fitmentVehicleDirty = true;
    await api.revalidateFitmentCatalogueChain(0, { preloaded: cataloguePreload() });

    assert.equal(api.state.fitmentVehicleDirty, true);
    assert.equal(api.state.fitmentForm.vehicle.model, "EC60");
});

test("RIM_DIRTY_SURVIVES_PASSIVE_VEHICLE_REVALIDATION", async () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.vehicle = { make: "Yema", model: "EC70", year: 2019, market: "CN" };
    overview.front_rim.rim.offset_et_mm = 45;
    seed(api, overview);
    api.state.fitmentForm.rim.offset_et_mm = 46;

    await api.revalidateFitmentCatalogueChain(0, { preloaded: cataloguePreload() });

    assert.equal(api.state.fitmentVehicleDirty, false);
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 46);
    assert.equal(api.state.fitmentFormState.baseline.rim.offset_et_mm, 45);
    assert.equal(api.fitmentFormIsDirty(), true);
});

test("SINGLE_AUTO_CONFIRM_FINAL_WORKSPACE remains SUMMARY after catalogue hydration", async () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "complete_rim_specs", { confirmedVariant: true });
    overview.vehicle = { make: "Yema", model: "EC70", year: 2019, market: "CN" };
    seed(api, overview);
    await api.revalidateFitmentCatalogueChain(0, { preloaded: cataloguePreload() });

    assert.equal(api.fitmentFormIsDirty(), false);
    assert.equal(api.deriveVehicleWorkspaceMode(overview, { vehicleEditing: false, pickerOpen: false }).mode, "summary");
});

test("RIM_CARD_EDITOR_PCD_CONSISTENCY uses one effective RimSpec", () => {
    const { api } = navigationApi();
    const overview = {
        rim: { brand: "Xtrike", model: "10-Spoke", pcd_display: "4×108" },
        front_rim: { rim: { brand: "Xtrike", model: "10-Spoke", bolt_count: 4, pcd_mm: 108, wheel_diameter_in: 20, wheel_width_j: 9 } },
    };
    const effective = api.fitmentEffectiveRim(overview);
    const form = api.fitmentFormFromOverview(overview);

    assert.equal(effective.bolt_count, 4);
    assert.equal(effective.pcd_mm, 108);
    assert.equal(form.rim.bolt_count, 4);
    assert.equal(form.rim.pcd_mm, 108);
});

test("V2_PCD_PRESET_HYDRATES_VISIBLE_SELECT", () => {
    const { api, pcdSelect, pcdCustom } = pcdProjectionApi();
    renderV2RimEditor(api, { bolt_count: 4, pcd_mm: 108 });

    assert.equal(api.state.fitmentForm.rim.bolt_count, 4);
    assert.equal(api.state.fitmentForm.rim.pcd_mm, 108);
    assert.equal(pcdSelect.value, "4x108");
    assert.equal(pcdCustom.hidden, true);
});

test("V2_PCD_EMPTY_STAYS_EMPTY", () => {
    const { api, pcdSelect } = pcdProjectionApi();
    renderV2RimEditor(api, { bolt_count: null, pcd_mm: null });

    assert.equal(pcdSelect.value, "");
});

test("V2_PCD_CUSTOM_PRESERVES_VALUE", () => {
    const { api, pcdSelect, pcdCustom } = pcdProjectionApi();
    renderV2RimEditor(api, { bolt_count: 5, pcd_mm: 111 });

    assert.equal(pcdSelect.value, "custom");
    assert.equal(pcdCustom.hidden, false);
    assert.equal(api.state.fitmentForm.rim.pcd_mm, 111);
    assert.equal(pcdCustom.value, 111);
});

test("PCD_CONTROL_SYNC_IS_NON_MUTATING", () => {
    const { api, calls } = pcdProjectionApi();
    renderV2RimEditor(api, { bolt_count: 4, pcd_mm: 108 });
    const formBefore = JSON.parse(JSON.stringify(api.state.fitmentForm));
    const vehicleDirtyBefore = api.state.fitmentVehicleDirty;
    const formStatusBefore = api.state.fitmentFormState.status;
    const callsBefore = calls.length;

    api.syncFitmentPcdControl();

    assert.deepEqual(JSON.parse(JSON.stringify(api.state.fitmentForm)), formBefore);
    assert.equal(api.state.fitmentVehicleDirty, vehicleDirtyBefore);
    assert.equal(api.state.fitmentFormState.status, formStatusBefore);
    assert.equal(calls.length, callsBefore);
});

test("CANONICAL_RIM_WINS_OVER_RICHER_LEGACY_RIM", () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.front_rim = {
        rim: {
            brand: "Canonical", model: "C4", sku: "canonical-4x108", product_url: "https://canonical.test",
            bolt_count: 4, pcd_mm: 108, wheel_diameter_in: 20, wheel_width_j: 9,
            center_bore_mm: 66.6, offset_et_mm: 45,
        },
    };
    overview.rim = {
        brand: "Legacy", model: "Richer", sku: "legacy-5x112", product_url: "https://legacy.test",
        bolt_count: 5, pcd_mm: 112, wheel_diameter_in: 21, wheel_width_j: 10,
        center_bore_mm: 70.1, offset_et_mm: 35, extra_metadata: "richer legacy object",
    };
    seed(api, overview);

    const effective = api.fitmentEffectiveRim(overview);
    const form = api.fitmentFormFromOverview(overview);
    const payload = api.fitmentPayload({ includeVehicle: false });

    assert.equal(effective.bolt_count, 4);
    assert.equal(effective.pcd_mm, 108);
    assert.equal(api.fitmentRimSpecs(effective), '20" / 9J / 4×108');
    assert.equal(form.rim.bolt_count, 4);
    assert.equal(form.rim.pcd_mm, 108);
    assert.equal(payload.rim.bolt_count, 4);
    assert.equal(payload.rim.pcd_mm, 108);
});

test("RIM_ONLY_PATCH_CONTAINS_VEHICLE is NO and preserves existing PCD", () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    overview.front_rim = { rim: { brand: "Xtrike", model: "10-Spoke", bolt_count: 4, pcd_mm: 108, wheel_diameter_in: 20, wheel_width_j: 9, offset_et_mm: 45 } };
    overview.rim = { brand: "Xtrike", model: "10-Spoke", pcd_display: "4×108" };
    seed(api, overview, "rim");
    api.state.fitmentForm.rim.offset_et_mm = 46;
    const payload = api.fitmentPayload({ includeVehicle: false });

    assert.equal(Object.hasOwn(payload, "vehicle"), false);
    assert.equal(payload.rim.bolt_count, 4);
    assert.equal(payload.rim.pcd_mm, 108);
    assert.equal(payload.rim.offset_et_mm, 46);
});

test("RIM_ONLY_SAVE_BOUNDARY sends the real PATCH without Vehicle", async () => {
    let api;
    let requestBody;
    ({ api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": (options) => {
            requestBody = JSON.parse(options.body);
            return response(200, overviewFor(api, "run_standard_check", { confirmedVariant: true }));
        },
    } }));
    const overview = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    seed(api, overview, "rim");
    api.state.fitmentRimEditing = true;
    api.state.fitmentForm.rim.offset_et_mm = 46;
    Object.assign(api.state.fitmentForm.rim, { wheel_diameter_in: 18, wheel_width_j: 8, center_bore_mm: 66.6 });
    api.state.fitmentRimManualFields = ["wheel_diameter_in", "wheel_width_j", "bolt_count", "pcd_mm", "center_bore_mm", "offset_et_mm"];
    api.state.fitmentFormState.status = "dirty";
    await api.saveFitment();

    assert.equal(Object.hasOwn(requestBody, "vehicle"), false);
    assert.equal(requestBody.rim.bolt_count, 5);
    assert.equal(requestBody.rim.pcd_mm, 112);
});

test("WHEEL_ONLY_SAVE works while Vehicle is unconfirmed and keeps its revision", async () => {
    let api;
    let requestBody;
    const initial = overviewFor({ buildDefaultDemoFitmentOverview: () => ({
        job_id: "behavior-job", vehicle: {}, vehicle_state: "unconfirmed",
        vehicle_revision: 2, rim_revision: 1, rim_setup_revision: 1,
        rim: {}, front_rim: { rim: {} }, setup_mode: "uniform",
        next_action: { kind: "complete_vehicle_details" },
    }) }, "complete_vehicle_details");
    const saved = { ...initial, rim_revision: 2, rim_setup_revision: 2, rim_setup_state: "confirmed_ready" };
    ({ api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": (options) => {
            requestBody = JSON.parse(options.body);
            return response(200, saved);
        },
    } }));
    seed(api, initial, "vehicle");
    api.useRealValidation();
    api.state.fitmentRimEditing = true;
    Object.assign(api.state.fitmentForm.rim, {
        bolt_count: 5, pcd_mm: 112, wheel_diameter_in: 18,
        wheel_width_j: 8, center_bore_mm: 66.6, offset_et_mm: 35.25,
    });
    api.state.fitmentRimManualFields = ["bolt_count", "pcd_mm", "wheel_diameter_in", "wheel_width_j", "center_bore_mm", "offset_et_mm"];
    await api.saveVnextFitment("rim");

    assert.ok(requestBody, "Wheel save must send PATCH while Vehicle is incomplete");
    assert.equal(Object.hasOwn(requestBody, "vehicle"), false);
    assert.equal(requestBody.rim.offset_et_mm, 35.25);
    assert.equal(api.state.fitmentOverview.vehicle_revision, 2);
    assert.equal(api.state.fitmentOverview.next_action.kind, "complete_vehicle_details");
});

test("Wheel Save closes its editor and leaves Standard Check enabled from server next_action", async () => {
    let api, requestBody;
    ({ api } = navigationApi({ vnext: true, routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": options => {
            requestBody = JSON.parse(options.body);
            return response(200, overviewFor(api, "run_standard_check", { confirmedVariant: true }));
        },
    } }));
    seed(api, overviewFor(api, "complete_rim_specs", { confirmedVariant: true }), "vehicle");
    Object.assign(api.state.fitmentForm.rim, { bolt_count: 5, pcd_mm: 112, wheel_diameter_in: 18, wheel_width_j: 8, center_bore_mm: 66.6, offset_et_mm: 35 });
    api.state.fitmentRimManualFields = ["bolt_count", "pcd_mm", "wheel_diameter_in", "wheel_width_j", "center_bore_mm", "offset_et_mm"];
    api.state.fitmentRimEditing = true;
    await api.saveVnextFitment("rim");
    assert.equal(Object.hasOwn(requestBody, "vehicle"), false);
    assert.equal(api.state.fitmentOverview.next_action.kind, "run_standard_check");
    assert.equal(api.state.fitmentRimEditing, false);
    const snapshot = api.snapshot();
    assert.equal(snapshot.canRunCheck, true);
    assert.match(fitmentMarkup(snapshot), /data-fitment-action="check"[^>]*>Проверить совместимость<\/button>/);
});

test("canonical revision change keeps previous evidence visibly stale when detail refresh fails or lies current", async () => {
    let api;
    const check = { id: "check-old", execution_status: "completed", verdict: "compatible", is_current: true };
    ({ api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": () => {
            const updated = overviewFor(api, "run_standard_check", { confirmedVariant: true });
            updated.rim_revision += 1;
            updated.current_check = { ...check, is_current: true };
            return response(200, updated);
        },
        "GET /api/backend/fitment/checks/check-old": response(200, { ...check, is_current: true }),
    } }));
    const original = overviewFor(api, "complete_rim_specs", { confirmedVariant: true });
    original.current_check = check;
    seed(api, original, "rim");
    api.state.fitmentCheck = check;
    await api.saveFitment();
    assert.equal(api.state.fitmentCheck.is_current, false);
    assert.equal(api.state.fitmentOverview.current_check.is_current, false);
});

test("Wheel save preserves an unsaved Vehicle draft with a new server baseline", async () => {
    let api;
    let saved;
    ({ api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": () => response(200, saved),
    } }));
    const initial = overviewFor(api, "complete_vehicle_details");
    seed(api, initial, "rim");
    api.state.fitmentRimEditing = true;
    api.state.fitmentForm.vehicle.model = "Draft Model";
    api.state.fitmentVehicleDirty = true;
    api.state.fitmentForm.rim.offset_et_mm = 35.25;
    Object.assign(api.state.fitmentForm.rim, { bolt_count: 5, pcd_mm: 112, wheel_diameter_in: 18, wheel_width_j: 8, center_bore_mm: 66.6 });
    api.state.fitmentRimManualFields = ["wheel_diameter_in", "wheel_width_j", "bolt_count", "pcd_mm", "center_bore_mm", "offset_et_mm"];
    saved = { ...initial, rim_revision: (initial.rim_revision || 1) + 1 };
    await api.saveFitment();

    assert.equal(api.state.fitmentForm.vehicle.model, "Draft Model");
    assert.equal(api.state.fitmentVehicleDirty, true);
    assert.equal(api.state.fitmentFormState.baseline.vehicle.model, initial.vehicle.model);
    assert.equal(api.state.fitmentOverview.vehicle_revision, initial.vehicle_revision);
    assert.equal(api.state.fitmentOverview.next_action.kind, "complete_vehicle_details");
    api.state.fitmentForm = api.fitmentFormFromOverview(saved);
    api.state.fitmentFormState.baseline = api.cloneFitmentForm(api.state.fitmentForm);
    api.state.fitmentVehicleDirty = false;
    assert.equal(api.restoreFitmentTransientDraft({ reason: "navigation", overview: saved }), "restored");
    assert.equal(api.state.fitmentForm.vehicle.model, "Draft Model");
});

test("demo Wheel save keeps Vehicle progression authoritative", () => {
    const { api } = navigationApi();
    seed(api, overviewFor(api, "complete_vehicle_details"), "rim");
    const before = api.state.fitmentOverview.vehicle_revision;
    const saved = api.demoServerTransition("save_rim", { rim: { offset_et_mm: 35.25 } });
    assert.equal(saved.vehicle_revision, before);
    assert.equal(saved.next_action.kind, "complete_vehicle_details");
    assert.equal(saved.rim_revision, api.state.fitmentOverview.rim_revision + 1);
});

test("Vehicle-only Save excludes Wheel fields and retains both axle drafts and acceptance", async () => {
    let api, saved, requestBody;
    ({ api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": options => {
            requestBody = JSON.parse(options.body);
            return response(200, saved);
        },
    } }));
    const initial = overviewFor(api, "complete_vehicle_details");
    seed(api, initial, "vehicle");
    api.state.fitmentVehicleDirty = true;
    api.state.fitmentForm.vehicle.model = "Updated model";
    api.state.fitmentForm.rim.offset_et_mm = "35,125";
    api.state.fitmentForm.rear_rim.offset_et_mm = "42,75";
    api.state.fitmentForm.setup_mode = "staggered";
    api.state.fitmentRimManualFields = ["offset_et_mm"];
    api.state.fitmentRearPendingFields = ["offset_et_mm"];
    api.state.fitmentRearDraftInitialized = true;
    saved = { ...initial, vehicle_revision: initial.vehicle_revision + 1, vehicle: { ...initial.vehicle, model: "Updated model" } };
    await api.saveFitment();
    assert.ok(requestBody.vehicle);
    for (const field of ["rim", "front_rim", "rear_rim", "setup_mode"]) assert.equal(Object.hasOwn(requestBody, field), false, field);
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, "35,125");
    assert.equal(api.state.fitmentForm.rear_rim.offset_et_mm, "42,75");
    assert.equal(api.state.fitmentForm.setup_mode, "staggered");
    assert.ok(api.state.fitmentRimManualFields.includes("offset_et_mm"));
    assert.ok(api.state.fitmentRearPendingFields.includes("offset_et_mm"));
    assert.equal(api.state.fitmentOverview.rim_revision, initial.rim_revision);
    assert.equal(api.state.fitmentFormState.baseline.rim.offset_et_mm, api.fitmentFormFromOverview(saved).rim.offset_et_mm);
});

test("Vehicle variant refresh preserves Wheel draft only while its authoritative revisions match", async () => {
    let api, saved;
    ({ api } = navigationApi({ routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants": () => response(200, { outcome: "single" }),
        "GET /api/backend/jobs/behavior-job/fitment": () => response(200, saved),
    } }));
    const initial = overviewFor(api, "select_vehicle_variant");
    seed(api, initial, "vehicle");
    api.state.fitmentForm.rim.offset_et_mm = "35,125";
    api.state.fitmentRimManualFields = ["offset_et_mm"];
    saved = { ...overviewFor(api, "run_standard_check"), vehicle_revision: initial.vehicle_revision + 1 };
    await api.loadFitmentVehicleVariants();
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, "35,125");
    assert.ok(api.state.fitmentRimManualFields.includes("offset_et_mm"));
    saved = { ...saved, rim_revision: saved.rim_revision + 1 };
    await api.loadFitmentOverview("behavior-job", { preserveWheelDraft: true });
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, api.fitmentFormFromOverview(saved).rim.offset_et_mm);
    assert.equal(api.state.fitmentRimManualFields.length, 0);
});

test("resolver compares proposals with confirmed Wheel values without changing canonical data", () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "complete_vehicle_details");
    overview.front_rim = { rim: { offset_et_mm: 35.125 }, field_states: { offset_et_mm: { state: "confirmed", value: 35.125 } } };
    seed(api, overview, "rim");
    assert.equal(api.fitmentCanonicalRimConflicts({ offset_et_mm: "35,125" }).length, 0);
    const conflicts = JSON.parse(JSON.stringify(api.fitmentCanonicalRimConflicts({ offset_et_mm: 42.75 })));
    assert.deepEqual(conflicts, [{ field: "offset_et_mm", current: 35.125, suggested: 42.75, origin: "canonical" }]);
    assert.equal(api.state.fitmentOverview.front_rim.rim.offset_et_mm, 35.125);
    assert.equal(api.fitmentCanonicalRimConflicts({ center_bore_mm: 66.6 }).length, 0);
    api.state.fitmentSourceIdentity = { sourceFingerprint: "same-source", selectedVariantSku: "SKU-1", variantState: "selected" };
    api.state.fitmentSourceConflicts = conflicts;
    api.bridge.action("conflict-use", "offset_et_mm|42.75");
    assert.equal(api.fitmentPayload({ includeVehicle: false }).rim.offset_et_mm, 42.75);
    assert.equal(api.fitmentPayload({ includeVehicle: false }).rim.source_fingerprint, null);
    assert.equal(api.state.fitmentOverview.front_rim.rim.offset_et_mm, 35.125);
});

test("photo replacement and recognition remain local until catalogue/variant Save", async () => {
    let api, revision, formData;
    ({ api } = navigationApi({ routes: {
        "POST /api/backend/identity/fitment/behavior-job/vehicle-proposal": options => {
            formData = options.body;
            return response(200, { vehicle_revision: revision, vehicle: { status: "resolved", primary: { make: "Porsche", model: "Cayenne", year_start: 2020, year_end: 2022 } } });
        },
    } }));
    const initial = overviewFor(api, "run_standard_check");
    seed(api, initial, "vehicle");
    revision = initial.vehicle_revision;
    const canonical = JSON.stringify(api.state.fitmentOverview);
    const beforeVehicle = JSON.stringify(api.state.fitmentForm.vehicle);
    await api.setFitmentVehiclePhoto(new File(["test"], "photo.png", { type: "image/png" }));
    assert.equal(JSON.stringify(api.state.fitmentOverview), canonical);
    await api.recognizeFitmentVehicle();
    assert.equal(api.state.fitmentRecognition.status, "proposed");
    assert.equal(formData.get("expected_vehicle_revision"), String(revision));
    assert.equal(formData.get("car_image").type, "image/png");
    assert.equal(JSON.stringify(api.state.fitmentForm.vehicle), beforeVehicle);
    api.useFitmentRecognitionProposal(0);
    assert.equal(api.state.fitmentForm.vehicle.make, "Porsche");
    assert.equal(api.state.fitmentForm.vehicle.year, "", "year range must never choose an arbitrary year");
    assert.equal(api.state.fitmentForm.vehicle.market, "");
    assert.equal(api.state.fitmentVehicleDirty, true);
    assert.equal(JSON.stringify(api.state.fitmentOverview), canonical);
});

test("VNext single variant is preselected locally and waits for explicit Apply", async () => {
    let api, saved, lookupUrl;
    const variant = { generation: "E3", modification: "3.0 V6", generation_slug: "e3", modification_slug: "v6" };
    ({ api } = navigationApi({ vnext: true, routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants": (_options, url) => {
            lookupUrl = url;
            return response(200, { outcome: "single", requires_confirmation: true, variants: [variant] });
        },
        "GET /api/backend/jobs/behavior-job/fitment": () => response(200, saved),
    } }));
    saved = overviewFor(api, "select_vehicle_variant");
    seed(api, saved, "vehicle");
    await api.loadFitmentVehicleVariants();
    assert.equal(new URL(lookupUrl, "https://test.local").searchParams.get("require_confirmation"), "true");
    assert.equal(api.state.fitmentVehicleVariants.length, 1);
    assert.equal(api.state.fitmentSelectedVehicleVariantIndex, 0);
    assert.equal(api.state.fitmentOverview.next_action.kind, "select_vehicle_variant");
});

test("optional vehicle reselection opens choices and Cancel restores the confirmed summary", async () => {
    let api;
    ({ api } = navigationApi({ vnext: true, routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants/reselect": response(200, { outcome: "multiple", variants: [variant("A"), variant("B")] }),
    } }));
    const canonical = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    seed(api, canonical, "vehicle");
    api.state.fitmentModificationPickerOpen = true;
    api.state.fitmentModificationLookupMode = "reselect";
    await api.reselectionVariants();
    assert.equal(api.state.fitmentModificationPickerOpen, true);
    assert.equal(api.state.fitmentModificationLookupMode, "reselect");
    const picker = fitmentMarkup(api.snapshot());
    assert.match(picker, /data-fitment-action="cancel-vehicle-reselection"/);
    api.bridge.action("cancel-vehicle-reselection");
    assert.equal(api.state.fitmentModificationPickerOpen, false);
    assert.equal(JSON.stringify(api.state.fitmentOverview), JSON.stringify(canonical));
    assert.equal(api.state.fitmentOverview.current_check?.is_current, canonical.current_check?.is_current);
});

test("optional vehicle reselection opens from the VNext action while the wheel editor is active", async () => {
    const { api, calls } = navigationApi({ vnext: true, routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants/reselect": response(200, { outcome: "multiple", variants: [variant("A"), variant("B")] }),
    } });
    const canonical = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    seed(api, canonical, "rim");
    api.state.fitmentForm.rim.offset_et_mm = "35,125";
    api.state.fitmentRimEditing = true;

    api.bridge.action("reselect-vehicle");
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(api.state.fitmentModificationPickerOpen, true);
    assert.equal(api.state.fitmentModificationLookupMode, "reselect");
    assert.equal(api.state.fitmentRimEditing, false);
    assert.equal(api.state.fitmentActiveSection, "vehicle");
    assert.ok(calls.includes("POST /api/backend/jobs/behavior-job/fitment/vehicle-variants/reselect"));
    const picker = fitmentMarkup(api.snapshot());
    assert.match(picker, /<strong>A<\/strong>/);
    assert.match(picker, /data-fitment-action="cancel-vehicle-reselection"/);
    api.bridge.action("cancel-vehicle-reselection");
    assert.equal(api.state.fitmentRimEditing, true);
    assert.equal(api.state.fitmentActiveSection, "rim");
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, "35,125");
});

test("failed vehicle variant Apply keeps the picker and selection available", async () => {
    const { api } = navigationApi({ routes: {
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants/apply": response(503, { detail: "provider unavailable" }),
    } });
    const overview = overviewFor(api, "select_vehicle_variant");
    seed(api, overview, "vehicle");
    api.state.fitmentVehicleVariants = [variant("A"), variant("B")];
    api.state.fitmentSelectedVehicleVariantIndex = 1;
    await assert.rejects(api.applyFitmentVehicleVariant(api.state.fitmentVehicleVariants[1]));
    assert.equal(api.state.fitmentOverview, overview);
    assert.equal(api.state.fitmentVehicleVariants.length, 2);
    assert.equal(api.state.fitmentSelectedVehicleVariantIndex, 1);
    assert.equal(api.state.fitmentVehicleVariantApplying, false);
});

test("late overview success, 500, and 401 cannot replace a newly opened Fitment job", async () => {
    for (const lateStatus of [200, 500, 401]) {
        let releaseA;
        const { api } = navigationApi({ routes: {
            "GET /api/backend/jobs/job-a/fitment": () => new Promise(resolve => { releaseA = resolve; }),
            "GET /api/backend/jobs/job-b/fitment": () => response(200, overviewFor(api, "complete_rim_specs", { confirmedVariant: true })),
        } });
        api.state.fitmentJobId = "job-a";
        api.state.fitmentContextGeneration = 1;
        const requestA = api.loadFitmentOverview("job-a");
        api.state.fitmentJobId = "job-b";
        api.state.fitmentContextGeneration += 1;
        const requestB = api.loadFitmentOverview("job-b");
        await requestB;
        const expected = api.state.fitmentOverview;
        releaseA(response(lateStatus, lateStatus === 200 ? overviewFor(api, "complete_vehicle_details") : { detail: "late" }));
        await requestA;
        assert.equal(api.state.fitmentOverview, expected);
        assert.equal(api.state.fitmentJobId, "job-b");
        assert.equal(api.state.fitmentAuthRequired, false);
        assert.equal(api.state.fitmentLoading, false);
    }
});

test("late Wheel Save response from Job A cannot overwrite Job B", async () => {
    let releaseSave;
    const { api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/job-a/fitment": () => new Promise(resolve => { releaseSave = resolve; }),
    } });
    const original = overviewFor(api, "complete_rim_specs", { confirmedVariant: true });
    seed(api, original, "rim");
    api.state.fitmentJobId = "job-a";
    api.state.fitmentForm.rim.offset_et_mm = 35.125;
    const save = api.saveFitment(undefined, { owner: "rim", confirmWheelFields: true });
    const jobB = overviewFor(api, "complete_vehicle_details");
    api.state.fitmentJobId = "job-b";
    api.state.fitmentContextGeneration += 1;
    api.state.fitmentOverview = jobB;
    api.state.fitmentForm = api.fitmentFormFromOverview(jobB);
    api.state.fitmentSaving = false;
    releaseSave(response(200, { ...original, rim_revision: original.rim_revision + 1 }));
    await save;
    assert.equal(api.state.fitmentOverview, jobB);
    assert.equal(api.state.fitmentJobId, "job-b");
    assert.equal(api.state.fitmentSaving, false);
    assert.equal(api.state.fitmentError, "");
});

test("accepting a resolver proposal is local and Save waits for explicit confirmation", async () => {
    const { api, calls } = navigationApi();
    seed(api, overviewFor(api, "complete_vehicle_details"), "rim");
    Object.assign(api.state.fitmentForm.rim, { bolt_count: 5, pcd_mm: 112, wheel_diameter_in: 18, wheel_width_j: 8, center_bore_mm: 66.6, offset_et_mm: 35.125 });
    api.state.fitmentSourceAppliedFields = ["offset_et_mm"];
    api.state.fitmentRimManualFields = ["bolt_count", "pcd_mm", "wheel_diameter_in", "wheel_width_j", "center_bore_mm"];
    const initialCallCount = calls.length;
    assert.equal(api.fitmentRimSaveReadiness().ready, false);
    await api.saveVnextFitment("rim");
    assert.equal(calls.length, initialCallCount, "unconfirmed proposal must not send PATCH");
    const revision = api.state.fitmentOverview.rim_revision;
    api.bridge.action("accept-rim-proposal", "offset_et_mm");
    assert.equal(calls.length, initialCallCount, "accepting a value must not send PATCH");
    assert.equal(api.state.fitmentOverview.rim_revision, revision);
    assert.equal(api.fitmentRimPendingProposalFields().includes("offset_et_mm"), false);
    assert.equal(api.fitmentRimSaveReadiness().ready, true);
});

test("manual Wheel fallback does not implicitly accept existing resolver proposals", () => {
    const { api } = navigationApi();
    seed(api, overviewFor(api, "complete_vehicle_details"), "rim");
    api.state.fitmentForm.rim.offset_et_mm = "35.125";
    api.state.fitmentSourceAppliedFields = ["offset_et_mm"];
    api.state.fitmentSourceIdentity = { variantState: "selection_required", selectedVariantSku: "old" };
    api.bridge.action("manual-rim");
    assert.ok(api.fitmentRimPendingProposalFields().includes("offset_et_mm"));
    assert.equal(api.state.fitmentSourceIdentity.variantState, "none");
    assert.equal(api.state.fitmentSourceIdentity.selectedVariantSku, null);
    assert.equal(api.fitmentRimSaveReadiness().ready, false);
});

test("late resolver proposals cannot overwrite manual fallback or a newer URL", async () => {
    for (const transition of ["manual", "url"]) {
        let release;
        const { api } = navigationApi({ routes: {
            "POST /api/backend/jobs/behavior-job/fitment/rim-source/resolve": () => new Promise(resolve => { release = resolve; }),
        } });
        seed(api, overviewFor(api, "complete_vehicle_details"), "rim");
        api.state.fitmentForm.rim.product_url = "https://shop.example.test/old";
        api.state.fitmentForm.rim.offset_et_mm = "35.125";
        const request = api.resolveFitmentRimSource();
        assert.equal(typeof release, "function");
        if (transition === "manual") api.bridge.action("manual-rim");
        else api.bridge.setSourceUrl("https://shop.example.test/new");
        release(response(200, { final_url: "https://shop.example.test/old", values: { offset_et_mm: 99 }, source_fingerprint: "obsolete" }));
        await request;
        assert.equal(api.state.fitmentForm.rim.offset_et_mm, "35.125");
        assert.notEqual(api.state.fitmentSourceIdentity.sourceFingerprint, "obsolete");
        assert.equal(api.state.fitmentSourceResolving, false);
    }
});

test("staggered copies front proposals once and preserves an independently edited rear draft", () => {
    const { api } = navigationApi();
    seed(api, overviewFor(api, "complete_vehicle_details"), "rim");
    const geometry = { bolt_count: 5, pcd_mm: 112, wheel_diameter_in: 18, wheel_width_j: 8, center_bore_mm: 66.6, offset_et_mm: "35,125" };
    Object.assign(api.state.fitmentForm.rim, geometry);
    api.state.fitmentRimManualFields = Object.keys(geometry);
    api.state.fitmentSourceAppliedFields = [];
    api.state.fitmentSourceIdentity = { sourceFingerprint: "source", selectedVariantSku: "SKU", variantState: "selected" };
    api.setVnextFitmentField("setup_mode", "staggered");
    assert.equal(api.state.fitmentForm.rear_rim.offset_et_mm, "35,125");
    assert.equal(api.fitmentRimSaveReadiness().ready, false);
    api.state.fitmentSourceAppliedFields = ["offset_et_mm"];
    api.setVnextFitmentField("rear_rim.offset_et_mm", "42,75");
    assert.ok(api.state.fitmentSourceAppliedFields.includes("offset_et_mm"));
    api.bridge.action("accept-rim-proposal", "rim.offset_et_mm");
    assert.equal(api.state.fitmentSourceIdentity.sourceFingerprint, "source");
    for (const field of ["wheel_diameter_in", "wheel_width_j", "pcd", "center_bore_mm"]) {
        api.bridge.action("accept-rim-proposal", `rear_rim.${field}`);
    }
    assert.equal(api.fitmentRimSaveReadiness().ready, true);
    api.setVnextFitmentField("setup_mode", "uniform");
    assert.equal(Object.hasOwn(api.fitmentPayload({ includeVehicle: false }), "rear_rim"), false);
    api.setVnextFitmentField("setup_mode", "staggered");
    assert.equal(api.state.fitmentForm.rear_rim.offset_et_mm, "42,75");
    const payload = api.fitmentPayload({ includeVehicle: false, confirmWheelFields: true });
    assert.equal(payload.rear_rim.offset_et_mm, 42.75);
    assert.ok(payload.rear_rim.confirmed_fields.includes("offset_et_mm"));
    assert.equal(Object.hasOwn(payload, "vehicle"), false);
    api.setVnextFitmentField("rear_rim.offset_et_mm", "150,001");
    assert.ok(api.fitmentRimSaveReadiness().invalid.includes("rear_rim.offset_et_mm"));
});

test("repeating one resolver proposal keeps it pending until explicit acceptance", () => {
    const { api } = navigationApi();
    seed(api, overviewFor(api, "complete_rim_specs"), "rim");
    const value = { wheel_diameter_in: 18, wheel_width_j: 8, bolt_count: 5, pcd_mm: 112, center_bore_mm: 66.6, offset_et_mm: 35.125 };
    api.state.fitmentSourceIdentity = { sourceFingerprint: "source-a", selectedVariantSku: "sku-a", variantState: "selected" };
    api.applyRimSourceValues(value, { sourceFingerprint: "source-a", selectedVariantSku: "sku-a" });
    assert.equal(api.fitmentRimSaveReadiness().ready, false);
    api.applyRimSourceValues(value, { sourceFingerprint: "source-a", selectedVariantSku: "sku-a" });
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 35.125);
    assert.ok(api.fitmentRimPendingProposalFields().includes("offset_et_mm"));
    assert.equal(api.fitmentRimSaveReadiness().ready, false);
    api.bridge.action("accept-rim-proposal", "offset_et_mm");
    assert.equal(api.fitmentRimPendingProposalFields().includes("offset_et_mm"), false);
});

test("SKU change replaces unresolved system values, invalidates changed accepted values, and preserves manual fields", () => {
    const { api } = navigationApi();
    seed(api, overviewFor(api, "complete_rim_specs"), "rim");
    const skuA = { wheel_diameter_in: 18, wheel_width_j: 8, bolt_count: 5, pcd_mm: 112, center_bore_mm: 66.6, offset_et_mm: 35 };
    const skuB = { ...skuA, wheel_diameter_in: 19, offset_et_mm: 42 };
    api.state.fitmentSourceIdentity = { sourceFingerprint: "source-a", selectedVariantSku: "sku-a", variantState: "selected" };
    api.applyRimSourceValues(skuA, { sourceFingerprint: "source-a", selectedVariantSku: "sku-a" });
    api.applyRimSourceValues(skuB, { sourceFingerprint: "source-a", selectedVariantSku: "sku-b" });
    assert.equal(api.state.fitmentForm.rim.wheel_diameter_in, 19);
    assert.ok(api.fitmentRimPendingProposalFields().includes("wheel_diameter_in"));
    api.bridge.action("accept-rim-proposal", "wheel_diameter_in");
    api.state.fitmentForm.rim.offset_et_mm = 35;
    api.state.fitmentRimManualFields = ["offset_et_mm"];
    api.applyRimSourceValues({ ...skuB, wheel_diameter_in: 20, offset_et_mm: 45 }, { sourceFingerprint: "source-a", selectedVariantSku: "sku-c" });
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, 35);
    assert.ok(api.state.fitmentSourceConflicts.some(item => item.field === "offset_et_mm"));
    assert.equal(api.state.fitmentForm.rim.wheel_diameter_in, 20);
    assert.ok(api.fitmentRimPendingProposalFields().includes("wheel_diameter_in"), "changed accepted value must require another acceptance");
});

test("opening and cancelling another SKU preserves accepted A; selecting B invalidates A", () => {
    const { api } = navigationApi(); seedSourceSelection(api);
    api.state.fitmentSourceVariantOptions = api.state.fitmentSourceVariants;
    api.state.fitmentSourceVariants = [];
    const before = JSON.stringify([api.state.fitmentForm,api.state.fitmentSourceIdentity,api.state.fitmentSourceAcceptedContexts]);
    api.bridge.action("choose-rim-sku");
    assert.equal(api.state.fitmentSkuChooserOpen,true);
    assert.equal(JSON.stringify([api.state.fitmentForm,api.state.fitmentSourceIdentity,api.state.fitmentSourceAcceptedContexts]),before);
    api.bridge.action("cancel-rim-sku");
    assert.equal(JSON.stringify([api.state.fitmentForm,api.state.fitmentSourceIdentity,api.state.fitmentSourceAcceptedContexts]),before);
    api.bridge.action("choose-rim-sku"); api.bridge.action("rim-variant","0");
    assert.equal(api.state.fitmentSourceIdentity.selectedVariantSku,"sku-b");
    assert.equal(api.state.fitmentSourceAcceptedContexts.center_bore_mm,undefined);
    assert.ok(api.fitmentRimPendingProposalFields().includes("center_bore_mm"));
});

test("a newly required Vehicle workspace preserves and resumes the Wheel draft", async () => {
    const { api } = navigationApi({vnext:true});
    const ov=overviewFor(api,"select_vehicle_variant"); seed(api,ov,"rim");
    api.state.fitmentRimEditing=true;
    api.state.fitmentForm.rim.offset_et_mm="35,125";
    api.reconcileRequiredFitmentWorkspace();
    assert.equal(api.state.fitmentActiveSection,"vehicle"); assert.equal(api.state.fitmentRimEditing,false);
    assert.equal((fitmentMarkup(api.snapshot()).match(/data-fitment-workspace=/g)||[]).length,1);
    const picked=variant("Long Range"); api.state.fitmentVehicleVariants=[picked]; api.state.fitmentSelectedVehicleVariantIndex=0;
    // Demo confirms through the real variant operation, with no PATCH/render side effect.
    api.state.fitmentJobId="guest-demo-zeekr";
    api.bridge.action("confirm-vehicle-variant");
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(api.state.fitmentActiveSection,"rim"); assert.equal(api.state.fitmentRimEditing,true);
    assert.equal(api.state.fitmentForm.rim.offset_et_mm,"35,125");
});

test("manual Wheel fallback removes resolver provenance while preserving explicit values", () => {
    const { api }=navigationApi(); seedSourceSelection(api);
    api.state.fitmentSourceProposalContexts={offset_et_mm:{sourceFingerprint:"source-fp",selectedVariantSku:"sku-a",value:30}};
    api.bridge.action("manual-rim");
    assert.equal(api.state.fitmentSourceIdentity.sourceFingerprint,null); assert.equal(api.state.fitmentSourceIdentity.selectedVariantSku,null);
    assert.equal(Object.keys(api.state.fitmentSourceAcceptedContexts).length,0); assert.equal(Object.keys(api.state.fitmentSourceProposalContexts).length,0);
    assert.equal(api.state.fitmentForm.rim.center_bore_mm,66.6); assert.ok(api.state.fitmentRimManualFields.includes("center_bore_mm"));
});

test("implicit VNext save does not mutate and navigation resets history loading", async () => {
    const { api,calls }=navigationApi(); seedSourceSelection(api);
    await api.saveVnextFitment(); api.bridge.action("save");
    assert.equal(calls.some(call=>call.startsWith("PATCH")),false);
    api.state.fitmentCheckHistoryLoading=true; api.clearFitmentRuntimeRequests(); assert.equal(api.state.fitmentCheckHistoryLoading,false);
    api.state.fitmentSourceVariantOptions=[{sku:"previous-job"}];
    api.state.fitmentSourceVariantOptionsIdentity={sourceFingerprint:"previous-source"};
    api.state.fitmentSourceChooserIdentity={sourceFingerprint:"previous-source"};
    api.state.fitmentSkuChooserOpen=true;
    api.openFitmentView("another-job");
    assert.equal(api.state.fitmentSourceVariantOptions.length,0);
    assert.equal(api.state.fitmentSourceVariantOptionsIdentity,null);
    assert.equal(api.state.fitmentSourceChooserIdentity,null);
    assert.equal(api.state.fitmentSkuChooserOpen,false);
});

test("Standard summaries contain confirmed canonical values, never the edited Wheel draft", () => {
    const {api}=navigationApi(); const ov=overviewFor(api,"run_standard_check",{confirmedVariant:true});
    ov.rim_setup_state="confirmed_ready"; seed(api,ov,"rim"); api.state.fitmentForm.rim.offset_et_mm="99,125";
    let snapshot=api.snapshot(); assert.doesNotMatch(snapshot.canonicalWheelSummary,/99,125/); assert.ok(snapshot.canonicalVehicleSummary);
    ov.rim_setup_state="partial"; ov.vehicle_state="unconfirmed"; snapshot=api.snapshot();
    assert.equal(snapshot.canonicalWheelSummary,""); assert.equal(snapshot.canonicalVehicleSummary,"");
});


test("guest Vehicle Save opens the real demo exact-variant lookup", async () => {
    const {api,calls}=navigationApi({vnext:true});
    seed(api,overviewFor(api,"complete_vehicle_details"),"vehicle");
    api.state.fitmentJobId="guest-demo-zeekr";
    api.state.fitmentVehicleEditing=true;
    api.useRealVariantLookup();
    await api.saveVnextFitment("vehicle");
    assert.equal(api.snapshot().nextAction,"select_vehicle_variant");
    assert.equal(api.state.fitmentLookup.status,"loaded");
    assert.ok(api.state.fitmentVehicleVariants.length>0);
    assert.match(fitmentMarkup(api.snapshot()),/data-fitment-workspace="vehicle"/);
    assert.equal(calls.some(call=>call.startsWith("PATCH")),false);
});

test("readonly SKU lookup and cancel retain A, and reopening B uses the newly returned fingerprint", async () => {
    const {api}=navigationApi({routes:{"POST /api/backend/jobs/behavior-job/fitment/rim-source/resolve":response(200,{source_fingerprint:"fresh-source",variants:[sourceVariant("sku-b",{wheel_diameter_in:19,wheel_width_j:8.5,bolt_count:5,pcd_mm:112,center_bore_mm:66.6,offset_et_mm:45})]})}});
    seedSourceSelection(api); api.state.fitmentSourceVariants=[];
    const before=JSON.stringify([api.state.fitmentForm,api.state.fitmentSourceIdentity,api.state.fitmentSourceAcceptedContexts]);
    await api.resolveFitmentRimSource({chooserOnly:true});
    assert.equal(JSON.stringify([api.state.fitmentForm,api.state.fitmentSourceIdentity,api.state.fitmentSourceAcceptedContexts]),before);
    api.bridge.action("cancel-rim-sku"); api.bridge.action("choose-rim-sku"); api.bridge.action("rim-variant","0");
    assert.equal(api.state.fitmentSourceIdentity.sourceFingerprint,"fresh-source");
    assert.equal(api.state.fitmentSourceProposalContexts.center_bore_mm.sourceFingerprint,"fresh-source");
});

test("a valid multi-SKU resolver response is a chooser, even without shared top-level values", async () => {
    const {api}=navigationApi({routes:{"POST /api/backend/jobs/behavior-job/fitment/rim-source/resolve":response(200,{source_fingerprint:"source",selection_required:true,values:{},variants:[sourceVariant("sku-a",{wheel_diameter_in:19})]})}});
    seedSourceSelection(api); api.state.fitmentRimEditing=true;
    await api.resolveFitmentRimSource();
    assert.equal(api.state.fitmentSourceStatusTone,"neutral");
    assert.match(fitmentMarkup(api.snapshot()),/Выберите колесный диск/);
    assert.doesNotMatch(fitmentMarkup(api.snapshot()),/data-fitment-source-url|Указать параметры вручную/);
});

test("owner chips require explicit conflict resolution for ET and DIA while preserving canonical values", () => {
    for (const [field, current, suggested] of [["offset_et_mm",35.125,33.275],["center_bore_mm",66.6,72.6]]) {
        for (const useProposal of [true,false]) {
            const { api } = navigationApi();
            const overview = overviewFor(api,"complete_vehicle_details");
            seed(api,overview,"rim");
            api.state.fitmentForm.rim[field] = current;
            api.state.fitmentSourceConflicts = [{field,current,suggested}];
            const canonical = JSON.stringify(api.state.fitmentOverview);
            assert.equal(api.fitmentRimSaveReadiness().ready,false);
            api.bridge.action(useProposal ? "conflict-use" : "conflict-keep",useProposal ? `${field}|${suggested}` : field);
            assert.equal(api.state.fitmentSourceConflicts.length,0);
            assert.equal(Number(api.state.fitmentForm.rim[field]),useProposal ? suggested : current);
            assert.equal(JSON.stringify(api.state.fitmentOverview),canonical);
        }
    }
});

for (const [field,current,suggested] of [["offset_et_mm",35.125,33.275],["center_bore_mm",66.6,72.6],["wheel_width_j",9,8.5]]) {
    for (const useProposal of [false,true]) {
        test(`final UI gate runtime ${field} ${useProposal ? "use" : "keep"}: zero pending plus conflict never claims all confirmed`, () => {
            const {api}=navigationApi();
            seed(api,overviewFor(api,"complete_vehicle_details"),"rim");
            Object.assign(api.state.fitmentForm.rim,{wheel_diameter_in:20,wheel_width_j:9,bolt_count:5,pcd_mm:112,center_bore_mm:66.6,offset_et_mm:35.125,[field]:current});
            api.state.fitmentRimManualFields=["wheel_diameter_in","wheel_width_j","bolt_count","pcd_mm","center_bore_mm","offset_et_mm"];
            api.state.fitmentSourceAppliedFields=[];
            api.state.fitmentRimEditing=true;
            api.state.fitmentSourceConflicts=[{field,current,suggested,origin:"manual"}];
            const canonical=JSON.stringify(api.state.fitmentOverview);
            let snapshot=api.snapshot();
            assert.deepEqual(JSON.parse(JSON.stringify(snapshot.rimSaveReadiness)),buildFitmentRimReadiness({conflicts:[{field,current,suggested}]}));
            assert.equal(snapshot.rimSaveReadiness.pending.length,0);
            const markup=fitmentMarkup(snapshot);
            assert.equal((markup.match(/Выберите значение перед сохранением\./g)||[]).length,1);
            assert.doesNotMatch(markup,/Все параметры подтверждены/);
            assert.match(markup,/Требуется выбрать значение/);
            assert.match(markup,/data-fitment-action="save-rim"[^>]*disabled/);
            api.bridge.action(useProposal?"conflict-use":"conflict-keep",useProposal?`${field}|${suggested}`:field);
            snapshot=api.snapshot();
            assert.equal(snapshot.rimSaveReadiness.conflicts.length,0);
            assert.equal(Number(snapshot.rim[field]),useProposal?suggested:current);
            assert.equal(JSON.stringify(api.state.fitmentOverview),canonical);
            assert.equal(snapshot.rimSaveReadiness.ready,true);
            const resolved=fitmentMarkup(snapshot);
            assert.match(resolved,/Все параметры подтверждены/);
            assert.match(resolved,/Готово к сохранению/);
            assert.doesNotMatch(resolved,/data-fitment-action="save-rim"[^>]*disabled/);
            assert.equal(snapshot.canonicalWheelSummary,"");
            api.state.fitmentRimEditing=false;
            assert.match(fitmentMarkup(api.snapshot()),/Есть несохранённые изменения/);
        });
    }
}

test("fidelity fixture readiness uses the runtime builder and never supplies synthetic readiness fields", () => {
    const fixture=fs.readFileSync(path.join(ROOT,"tests/browser-fixtures/fitment-vnext-ui-fidelity.html"),"utf8");
    assert.match(fixture,/import \{buildFitmentRimReadiness\} from "\.\.\/\.\.\/webapp\/vnext\/fitment-readiness\.mjs"/);
    assert.doesNotMatch(fixture,/rimSaveReadiness\s*:\s*\{/);
    assert.match(fixture,/model\.rimSaveReadiness=buildFitmentRimReadiness\(/);
});

test("demo fixture market identifiers use the provider slug without a duplicate China alias", () => {
    const {api}=navigationApi();
    const demo=api.buildDefaultDemoFitmentOverview();
    assert.equal(demo.vehicle.market,"chdm");
    const demoVariants=APP_SOURCE.slice(APP_SOURCE.indexOf("const DEMO_VEHICLE_VARIANTS"),APP_SOURCE.indexOf("const DEMO_VEHICLE_CATALOGUE"));
    assert.doesNotMatch(demoVariants,/market: "CN"/);
});


function seedH1Catalogue(api, { make = "lada", model = "vesta", market = "russia", multi = false } = {}) {
    api.state.fitmentCatalogue = {
        makes: { status: "loaded", items: [{ value: make, label: make === "lada" ? "LADA" : "Lexus" }] },
        models: { status: "loaded", items: [{ value: model, label: model === "vesta" ? "Vesta" : "RX" }] },
        years: { status: "loaded", items: [2020, 2021].map(year => ({ value: String(year), label: String(year) })) },
    };
    api.state.fitmentMarketResolution = {
        status: multi ? "selected" : "resolved_single", resolution: multi ? "selection_required" : "single",
        resolved_market: multi ? null : { value: market, label: "Russia+" },
        items: multi ? [{ value: "eudm", label: "Europe" }, { value: "usdm", label: "USA" }] : [],
    };
}

function h1Markup(api) {
    return fitmentMarkup(api.snapshot());
}

function assertH1Selection(api, make, model, year, market) {
    const snapshot = api.snapshot();
    assert.deepEqual([snapshot.vehicleForm.make, snapshot.vehicleForm.model, String(snapshot.vehicleForm.year), snapshot.vehicleForm.market], [make, model, year, market]);
    const markup = h1Markup(api);
    for (const value of [make, model, year]) assert.match(markup, new RegExp(`<option value="${value}" selected`));
}

test("H1-A canonical catalogue labels map to stable selectors without changing canonical data", () => {
    const { api } = navigationApi();
    const overview = overviewFor(api, "complete_vehicle_details");
    overview.vehicle = { make: "LADA", model: "Vesta", year: 2020, market: "russia" };
    overview.vehicle_state = "unconfirmed";
    seed(api, overview);
    api.state.fitmentVehicleEditing = true;
    seedH1Catalogue(api);
    assertH1Selection(api, "lada", "vesta", "2020", "russia");
    assert.equal(api.state.fitmentForm.vehicle.make, "LADA");
    assert.equal(api.state.fitmentOverview.vehicle.make, "LADA");
    const options = [{ value: "other", label: "lada" }, { value: "lada", label: "LADA" }];
    assert.equal(api.fitmentCatalogueSelectionItem("makes", "lada", options).value, "lada");
    assert.equal(api.fitmentCatalogueSelectionItem("makes", "ambiguous", [{ value: "a", label: "ambiguous" }, { value: "b", label: "ambiguous" }]), null);
});

for (const scenario of [
    { name: "H1-B/C/D/G single market", make: "lada", model: "vesta", labelMake: "LADA", labelModel: "Vesta", market: "russia", multi: false },
    { name: "H1-B/C/E/G multi market", make: "lexus", model: "rx", labelMake: "Lexus", labelModel: "RX", market: "usdm", multi: true },
]) test(`${scenario.name}: Save then explicit Confirm keeps selection and completed Wheel intact`, async () => {
    const mutations = [];
    let overview;
    const { api, calls } = navigationApi({ vnext: true, routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": options => {
            const payload = JSON.parse(options.body);
            mutations.push(payload);
            overview = structuredClone(overview);
            overview.vehicle = { ...overview.vehicle, make: scenario.labelMake, model: scenario.labelModel, year: 2020, market: scenario.market, is_user_confirmed: mutations.length === 2 };
            overview.vehicle_revision += 1;
            overview.vehicle_state = mutations.length === 1 ? "unconfirmed" : "confirmed_incomplete";
            overview.next_action = { kind: mutations.length === 1 ? "complete_vehicle_details" : "select_vehicle_variant" };
            return response(200, overview);
        },
        "POST /api/backend/jobs/behavior-job/fitment/vehicle-variants": (_options, url) => {
            assert.match(url, /require_confirmation=true/);
            return response(200, { outcome: "multiple", vehicle_revision: overview.vehicle_revision, variants: [variant("Version A"), variant("Version B")] });
        },
    } });
    overview = overviewFor(api, "complete_vehicle_details");
    overview.vehicle_state = "unconfirmed";
    overview.vehicle = { make: "", model: "", year: null, market: "", is_user_confirmed: false };
    overview.rim_setup_state = "confirmed_ready";
    overview.front_rim = { rim: { ...overview.rim }, revision: 7, source_revision: 3, source_fingerprint: "completed-wheel", selected_variant_sku: "SKU-38", variant_state: "selected", field_states: { offset_et_mm: { value: 38, state: "confirmed", is_user_confirmed: true, source: "user_confirmed" } } };
    overview.rim_revision = 7;
    overview.rim_setup_revision = 4;
    const wheelBefore = JSON.stringify([overview.rim, overview.front_rim, overview.rear_rim, overview.rim_revision, overview.rim_setup_revision, overview.rim_provenance]);
    seed(api, overview);
    seedH1Catalogue(api, scenario);
    api.useRealValidation();
    api.state.fitmentForm.vehicle = { ...api.state.fitmentForm.vehicle, make: scenario.make, model: scenario.model, year: "2020", market: scenario.market };
    api.state.fitmentVehicleDirty = true;
    api.state.fitmentVehicleEditing = true;
    assert.match(h1Markup(api), /data-fitment-action="save-vehicle"[^>]*>Сохранить автомобиль/);
    await api.saveVnextFitment("vehicle");
    assert.equal(mutations.length, 1);
    assert.equal(api.state.fitmentOverview.vehicle_state, "unconfirmed");
    assertH1Selection(api, scenario.make, scenario.model, "2020", scenario.market);
    assert.match(h1Markup(api), /data-fitment-action="confirm-vehicle"[^>]*>Подтвердить данные/);
    assert.equal(h1Markup(api).includes('data-fitment-field="vehicle.market"'), scenario.multi);
    assert.equal(calls.some(call => call.includes("vehicle-variants")), false);
    api.useRealVariantLookup();
    await api.saveVnextFitment("vehicle");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mutations.length, 2);
    assert.deepEqual(mutations[1].vehicle, { make: scenario.labelMake, model: scenario.labelModel, year: 2020, market: scenario.market });
    assert.equal(mutations[1].expected_vehicle_revision, mutations[0].expected_vehicle_revision + 1);
    assert.equal(api.state.fitmentOverview.vehicle_state, "confirmed_incomplete");
    assert.equal(api.state.fitmentOverview.next_action.kind, "select_vehicle_variant");
    assert.equal(api.state.fitmentVehicleVariants.length, 2);
    assert.equal(api.state.fitmentOverview.modification_state === "confirmed", false);
    assert.match(h1Markup(api), /Подтвердить комплектацию/);
    for (const payload of mutations) {
        assert.equal(Object.hasOwn(payload, "rim"), false);
        assert.equal(Object.hasOwn(payload, "front_rim"), false);
        assert.equal(Object.hasOwn(payload, "rear_rim"), false);
        assert.equal(Object.hasOwn(payload, "setup_mode"), false);
    }
    const saved = api.state.fitmentOverview;
    assert.equal(JSON.stringify([saved.rim, saved.front_rim, saved.rear_rim, saved.rim_revision, saved.rim_setup_revision, saved.rim_provenance]), wheelBefore);
});

test("H1-F edit after Save returns to Save and rejects an obsolete Confirm action", async () => {
    let mutations = 0;
    const { api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": options => {
            mutations += 1;
            const payload = JSON.parse(options.body);
            assert.equal(payload.vehicle.year, 2021);
            return response(200, { ...api.state.fitmentOverview, vehicle_revision: 3, vehicle: { make: "LADA", model: "Vesta", year: 2021, market: "russia" } });
        },
    } });
    const overview = overviewFor(api, "complete_vehicle_details");
    overview.vehicle_state = "unconfirmed";
    overview.vehicle = { make: "LADA", model: "Vesta", year: 2020, market: "russia" };
    seed(api, overview);
    seedH1Catalogue(api);
    api.state.fitmentVehicleEditing = true;
    assert.equal(api.awaitingVehicleConfirmation(), true);
    api.setVnextFitmentField("vehicle.year", "2021");
    assert.equal(api.awaitingVehicleConfirmation(), false);
    assert.match(h1Markup(api), /data-fitment-action="save-vehicle"[^>]*>Сохранить автомобиль/);
    api.bridge.action("confirm-vehicle");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mutations, 0);
    seedH1Catalogue(api);
    api.useRealValidation();
    await api.saveVnextFitment("vehicle");
    assert.equal(mutations, 1);
    assert.equal(api.state.fitmentOverview.vehicle.year, 2021);
    assert.equal(api.awaitingVehicleConfirmation(), true);
    assert.match(h1Markup(api), /data-fitment-action="confirm-vehicle"[^>]*>Подтвердить данные/);
});


test("P0-A: saved Wheel source is automatically resolved only on first entry", async () => {
    let overview;
    const {api,calls} = navigationApi({routes:{
        "GET /api/backend/jobs/behavior-job/fitment": () => response(200,overview),
        "POST /api/backend/jobs/behavior-job/fitment/rim-source/resolve": response(200,{final_url:"https://shop.example.test/wheel",source_fingerprint:"same-source",selected_variant_sku:"same-sku",values:{offset_et_mm:35.5}}),
    }});
    overview = overviewFor(api,"run_standard_check",{confirmedVariant:true});
    overview.rim.product_url = "https://shop.example.test/wheel";
    overview.rim.offset_et_mm = 38;
    overview.front_rim = {rim:overview.rim,source_fingerprint:"same-source",selected_variant_sku:"same-sku",source_revision:3,field_states:{offset_et_mm:{value:38,state:"confirmed",is_user_confirmed:true}}};
    seed(api,overview);
    for (let entry=0;entry<2;entry++) {
        api.openFitmentView("behavior-job",{originView:"render-detail"});
        await new Promise(resolve=>setImmediate(resolve));
    }
    assert.equal(calls.filter(call=>call.endsWith("rim-source/resolve")).length,1);
    assert.equal(api.state.fitmentOverview.front_rim.rim.offset_et_mm,38);
    assert.equal(api.state.fitmentSourceConflicts.length,0);
    assert.equal(api.snapshot().canRunCheck,true);
});

test("M2-A triage: manually completing absent geometry drops selected commercial SKU identity", () => {
    const {api} = navigationApi();
    seed(api,overviewFor(api,"complete_vehicle_details"),"rim");
    api.state.fitmentSourceIdentity = {sourceFingerprint:"product",selectedVariantSku:null,sourceUrl:"https://shop.example.test/wheel",variantState:"selection_required"};
    api.state.fitmentSourceVariants = [{sku:"SKU-A",values:{brand:"KONIG"}}];
    api.selectFitmentRimVariant(0);
    assert.equal(api.state.fitmentSourceIdentity.selectedVariantSku,"SKU-A");
    api.setVnextFitmentField("rim.offset_et_mm","38");
    assert.equal(api.state.fitmentSourceIdentity.selectedVariantSku,null);
    assert.equal(api.state.fitmentSourceIdentity.sourceFingerprint,null);
    assert.equal(api.state.fitmentRimManualFields.includes("offset_et_mm"),true);
});

test("M2-B triage: manual geometry remains accepted when another SKU lacks geometry", () => {
    const {api} = navigationApi();
    seed(api,overviewFor(api,"complete_vehicle_details"),"rim");
    api.setVnextFitmentField("rim.offset_et_mm","38");
    api.state.fitmentSourceVariants = [{sku:"SKU-B",values:{brand:"KONIG"}}];
    api.state.fitmentSourceChooserIdentity = {sourceFingerprint:"product",sourceUrl:"https://shop.example.test/wheel"};
    api.selectFitmentRimVariant(0);
    assert.equal(api.state.fitmentForm.rim.offset_et_mm,"38");
    assert.equal(api.state.fitmentRimManualFields.includes("offset_et_mm"),true);
    assert.equal(api.fitmentRimPendingProposalFields().includes("offset_et_mm"),false);
    assert.equal(api.state.fitmentSourceIdentity.selectedVariantSku,"SKU-B");
});

for (const section of ["vehicle", "rim", "result"]) test(`Final HIGH T1–T4/T7: confirm-vehicle owns Vehicle PATCH from ${section}`, async () => {
    const payloads = [];
    const {api} = navigationApi({routes:{
        "PATCH /api/backend/jobs/behavior-job/fitment": options => {
            const payload = JSON.parse(options.body);
            payloads.push(payload);
            assert.deepEqual(payload.vehicle,{make:"LADA",model:"Vesta",year:2020,market:"russia"});
            return response(200,{...api.state.fitmentOverview,vehicle_revision:3,vehicle_state:"confirmed_incomplete",vehicle:{...api.state.fitmentOverview.vehicle,is_user_confirmed:true},next_action:{kind:"select_vehicle_variant"}});
        },
    }});
    const overview = overviewFor(api,"complete_vehicle_details");
    overview.vehicle_state = "unconfirmed";
    overview.vehicle = {make:"LADA",model:"Vesta",year:2020,market:"russia",is_user_confirmed:false};
    overview.rim_setup_state = "confirmed_ready";
    overview.front_rim = {rim:{...overview.rim},source_revision:3,source_fingerprint:"unchanged-source",selected_variant_sku:"SKU-A",field_states:{offset_et_mm:{value:38,state:"confirmed",is_user_confirmed:true}}};
    const wheelBefore = JSON.stringify([overview.rim,overview.front_rim,overview.rear_rim,overview.rim_revision,overview.rim_setup_revision]);
    seed(api,overview,section);
    seedH1Catalogue(api);
    api.useRealValidation();
    api.state.fitmentForm.rim.offset_et_mm = "40,125";
    api.state.fitmentRimManualFields = ["offset_et_mm"];
    api.state.fitmentSourceIdentity = {sourceFingerprint:"unchanged-source",selectedVariantSku:"SKU-A",variantState:"selected"};
    const draftBefore = JSON.stringify([api.state.fitmentForm.rim,api.state.fitmentRimManualFields,api.state.fitmentSourceIdentity]);
    assert.equal(api.awaitingVehicleConfirmation(),true);
    api.bridge.action("confirm-vehicle");
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(payloads.length,1);
    for (const key of ["rim","front_rim","rear_rim","rim_setup","setup_mode"]) assert.equal(Object.hasOwn(payloads[0],key),false);
    assert.equal(payloads[0].expected_vehicle_revision,overview.vehicle_revision);
    assert.equal(payloads[0].expected_rim_revision,overview.rim_revision);
    const saved = api.state.fitmentOverview;
    assert.equal(JSON.stringify([saved.rim,saved.front_rim,saved.rear_rim,saved.rim_revision,saved.rim_setup_revision]),wheelBefore);
    assert.equal(JSON.stringify([api.state.fitmentForm.rim,api.state.fitmentRimManualFields,api.state.fitmentSourceIdentity]),draftBefore);
    assert.equal(saved.vehicle_state,"confirmed_incomplete");
    assert.equal(saved.next_action.kind,"select_vehicle_variant");
    assert.equal(api.state.fitmentMessageTone,"success");
    assert.equal(api.state.fitmentSaving,false);
});

for (const status of [409,503,200]) test(`Final HIGH T6: confirm response ${status}${status===200?" without confirmation":""} cannot report success`, async () => {
    let count = 0;
    const {api} = navigationApi({routes:{
        "PATCH /api/backend/jobs/behavior-job/fitment": () => {count+=1;return response(status,status===200?api.state.fitmentOverview:{detail:"failed"});},
    }});
    const overview = overviewFor(api,"complete_vehicle_details");
    overview.vehicle_state = "unconfirmed";
    overview.vehicle = {make:"LADA",model:"Vesta",year:2020,market:"russia",is_user_confirmed:false};
    seed(api,overview,"result");
    seedH1Catalogue(api);
    api.useRealValidation();
    api.bridge.action("confirm-vehicle");
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(count,1);
    assert.equal(api.state.fitmentOverview.vehicle_state,"unconfirmed");
    assert.equal(api.state.fitmentMessage,"");
    assert.notEqual(api.state.fitmentMessageTone,"success");
    assert.equal(api.state.fitmentFormState.status,"save_failed");
    assert.equal(api.state.fitmentVehicleVariants.length,0);
});

test("Final HIGH T5: explicit intent rejects edited, incomplete, non-proposed and revisionless Vehicle", async () => {
    const {api,calls} = navigationApi();
    const overview = overviewFor(api,"complete_vehicle_details");
    overview.vehicle_state = "unconfirmed";
    overview.vehicle = {make:"LADA",model:"Vesta",year:2020,market:"russia"};
    for (const invalid of ["edited","incomplete","confirmed","revisionless"]) {
        seed(api,structuredClone(overview),"result");
        seedH1Catalogue(api);
        api.useRealValidation();
        if (invalid==="edited") api.state.fitmentVehicleDirty=true;
        if (invalid==="incomplete") api.state.fitmentForm.vehicle.year="";
        if (invalid==="confirmed") api.state.fitmentOverview.vehicle_state="confirmed_ready";
        if (invalid==="revisionless") api.state.fitmentOverview.vehicle_revision=null;
        await api.saveVnextFitment("vehicle",{intent:"confirm_vehicle"});
    }
    assert.equal(calls.some(call=>call.startsWith("PATCH")),false);
});

test("Wheel → recognition → Vehicle preserves the Wheel draft and canonical revisions", async () => {
    let revision;
    const {api,calls}=navigationApi({vnext:true,routes:{
        "POST /api/backend/identity/fitment/behavior-job/vehicle-proposal":()=>response(200,{vehicle_revision:revision,vehicle:{primary:{make:"Audi",model:"Q8",year:2020}}}),
    }});
    seed(api,overviewFor(api,"complete_vehicle_details"),"rim");
    api.state.fitmentRimEditing=true;
    api.state.fitmentForm.rim.offset_et_mm="35,125";
    api.state.fitmentVehiclePhoto=new File(["test"],"car.jpg",{type:"image/jpeg"});
    revision=api.state.fitmentOverview.vehicle_revision;
    const canonical=JSON.stringify(api.state.fitmentOverview);
    await api.recognizeFitmentVehicle();
    assert.equal(api.state.fitmentRimEditing,false);
    assert.match(fitmentMarkup(api.snapshot()),/data-fitment-workspace-kind="vehicle-recognition"/);
    api.useFitmentRecognitionProposal(0);
    assert.match(fitmentMarkup(api.snapshot()),/data-fitment-workspace-kind="vehicle-editor"/);
    assert.doesNotMatch(fitmentMarkup(api.snapshot()),/Распознано по фотографии/);
    api.bridge.action("edit-rim");
    assert.match(fitmentMarkup(api.snapshot()),/data-fitment-workspace-kind="rim-editor"/);
    assert.equal(api.state.fitmentForm.rim.offset_et_mm,"35,125");
    assert.equal(JSON.stringify(api.state.fitmentOverview),canonical);
    assert.equal(calls.some(call=>call.startsWith("PATCH")),false);
});

test("a recognition reply after switching to Wheel does not reopen Vehicle workspace", async () => {
    let finish;
    const {api}=navigationApi({vnext:true,routes:{
        "POST /api/backend/identity/fitment/behavior-job/vehicle-proposal":()=>new Promise(resolve=>{finish=resolve;}),
    }});
    seed(api,overviewFor(api,"complete_vehicle_details"),"vehicle");
    api.state.fitmentVehiclePhoto=new File(["test"],"car.jpg",{type:"image/jpeg"});
    const pending=api.recognizeFitmentVehicle();
    api.bridge.action("edit-rim");
    finish(response(200,{vehicle_revision:api.state.fitmentOverview.vehicle_revision,vehicle:{primary:{make:"Audi",model:"Q8",year:2020}}}));
    await pending;
    assert.equal(api.state.fitmentRecognition.status,"proposed");
    assert.equal(api.state.fitmentRecognition.workspaceOpen,false);
    assert.match(fitmentMarkup(api.snapshot()),/data-fitment-workspace-kind="rim-editor"/);
    api.bridge.action("edit-vehicle");
    assert.match(fitmentMarkup(api.snapshot()),/data-fitment-workspace-kind="vehicle-editor"/);
    assert.doesNotMatch(fitmentMarkup(api.snapshot()),/Распознано по фотографии/);
});

test("P0-A: AI vehicle snapshots never name Result, History or failed cards", () => {
    const {api}=navigationApi();
    const job={job_id:"abcdef12-1111-4111-8111-111111111111",status:"failed",render_input_snapshot:{vehicle:{make:"Ghost",model:"AI"},rim:{brand:"BBS",model:"CH-R"}},vehicle:{make:"Ghost"},metadata:{vehicle:{make:"Ghost"}}};
    assert.equal(api.humanRenderTitle(job),"Примерка · BBS CH-R");
    assert.equal(api.humanRenderTitle({...job,render_input_snapshot:{vehicle:{make:"Ghost"}}}),"Примерка #abcdef");
    assert.equal(api.humanRenderTitle({...job,vehicle_identity:{make:"BMW",model:"3 Series",is_user_confirmed:true}}),"BMW 3 Series");
    assert.equal(api.humanRenderTitle({...job,vehicle_identity:{make:"Ghost",model:"AI",is_user_confirmed:false}}),"Примерка · BBS CH-R");
});

for(const failed of [false,true]) test(`P0-A: ${failed?"failed":"successful"} automatic URL resolution is not retried on reopen or session guard reset`,async()=>{
    let overview;
    const {api,calls}=navigationApi({routes:{
        "GET /api/backend/jobs/behavior-job/fitment":()=>response(200,overview),
        "POST /api/backend/jobs/behavior-job/fitment/rim-source/resolve":response(failed?422:200,failed?{detail:{code:"no_data"}}:{final_url:"https://shop.example.test/wheel",values:{}}),
    }});
    overview=overviewFor(api,"complete_vehicle_details");overview.rim.product_url="https://shop.example.test/wheel";overview.front_rim={rim:overview.rim};seed(api,overview);
    for(let i=0;i<3;i++){
        api.state.fitmentSourceAutoResolvedForJob="";
        api.openFitmentView("behavior-job",{originView:"render-detail"});
        await new Promise(resolve=>setImmediate(resolve));
    }
    assert.equal(calls.filter(c=>c.endsWith("rim-source/resolve")).length,1);
    await api.resolveFitmentRimSource();
    assert.equal(calls.filter(c=>c.endsWith("rim-source/resolve")).length,2);
});

test("P0-A: Fitment without product URL never auto-resolves a source",async()=>{
    let overview;
    const {api,calls}=navigationApi({routes:{"GET /api/backend/jobs/behavior-job/fitment":()=>response(200,overview)}});
    overview=overviewFor(api,"complete_vehicle_details");overview.rim.product_url=null;overview.front_rim={rim:overview.rim};seed(api,overview);
    api.openFitmentView("behavior-job",{originView:"render-detail"});await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.filter(c=>c.endsWith("rim-source/resolve")).length,0);
});

test('P0-A corrective: disabled resolver releases browser claim for a later enabled entry', async () => {
    let overview; let enabled=false;
    const {api,calls}=navigationApi({routes:{
        'GET /api/backend/jobs/behavior-job/fitment':()=>response(200,overview),
        'POST /api/backend/jobs/behavior-job/fitment/rim-source/resolve':()=>enabled
            ? response(422,{detail:{code:'no_data'}})
            : response(503,{detail:'Rim URL resolver is disabled'}),
    }});
    overview=overviewFor(api,'complete_vehicle_details');
    overview.rim.product_url='https://shop.example.test/wheel';
    overview.front_rim={rim:overview.rim};
    seed(api,overview);
    api.openFitmentView('behavior-job',{originView:'render-detail'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.filter(call=>call.endsWith('rim-source/resolve')).length,1);
    enabled=true;
    api.openFitmentView('behavior-job',{originView:'render-detail'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.filter(call=>call.endsWith('rim-source/resolve')).length,2);
    api.openFitmentView('behavior-job',{originView:'render-detail'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.filter(call=>call.endsWith('rim-source/resolve')).length,2);
});


test("P0-B domain dirty normalizes decimals and empty values, keeps ET zero and checks all Wheel fields", async () => {
    const { api, calls } = navigationApi();
    seed(api, overviewFor(api, "run_standard_check"), "rim");
    api.state.fitmentForm.rim.center_bore_mm = "66,6";
    api.state.fitmentFormState.baseline.rim.center_bore_mm = 66.6;
    api.state.fitmentForm.rim.offset_et_mm = "0";
    api.state.fitmentFormState.baseline.rim.offset_et_mm = 0;
    api.state.fitmentForm.rim.sku = "";
    api.state.fitmentFormState.baseline.rim.sku = null;
    assert.equal(api.fitmentWheelDraftIsDirty(), false);
    assert.equal(api.snapshot().canRunCheck, true);
    for (const [scope, key, value] of [["rim", "offset_et_mm", "1"], ["rim", "brand", "Other"], ["rear_rim", "pcd_mm", "120"]]) {
        const old = api.state.fitmentForm[scope][key];
        api.state.fitmentForm[scope][key] = value;
        assert.equal(api.fitmentWheelDraftIsDirty(), true);
        assert.equal(api.snapshot().canRunCheck, false);
        await api.runFitmentCheck();
        api.state.fitmentForm[scope][key] = old;
    }
    api.state.fitmentForm.setup_mode = "staggered";
    assert.equal(api.fitmentWheelDraftIsDirty(), true);
    assert.equal(calls.filter(call => call.startsWith("POST")).length, 0);
});

test("P0-B Wheel Save advances only canonical Wheel and preserves edits made while PATCH is in flight", async () => {
    let release, payload;
    const { api } = navigationApi({ routes: { "PATCH /api/backend/jobs/behavior-job/fitment": options => {
        payload = JSON.parse(options.body);
        return new Promise(resolve => { release = resolve; });
    } } });
    const original = overviewFor(api, "run_standard_check", { confirmedVariant: true });
    seed(api, original, "rim");
    api.setVnextFitmentField("rim.offset_et_mm", "35.125");
    const pending = api.saveFitment(undefined, { owner: "rim", confirmWheelFields: true });
    assert.equal(payload.vehicle, undefined);
    api.setVnextFitmentField("rim.offset_et_mm", "36.25");
    const saved = structuredClone(original);
    saved.rim.offset_et_mm = 35.125;
    if (saved.front_rim) saved.front_rim.rim.offset_et_mm = 35.125;
    saved.rim_revision += 1; saved.rim_setup_revision += 1;
    release(response(200, saved)); await pending;
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, "36.25");
    assert.equal(api.fitmentWheelDraftIsDirty(), true);
    assert.equal(api.snapshot().canRunCheck, false);
    assert.equal(api.state.fitmentOverview.vehicle_revision, original.vehicle_revision);
    assert.equal(JSON.stringify(api.state.fitmentOverview.vehicle), JSON.stringify(original.vehicle));
    api.setVnextFitmentField("rim.offset_et_mm", "35,125");
    assert.equal(api.fitmentWheelDraftIsDirty(), false);
    assert.equal(api.snapshot().canRunCheck, true);
});

test("P0-B invalid dirty Save opens Wheel editor without PATCH or Check", async () => {
    const { api, calls } = navigationApi(); seed(api, overviewFor(api, "run_standard_check"), "result");
    api.setVnextFitmentField("rim.center_bore_mm", "");
    await api.saveVnextFitment("rim");
    assert.equal(api.state.fitmentRimEditing, true);
    assert.ok(api.state.fitmentFormState.missingFields.includes("rim.center_bore_mm"));
    assert.equal(api.state.fitmentError, "");
    assert.equal(calls.some(call => call.startsWith("PATCH") || call.startsWith("POST")), false);
});

test("P0-B launch failure is separate from failed execution and retry uses a new canonical request", async () => {
    let attempts = 0, release;
    const { api, calls } = navigationApi({ routes: { "POST /api/backend/fitment/checks": () => {
        attempts++;
        return attempts === 1 ? response(500, { detail: "provider_timeout" }) : new Promise(resolve => { release = resolve; });
    } } });
    seed(api, overviewFor(api, "run_standard_check"), "result");
    await api.runFitmentCheck();
    assert.equal(api.state.fitmentCheck, null);
    assert.equal(api.snapshot().checkStartFailed, true);
    const html = fitmentMarkup(api.snapshot());
    assert.match(html, /Проверку выполнить не удалось/);
    assert.match(html, /Повторить проверку/);
    assert.doesNotMatch(html, /provider_timeout|500/);
    const retry = api.runFitmentCheck(); await api.runFitmentCheck();
    assert.equal(calls.filter(call => call.startsWith("POST")).length, 2);
    release(response(200, { id: "new-execution", execution_status: "failed", retry_mode: "retryable" }));
    await retry;
    assert.equal(api.snapshot().checkStartFailed, false);
    assert.equal(api.snapshot().executionStatus, "failed");
});

test("P0-B wheel source follows canonical URL or photo and hides credentials/query", () => {
    const { api } = navigationApi();
    const source = api.fitmentWheelSource({ rim: { product_url: "https://private:secret@www.shop.test/wheel?token=secret" } }, null);
    assert.equal(source.rimSourceLabel, "Ссылка на товар"); assert.equal(source.rimSourceDomain, "shop.test");
    assert.equal(api.fitmentWheelSource({ rim: { product_url: "javascript:alert(1)" } }, { assets: { rim_original: {} } }).rimSourceLabel, "Фото диска");
    assert.equal(api.fitmentWheelSource({ rim_field_states: { offset_et_mm: { source: "user_input" } } }, null).rimSourceLabel, "Указано вручную");
    assert.equal(api.fitmentWheelSource({}, null).rimSourceLabel, "Источник не указан");
});

test("P0-B expiry displays all positive active buckets sorted nearest first, permanent last", () => {
    const { api } = navigationApi();
    api.state.creditPackages = [
        { id: "later", remainingCredits: 6, expiresAt: "2099-12-01T00:00:00Z" },
        { id: "permanent", remainingCredits: 3, expiresAt: null },
        { id: "early", remainingCredits: 10, expiresAt: "2099-10-01T00:00:00Z" },
        { id: "middle", remainingCredits: 15, expiresAt: "2099-11-01T00:00:00Z" },
        { id: "zero", remainingCredits: 0, expiresAt: "2099-10-01T00:00:00Z" },
        { id: "expired", remainingCredits: 100, expiresAt: "2020-01-01T00:00:00Z" },
    ];
    api.state.balance = 34;
    assert.equal(api.buildRenderExpiryCohorts().map(item => item.key).join(","), "early,middle,later,permanent");
    const snapshot = api.vnextDashboardSnapshot();
    assert.equal(snapshot.expiry.length, 4);
    assert.equal(snapshot.expiry.reduce((sum, item) => sum + item.credits, 0), 34);
    assert.equal(snapshot.expiry.at(-1).expiresLabel, "без срока");
});


test("P0-B a Wheel edit during currentness refresh cannot become the saved baseline", async () => {
    let release;
    const { api } = navigationApi({ routes: {
        "PATCH /api/backend/jobs/behavior-job/fitment": () => {
            const next = structuredClone(api.state.fitmentOverview);
            next.rim.offset_et_mm = 40;
            if (next.front_rim) next.front_rim.rim.offset_et_mm = 40;
            next.rim_revision += 1;
            next.current_check = { id: "old-check", execution_status: "completed", verdict: "compatible", is_current: false };
            return response(200, next);
        },
        "GET /api/backend/fitment/checks/old-check": () => new Promise(resolve => { release = resolve; }),
    } });
    seed(api, overviewFor(api, "run_standard_check"), "rim");
    api.state.fitmentCheck = { id: "old-check", execution_status: "completed", verdict: "compatible" };
    api.setVnextFitmentField("rim.offset_et_mm", "40");
    const saving = api.saveWithRealCurrentness(undefined, { owner: "rim", confirmWheelFields: true });
    while (!release) await new Promise(resolve => setTimeout(resolve, 0));
    api.setVnextFitmentField("rim.offset_et_mm", "41");
    release(response(200, { id: "old-check", execution_status: "completed", verdict: "compatible", is_current: false }));
    await saving;
    assert.equal(Number(api.state.fitmentFormState.baseline.rim.offset_et_mm), 40);
    assert.equal(api.state.fitmentForm.rim.offset_et_mm, "41");
    assert.equal(api.snapshot().rimDraftDirty, true);
    assert.equal(api.snapshot().canRunCheck, false);
});
