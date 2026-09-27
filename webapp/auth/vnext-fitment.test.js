import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { fitmentMarkup } from "../vnext/views/fitment.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("vehicle edits survive Fitment snapshot refresh while the saved summary stays unchanged", () => {
  const app = read("app.js");
  const snapshot = app.slice(app.indexOf("function vnextFitmentSnapshot()"), app.indexOf("function setVnextFitmentField("));
  const setter = app.slice(app.indexOf("function setVnextFitmentField("), app.indexOf("window.dreamwheelsFitmentBridge ="));
  const saved = { make: "Zeekr", model: "001", year: "2023", body: "saved body" };
  const state = {
    fitmentOverview: { vehicle: saved },
    fitmentForm: { vehicle: { ...saved }, rim: {} },
    fitmentVehicleEditing: true,
    fitmentSourceAppliedFields: [],
  };
  const context = {
    state,
    fitmentCheckForPresentation: () => null,
    fitmentUiState: () => ({ nextAction: "complete_vehicle_details", rim: {}, form: { dirty: true } }),
    fitmentContextJob: () => null,
    fitmentNextAction: () => "complete_vehicle_details",
    demoVehicleTitle: vehicle => `${vehicle.make} ${vehicle.model}`,
    fitmentMarketLabel: value => value || "",
    fitmentCatalogueItems: kind => kind === "makes" ? [{ value: "zeekr", label: "Zeekr" }] : [],
    fitmentOptionValue: item => item.value,
    fitmentCatalogueOptionLabel: item => item.label,
    fitmentPreviewAsset: () => "",
    demoRimTitle: () => "",
    fitmentRimTechnicalSummary: () => "",
    fitmentRimProvenance: () => "",
    rememberFitmentVehicleCatalogueChain() {},
    beginFitmentCatalogueContextChange: () => 1,
    resetFitmentCatalogue() {},
    revalidateFitmentCatalogueChain: async () => {},
    markVehicleFieldEdited() {},
    markFitmentDirty() {},
    validateFitmentForm() {},
    renderFitment() {},
    setDeepValue: (object, path, value) => {
      const [section, field] = path.split(".");
      object[section][field] = value;
    },
  };
  vm.createContext(context);
  vm.runInContext(`${snapshot}\n${setter}`, context);
  context.setVnextFitmentField("vehicle.make", "zeekr");
  context.setVnextFitmentField("vehicle.body", "edited body");
  context.setVnextFitmentField("vehicle.modification", "AWD");
  const model = context.vnextFitmentSnapshot();
  assert.equal(model.vehicleForm.make, "zeekr");
  assert.equal(model.vehicleForm.body, "edited body");
  assert.equal(model.vehicleForm.modification, "AWD");
  assert.equal(model.vehicleTitle, "Zeekr 001");
  assert.equal(saved.body, "saved body");
  const markup = fitmentMarkup(model);
  assert.match(markup, /option value="zeekr" selected/);
  assert.match(markup, /data-fitment-field="vehicle.body" value="edited body"/);
  assert.match(markup, /data-fitment-field="vehicle.modification" value="AWD"/);

  state.fitmentForm.vehicle.body = "";
  assert.match(fitmentMarkup(context.vnextFitmentSnapshot()), /data-fitment-field="vehicle.body" value=""/);
  state.fitmentForm.vehicle = null;
  assert.equal(context.vnextFitmentSnapshot().vehicleForm, saved);
});

test("Fitment view renders exactly the four API verdicts and keeps execution failure separate", () => {
  const cases = [
    ["compatible", "Подходит"],
    ["compatible_with_conditions", "Подходит с условиями"],
    ["unknown", "Недостаточно данных"],
    ["incompatible", "Не подходит"],
  ];
  for (const [verdict, label] of cases) {
    const markup = fitmentMarkup({ jobId: "job-a", overview: {}, check: { execution_status: "completed", verdict, is_current: true }, executionStatus: "completed" });
    assert.match(markup, new RegExp(label));
  }
  const failed = fitmentMarkup({ jobId: "job-a", overview: {}, executionStatus: "failed", check: { execution_status: "failed" }, error: "Provider is unavailable", retryAvailable: true });
  assert.match(failed, /Не удалось проверить совместимость/);
  assert.match(failed, /Provider is unavailable/);
  assert.doesNotMatch(failed, /Технические данные|Недостаточно данных|Не подходит|Подходит/);
});

