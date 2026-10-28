import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("VNext Create is mounted as a presentation-only surface over legacy runtime actions", () => {
  const bootstrap = read("vnext/bootstrap.js");
  const app = read("app.js");
  assert.match(bootstrap, /"create"/);
  assert.match(bootstrap, /dreamwheels:createchange/);
  assert.match(bootstrap, /dreamwheelsCreateBridge\?\.snapshot\(\)/);
  assert.match(app, /createImage\(\)\s*\{\s*return submitJob\(\)/);
  assert.match(app, /handleGenerationError\(\)/);
  assert.doesNotMatch(app, /checkCompatibility\(\)/);
  assert.match(app, /uploads\.append\("car_image", state\.files\.car\.blob/);
  assert.match(app, /uploads\.append\("wheel_image", state\.files\.wheel\.blob/);
  assert.match(app, /apiUrl\("\/identity\/assets"\)/);
  assert.doesNotMatch(app, /apiUrl\("\/identity\/resolve"\)/);

});

test("Create view source covers upload, consent, URL storage, retry and render action", () => {
  const view = read("vnext/views/create.js");
  const css = read("vnext/styles/surfaces.css");
  for (const state of ["bothReady", "consentAccepted", "submitting"]) {
    assert.ok(view.includes(state), `missing Create state: ${state}`);
  }
  for (const action of ["create.addPhoto", "create.replacePhoto", "create.createImage", "create.retry"]) {
    assert.ok(view.includes(action), `missing Create action: ${action}`);
  }
  assert.match(css, /\.vnext-create__pair\s*\{[^}]*grid-template-columns/);
  assert.match(css, /\.vnext-create__stage img[^}]*object-fit:\s*contain/);
  assert.match(css, /\[data-view="create"\] > :not\(\[data-vnext-create-root\]\)[^}]*display: none !important/);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*?\.vnext-create__pair, \.vnext-create__summary\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(view, /https:\/\/legal\.dreamwheels\.pro\/legal\/privacy/);
  assert.match(view, /https:\/\/legal\.dreamwheels\.pro\/legal\/consent/);
  assert.doesNotMatch(view, /variant_state === "selection_required"/);
  assert.doesNotMatch(view, /Получаем данные по ссылке/);
});
