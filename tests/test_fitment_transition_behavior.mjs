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
