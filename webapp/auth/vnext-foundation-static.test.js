import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("VNext foundation assets are linked from the static app entry", () => {
  const html = read("index.html");
  const tokens = read("vnext/styles/tokens.css");
  for (const asset of [
    "/vnext/styles/tokens.css",
    "/vnext/styles/foundation.css",
    "/vnext/styles/shell.css",
    "/vnext/bootstrap.js",
  ]) assert.match(html, new RegExp(asset.replace(/[./]/g, "\\$&")));

  assert.doesNotMatch(tokens, /fonts\.googleapis\.com/);
  assert.match(tokens, /@font-face/);
  assert.match(tokens, /\.\.\/\.\.\/assets\/fonts\/ibm-plex-sans-cyrillic\.woff2/);
  assert.match(tokens, /\.\.\/\.\.\/assets\/fonts\/ibm-plex-sans-latin\.woff2/);
  for (const asset of [
    "assets/fonts/ibm-plex-sans-cyrillic.woff2",
    "assets/fonts/ibm-plex-sans-latin.woff2",
    "assets/fonts/OFL-LICENSE.txt",
  ]) assert.ok(fs.existsSync(path.join(root, asset)), `missing local font asset: ${asset}`);
});

test("VNext shell delegates navigation and keeps Help in the mobile model", () => {
  const shell = read("vnext/shell/app-shell.js");
  const bootstrap = read("vnext/bootstrap.js");
  const navigation = read("vnext/api/legacy-navigation.js");
  assert.match(shell, /\["Помощь", "support"\]/);
  assert.doesNotMatch(shell, /Ещё/);
  assert.match(shell, /pageTitle\.textContent = title/);
  assert.match(bootstrap, /title: model\.title/);
  assert.match(bootstrap, /legacyNavigate/);
  assert.match(bootstrap, /dreamwheels:viewchange/);
  assert.match(navigation, /typeof openExternal === "function"/);
  assert.doesNotMatch(navigation, /openExternal\?\.\(url\)\s*\|\|/);
});

test("VNext primitives remain presentation-only and Support matches the frozen proving surface", () => {
  const primitives = read("vnext/ui/primitives.js");
  const model = read("vnext/models/support.js");
  const view = read("vnext/views/support.js");
  assert.doesNotMatch(primitives, /fetch\(|DreamWheelsLegacy|state\./);
  assert.match(primitives, /createButton/);
  assert.match(primitives, /createStatusText/);

  for (const text of [
    "Разберёмся с проблемой",
    "Написать в поддержку",
    "Что можно проверить самостоятельно",
    "Как подготовить фотографию автомобиля",
    "Что делать, если ссылка на диск не распозналась",
    "Почему техническая проверка не блокирует примерку",
    "Оплата и срок действия рендеров",
    "Правовые документы",
    "dreamwheelsai@yandex.ru",
  ]) assert.ok(model.includes(text), `missing frozen Support copy: ${text}`);

  assert.match(view, /textarea/);
  assert.match(view, /mailto:/);
  assert.match(view, /navigate\?\.\("docs"\)/);
});

test("VNext shell retains desktop and safe-area mobile layout foundations", () => {
  const css = read("vnext/styles/shell.css");
  const tokens = read("vnext/styles/tokens.css");
  const foundation = read("vnext/styles/foundation.css");
  assert.match(css, /grid-template-columns: 220px minmax\(0, 1fr\)/);
  assert.match(tokens, /env\(safe-area-inset-bottom/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(foundation, /prefers-reduced-motion: reduce/);
  assert.match(foundation, /vnext-support__grid/);
});
