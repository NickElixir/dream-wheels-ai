import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { fitmentMarkup, wheelPickerOptions, wheelPickerManualValue } from "../vnext/views/fitment.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("picker makes the workspace inert and catalogue labels explicitly name controls", () => {
  const markup = fitmentMarkup({ vehicleEditing: true, vehicleForm: {}, catalogue: {}, wheelPicker: { path: "rim.offset_et_mm", query: "35,125", mode: "recommended" } });
  assert.match(markup, /class="vnext-fitment__workspace" inert/);
  assert.match(markup, /label for="fitment-field-vehicle-make"/);
  assert.match(markup, /id="fitment-field-vehicle-make"/);
  assert.ok(markup.indexOf('role="dialog"') > markup.indexOf('id="fitment-standard-title"'));
  const wheel = fitmentMarkup({ rimEditing: true, resolver: { canChooseSku: true, url: "https://example.test" }, canonicalRimSpecs: ["18″ / 8J / 5×112 / DIA 66,6 / ET 35,125"], vehicleSpecs: ["2024", "X254"] });
  assert.match(wheel, /Выбрать другой SKU/);
  assert.match(wheel, /DIA 66,6 \/ ET 35,125/);
  assert.doesNotMatch(wheel, /SKU[^<]*▾|·/);
});

test("comparison has shared semantic headers, preserves axles and neutralizes global unknown", () => {
  const fields = ["wheel_diameter_in", "wheel_width_j", "pcd", "center_bore_mm", "offset_et_mm"];
  const rows = fields.map(field => ({ field, axle: "front", vehicleValue: "33.275", rimValue: "35.125", resultLabel: "Подходит" }));
  const model = { check: { execution_status: "completed", verdict: "unknown", is_current: false }, fieldEvidence: rows };
  const markup = fitmentMarkup(model);
  assert.equal((markup.match(/<th scope="col">/g) || []).length, 4);
  assert.equal((markup.match(/<tr tabindex="0">/g) || []).length, 5);
  const table = markup.slice(markup.indexOf("<table"), markup.indexOf("</table>"));
  assert.doesNotMatch(table, /Подходит|data-label/);
  assert.match(table, /35,125/);
  assert.match(markup, /Результат больше не актуален/);
  const axles = fitmentMarkup({ ...model, fieldEvidence: [...rows, ...rows.map(row => ({ ...row, axle: "rear", rimValue: "42.125" }))] });
  assert.match(axles, /Передняя ось/);
  assert.match(axles, /Задняя ось/);
  assert.equal((axles.match(/<tr tabindex="0">/g) || []).length, 10);
});

test("pending check locks the mutation region and keeps Create Image outside it", () => {
  for (const executionStatus of ["queued", "processing"]) {
    const markup = fitmentMarkup({ executionStatus, checking: true, canRunCheck: false });
    assert.match(markup, /<fieldset[^>]*disabled/);
    assert.match(markup, /Проверяем совместимость…/);
    assert.ok(markup.indexOf("</fieldset>") < markup.indexOf('data-fitment-action="create-image"'));
    assert.match(markup, /data-fitment-action="check"[^>]*disabled/);
  }
  const failed = fitmentMarkup({ executionStatus: "failed", retryAvailable: true, canRunCheck: false });
  assert.match(failed, /data-fitment-action="check"[^>]*disabled/);
  assert.match(failed, /Изменить параметры/);
});