test("Fitment queued/processing and stale snapshots use server status/currentness only", () => {
  const queued = fitmentMarkup({ jobId: "A", overview: {}, executionStatus: "queued", vehicleTitle: "Car A", rimTitle: "Wheel A" });
  const processing = fitmentMarkup({ jobId: "A", overview: {}, executionStatus: "processing", vehicleTitle: "Car A", rimTitle: "Wheel A" });
  const stale = fitmentMarkup({ jobId: "A", overview: {}, executionStatus: "completed", check: { execution_status: "completed", verdict: "compatible", is_current: false }, resultCopy: "Vehicle or wheel details changed", retryAvailable: true });
  assert.match(queued, /Проверка в очереди/);
  assert.match(processing, /Проверяем совместимость/);
  assert.match(stale, /Результат больше не актуален/);
  assert.match(stale, /Проверить ещё раз/);
});

test("Fitment comparison keeps missing server values explicit without inventing rows", () => {
  const availableField = fitmentMarkup({
    overview: {},
    executionStatus: "completed",
    check: { execution_status: "completed", verdict: "unknown", is_current: true },
    fieldEvidence: [{ name: "ET", vehicleValue: null, rimValue: null, resultLabel: "Недостаточно данных" }],
  });
  assert.match(availableField, /Сравнение параметров/);
  assert.match(availableField, /Нет данных/);
  assert.match(availableField, /Недостаточно данных/);

  const noFields = fitmentMarkup({ overview: {}, executionStatus: "completed", check: { execution_status: "completed", verdict: "unknown" } });
  assert.match(noFields, /Нет дополнительных данных/);
  assert.doesNotMatch(noFields, /PCD|DIA|ET/);
});

test("Fitment keeps resolver retries, manual recovery, and explicit variant selection visible", () => {
  const resolver = fitmentMarkup({
    overview: {},
    rimEditing: true,
    resolver: { url: "https://shop.example.test/wheel", status: "Не удалось определить параметры", loading: false },
  });
  assert.match(resolver, /Источник колесного диска/);
  assert.match(resolver, /Повторить/);
  assert.match(resolver, /Заполнить вручную/);

  const variants = fitmentMarkup({
    overview: {},
    nextAction: "select_vehicle_variant",
    vehicleEditing: true,
    vehicleVariantPickerOpen: true,
    vehicleVariants: [{ label: "2.0 AWD", technical: "2025" }],
    selectedVehicleVariant: 0,
  });
  assert.match(variants, /2\.0 AWD/);
  assert.match(variants, /Подтвердить комплектацию/);
  assert.match(variants, /Сохранить автомобиль/);
});

test("an incompatible Fitment result still offers the existing independent render action", () => {
  const markup = fitmentMarkup({ overview: {}, executionStatus: "completed", canRunCheck: false, check: { execution_status: "completed", verdict: "incompatible" } });
  assert.match(markup, /Не подходит/);
  assert.match(markup, /data-fitment-action="create-image"/);
});

