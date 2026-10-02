import { fitmentDisplayValue } from "../webapp/vnext/fitment-display.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "webapp/vnext/views/fitment.js"), "utf8")
  .replaceAll("export function ", "function ")
  .replace(/import \{ fitmentDisplayValue \} from "\.\.\/fitment-display\.mjs";/u, `const fitmentDisplayValue = ${fitmentDisplayValue.toString()};`);
const context = {};
vm.runInNewContext(`${source}\nglobalThis.fitmentMarkup = fitmentMarkup;`, context);

test("VNext composition keeps independent source cards and a full-width editor before the result", () => {
  const markup = context.fitmentMarkup({
    overview: { vehicle_state: "unconfirmed", rim_setup_state: "confirmed_ready" },
    nextAction: "complete_vehicle_details",
    vehicleTitle: "Zeekr 007", rimTitle: "BBS CI-R",
    rimSourceDomain: "shop.example.ru", rimEditing: true,
    rim: { offset_et_mm: 35.25 },
    check: { execution_status: "completed", verdict: "incompatible", is_current: true },
    canRunCheck: false,
  });
  assert.ok(markup.indexOf('class="vnext-fitment__pair"') < markup.indexOf('class="vnext-fitment__active-editor"'));
  assert.ok(markup.indexOf('class="vnext-fitment__active-editor"') < markup.indexOf('class="vnext-fitment__verdict'));
  assert.ok(markup.indexOf('class="vnext-fitment__verdict') < markup.indexOf('class="vnext-fitment__standard"'));
  assert.match(markup, /data-fitment-action="edit-vehicle"/);
  assert.match(markup, /data-fitment-action="edit-rim"/);
  assert.match(markup, /data-fitment-action="recognize-vehicle"[^>]*disabled/);
  assert.match(markup, /data-fitment-action="resolve-rim"/);
  assert.match(markup, /shop\.example\.ru/);
  assert.equal((markup.match(/data-fitment-action="create-image"/g) || []).length, 1);
  assert.match(markup, /data-fitment-action="check"[^>]*disabled/);
});

test("a Wheel editor remains the only editor when the server requests a Vehicle variant", () => {
  const markup = context.fitmentMarkup({
    overview: { vehicle_state: "confirmed_incomplete", rim_setup_state: "partial" },
    nextAction: "select_vehicle_variant", activeSection: "rim",
    rimEditing: true, vehicleEditing: false,
    vehicleVariants: [{ label: "2.0 AWD" }],
    rim: { offset_et_mm: 35.25 },
  });
  assert.match(markup, /data-wheel-picker-open="rim\.offset_et_mm"/);
  assert.doesNotMatch(markup, /class="vnext-fitment__variant-step"/);
  assert.match(markup, /Выберите комплектацию автомобиля/);
  assert.match(markup, /data-fitment-action="edit-vehicle"/);
  assert.match(markup, /data-fitment-action="check"[^>]*disabled/);
});

