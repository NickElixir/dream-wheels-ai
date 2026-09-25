import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("PR2 registers Dashboard and remaining static surfaces on the VNext shell", () => {
  const bootstrap = read("vnext/bootstrap.js");
  for (const view of ["dashboard", "support", "photo-guide", "docs"]) {
    assert.ok(bootstrap.includes(`"${view}"`), `missing migrated surface: ${view}`);
  }
  assert.match(bootstrap, /vnext-surface-active/);
  assert.match(bootstrap, /dreamwheels:dashboardchange/);
  assert.doesNotMatch(bootstrap, /fetch\(/);
});

test("Dashboard consumes a read-only legacy view model and keeps domain actions behind callbacks", () => {
  const adapter = read("vnext/api/legacy-dashboard.js");
  const view = read("vnext/views/dashboard.js");
  const app = read("app.js");
  assert.match(adapter, /dashboardSnapshot/);
  assert.match(adapter, /openRenderDetail/);
  assert.match(adapter, /openAuth/);
  assert.doesNotMatch(view, /fetch\(|state\.|DreamWheelsLegacy/);
  assert.match(app, /function vnextDashboardSnapshot/);
  assert.match(app, /dreamwheels:dashboardchange/);
  assert.match(app, /openRenderDetail\(jobId, "dashboard"\)/);
});

test("Photo Guide uses real frozen reference photography and approved preparation rules", () => {
  const model = read("vnext/models/photo-guide.js");
  for (const asset of [
    "assets/photo-guide-good-vnext.jpg",
    "assets/photo-guide-bad-vnext.jpg",
  ]) assert.ok(fs.existsSync(path.join(root, asset)), `missing VNext Photo Guide asset: ${asset}`);
  for (const copy of [
    "Покажите автомобиль целиком",
    "Колёса должны быть видны",
    "Используйте резкий исходник",
    "Не меняйте фото перед загрузкой",
  ]) assert.ok(model.includes(copy), `missing Photo Guide rule: ${copy}`);
});

test("Documents keeps four frozen legal rows, existing legal endpoints and no arrow affordance", () => {
  const model = read("vnext/models/documents.js");
  const view = read("vnext/views/documents.js");
  for (const pathPart of ["/legal/privacy", "/legal/offer", "/legal/refund", "/legal/consent"]) {
    assert.ok(model.includes(pathPart), `missing legal endpoint: ${pathPart}`);
  }
  assert.match(view, /open\.textContent = "Открыть"/);
  assert.doesNotMatch(view, /›|→|arrow/i);
  assert.doesNotMatch(view, /fetch\(|state\./);
});

test("Auth/session VNext presentation preserves existing controller hooks and exposes frozen session states", () => {
  const html = read("index.html");
  const app = read("app.js");
  const css = read("vnext/styles/auth.css");
  assert.match(html, /\/vnext\/styles\/auth\.css/);
  assert.match(app, /sessionExpiredTitle: "Сессия истекла"/);
  assert.match(app, /Предыдущее действие не будет запущено автоматически/);
  assert.match(app, /data\.vnextAuthStep = state\.authDialogStep/);
  assert.match(app, /gate\.dataset\.vnextAuthState/);
  assert.match(css, /data-vnext-auth-step="restoring"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
});

test("PR2 leaves Create, Fitment, History and Balance out of the migrated surface registry", () => {
  const bootstrap = read("vnext/bootstrap.js");
  const registryMatch = bootstrap.match(/new Set\(\[([^\]]+)\]\)/s);
  assert.ok(registryMatch, "migrated surface registry not found");
  const registry = registryMatch[1];
  for (const legacyView of ["create", "fitment", "renders", "wallet", "render-detail"]) {
    assert.ok(!registry.includes(`"${legacyView}"`), `legacy feature migrated too early: ${legacyView}`);
  }
});
