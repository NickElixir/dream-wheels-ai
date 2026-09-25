import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("VNext foundation assets are linked from the static app entry", () => {
  const html = read("index.html");
  for (const asset of [
    "/vnext/styles/tokens.css",
    "/vnext/styles/foundation.css",
    "/vnext/styles/shell.css",
    "/vnext/bootstrap.js",
  ]) assert.match(html, new RegExp(asset.replace(/[./]/g, "\\$&")));
});

test("VNext shell delegates navigation and keeps Help in the mobile model", () => {
  const shell = read("vnext/shell/app-shell.js");
  const bootstrap = read("vnext/bootstrap.js");
  assert.match(shell, /\["Помощь", "support"\]/);
  assert.doesNotMatch(shell, /Ещё/);
  assert.match(bootstrap, /legacyNavigate/);
  assert.match(bootstrap, /dreamwheels:viewchange/);
});

test("VNext primitives remain presentation-only", () => {
  const primitives = read("vnext/ui/primitives.js");
  assert.doesNotMatch(primitives, /fetch\(|DreamWheelsLegacy|state\./);
  assert.match(primitives, /createButton/);
  assert.match(primitives, /createStatusText/);
});

test("VNext shell retains desktop and safe-area mobile layout foundations", () => {
  const css = read("vnext/styles/shell.css");
  const tokens = read("vnext/styles/tokens.css");
  assert.match(css, /grid-template-columns: 220px minmax\(0, 1fr\)/);
  assert.match(tokens, /env\(safe-area-inset-bottom/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});