test("Fitment is summary-first, maps server next_action exactly, and keeps required variants visible", () => {
  for (const [nextAction, label] of [
    ["complete_vehicle_details", "Нужно уточнить данные автомобиля"],
    ["select_vehicle_variant", "Выберите комплектацию автомобиля"],
    ["complete_rim_specs", "Уточните параметры колесного диска"],
    ["run_standard_check", "Данные готовы к проверке"],
  ]) {
    assert.match(fitmentMarkup({ overview: {}, nextAction }), new RegExp(label));
  }
  const unknownAction = fitmentMarkup({ overview: {}, nextAction: "unrecognized_server_action" });
  assert.match(unknownAction, /Техническая проверка ещё не готова/);
  assert.doesNotMatch(unknownAction, /Данные готовы к проверке/);

  const variantRequired = fitmentMarkup({
    overview: {}, nextAction: "select_vehicle_variant", vehicleVariants: [{ label: "2.0 AWD", technical: "2025" }],
    vehicleVariantPickerOpen: false, selectedVehicleVariant: 0,
  });
  assert.match(variantRequired, /2\.0 AWD/);
  assert.match(variantRequired, /Подтвердить комплектацию/);
  assert.doesNotMatch(variantRequired, /Скрыть комплектации/);
  assert.doesNotMatch(variantRequired, /data-fitment-field="vehicle\.make"/);
  assert.match(variantRequired, /Не мой автомобиль — указать вручную/);

  const confirmed = fitmentMarkup({
    overview: {}, vehicleVariantName: "L9 Max AWD", canReselectVehicleVariant: true,
    vehicleVariants: [{ label: "L9 Pro AWD" }], vehicleVariantPickerOpen: false,
  });
  assert.match(confirmed, /Комплектация/);
  assert.match(confirmed, /L9 Max AWD/);
  assert.match(confirmed, /Изменить комплектацию/);
  assert.doesNotMatch(confirmed, /L9 Pro AWD/);
  assert.doesNotMatch(confirmed, /data-fitment-field="vehicle\.make"/);
});

test("Fitment candidate suggestions stay beside their field and editors are hidden until requested", () => {
  const markup = fitmentMarkup({
    overview: {}, nextAction: "complete_vehicle_details", vehicleEditing: true,
    vehicleForm: { make: "", model: "" }, vehicleCandidates: [{ field: "make", value: "Zeekr" }],
    rimEditing: false, rim: { brand: "BBS" },
  });
  assert.match(markup, /data-fitment-field="vehicle\.make"[^]*?data-fitment-action="candidate" data-value="vehicle\.make\|Zeekr"/);
  assert.doesNotMatch(markup, /data-fitment-field="rim\.brand"/);
  assert.match(markup, /data-fitment-action="create-image"/);
});

test("completed Fitment shows verdict before conditions and technical comparison", () => {
  const markup = fitmentMarkup({
    overview: {}, executionStatus: "completed", resultCopy: "Короткое объяснение",
    check: { execution_status: "completed", verdict: "compatible_with_conditions" },
    conditions: [{ label: "Условие установки" }],
    fieldEvidence: [{ name: "ET", vehicleValue: "40", rimValue: "45", resultLabel: "Проверьте" }],
  });
  assert.ok(markup.indexOf("Подходит с условиями") < markup.indexOf("Условия и пояснения"));
  assert.ok(markup.indexOf("Условия и пояснения") < markup.indexOf("Сравнение параметров"));
});

