import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_SOURCE = fs.readFileSync(path.join(REPO_ROOT, "webapp", "app.js"), "utf8");

function response(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return body;
        },
        async text() {
            return JSON.stringify(body);
        },
    };
}

function storage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
    };
}

function elementStub() {
    return {
        dataset: {},
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {},
        append() {},
        appendChild() {},
        remove() {},
        setAttribute() {},
        removeAttribute() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
    };
}

function createHarness({ catalogue = {}, deferred = false } = {}) {
    const pending = [];
    const calls = [];
    const fetchImpl = (url, options = {}) => {
        const parsed = new URL(url, "http://test.local");
        if (parsed.pathname.endsWith("/auth/telegram/nonce")) {
            return Promise.resolve(response({ client_id: "1", nonce: "test-nonce", nonce_token: "test-token" }));
        }
        const match = parsed.pathname.match(/\/vehicle-catalogue\/([^/]+)$/);
        if (!match) return Promise.resolve(response({}));
        const kind = match[1];
        const params = Object.fromEntries(parsed.searchParams.entries());
        const request = { kind, params, options, url };
        calls.push(request);
        if (deferred) {
            return new Promise((resolve, reject) => pending.push({ ...request, resolve, reject }));
        }
        const key = catalogueKey(kind, params);
        const items = catalogue[key] || [];
        if (kind === "markets") {
            return Promise.resolve(response({
                outcome: items.length ? "success" : "no_data",
                resolution: items.length === 1 ? "single" : items.length ? "selection_required" : "no_data",
                resolved_market: items.length === 1 ? items[0] : null,
                items: items.length === 1 ? [] : items,
            }));
        }
        return Promise.resolve(response({ outcome: items.length ? "success" : "no_data", items }));
    };

    const document = {
        documentElement: { dataset: { appBuild: "behavior-test" } },
        head: { append() {} },
        body: elementStub(),
        hidden: false,
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement: elementStub,
    };
    const window = {
        Telegram: { Login: {} },
        location: { search: "" },
        innerWidth: 1280,
        setTimeout,
        clearTimeout,
        requestAnimationFrame(callback) { callback(); },
        addEventListener() {},
        scrollTo() {},
        open() {},
    };
    const context = {
        AbortController,
        URL,
        URLSearchParams,
        console,
        document,
        fetch: fetchImpl,
        localStorage: storage(),
        sessionStorage: storage(),
        navigator: { language: "ru-RU", userAgent: "behavior-test" },
        window,
        setTimeout,
        clearTimeout,
        setImmediate,
        globalThis: null,
    };
    context.globalThis = context;

    const apiSource = `${APP_SOURCE}
renderFitment = () => {};
globalThis.__fitmentCatalogueTestApi = {
    state,
    createFitmentCatalogueDraftMemory,
    fitmentCatalogueResultFromState,
    fitmentCatalogueFieldState,
    validateFitmentForm,
    demoVehicleCatalogueResult,
    fitmentRememberedVehicleChain,
    rememberFitmentVehicleCatalogueChain,
    beginFitmentCatalogueContextChange,
    resetFitmentCatalogue,
    loadFitmentCatalogue,
    revalidateFitmentCatalogueChain,
    retryFitmentCatalogue,
};`;
    vm.runInNewContext(apiSource, context, { filename: "webapp/app.js" });
    const api = context.__fitmentCatalogueTestApi;
    api.state.fitmentJobId = "behavior-job";
    api.state.fitmentCatalogueDraftMemory = api.createFitmentCatalogueDraftMemory("behavior-job");
    api.state.fitmentCatalogueRequestToken = 0;
    api.state.fitmentCatalogueContextVersion = 0;
    api.state.fitmentCatalogueControllers = {};
    api.state.fitmentCatalogueRequests = {};
    return { api, calls, pending, context };
}

function catalogueKey(kind, params) {
    if (kind === "makes") return "makes";
    if (kind === "models") return `models:${params.make || ""}`;
    if (kind === "years") return `years:${params.make || ""}:${params.model || ""}`;
    return `markets:${params.make || ""}:${params.model || ""}:${params.year || ""}`;
}

const CATALOGUE = {
    makes: [
        { value: "ZEEKR", label: "ZEEKR" },
        { value: "Porsche", label: "Porsche" },
        { value: "Lada", label: "Lada" },
    ],
    "models:ZEEKR": [
        { value: "007", label: "007" },
        { value: "X", label: "X" },
    ],
    "models:Porsche": [{ value: "Cayenne", label: "Cayenne" }],
    "models:Lada": [{ value: "Vesta", label: "Vesta" }],
    "years:ZEEKR:007": [{ value: "2025", label: "2025" }, { value: "2023", label: "2023" }],
    "years:ZEEKR:X": [{ value: "2023", label: "2023" }],
    "years:Porsche:Cayenne": [{ value: "2022", label: "2022" }],
    "years:Lada:Vesta": [{ value: "2021", label: "2021" }],
    "markets:ZEEKR:007:2025": [{ value: "chdm", label: "Китай" }],
    "markets:ZEEKR:X:2023": [{ value: "chdm", label: "Китай" }, { value: "russia", label: "Россия+" }],
    "markets:Porsche:Cayenne:2022": [{ value: "russia", label: "Россия+" }],
};