test("ET picker separates recommended/all, prioritizes exact matches and preserves manual decimals", () => {
  assert.ok(wheelPickerOptions("offset_et_mm").matches.length < wheelPickerOptions("offset_et_mm", "", "all").matches.length);
  const exact = wheelPickerOptions("offset_et_mm", "33,275");
  assert.deepEqual(exact.exact, [33.275]);
  assert.equal(exact.matches.includes(33.275), false);
  assert.equal(wheelPickerManualValue("offset_et_mm", "35,125"), "35.125");
  assert.equal(wheelPickerManualValue("offset_et_mm", "-150"), "-150");
  assert.equal(wheelPickerManualValue("offset_et_mm", "150,001"), null);
  assert.equal(wheelPickerManualValue("offset_et_mm", "invalid"), null);
  assert.equal(wheelPickerManualValue("pcd", "5x114,3"), "5×114.3");
  const markup = fitmentMarkup({ wheelPicker: { path: "rim.offset_et_mm", query: "35,125", mode: "recommended" } });
  assert.match(markup, /role="dialog" aria-modal="true"/);
  assert.match(markup, /data-wheel-picker-value="35.125"/);
  assert.match(markup, /Ручной ввод ET/);
  assert.match(markup, /data-wheel-picker-search/);
});

test("Vehicle recognition exposes proposals and failure recovery without gating Create Image", () => {
  const proposed = fitmentMarkup({ vehicleRecognition: { status: "proposed", canRecognize: true, candidates: [{ make: "Porsche", model: "Cayenne", year_start: 2020, year_end: 2022 }] } });
  assert.match(proposed, /Porsche Cayenne 2020–2022/);
  assert.match(proposed, /data-fitment-action="recognition-proposal"/);
  assert.match(proposed, /data-fitment-action="edit-vehicle-photo"/);
  const failed = fitmentMarkup({ vehicleRecognition: { status: "failed", canRecognize: true } });
  assert.match(failed, /Не удалось распознать автомобиль по фото/);
  assert.match(failed, /Попробовать ещё раз/);
  assert.match(failed, /Указать вручную/);
  assert.match(failed, /data-fitment-action="create-image"[^>]*>Создать изображение/);
  const pending = fitmentMarkup({ vehicleRecognition: { status: "loading", canRecognize: true } });
  assert.match(pending, /Распознаём автомобиль/);
  assert.match(pending, /data-fitment-action="recognize-vehicle"[^>]*disabled/);
});

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
    fitmentRimManualFields: [], fitmentSourceConflicts: [], fitmentSourceIdentity: {},
  };
  const context = {
    state,
    normalizeFitmentNumber: value => value === "" || value == null ? null : Number(String(value).replace(",", ".")),
    fitmentCheckForPresentation: () => null,
    fitmentMutationsLocked: () => false,
    fitmentUiState: () => ({ nextAction: "complete_vehicle_details", rim: {}, form: { dirty: true } }),
    fitmentContextJob: () => null,
    fitmentNextAction: () => "complete_vehicle_details",
    demoVehicleTitle: vehicle => `${vehicle.make} ${vehicle.model}`,
    fitmentMarketLabel: value => value || "",
    fitmentPresentationText: value => String(value ?? ""),
    fitmentCatalogueFieldState: (kind, value) => ({ state: value ? "selected" : "loaded_unselected", message: "" }),
    fitmentFieldLabel: path => path,
    fitmentSectionForAction: () => "vehicle",
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
    markRimFieldEdited() {},
    markFitmentDirty() {},
    validateFitmentForm() {},
    renderFitment() {},
    setDeepValue: (object, path, value) => {
      const [section, field] = path.split(".");
      object[section][field] = value;
    },
  };
  vm.createContext(context);
  const wheelHelpers = app.slice(app.indexOf("function fitmentRimValuesEqual("), app.indexOf("function markRimFieldEdited("));
  vm.runInContext(`${wheelHelpers}\n${snapshot}\n${setter}`, context);
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
  assert.doesNotMatch(markup, /data-fitment-field="vehicle.body"/);
  assert.doesNotMatch(markup, /data-fitment-field="vehicle.modification"/);

  context.setVnextFitmentField("rim.offset_et_mm", "35,125");
  assert.equal(state.fitmentForm.rim.offset_et_mm, "35,125");

  state.fitmentForm.vehicle.body = "";
  assert.doesNotMatch(fitmentMarkup(context.vnextFitmentSnapshot()), /data-fitment-field="vehicle.body"/);
  state.fitmentForm.vehicle = null;
  assert.equal(context.vnextFitmentSnapshot().vehicleForm, saved);
});