test("Fitment presentation is a callback-only view with no API, polling, verdict, or revision logic", () => {
  const view = read("vnext/views/fitment.js");
  assert.doesNotMatch(view, /fetch\(|setTimeout\(|clearTimeout\(|revision\s*[+\-*/=]|pcd.*(?:match|compare)|infer/i);
  assert.match(view, /button\([^\n]*"check"/);
  assert.match(view, /button\([^\n]*"resolve-rim"/);
  assert.match(view, /data-fitment-field=/);
  const bootstrap = read("vnext/bootstrap.js");
  assert.match(bootstrap, /dreamwheelsFitmentBridge\?\.snapshot\(\)/);
  assert.match(bootstrap, /dreamwheels:fitmentchange/);
});

test("Fitment retains the exact job and origin through entry/back and reuses existing runtime operations", () => {
  const app = read("app.js");
  assert.match(app, /state\.fitmentJobId = jobId;[\s\S]*?state\.fitmentOriginView = originView;[\s\S]*?state\.fitmentOriginJobId = jobId/);
  assert.match(app, /function closeFitmentView\(\)[\s\S]*?setView\(originView\)/);
  assert.match(app, /snapshot: vnextFitmentSnapshot/);
  assert.match(app, /setupMode: state\.fitmentForm\?\.setup_mode \|\| overview\?\.setup_mode \|\| "uniform"/);
  assert.match(app, /rearRim: state\.fitmentForm\?\.rear_rim \|\| overview\?\.rear_rim \|\| \{\}/);
  assert.match(app, /action === "save"\) void saveFitment\(\)/);
  assert.match(app, /action === "check"\) void runFitmentCheck\(\)/);
  assert.match(app, /action === "resolve-rim"\) void resolveFitmentRimSource\(\)/);
  assert.match(app, /action === "load-vehicle-variants"\) \{\s*toggleFitmentModificationPicker\(\)/);
  assert.match(app, /action === "confirm-vehicle-variant"\)[\s\S]*?applyFitmentVehicleVariant\(variant\)/);
  assert.match(app, /function renderFitment\(\)[\s\S]*?notifyFitmentBridge\(\);\s*return;/);
});

test("Fitment preserves render independence and single-column tablet/mobile layouts", () => {
  const app = read("app.js");
  const submit = app.slice(app.indexOf("async function submitJob("), app.indexOf("function ", app.indexOf("async function submitJob(") + 1));
  assert.doesNotMatch(submit, /fitmentVerdict|fitmentCheck|fitmentOverview/);
  const css = read("vnext/styles/fitment.css");
  assert.match(css, /@media\(max-width:900px\)\s*\{\s*\.vnext-fitment__pair\s*\{\s*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:700px\)/);
  const html = read("index.html");
  assert.match(html, /vnext\/styles\/fitment\.css/);
});

test("runtime Fitment initialization follows next_action and never opens both object editors", async () => {
  const app = read("app.js");
  const source = [
    app.slice(app.indexOf("function fitmentNextAction("), app.indexOf("function deriveFitmentNextIntent(")),
    app.slice(app.indexOf("function updateDemoFitmentState("), app.indexOf("function createDemoFitmentCheck(")),
    app.slice(app.indexOf("async function loadFitmentOverview("), app.indexOf("function openFitmentView(")),
    app.slice(app.indexOf("function vnextFitmentSnapshot()"), app.indexOf("function setVnextFitmentField(")),
  ].join("\n");
  const state = {
    fitmentJobId: "demo-job", fitmentOverview: null, fitmentForm: null, fitmentFormState: {},
    fitmentCheck: null, fitmentCheckHistory: [], fitmentVehicleEditing: false, fitmentRimEditing: false,
    fitmentVehicleDirty: false, fitmentVehicleMarketEdited: false, fitmentSourceAppliedFields: [],
    fitmentSourceIdentity: {}, fitmentSourceStatus: "", fitmentSourceResolving: false,
    fitmentSourceStatusTone: "neutral", fitmentSourceDetected: false, fitmentSourceVariants: [],
    fitmentSourceConflicts: [], fitmentModificationPickerOpen: false, fitmentVehicleVariantsLoading: false,
    fitmentVehicleVariants: [], fitmentSelectedVehicleVariantIndex: null, fitmentModificationLookupMode: "initial",
    fitmentCatalogue: {}, fitmentCheckHistoryLoading: false, fitmentLoading: false, fitmentError: "",
    fitmentMessage: "", fitmentActiveSection: "", fitmentSourceAutoResolvedForJob: "",
  };
  let overview = null;
  const context = {
    state,
    FITMENT_NEXT_ACTION_KINDS: new Set(["complete_vehicle_details", "select_vehicle_variant", "complete_rim_specs", "run_standard_check"]),
    URLSearchParams,
    window: { location: { search: "" } },
    shouldUseDemoFitment: () => true,
    loadDemoFitmentOverview: () => overview,
    validateFitmentOverview: () => true,
    fitmentFormFromOverview: (value) => ({ vehicle: value.vehicle || {}, rim: value.rim || {}, rear_rim: value.rear_rim || {}, setup_mode: value.setup_mode || "uniform" }),
    fitmentSourceIdentityFromOverview: () => ({}),
    cloneFitmentForm: (value) => structuredClone(value),
    fitmentSectionForAction: (value) => ({ complete_vehicle_details: "vehicle", select_vehicle_variant: "vehicle", complete_rim_specs: "rim", run_standard_check: "result" }[value.next_action.kind]),
    fitmentSectionToStep: (value) => ({ vehicle: 1, rim: 2, result: 3 }[value]),
    fitmentContextJob: () => null,
    fitmentUiState: (value) => ({ nextAction: value?.next_action?.kind, rim: { setupState: value?.rim_setup_state, setupMode: value?.setup_mode, front: value?.front_rim, rear: value?.rear_rim } }),
    fitmentCheckForPresentation: () => null,
    demoVehicleTitle: (value) => [value?.make, value?.model].filter(Boolean).join(" "),
    fitmentMarketLabel: (value) => value || "",
    fitmentCatalogueItems: () => [], fitmentOptionValue: (value) => value.value,
    fitmentCatalogueOptionLabel: (value) => value.label, fitmentPreviewAsset: () => "",
    demoRimTitle: () => "", fitmentRimTechnicalSummary: () => "", fitmentRimProvenance: () => "",
    fitmentEffectiveRim: (value) => value.rim || {}, fitmentNextAction: (value) => value?.next_action?.kind,
    beginFitmentCatalogueContextChange() {}, renderFitment() {}, loadFitmentVehicleCatalogue() {},
    persistDemoFitmentOverview() {},
    ensureRequiredFitmentVariantLookup() {}, fitmentCheckIsPending: () => false,
    restoreFitmentTransientDraft: () => "none", applyDemoResultFixture() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const makeOverview = (nextAction, rimSetupState = "empty") => ({
    vehicle_state: "empty", rim_setup_state: rimSetupState, setup_mode: "uniform",
    next_action: { kind: nextAction }, vehicle: { make: "Audi", model: "Q8" }, rim: {},
    vehicle_candidates: {}, rim_candidates: {}, vehicle_field_states: {}, rim_field_states: {},
  });

  for (const [action, expectedVehicleEditor, expectedRimEditor] of [
    ["complete_vehicle_details", true, false],
    ["select_vehicle_variant", false, false],
    ["complete_rim_specs", false, true],
    ["run_standard_check", false, false],
  ]) {
    overview = makeOverview(action);
    await context.loadFitmentOverview("demo-job");
    const snapshot = context.vnextFitmentSnapshot();
    assert.equal(state.fitmentVehicleEditing, expectedVehicleEditor, `${action}: vehicle editor flag`);
    assert.equal(state.fitmentRimEditing, expectedRimEditor, `${action}: rim editor flag`);
    assert.ok(!(snapshot.vehicleEditing && snapshot.rimEditing), `${action}: editors must be mutually exclusive`);
    const markup = fitmentMarkup(snapshot);
    assert.equal((markup.match(/class="vnext-fitment__editor"/g) || []).length > 0, expectedVehicleEditor || expectedRimEditor, `${action}: editor presentation`);
    assert.equal(markup.includes("Источник колесного диска"), expectedRimEditor, `${action}: wheel source editor visibility`);
    if (action === "select_vehicle_variant") assert.match(markup, /Выберите комплектацию автомобиля/);
  }
  context.setFitmentEditor("vehicle");
  assert.deepEqual([state.fitmentVehicleEditing, state.fitmentRimEditing], [true, false]);
  context.setFitmentEditor("rim");
  assert.deepEqual([state.fitmentVehicleEditing, state.fitmentRimEditing], [false, true]);
});

test("deferred wheel-source failures preserve the active editor, navigation, and unsaved values", async () => {
  const app = read("app.js");
  const resolver = app.slice(app.indexOf("async function resolveFitmentRimSource("), app.indexOf("async function loadFitmentVehicleVariants(", app.indexOf("async function resolveFitmentRimSource(")));
  const navigation = app.slice(app.indexOf("function setFitmentEditor("), app.indexOf("function setFitmentEditorsForNextAction("));
  const section = app.slice(app.indexOf("function fitmentSectionToStep("), app.indexOf("function navigateFitmentRecovery("));
  const bridge = app.slice(app.indexOf("window.dreamwheelsFitmentBridge = {"), app.indexOf("\n};\n\nlet renderAssetPreparationPending"));

  function createRuntime() {
    let rejectRequest;
    let resolveRequest;
    const pendingResponse = new Promise((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });
    const state = {
      fitmentJobId: "job-1", fitmentForm: { vehicle: { make: "Zeekr", model: "001", year: "2025", body: "user-edited body" }, rim: { brand: "BBS", product_url: "https://shop.example.test/rim", wheel_diameter_in: "19" } },
      fitmentOverview: { next_action: { kind: "complete_vehicle_details" } },
      fitmentVehicleEditing: false, fitmentRimEditing: false, fitmentActiveSection: "rim", fitmentActiveStep: 2,
      fitmentSourceResolving: false, fitmentSourceOpen: false, fitmentSourceAppliedFields: [], fitmentSourceDetected: false,
      fitmentSourceVariants: [], fitmentSourceStatus: "", fitmentSourceStatusTone: "neutral", fitmentSourceController: null,
      fitmentMessage: "", fitmentMessageTone: "neutral", fitmentSourceConflicts: [], fitmentSourceIdentity: {},
    };
    const context = {
      state, locale: "ru", RIM_SOURCE_RESOLVE_TIMEOUT_MS: 30_000,
      window: { setTimeout: () => 1, clearTimeout() {} }, AbortController,
      shouldUseDemoFitment: () => false,
      normalizeFitmentText: value => value.trim(),
      clearFitmentTransientMessage() { state.fitmentMessage = ""; },
      apiUrl: value => value,
      withAuthHeaders: value => value,
      authenticatedFetch: () => pendingResponse,
      fitmentSourceErrorMessage: () => "URL resolver unavailable",
      parseApiError: async () => "URL resolver unavailable",
      showFitmentAuthRequired() {},
      renderFitment() {}, scrollFitmentTo() {},
      persistFitmentNavigationContext() {}, ensureRequiredFitmentVariantLookup() {},
      notifyFitmentBridge() {},
      fitmentSectionToStep: value => value === "vehicle" ? 1 : value === "rim" ? 2 : 3,
      vnextFitmentSnapshot: () => ({}), setVnextFitmentField() {},
    };
    vm.createContext(context);
    vm.runInContext(`${navigation}\n${section}\n${resolver}\n${bridge}\n};`, context);
    return { context, state, rejectRequest, resolveRequest: (...args) => resolveRequest(...args), reject: error => rejectRequest(error) };
  }

  async function begin(runtime, options = {}) {
    const request = runtime.context.resolveFitmentRimSource(options);
    await Promise.resolve();
    assert.equal(runtime.state.fitmentSourceResolving, true, "request must remain pending while context changes");
    return { request };
  }

  const automatic = createRuntime();
  automatic.context.setFitmentEditor("vehicle");
  automatic.state.fitmentActiveSection = "vehicle";
  automatic.state.fitmentActiveStep = 1;
  const { request: autoRequest } = await begin(automatic, { automatic: true });
  automatic.reject(new Error("provider failed"));
  await autoRequest;
  assert.deepEqual([automatic.state.fitmentVehicleEditing, automatic.state.fitmentRimEditing], [true, false]);
  assert.deepEqual([automatic.state.fitmentActiveSection, automatic.state.fitmentActiveStep], ["vehicle", 1]);
  assert.equal(automatic.state.fitmentSourceStatus, "URL resolver unavailable");
  assert.equal(automatic.state.fitmentForm.vehicle.body, "user-edited body");
  assert.equal(automatic.state.fitmentForm.rim.brand, "BBS");

  const lateManual = createRuntime();
  lateManual.context.setFitmentEditor("rim");
  lateManual.state.fitmentActiveSection = "rim";
  lateManual.state.fitmentActiveStep = 2;
  const { request: manualRequest } = await begin(lateManual);
  lateManual.context.window.dreamwheelsFitmentBridge.action("edit-vehicle");
  lateManual.reject(new Error("provider failed"));
  await manualRequest;
  assert.deepEqual([lateManual.state.fitmentVehicleEditing, lateManual.state.fitmentRimEditing], [true, false]);
  assert.deepEqual([lateManual.state.fitmentActiveSection, lateManual.state.fitmentActiveStep], ["vehicle", 1]);
  assert.equal(lateManual.state.fitmentForm.vehicle.body, "user-edited body");
  assert.equal(lateManual.state.fitmentForm.rim.brand, "BBS");

  const wheelActive = createRuntime();
  wheelActive.context.setFitmentEditor("rim");
  wheelActive.state.fitmentActiveSection = "rim";
  wheelActive.state.fitmentActiveStep = 2;
  const { request: wheelRequest } = await begin(wheelActive);
  wheelActive.reject(new Error("provider failed"));
  await wheelRequest;
  assert.deepEqual([wheelActive.state.fitmentVehicleEditing, wheelActive.state.fitmentRimEditing], [false, true]);
  assert.deepEqual([wheelActive.state.fitmentActiveSection, wheelActive.state.fitmentActiveStep], ["rim", 2]);
  assert.equal(wheelActive.state.fitmentSourceStatusTone, "error");
  assert.equal(wheelActive.state.fitmentSourceOpen, true);
  const recoveryMarkup = fitmentMarkup({ overview: {}, rimEditing: true, resolver: { url: wheelActive.state.fitmentForm.rim.product_url, status: wheelActive.state.fitmentSourceStatus, loading: false } });
  assert.match(recoveryMarkup, /Повторить/);
  assert.match(recoveryMarkup, /Заполнить вручную/);
  assert.equal(wheelActive.state.fitmentForm.rim.wheel_diameter_in, "19");
  assert.equal(wheelActive.state.fitmentForm.vehicle.body, "user-edited body");
});

test("rim status comes from server-owned per-axle state, not next_action", () => {
  const emptyWhileVehicleIsIncomplete = fitmentMarkup({
    overview: { rim_setup_state: "empty" }, nextAction: "complete_vehicle_details",
    frontRimSetupState: "empty", vehicleEditing: true, rimEditing: false,
  });
  assert.match(emptyWhileVehicleIsIncomplete, /Параметры не заполнены/);
  assert.doesNotMatch(emptyWhileVehicleIsIncomplete, /Параметры подтверждены/);
  assert.match(fitmentMarkup({ overview: {}, frontRimSetupState: "partial" }), /Нужно уточнить параметры/);
  assert.match(fitmentMarkup({ overview: {}, frontRimSetupState: "complete_unconfirmed" }), /Параметры требуют подтверждения/);
  assert.match(fitmentMarkup({ overview: {}, frontRimSetupState: "confirmed_ready" }), /Параметры подтверждены/);
  const staggered = fitmentMarkup({
    overview: {}, setupMode: "staggered", frontRimSetupState: "confirmed_ready", rearRimSetupState: "empty",
  });
  assert.match(staggered, /Передняя ось: Параметры подтверждены · Задняя ось: Параметры не заполнены/);
});

test("staggered Fitment does not project front rim candidates into rear axle fields", () => {
  const markup = fitmentMarkup({
    overview: {}, setupMode: "staggered", rimEditing: true,
    rim: { offset_et_mm: 42 }, rearRim: { offset_et_mm: 55 },
    rimCandidates: [{ field: "offset_et_mm", value: 35 }],
  });
  assert.match(markup, /data-fitment-field="rim\.offset_et_mm"[^]*?data-fitment-action="candidate" data-value="rim\.offset_et_mm\|35"/);
  assert.doesNotMatch(markup, /data-value="rear_rim\.offset_et_mm\|35"/);
});

test("Fitment candidate controls meet the mobile tap target and saved progression uses the returned next_action", () => {
  const css = read("vnext/styles/fitment.css");
  assert.match(css, /\.vnext-fitment__suggestions \.vnext-button \{ min-height:42px/);
  const app = read("app.js");
  const saveStart = app.indexOf("async function saveFitment(");
  const save = app.slice(saveStart, app.indexOf("async function fetchRenderHistory(", saveStart));
  assert.ok(save.indexOf("const overview = await response.json()") < save.indexOf("setFitmentEditorsForNextAction(overview)"));
  assert.ok(save.indexOf("await refreshFitmentCheckCurrentness()") < save.indexOf("setFitmentEditorsForNextAction(overview)"));
  const catchBlock = save.slice(save.indexOf("} catch (error) {"), save.indexOf("} finally {"));
  assert.doesNotMatch(catchBlock, /setFitmentEditor/);
});
