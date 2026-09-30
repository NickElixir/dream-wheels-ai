import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "webapp/vnext/views/fitment.js"), "utf8")
  .replaceAll("export function ", "function ");
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