test("Wheel decimal controls preserve comma input until exact numeric serialization", () => {
  const markup = fitmentMarkup({ overview: {}, rimEditing: true, rim: { offset_et_mm: "35,125" } });
  assert.match(markup, /data-wheel-picker-open="rim\.offset_et_mm"/);
  assert.match(markup, />35,125<\/button>/);
  const app = read("app.js");
  const normalizer = app.slice(app.indexOf("function normalizeFitmentNumber("), app.indexOf("function formatFitmentNumber("));
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${normalizer}\nthis.normalize = normalizeFitmentNumber`, context);
  assert.equal(context.normalize("35,125"), 35.125);
  assert.equal(context.normalize("35.125"), 35.125);
});

test("manual Vehicle catalogue shows Market only when the provider requires a choice", () => {
  const base = {
    overview: {}, nextAction: "complete_vehicle_details", vehicleEditing: true,
    vehicleForm: { make: "zeekr", model: "001", year: "2023", market: "CN" },
    catalogue: {
      makes: [{ value: "zeekr", label: "Zeekr" }],
      models: [{ value: "001", label: "001" }],
      years: [{ value: "2023", label: "2023" }],
      markets: [{ value: "CN", label: "Китай" }, { value: "EU", label: "Европа" }],
      states: {
        makes: { status: "selected" }, models: { status: "selected" },
        years: { status: "selected" },
      },
    },
  };
  const single = fitmentMarkup({ ...base, catalogue: { ...base.catalogue, states: { ...base.catalogue.states, markets: { status: "selected", resolution: "single" } } } });
  assert.doesNotMatch(single, /data-fitment-field="vehicle.market"/);
  const multiple = fitmentMarkup({ ...base, catalogue: { ...base.catalogue, states: { ...base.catalogue.states, markets: { status: "selection_required", resolution: "selection_required" } } } });
  assert.match(multiple, /data-fitment-field="vehicle.market"/);
  assert.match(multiple, /Версия для рынка/);
  const failed = fitmentMarkup({ ...base, catalogue: { ...base.catalogue, states: { ...base.catalogue.states, markets: { status: "failed", message: "Не удалось загрузить рынки" } } } });
  assert.match(failed, /Не удалось загрузить рынки/);
  assert.match(failed, /data-fitment-action="retry-catalogue"/);
  const noData = fitmentMarkup({ ...base, catalogue: { ...base.catalogue, states: { ...base.catalogue.states, markets: { status: "no_data", message: "Нет доступных рынков" } } } });
  assert.match(noData, /Нет доступных рынков/);
  assert.doesNotMatch(noData, /data-fitment-action="retry-catalogue"/);
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
  const failed = fitmentMarkup({ jobId: "job-a", overview: {}, executionStatus: "failed", check: { execution_status: "failed" }, error: "Provider is unavailable", retryAvailable: true, canRunCheck: true });
  assert.match(failed, /Не удалось выполнить проверку/);
  assert.match(failed, /Provider is unavailable/);
  assert.doesNotMatch(failed, /Технические данные|Недостаточно данных|Не подходит|Подходит/);
});

test("Fitment queued/processing and stale snapshots use server status/currentness only", () => {
  const queued = fitmentMarkup({ jobId: "A", overview: {}, executionStatus: "queued", vehicleTitle: "Car A", rimTitle: "Wheel A" });
  const processing = fitmentMarkup({ jobId: "A", overview: {}, executionStatus: "processing", vehicleTitle: "Car A", rimTitle: "Wheel A" });
  const stale = fitmentMarkup({ jobId: "A", overview: {}, executionStatus: "completed", check: { execution_status: "completed", verdict: "compatible", is_current: false }, resultCopy: "Vehicle or wheel details changed", retryAvailable: true, canRunCheck: true });
  assert.match(queued, /Проверяем совместимость/);
  assert.match(processing, /Проверяем совместимость/);
  assert.match(stale, /Результат больше не актуален/);
  assert.match(stale, /Проверить ещё раз/);
});

test("Fitment comparison keeps all five rows with explicit missing evidence", () => {
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
  assert.match(noFields, /Нет данных/);
  assert.match(noFields, /PCD/);
  assert.equal((noFields.match(/<tr tabindex="0">/g) || []).length, 5);
});

test("Fitment keeps resolver retries, manual recovery, and explicit variant selection visible", () => {
  const resolver = fitmentMarkup({
    overview: {},
    rimEditing: true,
    resolver: { url: "https://shop.example.test/wheel", status: "Не удалось определить параметры", statusTone: "error", loading: false, open: true },
  });
  assert.match(resolver, /Источник колесного диска/);
  assert.match(resolver, /Повторить/);
  assert.match(resolver, /Указать параметры вручную/);

  const variants = fitmentMarkup({
    overview: {},
    nextAction: "select_vehicle_variant",
    vehicleEditing: false,
    vehicleVariantPickerOpen: true,
    vehicleVariants: [{ label: "2.0 AWD", technical: "2025" }],
    selectedVehicleVariant: 0,
  });
  assert.match(variants, /2\.0 AWD/);
  assert.match(variants, /Подтвердить комплектацию/);
  assert.match(variants, /aria-label="Варианты комплектации"/);
  assert.doesNotMatch(variants, /data-fitment-field="vehicle\.make"/);
  const manualRecovery = fitmentMarkup({ overview: {}, nextAction: "select_vehicle_variant", manualVehicleEditing: true, vehicleEditing: true, vehicleForm: { make: "Other" } });
  assert.match(manualRecovery, /data-fitment-field="vehicle\.make"/);
  assert.doesNotMatch(manualRecovery, /Подтвердить комплектацию/);
});

test("an incompatible Fitment result still offers the existing independent render action", () => {
  const markup = fitmentMarkup({ overview: {}, executionStatus: "completed", canRunCheck: false, check: { execution_status: "completed", verdict: "incompatible" } });
  assert.match(markup, /Не подходит/);
  assert.match(markup, /data-fitment-action="create-image"/);
});

test("Fitment action hierarchy keeps Create Image independent and secondary", () => {
  const buttonClass = (markup, action) => markup.match(new RegExp(`<button[^>]*class="([^"]+)"[^>]*data-fitment-action="${action}"`))?.[1] || "";
  const unfinished = [
    ["complete_vehicle_details", { vehicleEditing: true, vehicleForm: { make: "Zeekr" } }, "save"],
    ["select_vehicle_variant", { selectedVehicleVariant: 0, vehicleVariants: [{ label: "Long Range" }] }, "confirm-vehicle-variant"],
    ["complete_rim_specs", { rimEditing: true, rim: { wheel_diameter_in: 18 } }, "save"],
    ["run_standard_check", { canRunCheck: true }, "check"],
  ];
  for (const [nextAction, model, primaryAction] of unfinished) {
    const markup = fitmentMarkup({ overview: {}, nextAction, ...model });
    assert.equal(buttonClass(markup, "create-image"), "vnext-button vnext-button--secondary", nextAction);
    assert.equal(buttonClass(markup, primaryAction), "vnext-button vnext-button--primary", nextAction);
  }

  const ready = fitmentMarkup({ overview: {}, nextAction: "run_standard_check", canRunCheck: true });
  assert.equal(buttonClass(ready, "check"), "vnext-button vnext-button--primary");
  assert.equal(buttonClass(ready, "create-image"), "vnext-button vnext-button--secondary");
  assert.equal((ready.match(/data-fitment-action="create-image"/g) || []).length, 1);

  for (const verdict of ["compatible", "compatible_with_conditions", "incompatible", "unknown"]) {
    const markup = fitmentMarkup({ overview: {}, nextAction: "run_standard_check", executionStatus: "completed", check: { execution_status: "completed", verdict, is_current: true } });
    assert.equal(buttonClass(markup, "create-image"), "vnext-button vnext-button--secondary", verdict);
    assert.equal(buttonClass(markup, "edit-rim"), "vnext-button vnext-button--secondary", verdict);
    assert.equal((markup.match(/data-fitment-action="create-image"/g) || []).length, 1, verdict);
  }

  const stale = fitmentMarkup({ overview: {}, nextAction: "run_standard_check", retryAvailable: true, canRunCheck: true, executionStatus: "completed", check: { execution_status: "completed", verdict: "compatible", is_current: false } });
  assert.equal(buttonClass(stale, "check"), "vnext-button vnext-button--primary");
  assert.equal(buttonClass(stale, "create-image"), "vnext-button vnext-button--secondary");

  const failed = fitmentMarkup({ overview: {}, nextAction: "run_standard_check", retryAvailable: true, canRunCheck: true, executionStatus: "failed", check: { execution_status: "failed" } });
  assert.equal(buttonClass(failed, "check"), "vnext-button vnext-button--primary");
  assert.equal(buttonClass(failed, "create-image"), "vnext-button vnext-button--secondary");

  for (const executionStatus of ["queued", "processing"]) {
    const markup = fitmentMarkup({ overview: {}, nextAction: "run_standard_check", executionStatus });
    assert.equal(buttonClass(markup, "create-image"), "vnext-button vnext-button--secondary", executionStatus);
  }

  const editingCompleted = fitmentMarkup({ overview: {}, nextAction: "run_standard_check", rimEditing: true, canRunCheck: true, retryAvailable: true, check: { execution_status: "completed", verdict: "compatible", is_current: true } });
  assert.equal(buttonClass(editingCompleted, "save"), "vnext-button vnext-button--primary");
  assert.equal(buttonClass(editingCompleted, "create-image"), "vnext-button vnext-button--secondary");
  assert.match(editingCompleted, /data-fitment-action="check"[^>]*disabled/);
  assert.equal((editingCompleted.match(/data-fitment-action="edit-rim"/g) || []).length, 1);
});