function seedState(harness, vehicle, catalogue = CATALOGUE) {
    const { api } = harness;
    api.state.fitmentForm.vehicle = { ...vehicle };
    api.state.fitmentCatalogue = {
        regions: { status: "idle", items: [] },
        makes: { status: "loaded", items: catalogue.makes || [] },
        models: { status: "loaded", items: catalogue[`models:${vehicle.make}`] || [] },
        years: { status: "loaded", items: catalogue[`years:${vehicle.make}:${vehicle.model}`] || [] },
    };
    const markets = catalogue[`markets:${vehicle.make}:${vehicle.model}:${vehicle.year}`] || [];
    api.state.fitmentMarketResolution = {
        status: markets.length === 1 ? "resolved_single" : markets.length ? "selection_required" : "no_data",
        resolution: markets.length === 1 ? "single" : markets.length ? "selection_required" : "no_data",
        resolved_market: markets.length === 1 ? markets[0] : null,
        items: markets.length === 1 ? [] : markets,
    };
    api.state.fitmentFormState = {
        baseline: { vehicle: { ...vehicle } },
        status: "dirty",
        validation: "valid",
        missingFields: [],
        invalidFields: [],
    };
}

async function selectMake(harness, make) {
    const { api } = harness;
    api.rememberFitmentVehicleCatalogueChain();
    api.state.fitmentCatalogueParentChange = {
        makeChanged: make !== api.state.fitmentForm.vehicle.make,
        modelChanged: false,
    };
    api.state.fitmentForm.vehicle.make = make;
    const version = api.beginFitmentCatalogueContextChange();
    api.resetFitmentCatalogue("models", { status: "loading" });
    api.resetFitmentCatalogue("years", { status: "loading" });
    api.state.fitmentMarketResolution = { status: "idle", resolution: "", resolved_market: null, items: [] };
    await api.revalidateFitmentCatalogueChain(version);
}

async function selectModel(harness, model) {
    const { api } = harness;
    api.rememberFitmentVehicleCatalogueChain();
    api.state.fitmentCatalogueParentChange = {
        makeChanged: false,
        modelChanged: model !== api.state.fitmentForm.vehicle.model,
    };
    api.state.fitmentForm.vehicle.model = model;
    const version = api.beginFitmentCatalogueContextChange();
    api.resetFitmentCatalogue("years", { status: "loading" });
    api.state.fitmentMarketResolution = { status: "idle", resolution: "", resolved_market: null, items: [] };
    await api.revalidateFitmentCatalogueChain(version);
}

function vehicleOf(harness) {
    return { ...harness.api.state.fitmentForm.vehicle };
}

test("restores ZEEKR/007/2025 after a make round trip", async () => {
    const harness = createHarness({ catalogue: CATALOGUE });
    seedState(harness, { market: "chdm", make: "ZEEKR", model: "007", year: "2025" });
    harness.api.rememberFitmentVehicleCatalogueChain();

    await selectMake(harness, "Porsche");
    assert.deepEqual(vehicleOf(harness), { market: "chdm", make: "Porsche", model: "", year: "" });
    await selectMake(harness, "ZEEKR");

    assert.deepEqual(vehicleOf(harness), { market: "chdm", make: "ZEEKR", model: "007", year: "2025" });
});

test("restores Porsche/Cayenne/2022 from the selected make context", async () => {
    const harness = createHarness({ catalogue: CATALOGUE });
    seedState(harness, { market: "chdm", make: "Porsche", model: "Cayenne", year: "2022" });
    harness.api.rememberFitmentVehicleCatalogueChain();

    await selectMake(harness, "ZEEKR");
    await selectMake(harness, "Porsche");

    assert.deepEqual(vehicleOf(harness), { market: "russia", make: "Porsche", model: "Cayenne", year: "2022" });
});

test("restores 007/2025 from the selected model context", async () => {
    const harness = createHarness({ catalogue: CATALOGUE });
    seedState(harness, { market: "chdm", make: "ZEEKR", model: "007", year: "2025" });
    harness.api.rememberFitmentVehicleCatalogueChain();

    await selectModel(harness, "X");
    harness.api.state.fitmentForm.vehicle.year = "2023";
    harness.api.rememberFitmentVehicleCatalogueChain();
    await selectModel(harness, "007");

    assert.deepEqual(vehicleOf(harness), { market: "chdm", make: "ZEEKR", model: "007", year: "2025" });
});

