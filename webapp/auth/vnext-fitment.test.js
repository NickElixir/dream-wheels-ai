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