const workspace = markup => [...markup.matchAll(/data-fitment-workspace-kind="([^"]+)"/g)].map(match => match[1]);
const cases = [
  ["idle", {}, "none"],
  ...["loading", "proposed", "failed"].map(status => [status, {activeSection:"vehicle", vehicleEditing:true, vehicleRecognition:{status,canRecognize:true,candidates:[{make:"Audi",model:"Q8",year_start:2018,year_end:2023}]}}, "vehicle-recognition"]),
  ["applied", {vehicleEditing:true,vehicleRecognition:{status:"applied"}}, "vehicle-editor"],
  ["base confirmation", {vehicleEditing:true,vehicleAwaitingConfirmation:true}, "vehicle-editor"],
  ["required variant", {nextAction:"select_vehicle_variant"}, "vehicle-variant"],
  ["reselect", {vehicleVariantPickerOpen:true,vehicleVariantMode:"reselect"}, "vehicle-variant"],
  ["manual fallback", {nextAction:"select_vehicle_variant",vehicleEditing:true,manualVehicleEditing:true}, "vehicle-editor"],
  ["Wheel", {rimEditing:true,activeSection:"rim"}, "rim-editor"],
  ["SKU", {rimEditing:true,resolver:{chooserOpen:true,variants:[{sku:"A",values:{}}]}}, "rim-editor"],
  ["Wheel with pending recognition and variant", {nextAction:"select_vehicle_variant",rimEditing:true,vehicleEditing:true,activeSection:"rim",vehicleRecognition:{status:"proposed"},vehicleVariantPickerOpen:true}, "rim-editor"],
  ["manual Vehicle with retained recognition", {vehicleEditing:true,activeSection:"vehicle",vehicleRecognition:{status:"proposed",workspaceOpen:false}}, "vehicle-editor"],
];
for (const [name, model, expected] of cases) test(`single Active Workspace: ${name}`, () => {
  const markup = context.fitmentMarkup(model);
  assert.deepEqual(workspace(markup), expected === "none" ? [] : [expected]);
  assert.equal((markup.match(/data-fitment-active-workspace/g) || []).length,1);
  assert.equal((markup.match(/data-fitment-workspace=/g) || []).length, expected === "none" ? 0 : 1);
  assert.equal((markup.match(/class="vnext-fitment__object(?: |")/g) || []).length,2);
  assert.doesNotMatch(markup, /<hr\b|decorative-divider/);
});

test("recognition candidate uses its whole button and disappears after applying", () => {
  const recognition={status:"proposed",candidates:[{make:"Audi",model:"Q8",year_start:2018,year_end:2023}]};
  const markup=context.fitmentMarkup({vehicleRecognition:recognition});
  assert.match(markup,/Распознавание автомобиля/);
  assert.match(markup,/Распознано по фотографии/);
  assert.match(markup,/aria-label="Audi Q8 2018–2023"/);
  assert.doesNotMatch(markup,/Использовать|Предложено по фотографии/);
  const applied=context.fitmentMarkup({vehicleRecognition:{...recognition,status:"applied"},vehicleEditing:true});
  assert.doesNotMatch(applied,/fitment-recognition-title|Распознано по фотографии/);
  assert.match(applied,/Укажите автомобиль/);
});

test("confirmed configuration is a primary value without duplicate status labels", () => {
  const markup=context.fitmentMarkup({vehicleStatus:"Комплектация подтверждена",vehicleVariantName:"55 TFSI quattro",vehicleVariantTechnical:"Россия+ · 4M Facelift",canReselectVehicleVariant:true});
  assert.match(markup,/<strong>55 TFSI quattro<\/strong>/);
  assert.match(markup,/<small>Россия\+ · 4M Facelift<\/small>/);
  assert.match(markup,/<span>Подтверждено<\/span>/);
  assert.doesNotMatch(markup,/Комплектация подтверждена|Комплектация 55/);
});

test("ET accessible names contain the label once for confirmed, proposed and missing", () => {
  for (const pending of [[],["offset_et_mm"]]) {
    const markup=context.fitmentMarkup({rimEditing:true,rim:{offset_et_mm:40},rimPendingProposals:pending});
    assert.doesNotMatch(markup,/ET ET/);
    assert.match(markup, pending.length ? /aria-label="Подтвердить предложение ET 40"/ : /aria-label="Подтверждено ET 40"/);
  }
  assert.match(context.fitmentMarkup({rimEditing:true}), /aria-label="Выбрать ET Не выбрано"/);
});

test("new workspace copy is translated in EN", () => {
  const markup=context.fitmentMarkup({locale:"en",vehicleRecognition:{status:"proposed",candidates:[{make:"Audi",model:"Q8",year:2020}]}});
  assert.match(markup,/Vehicle recognition|Recognized from the photo/);
  assert.doesNotMatch(markup,/[А-Яа-яЁё]/);
  assert.match(context.fitmentMarkup({locale:"en",rimEditing:true}),/Wheel parameters/);
  assert.match(context.fitmentMarkup({locale:"en",nextAction:"select_vehicle_variant"}),/Vehicle version/);
});
