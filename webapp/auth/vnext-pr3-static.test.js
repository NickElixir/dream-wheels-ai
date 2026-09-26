import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("PR3 mounts Create on VNext without remounting active edit state", () => {
  const bootstrap = read("vnext/bootstrap.js");
  const view = read("vnext/views/create.js");
  const adapter = read("vnext/api/legacy-create.js");

  assert.match(bootstrap, /"create"/);
  assert.match(bootstrap, /dreamwheels:createchange/);
  assert.match(bootstrap, /createSurface\.update\(legacyCreateSnapshot\(\)\)/);
  assert.doesNotMatch(bootstrap, /mountSurface\("create", \{ force: true \}\)/);
  assert.doesNotMatch(view, /fetch\(|DreamWheelsLegacy|state\./);
  assert.match(adapter, /refreshCreateWheelUrl/);
  assert.match(view, /Создать изображение/);
  assert.match(view, /Проверить совместимость/);
});

test("PR3 wheel URL refresh uses the existing identity endpoint in wheel-only mode", () => {
  const app = read("app.js");
  const start = app.indexOf("async function refreshCreateWheelFromUrl(productUrl)");
  const end = app.indexOf("function formatVehicle", start);
  assert.ok(start >= 0 && end > start);
  const refresh = app.slice(start, end);

  assert.match(refresh, /formData\.append\("draft_id", state\.identityDraftId\)/);
  assert.match(refresh, /formData\.append\("rim_product_url", normalizedUrl\)/);
  assert.match(refresh, /vehicle_user_confirmed/);
  assert.doesNotMatch(refresh, /car_image|wheel_image/);
  assert.match(refresh, /confirmedVehicle:/);
  assert.match(refresh, /createParserStatus = "error"/);
});

test("PR3 keeps render permission independent from Fitment", () => {
  const app = read("app.js");
  const start = app.indexOf("function vnextCreateSnapshot()");
  const end = app.indexOf("function saveCreateVehicle", start);
  const snapshot = app.slice(start, end);
  const canCreate = snapshot.slice(snapshot.indexOf("canCreate:"), snapshot.indexOf("canCheckFitment:"));

  assert.doesNotMatch(canCreate, /fitment/i);
  assert.match(canCreate, /state\.identityDraftId/);
  assert.match(canCreate, /state\.photoConsentAccepted/);
  assert.match(app, /rim_user_confirmed: state\.manualRimEdited/);
});

test("PR3 surfaces parser ambiguity without inventing exact specs", () => {
  const view = read("vnext/views/create.js");
  assert.match(view, /variant_state === "selection_required"/);
  assert.match(view, /На странице найдено несколько вариантов/);
  assert.match(view, /точные параметры не выбраны/);
  assert.match(view, /Попробовать другую ссылку/);
  assert.match(view, /Загрузить вручную/);
});