test("Fitment is summary-first, maps server next_action exactly, and keeps required variants visible", () => {
  for (const [nextAction, label] of [
    ["complete_vehicle_details", "Уточните данные автомобиля"],
    ["select_vehicle_variant", "Выберите комплектацию автомобиля"],
    ["complete_rim_specs", "Уточните параметры колесного диска"],
    ["run_standard_check", "Данные готовы к проверке"],
  ]) {
    assert.match(fitmentMarkup({ overview: {}, nextAction }), new RegExp(label));
  }
  const unknownAction = fitmentMarkup({ overview: {}, nextAction: "unrecognized_server_action" });
  assert.match(unknownAction, /Подтвердите автомобиль и параметры диска/);
  assert.doesNotMatch(unknownAction, /Данные готовы к проверке/);

  const ready = fitmentMarkup({ overview: {}, nextAction: "run_standard_check", canRunCheck: true });
  assert.match(ready, /<section class="vnext-fitment__standard"[^>]*><h2[^>]*>Проверка совместимости<\/h2><p>Данные готовы к проверке<\/p>/);
  assert.match(ready, /data-fitment-action="check"[^>]*>Проверить совместимость<\/button>/);
  assert.doesNotMatch(ready, /<h2>Проверить совместимость<\/h2>/);

  const variantRequired = fitmentMarkup({
    overview: {}, nextAction: "select_vehicle_variant", vehicleVariants: [{ label: "2.0 AWD", technical: "2025" }],
    vehicleVariantPickerOpen: false, selectedVehicleVariant: 0,
  });
  assert.match(variantRequired, /2\.0 AWD/);
  assert.match(variantRequired, /Подтвердить комплектацию/);
  assert.doesNotMatch(variantRequired, /Скрыть комплектации/);
  assert.doesNotMatch(variantRequired, /data-fitment-field="vehicle\.make"/);
  assert.match(variantRequired, /data-fitment-action="edit-vehicle"/);

  const confirmed = fitmentMarkup({
    overview: {}, vehicleVariantName: "L9 Max AWD", canReselectVehicleVariant: true,
    vehicleVariants: [{ label: "L9 Pro AWD" }], vehicleVariantPickerOpen: false,
  });
  assert.match(confirmed, /<span>Комплектация<\/span>/);
  assert.match(confirmed, /L9 Max AWD/);
  assert.match(confirmed, /Изменить комплектацию/);
  assert.doesNotMatch(confirmed, /L9 Pro AWD/);
  assert.doesNotMatch(confirmed, /data-fitment-field="vehicle\.make"/);
});

