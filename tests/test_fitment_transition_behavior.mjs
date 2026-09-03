import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "webapp", "app.js"), "utf8");

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
    vm.runInNewContext(`${APP_SOURCE}\n globalThis.__workflowApi = { deriveFitmentNextIntent, deriveVehicleWorkspaceMode, deriveResultRecovery, deriveNavigatorPresentation };`, context);
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

function response(status, body = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        async json() { return body; },
        async text() { return JSON.stringify(body); },
    };
}

function navigationApi({ routes = {} } = {}) {
    const calls = [];
    const document = {
        documentElement: { dataset: { appBuild: "navigation-test" } },
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
        fetch: async (url, options = {}) => {
            const key = `${options.method || "GET"} ${new URL(url, "https://test.local").pathname}`;
            calls.push(key);
            const handler = routes[key];
            return typeof handler === "function" ? handler() : handler || response(404, { detail: key });
        },
        localStorage: storage(), sessionStorage: storage(), navigator: { language: "ru-RU", userAgent: "test" },
        setTimeout, clearTimeout, globalThis: null,
    };
    context.globalThis = context;
    vm.runInNewContext(`${APP_SOURCE}
        globalThis.__fitmentRenderedWorkspace = "";
        renderFitment = () => { globalThis.__fitmentRenderedWorkspace = state.fitmentActiveSection; };
        loadFitmentVehicleCatalogue = () => {};
        ensureRequiredFitmentVariantLookup = () => {};
        loadFitmentCheckHistory = async () => {};
        loadRenderHistory = async () => {};
        refreshFitmentCheckCurrentness = async () => {};
        validateFitmentForm = () => [];
        fitmentFormIsDirty = () => false;
        globalThis.__navigationApi = {
            state, buildDefaultDemoFitmentOverview, fitmentFormFromOverview, cloneFitmentForm,
            loadFitmentOverview, loadFitmentVehicleVariants, applyFitmentVehicleVariant,
            replaceFitmentVehicleVariant, saveFitment, setFitmentActiveSection,
            navigateFitmentRecovery,
            renderedWorkspace: () => globalThis.__fitmentRenderedWorkspace
        };`, context);
    return { api: context.__navigationApi, calls };
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

function assertSection(api, section) {
    assert.equal(api.state.fitmentActiveSection, section);
    assert.equal(api.renderedWorkspace(), section);
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
        "GET /api/backend/jobs/behavior-job/fitment": () => response(200, overviewFor(api, "complete_rim_specs", { confirmedVariant: true })),
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