test("ignores stale make catalogue responses that arrive in reverse order", async () => {
    const harness = createHarness({ deferred: true });
    const { api, pending } = harness;

    const versionA = api.beginFitmentCatalogueContextChange();
    const responseA = api.loadFitmentCatalogue("makes", {}, { contextVersion: versionA });
    const versionB = api.beginFitmentCatalogueContextChange();
    const responseB = api.loadFitmentCatalogue("makes", {}, { contextVersion: versionB });
    const versionA2 = api.beginFitmentCatalogueContextChange();
    const responseA2 = api.loadFitmentCatalogue("makes", {}, { contextVersion: versionA2 });

    assert.equal(pending.length, 3);
    pending[2].resolve(response({ outcome: "success", items: [{ value: "ZEEKR", label: "ZEEKR" }] }));
    pending[1].resolve(response({ outcome: "success", items: [{ value: "Lada", label: "Lada" }] }));
    pending[0].resolve(response({ outcome: "success", items: [{ value: "Stale", label: "Stale" }] }));
    await Promise.all([responseA, responseB, responseA2]);

    assert.equal(harness.calls.length, 3);
    assert.equal(harness.calls[0].options.signal.aborted, true);
    assert.equal(harness.calls[1].options.signal.aborted, true);
    assert.deepEqual(api.state.fitmentCatalogue.makes.items, [{ value: "ZEEKR", label: "ZEEKR" }]);
});

test("retrying years revalidates the dependent market resolution", async () => {
    const harness = createHarness({ catalogue: CATALOGUE });
    seedState(harness, { market: "chdm", make: "ZEEKR", model: "007", year: "2025" });
    harness.api.state.fitmentCatalogue.years = { status: "failed", items: [] };

    harness.api.retryFitmentCatalogue("years");
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(harness.calls.map(({ kind }) => kind), ["years", "markets"]);
    assert.equal(harness.api.state.fitmentCatalogue.years.status, "loaded");
    assert.equal(harness.api.state.fitmentForm.vehicle.year, "2025");
});

test("normal catalogue selections keep selected state without visible helper copy", () => {
    const harness = createHarness({ catalogue: CATALOGUE });
    seedState(harness, { market: "chdm", make: "ZEEKR", model: "007", year: "2025" });

    for (const [kind, value] of [["makes", "ZEEKR"], ["models", "007"], ["years", "2025"]]) {
        const fieldState = harness.api.fitmentCatalogueFieldState(kind, value);
        assert.equal(fieldState.state, "selected");
        assert.equal(fieldState.message, "");
    }
});

test("ambiguous markets keep save invalid until the user selects a candidate", () => {
    const harness = createHarness({ catalogue: CATALOGUE });
    seedState(harness, { market: "", make: "ZEEKR", model: "X", year: "2023" });
    harness.api.state.fitmentMarketResolution = {
        status: "selection_required",
        resolution: "selection_required",
        resolved_market: null,
        items: CATALOGUE["markets:ZEEKR:X:2023"],
    };

    harness.api.validateFitmentForm();
    assert.ok(harness.api.state.fitmentFormState.invalidFields.includes("vehicle.market"));

    harness.api.state.fitmentForm.vehicle.market = "russia";
    harness.api.state.fitmentMarketResolution.status = "selected";
    harness.api.validateFitmentForm();
    assert.equal(harness.api.state.fitmentFormState.validation, "valid");
});

test("demo fixture exposes 001 years and a multi-market resolution", async () => {
    const harness = createHarness();
    const { api } = harness;
    api.state.fitmentJobId = "guest-demo-zeekr";
    api.state.fitmentForm.vehicle = { make: "ZEEKR", model: "001", year: "2025", market: "" };
    api.state.fitmentFormState = {
        baseline: { vehicle: {} },
        status: "dirty",
        validation: "invalid",
        missingFields: [],
        invalidFields: [],
    };
    api.state.fitmentCatalogueParentChange = { makeChanged: false, modelChanged: false };
    api.state.fitmentCatalogue = {
        regions: { status: "idle", items: [] },
        makes: { status: "loaded", items: [] },
        models: { status: "loaded", items: [] },
        years: { status: "loading", items: [] },
    };
    const version = api.beginFitmentCatalogueContextChange();
    await api.revalidateFitmentCatalogueChain(version);
    assert.equal(api.state.fitmentCatalogue.years.status, "loaded");
    assert.equal(api.state.fitmentCatalogue.years.items.map((item) => item.value).join(","), "2025,2024");
    assert.equal(api.state.fitmentMarketResolution.status, "selection_required");
    assert.equal(api.state.fitmentMarketResolution.items.map((item) => item.value).join(","), "chdm,russia");
});