test("Fitment preserves existing vehicle trim terminology", () => {
  const base = { overview: {}, nextAction: "select_vehicle_variant" };
  const loading = fitmentMarkup({ ...base, vehicleVariantsLoading: true });
  assert.match(loading, /Загружаем комплектации автомобиля/);
  assert.match(loading, /aria-label="Варианты комплектации"/);

  const failure = fitmentMarkup({ ...base, vehicleLookup: { status: "failed" } });
  assert.match(failure, /Не удалось загрузить комплектации\./);
  const noMatch = fitmentMarkup({ ...base, vehicleLookup: { status: "no_match" } });
  assert.match(noMatch, /Комплектации не найдены\./);

  const editing = fitmentMarkup({ ...base, vehicleEditing: true, manualVehicleEditing: true });
  assert.match(editing, /Вернуться к выбору комплектации/);
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

test("the active object editor avoids repeating summary parameters and uses a compact preview", () => {
  const vehicleEditor = fitmentMarkup({ overview: {}, vehicleEditing: true, vehicleSpecs: ["2025", "EU"], vehicleSummaryRows: [["Год", "2025"]] });
  assert.doesNotMatch(vehicleEditor, /<dt>Год<\/dt>/);
  assert.match(vehicleEditor, /vnext-fitment__object--editing/);
  const wheelEditor = fitmentMarkup({ overview: {}, rimEditing: true, rimSpecs: "20 inch", rimSummaryRows: [["ET", "40 мм"]], rim: { offset_et_mm: 40 } });
  assert.doesNotMatch(wheelEditor, /<dt>ET<\/dt>/);
  assert.doesNotMatch(wheelEditor, /20 inch/);
  assert.match(wheelEditor, /data-wheel-picker-open="rim\.offset_et_mm"/);
  assert.match(read("vnext/styles/fitment.css"), /\.vnext-fitment:has\(\.vnext-fitment__object--editing\) \.vnext-fitment__stage \{ height: 160px; \}/);
});

test("Fitment parser states stay in wheel context and preserve the existing field actions", () => {
  const base = { overview: {}, rimEditing: true, rim: { brand: "BBS", wheel_diameter_in: 19 }, vehicleForm: { make: "Audi" } };
  const idle = fitmentMarkup({ ...base, resolver: { open: true, url: "", loading: false } });
  assert.match(idle, /data-fitment-source-url/);
  assert.match(idle, /Определить параметры/);

  const loading = fitmentMarkup({ ...base, resolver: { open: true, url: "https:\/\/shop.example.test\/wheel", loading: true, statusTone: "neutral" } });
  assert.match(loading, /Определяем параметры колесного диска/);
  assert.match(loading, /value="BBS"/);
  assert.match(loading, /data-fitment-source-url/);

  const success = fitmentMarkup({ ...base, resolver: { open: true, url: "https:\/\/shop.example.test\/wheel", loading: false, status: "Параметры найдены — проверьте значения", statusTone: "success" } });
  assert.match(success, /Параметры найдены — проверьте значения/);

  const variants = fitmentMarkup({ ...base, resolver: { open: true, url: "https:\/\/shop.example.test\/wheel", variants: [{ brand: "BBS", model: "CI-R", sku: "A1", values: { wheel_diameter_in: 19, wheel_width_j: 8.5, bolt_count: 5, pcd_mm: 112, center_bore_mm: 66.6, offset_et_mm: 35.25 } }] } });
  assert.match(variants, /Выберите вариант диска/);
  assert.match(variants, /BBS CI-R/);
  assert.match(variants, /SKU: A1/);
  assert.match(variants, /19″[^]*?8.5J[^]*?5×112[^]*?66.6 мм[^]*?35.25 мм/);
  assert.match(variants, /Выбрать/);
  assert.match(variants, /data-fitment-action="rim-variant"/);
  const missingSpecs = fitmentMarkup({ ...base, resolver: { open: true, url: "https:\/\/shop.example.test\/wheel", variants: [{ sku: "A2", values: {} }] } });
  assert.equal((missingSpecs.match(/Не определено/g) || []).length, 5);

  const conflict = fitmentMarkup({ ...base, resolver: { open: true, url: "https:\/\/shop.example.test\/wheel", conflicts: [{ field: "offset_et_mm", current: 40, suggested: 45 }] } });
  assert.match(conflict, /Подтверждено: 40 — найдено: 45/);
  assert.match(conflict, /data-fitment-action="conflict-use"/);
  assert.match(conflict, /data-fitment-action="conflict-keep"/);

  const failure = fitmentMarkup({ ...base, resolver: { open: true, url: "https:\/\/shop.example.test\/wheel", status: "Сайт недоступен", statusTone: "error" } });
  assert.match(failure, /Сайт недоступен/);
  assert.match(failure, /data-fitment-action="resolve-rim"/);
  assert.match(failure, /Указать параметры вручную/);
  assert.match(failure, />19<\/button>/);
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
  assert.doesNotMatch(view, /fetch\(|setTimeout\(|clearTimeout\(|revision\s*[+\-*/=]|infer/i);
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
  assert.match(app, /action === "save"\) void saveVnextFitment\(\)/);
  assert.match(app, /action === "check"\) void runFitmentCheck\(\)/);
  assert.match(app, /action === "resolve-rim"\)[\s\S]*?setFitmentEditor\("rim"\)[\s\S]*?void resolveFitmentRimSource\(\)/);
  assert.match(app, /action === "load-vehicle-variants"\) \{\s*toggleFitmentModificationPicker\(\)/);
  assert.match(app, /action === "confirm-vehicle-variant"\)[\s\S]*?applyFitmentVehicleVariant\(variant\)/);
  assert.match(app, /function renderFitment\(\)[\s\S]*?notifyFitmentBridge\(\);\s*return;/);
});

test("Fitment preserves render independence and single-column tablet/mobile layouts", () => {
  const app = read("app.js");
  const submit = app.slice(app.indexOf("async function submitJob("), app.indexOf("function ", app.indexOf("async function submitJob(") + 1));
  assert.doesNotMatch(submit, /fitmentVerdict|fitmentCheck|fitmentOverview/);
  const css = read("vnext/styles/fitment.css");
  assert.match(css, /@media\s*\(max-width:\s*700px\)[^]*?\.vnext-fitment__pair\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  const html = read("index.html");
  assert.match(html, /vnext\/styles\/fitment\.css/);
});

test("runtime Fitment initialization follows next_action and never opens both object editors", async () => {
  const app = read("app.js");
  const source = [
    app.slice(app.indexOf("function fitmentRimValuesEqual("), app.indexOf("function markRimFieldEdited(")),
    app.slice(app.indexOf("function fitmentNextAction("), app.indexOf("function deriveFitmentNextIntent(")),
    app.slice(app.indexOf("function updateDemoFitmentState("), app.indexOf("function createDemoFitmentCheck(")),
    app.slice(app.indexOf("async function loadFitmentOverview("), app.indexOf("function openFitmentView(")),
    app.slice(app.indexOf("function vnextFitmentSnapshot()"), app.indexOf("function setVnextFitmentField(")),
  ].join("\n");
  const state = {
    fitmentJobId: "demo-job", fitmentOverview: null, fitmentForm: null, fitmentFormState: {},
    fitmentCheck: null, fitmentCheckHistory: [], fitmentVehicleEditing: false, fitmentRimEditing: false,
    fitmentVehicleDirty: false, fitmentVehicleMarketEdited: false, fitmentSourceAppliedFields: [],
    fitmentRimManualFields: [],
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
    fitmentMutationsLocked: () => false,
    demoVehicleTitle: (value) => [value?.make, value?.model].filter(Boolean).join(" "),
    fitmentMarketLabel: (value) => value || "",
    fitmentPresentationText: (value) => String(value ?? ""),
    fitmentCatalogueFieldState: (kind, value) => ({ state: value ? "selected" : "loaded_unselected", message: "" }),
    fitmentFieldLabel: (path) => path,
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
    assert.equal(markup.includes('data-fitment-action="toggle-source"'), expectedRimEditor, `${action}: wheel source disclosure visibility`);
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
      state, fitmentMutationsLocked: () => false, locale: "ru", RIM_SOURCE_RESOLVE_TIMEOUT_MS: 30_000,
      window: { setTimeout: () => 1, clearTimeout() {} }, AbortController,
      shouldUseDemoFitment: () => false,
      fitmentCheckContextKey: () => state.fitmentJobId,
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
      vnextFitmentSnapshot: () => ({}), setVnextFitmentField() {}, setFitmentVehiclePhoto() {},
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
  const recoveryMarkup = fitmentMarkup({ overview: {}, rimEditing: true, resolver: { url: wheelActive.state.fitmentForm.rim.product_url, status: wheelActive.state.fitmentSourceStatus, statusTone: "error", loading: false, open: true } });
  assert.match(recoveryMarkup, /Повторить/);
  assert.match(recoveryMarkup, /Указать параметры вручную/);
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
  assert.match(fitmentMarkup({ overview: {}, frontRimSetupState: "partial" }), /Не хватает параметров/);
  assert.match(fitmentMarkup({ overview: {}, frontRimSetupState: "complete_unconfirmed" }), /Проверьте и подтвердите параметры/);
  assert.match(fitmentMarkup({ overview: {}, frontRimSetupState: "confirmed_ready" }), /Параметры подтверждены/);
  const staggered = fitmentMarkup({
    overview: {}, setupMode: "staggered", frontRimSetupState: "confirmed_ready", rearRimSetupState: "empty",
  });
  assert.match(staggered, /Передняя ось: Параметры подтверждены — Задняя ось: Параметры не заполнены/);
});

test("staggered Fitment does not project front rim candidates into rear axle fields", () => {
  const markup = fitmentMarkup({
    overview: {}, setupMode: "staggered", rimEditing: true,
    rim: { offset_et_mm: 42 }, rearRim: { offset_et_mm: 55 },
    rimCandidates: [{ field: "offset_et_mm", value: 35 }],
  });
  assert.match(markup, /data-wheel-picker-open="rim\.offset_et_mm"[^]*?data-fitment-action="candidate" data-value="rim\.offset_et_mm\|35"/);
  assert.doesNotMatch(markup, /data-value="rear_rim\.offset_et_mm\|35"/);
});

test("Fitment candidate controls meet the mobile tap target and saved progression uses the returned next_action", () => {
  const css = read("vnext/styles/fitment.css");
  assert.match(css, /\.vnext-fitment__suggestions \.vnext-button \{ min-height:\s*42px/);
  const app = read("app.js");
  const saveStart = app.indexOf("async function saveFitment(");
  const save = app.slice(saveStart, app.indexOf("async function fetchRenderHistory(", saveStart));
  assert.ok(save.indexOf("const overview = await response.json()") < save.indexOf("setFitmentEditorsForNextAction(overview)"));
  assert.ok(save.indexOf("await refreshFitmentCheckCurrentness()") < save.indexOf("setFitmentEditorsForNextAction(overview)"));
  const catchBlock = save.slice(save.indexOf("} catch (error) {"), save.indexOf("} finally {"));
  assert.doesNotMatch(catchBlock, /setFitmentEditor/);
});
