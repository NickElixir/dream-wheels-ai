import assert from "node:assert/strict";
import test from "node:test";

class ElementStub {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.value = "";
    this.className = "";
    this.textContent = "";
  }
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); return item; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  get childElementCount() { return this.children.length; }
  get allText() { return this.textContent + this.children.map((child) => child.allText || child.textContent || "").join(""); }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find?.(predicate);
      if (found) return found;
    }
    return null;
  }
}

globalThis.document = {
  createElement: (tag) => new ElementStub(tag),
  createTextNode: (text) => Object.assign(new ElementStub("#text"), { textContent: text }),
  querySelector: () => null,
};
const { createCreateView } = await import("../vnext/views/create.js");

test("Create renders fixed empty/upload stages and replaces either asset through the legacy picker callback", () => {
  const picked = [];
  const view = createCreateView({}, { pickFile: (kind) => picked.push(kind) });
  assert.match(view.allText, /Добавьте фото автомобиля/);
  assert.match(view.allText, /Добавьте фото диска/);
  assert.match(view.className, /vnext-create/);
  const stages = [];
  (function visit(node) { if (node.className?.includes("vnext-create__stage")) stages.push(node); node.children.forEach(visit); })(view);
  assert.equal(stages.length, 2);
  stages[0].listeners.click();
  assert.deepEqual(picked, ["car"]);
});

test("Create renders uploaded media and keeps consent and identity resolution explicit", () => {
  let consent = null;
  const view = createCreateView({
    files: { car: { name: "car.jpg", size: 1024, previewUrl: "blob:car" }, wheel: null },
    bothReady: true,
    consentAccepted: false,
  }, { setConsent: (checked) => { consent = checked; } });
  const image = view.find((node) => node.tagName === "img");
  assert.equal(image.src, "blob:car");
  assert.match(view.allText, /Согласие/);
  assert.match(view.allText, /legal\.dreamwheels\.pro\/legal\/privacy|Политика конфиденциальности/);
  const checkbox = view.find((node) => node.tagName === "input");
  checkbox.checked = true;
  checkbox.listeners.change();
  assert.equal(consent, true);
});

test("identity loading, proposal summary, retry, Create Image and Fitment delegation render correctly", () => {
  const called = [];
  const loading = createCreateView({ identityResolving: true }, {});
  assert.match(loading.allText, /Определяем автомобиль/);

  const proposal = {
    bothReady: true,
    consentAccepted: true,
    draftId: "draft-1",
    selectedVehicle: { make: "Audi", model: "Q8", year: 2024, source: "vlm", confidence: 0.92 },
    selectedVehicleIndex: 0,
    proposal: {
      vehicle: { primary: { make: "Audi", model: "Q8", year: 2024, confidence: 0.92 }, alternatives: [] },
      rim: { brand: "X-Trike", model: "A-123", wheel_diameter_in: 20, wheel_width_j: 9, bolt_count: 5, pcd_mm: 112 },
    },
  };
  const view = createCreateView(proposal, {
    createImage: () => called.push("render"),
    checkCompatibility: () => called.push("fitment"),
  });
  assert.match(view.allText, /Audi Q8/);
  assert.match(view.allText, /X-Trike/);
  assert.match(view.allText, /5×112/);
  assert.doesNotMatch(view.allText, /ET —|DIA —/);
  const actions = [];
  (function visit(node) { if (node.tagName === "button") actions.push(node); node.children.forEach(visit); })(view);
  const create = actions.find((button) => button.textContent === "Создать изображение");
  const fitment = actions.find((button) => button.textContent === "Проверить совместимость");
  assert.equal(create.disabled, false);
  assert.equal(fitment.disabled, true, "Fitment requires the existing render job context");
  create.listeners.click();
  assert.deepEqual(called, ["render"]);

  const fitmentReady = createCreateView({ ...proposal, jobId: "job-1", fitmentJobId: "job-1", resultUrl: "/result.jpg" }, {
    createImage: () => {}, checkCompatibility: () => called.push("fitment-ready"),
  });
  const fitmentButton = fitmentReady.find((node) => node.tagName === "button" && node.textContent === "Проверить совместимость");
  assert.equal(fitmentButton.disabled, false);
  fitmentButton.listeners.click();
  assert.equal(called.at(-1), "fitment-ready");
});

test("identity error renders retry without inventing parser URL states", () => {
  let retries = 0;
  const view = createCreateView({ identityError: { title: "Сервис распознавания временно недоступен", body: "Попробуйте позже." } }, { retryIdentity: () => retries++ });
  assert.match(view.allText, /Сервис распознавания временно недоступен/);
  const retry = view.find((node) => node.tagName === "button" && node.textContent === "Повторить");
  retry.listeners.click();
  assert.equal(retries, 1);
  assert.doesNotMatch(view.allText, /Не удалось получить данные по ссылке|URL resolver/i);
});
