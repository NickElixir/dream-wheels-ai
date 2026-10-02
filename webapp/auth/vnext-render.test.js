import { buildFitmentRimReadiness } from "../vnext/fitment-readiness.mjs";
import { fitmentDisplayValue } from "../vnext/fitment-display.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { historyMarkup, patchNode, processingMarkup, resultMarkup } from "../vnext/views/render.js";

class TestElement {
  constructor(name, children = []) {
    this.nodeType = 1;
    this.nodeName = name;
    this.childNodes = children;
    this.attributes = [];
    this.parentNode = null;
    for (const child of children) child.parentNode = this;
  }

  get lastChild() { return this.childNodes.at(-1) || null; }
  hasAttribute() { return false; }
  getAttribute() { return null; }
  removeAttribute() {}
  setAttribute() {}
  matches() { return false; }
  append(child) { child.parentNode = this; this.childNodes.push(child); }
  remove() {
    const index = this.parentNode?.childNodes.indexOf(this) ?? -1;
    if (index >= 0) this.parentNode.childNodes.splice(index, 1);
    this.parentNode = null;
  }
  replaceWith(replacement) {
    const index = this.parentNode.childNodes.indexOf(this);
    replacement.parentNode = this.parentNode;
    this.parentNode.childNodes.splice(index, 1, replacement);
  }
  cloneNode(deep) { return new TestElement(this.nodeName, deep ? this.childNodes.map(child => child.cloneNode(true)) : []); }
}

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8").replace(/^import \{[\s\S]*?\} from "\.\/app-route\.mjs";\n\n/u, `const fitmentDisplayValue = ${fitmentDisplayValue.toString()};\nconst buildFitmentRimReadiness = ${buildFitmentRimReadiness.toString()};\n`).replace(/import \{ fitmentDisplayValue \} from "\.\/vnext\/fitment-display\.mjs";\nimport \{ buildFitmentRimReadiness \} from "\.\/vnext\/fitment-readiness\.mjs";\n\n/u, "");
function runtime() {
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const context = {
    URL, URLSearchParams, Blob, FormData, console,
    document: { documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {} }, appendChild() {} }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ click() {}, remove() {}, set textContent(value) { this.innerHTML = String(value); } }) },
    window: { Telegram: {}, location: { search: "" }, dispatchEvent() {}, scrollTo() {} },
    localStorage: storage, sessionStorage: storage, navigator: { language: "ru-RU", userAgent: "test" },
    setTimeout, clearTimeout,
  };
  vm.runInNewContext(`
const applicationRouteContext = () => null;
const isApplicationRoute = () => false;
const safeApplicationReturnPath = () => null;
${source}
notifyRenderBridge = () => {};
notifyCreateBridge = () => {};
renderRenders = () => {};
renderDashboard = () => {};
renderRenderDetail = () => {};
renderIdentityFlow = () => {};
refreshButtonsForCurrentView = () => {};
haptic = () => {};
trackEvent = async () => {};
loadFitmentReturnContext = async () => {};
sleep = async () => {};
apiUrl = (path) => path;
getWebsiteAuthToken = () => "test-token";
withAuthHeaders = () => ({Authorization: "Bearer test-token"});
getIdentityPayload = () => ({});
globalThis.api = {state, bridge: window.dreamwheelsRenderBridge, resultUrlForJob, submitHistoryFeedback, loadRenderDetailJob, openRenderDetail, submitJob, ensureAssetBlobUrl, downloadResult,
 ensureOriginalDisplayUrl, originalSignedUrlForJob, handleOriginalDisplayError,
 setAuth: (ready) => { hasFrontendAuth = () => ready; },
 setAuthIdentity: (token) => { getWebsiteAuthToken = () => token; },
 loadRenderHistory,
 setHistoryFetch: (fn) => { fetchRenderHistory = fn; scheduleRenderHistoryPolling = () => {}; },
 classifyGenerationError,
 ready: () => { state.view = "create"; state.identityDraftId = "draft"; selectedVehicleCandidate = () => ({make: "Zeekr", model: "001"}); },
 observe: (fn) => { notifyCreateBridge = () => fn(state.renderStatus); },
 setFetch: (fetcher) => { authenticatedFetch = fetcher; },
 setFitment: (fn) => { openFitmentView = fn; },
 setHistory: (fn) => { loadRenderHistory = fn; },
 setOpenDetail: (fn) => { openRenderDetail = fn; },
 setObjectURL: (fn) => { URL.createObjectURL = fn; URL.revokeObjectURL = () => {}; },
 website: () => { isWebsiteAuthMode = () => true; }
};`, context);
  return context.api;
}
const job = (id, status = "completed") => ({ job_id: id, status, created_at: "2026-09-25T12:00:00Z", result_url: `/result-${id}.jpg`, fitment_available: true, render_input_snapshot: { vehicle: { make: "Zeekr", model: id }, rim: { brand: "RZ", model: "XL6002", offset_et_mm: 0 } }, assets: { car_original: { download_url: `/jobs/${id}/assets/car_original/download` }, result: { download_url: `/jobs/${id}/download` } } });

test("render reconciliation preserves later siblings when replacing a node", () => {
  const current = new TestElement("SECTION", [new TestElement("DIV"), new TestElement("BUTTON")]);
  const next = new TestElement("SECTION", [new TestElement("P"), new TestElement("BUTTON"), new TestElement("FOOTER")]);

  patchNode(current, next);

  assert.deepEqual(current.childNodes.map(child => child.nodeName), ["P", "BUTTON", "FOOTER"]);
  assert.deepEqual(next.childNodes.map(child => child.nodeName), ["P", "BUTTON", "FOOTER"]);
});

test("all three result URL contracts remain supported", () => {
  const app = runtime();
  for (const response of [{ result_url: "/a" }, { output_image_url: "/a" }, { assets: { result: { url: "/a" } } }]) assert.equal(app.resultUrlForJob(response), "/a");
});

test("comparison reveals original on the left and result on the right, with matching labels", () => {
  const markup = resultMarkup({jobId: "A", status: "completed", originalUrl: "/original", resultUrl: "/result"});
  assert.match(markup, /class="vnext-compare-layer">[\s\S]*?src="\/result"[^>]*data-render-image="result"/);
  assert.match(markup, /class="vnext-compare-layer vnext-compare-reveal">[\s\S]*?src="\/original"[^>]*data-render-image="original"/);
  assert.match(markup, /class="vnext-compare-label left">Оригинал<\/span>/);
  assert.match(markup, /class="vnext-compare-label right">Результат<\/span>/);
  const css = fs.readFileSync(new URL("../vnext/styles/render.css", import.meta.url), "utf8");
  assert.match(css, /\.vnext-compare-reveal\s*\{[^}]*clip-path:inset\(0 calc\(100% - var\(--compare\)\) 0 0\)/);
});

test("Result keeps its desktop grid and stacks comparison before a bounded aside on tablet", () => {
  const css = fs.readFileSync(new URL("../vnext/styles/render.css", import.meta.url), "utf8");
  const tablet = css.match(/@media\(max-width:1024px\)\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const mobile = css.match(/@media\(max-width:680px\)\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const narrowMobile = css.match(/@media\(max-width:390px\)\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(css, /\.vnext-result-layout\s*\{ display:grid; grid-template-columns:minmax\(0,76fr\) minmax\(250px,24fr\); gap:24px;/);
  assert.match(tablet, /\.vnext-result-layout\s*\{ display:flex; flex-direction:column; gap:20px; \}/);
  assert.match(tablet, /\.vnext-result-layout > \.vnext-compare\s*\{ width:100%; \}/);
  assert.match(tablet, /\.vnext-result-aside\s*\{ width:100%; max-width:680px; \}/);
  assert.match(css, /\.vnext-compare\s*\{[^}]*aspect-ratio:16\/9/);
  assert.match(mobile, /\.vnext-result-layout\s*\{ display:flex; flex-direction:column; gap:18px; \}/);
  assert.match(mobile, /\.vnext-compare\s*\{ aspect-ratio:4\/3; \}/);
  assert.match(narrowMobile, /\.vnext-compare\s*\{ aspect-ratio:1; \}/);
});

test("Result actions keep the primary and Fitment CTAs, expose tertiary download, and omit redundant History navigation", () => {
  const markup = resultMarkup({ jobId: "A", status: "completed", title: "ZEEKR 007", rimName: "X-Trike", specs: "20″ / 9J / 5×112", createdLabel: "25 сентября, 14:32", resultUrl: "/result", originalUrl: "/original", canFitment: true, canDownload: true });
  assert.ok(markup.indexOf('class="vnext-compare"') < markup.indexOf('class="vnext-result-aside"'));
  assert.match(markup, /Автомобиль[\s\S]*?ZEEKR 007[\s\S]*?Колесный диск[\s\S]*?X-Trike[\s\S]*?20″ \/ 9J \/ 5×112[\s\S]*?Создано[\s\S]*?25 сентября, 14:32/);
  assert.ok(markup.indexOf('aria-label="Оценка результата"') > markup.indexOf('class="vnext-result-layout"'));
  assert.match(markup, /class="vnext-button vnext-button--primary[^>]*data-render-action="repeat"[^>]*>Создать ещё вариант/);
  assert.match(markup, /class="vnext-button vnext-button--secondary[^>]*data-render-action="fitment"[^>]*>Проверить совместимость/);
  assert.match(markup, /class="vnext-button vnext-button--tertiary[^>]*data-render-action="download"[^>]*><svg[^>]*aria-hidden="true"[^>]*><path[\s\S]*?Скачать результат/);
  assert.doesNotMatch(markup, /К моим примеркам|Скачать изображение/);
  assert.match(markup, /data-render-action="feedback"[^>]*data-value="liked"[^>]*>Удачный результат/);
  assert.match(markup, /data-render-action="feedback"[^>]*data-value="disliked"[^>]*>Нужна доработка/);
  assert.match(markup, /class="vnext-result-value">ZEEKR 007/);
  assert.match(markup, /class="vnext-result-value">X-Trike/);
  assert.match(markup, /class="vnext-result-detail">20″ \/ 9J \/ 5×112/);
  assert.match(markup, /class="vnext-result-value vnext-result-value--date">25 сентября, 14:32/);
  assert.doesNotMatch(markup, /class="vnext-result-aside"><p class="vnext-eyebrow">Виртуальная примерка/);
  assert.doesNotMatch(markup, /👍|👎/);
  const sparse = resultMarkup({ jobId: "B", status: "completed", resultUrl: "/result", originalUrl: "/original" });
  assert.doesNotMatch(sparse, /<h3>(?:Автомобиль|Колесный диск|Создано)<\/h3>|—/);
  const css = fs.readFileSync(new URL("../vnext/styles/render.css", import.meta.url), "utf8");
  const tokens = fs.readFileSync(new URL("../vnext/styles/tokens.css", import.meta.url), "utf8");
  assert.match(tokens, /--vnext-text-value:\s*#[0-9a-f]{6}/i);
  assert.match(css, /\.vnext-render p\.vnext-result-value\s*\{[^}]*color:var\(--vnext-text-value\)/);
  assert.match(css, /\.vnext-result-detail\s*\{[^}]*color:var\(--vnext-text-secondary\)/);
  assert.match(css, /\.vnext-result-meta h3\s*\{[^}]*color:var\(--vnext-text-subtle\)/);
  assert.match(css, /\.vnext-result-actions \.vnext-button--tertiary:hover[^{]*\{ color:var\(--vnext-text\)/);
  assert.match(css, /\.vnext-result-layout\s*\{[^}]*76fr[^}]*24fr[^}]*gap:24px/);
  assert.match(css, /\.vnext-rating\s*\{[^}]*width:min\(650px,100%\)/);
  assert.match(css, /\.vnext-rating-actions \.vnext-button\s*\{[^}]*min-height:40px/);
  assert.match(css, /\.vnext-compare-handle\s*\{[^}]*width:32px; height:32px/);
  assert.match(css, /\.vnext-shell__main:has\(\.vnext-render--result\)\s*\{ padding-inline:32px; \}/);
});

test("Generation Error uses available car/wheel context and preserves its existing primary action", () => {
  const markup = processingMarkup({ title: "ZEEKR 007", rimName: "X-Trike X-132", specs: "20″ / 9J / 5×112 / ET 0", carUrl: "/car.jpg", wheelUrl: "/wheel.jpg", error: { title: "Не удалось создать виртуальную примерку", copy: "Попробуйте ещё раз. Если ошибка повторится, обратитесь в поддержку.", actionLabel: "Повторить", showSupport: true } });
  assert.match(markup, /vnext-generation-error[^>]*role="status"/);
  assert.ok(markup.indexOf('class="vnext-generation-media"') < markup.indexOf('class="vnext-generation-aside"'));
  assert.match(markup, /Фото автомобиля[\s\S]*?Автомобиль[\s\S]*?ZEEKR 007[\s\S]*?Колесный диск[\s\S]*?vnext-generation-wheel-thumb[\s\S]*?Фото выбранного колесного диска[\s\S]*?X-Trike X-132[\s\S]*?20″ \/ 9J \/ 5×112 \/ ET 0/);
  assert.match(markup, /class="vnext-generation-value">ZEEKR 007/);
  assert.match(markup, /class="vnext-generation-value">X-Trike X-132/);
  assert.match(markup, /class="vnext-generation-specs">20″ \/ 9J \/ 5×112 \/ ET 0/);
  assert.match(markup, /Генерация[\s\S]*?Не удалось создать виртуальную примерку[\s\S]*?Попробуйте ещё раз\. Если ошибка повторится, обратитесь в поддержку\./);
  assert.match(markup, /class="vnext-button vnext-button--primary[^>]*data-render-action="generation-retry"[^>]*>Повторить/);
  assert.match(markup, /data-render-action="support"/);
  assert.doesNotMatch(markup, /vnext-system-card|vnext-system-mark|provider[_ -]?(?:error|failure)/i);
  const missingCar = processingMarkup({ title: "ZEEKR 007", error: { title: "Ошибка", copy: "Попробуйте ещё раз.", actionLabel: "Повторить" } });
  assert.match(missingCar, /vnext-generation-error--no-car/);
  assert.match(missingCar, /vnext-generation-error--no-car[\s\S]*?ZEEKR 007/);
  assert.doesNotMatch(missingCar, /<img|vnext-generation-wheel-thumb/);
  const missingWheel = processingMarkup({ title: "ZEEKR 007", carUrl: "/car.jpg", error: { title: "Ошибка", copy: "Попробуйте ещё раз.", actionLabel: "Повторить" } });
  assert.doesNotMatch(missingWheel, /<h3>Колесный диск<\/h3>|vnext-generation-wheel-thumb/);
  const noContext = processingMarkup({ error: { title: "Ошибка", copy: "Попробуйте ещё раз.", actionLabel: "Повторить" } });
  assert.match(noContext, /vnext-generation-error--no-car/);
  assert.doesNotMatch(noContext, /<img|vnext-generation-wheel-thumb/);
  const bootstrap = fs.readFileSync(new URL("../vnext/bootstrap.js", import.meta.url), "utf8");
  assert.match(bootstrap, /model\.error \? "Виртуальная примерка"/);
  assert.match(bootstrap, /if \(heading && heading\.textContent !== title\) heading\.textContent = title/);
  const css = fs.readFileSync(new URL("../vnext/styles/render.css", import.meta.url), "utf8");
  assert.match(css, /\.vnext-render p\.vnext-generation-value\s*\{[^}]*color:var\(--vnext-text-value\)/);
  assert.match(css, /\.vnext-generation-specs\s*\{[^}]*color:var\(--vnext-text-secondary\)/);
  assert.match(css, /\.vnext-generation-error\s*\{[^}]*grid-template-columns:minmax\(0,1\.6fr\) minmax\(300px,1fr\)/);
  assert.match(css, /\.vnext-generation-error--no-car\s*\{[^}]*grid-template-columns:minmax\(0,680px\)/);
  assert.match(css, /\.vnext-generation-media:empty\s*\{ display:none; \}/);
  assert.match(css, /\.vnext-generation-wheel-thumb\s*\{[^}]*width:80px/);
  assert.match(css, /@media\(max-width:680px\)\s*\{[\s\S]*?\.vnext-generation-error, \.vnext-generation-error--no-car\s*\{ grid-template-columns:minmax\(0,1fr\)/);
  assert.ok(markup.indexOf('class="vnext-generation-media"') < markup.indexOf('class="vnext-generation-aside"'));
});

test("History rows share inset and thumbnail grid at mobile widths", () => {
  const markup = historyMarkup({ rows: [{ jobId: "A", status: "completed", title: "ZEEKR 007", rimName: "X-Trike", specs: "20″ / 9J / 5×112", dateLabel: "25 сентября", createdLabel: "25 сентября, 14:32", statusLabel: "Готово" }] });
  assert.match(markup, /<h3>ZEEKR 007<\/h3>[\s\S]*?<p>X-Trike \/ 20″ \/ 9J \/ 5×112 \/ 25 сентября, 14:32<\/p>[\s\S]*?<span class="vnext-status vnext-status--positive">Готово<\/span>/);
  const css = fs.readFileSync(new URL("../vnext/styles/render.css", import.meta.url), "utf8");
  assert.match(css, /\.vnext-history-row h3\s*\{[^}]*color:var\(--vnext-text-value\)/);
  assert.match(css, /\.vnext-history-date\s*\{[^}]*color:var\(--vnext-text-secondary\)/);
  assert.match(css, /\.vnext-history-row\s*\{[^}]*padding:16px/);
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /\.vnext-history-row\s*\{[^}]*grid-template-columns:88px minmax\(0,1fr\); gap:14px; align-items:start; padding:16px/);
  assert.match(css, /\.vnext-history-actions\s*\{[^}]*grid-column:2/);
});

test("Processing preserves status hierarchy while separating selected wheel identity from specs", () => {
  const markup = processingMarkup({ status: "processing", title: "ZEEKR 007", rimName: "X-Trike X-132", specs: "20″ / 9J / 5×112 / ET 0", carUrl: "/car.jpg", wheelUrl: "/wheel.jpg" });
  assert.match(markup, /<h2>Создаём виртуальную примерку<\/h2>/);
  assert.match(markup, /<strong>Создаём примерку\.\.\.<\/strong>/);
  assert.match(markup, /class="vnext-render-object">ZEEKR 007/);
  assert.match(markup, /class="vnext-processing-wheel-name">X-Trike X-132/);
  assert.match(markup, /class="vnext-processing-wheel-specs">20″ \/ 9J \/ 5×112 \/ ET 0/);
  const css = fs.readFileSync(new URL("../vnext/styles/render.css", import.meta.url), "utf8");
  assert.match(css, /\.vnext-render-object\s*\{[^}]*color:var\(--vnext-text-value\)/);
  assert.match(css, /\.vnext-processing-aside p\.vnext-processing-wheel-name\s*\{[^}]*color:var\(--vnext-text-value\)/);
  assert.match(css, /\.vnext-processing-aside p\.vnext-processing-wheel-specs\s*\{[^}]*color:var\(--vnext-text-secondary\)/);
});

for (const result of [{ result_url: "/result" }, { output_image_url: "/result" }, { assets: { result: { url: "/result" } } }]) test(`existing polling transitions queued → processing → Result (${Object.keys(result)[0]})`, async () => {
  const app = runtime(); app.ready();
  const observed = []; const calls = []; let poll = 0; let opened;
  app.observe((status) => observed.push(status));
  app.setHistory(async () => {});
  app.setOpenDetail((id) => { opened = id; });
  app.setFetch(async (path, options) => {
    calls.push({path, options});
    return {ok: true, json: async () => options?.method === "POST" ? {job_id: "A", status: "queued"} : ++poll === 1 ? {status: "processing"} : {status: "completed", ...result}};
  });
  await app.submitJob(); await Promise.resolve();
  assert.equal(calls.filter((call) => call.options?.method === "POST").length, 1);
  assert.equal(calls.filter((call) => call.path === "/jobs/A").length, 2);
  assert.deepEqual([...new Set(observed)], ["queued", "processing", "completed"]);
  assert.equal(app.state.resultUrl, "/result");
  assert.equal(app.state.jobId, "A");
  assert.equal(opened, "A");
});

test("failed render stays a generation failure, and navigation away is not hijacked by completion", async () => {
  const app = runtime(); app.ready(); app.setHistory(async () => {});
  app.setFetch(async (_, options) => ({ok: true, json: async () => options?.method === "POST" ? {job_id: "A"} : {status: "failed", error_code: "provider_failure"}}));
  await app.submitJob();
  assert.equal(app.state.renderStatus, "failed");
  assert.equal(app.state.submitting, false);
  const other = runtime(); other.ready(); other.setHistory(async () => {});
  let opened = false;
  other.setOpenDetail(() => {opened = true;});
  other.setFetch(async (_, options) => {
    if (!options?.method) other.state.view = "renders";
    return {ok: true, json: async () => options?.method === "POST" ? {job_id: "A"} : {status: "completed", result_url: "/a"}};
  });
  await other.submitJob(); await Promise.resolve();
  assert.equal(opened, false);
  assert.equal(other.state.view, "renders");
});

test("late completed render cannot overwrite a new Create context", async () => {
  const app = runtime(); app.ready(); let resolveStatus;
  app.setFetch(async (_, options) => options?.method === "POST" ? {ok: true, json: async () => ({job_id: "A"})} : new Promise((resolve) => {resolveStatus = resolve;}));
  const pending = app.submitJob();
  while (!resolveStatus) await Promise.resolve();
  app.state.jobId = "B"; app.state.identityDraftId = "draft-B"; app.state.resultUrl = "/B";
  resolveStatus({ok: true, json: async () => ({status: "completed", result_url: "/A"})});
  await pending;
  assert.equal(app.state.jobId, "B"); assert.equal(app.state.resultUrl, "/B");
});

test("error categories retain existing runtime classification", () => {
  const app = runtime();
  assert.equal(app.classifyGenerationError("insufficient credits").action, "wallet");
  assert.equal(app.classifyGenerationError("queue unavailable").action, "retry");
  assert.equal(app.classifyGenerationError("provider_failure").action, "retry");
  assert.equal(app.classifyGenerationError("401 unauthorized").action, "retry");
});

test("history follows server order and immutable snapshot, not current draft/vehicle corrections", () => {
  const app = runtime();
  const older = { ...job("A"), vehicle_identity: { make: "Wrong", model: "Current", is_user_confirmed: true } };
  app.state.renderHistory = [job("B"), older];
  app.state.identityProposal = { vehicle: { primary: { make: "Other", model: "Draft" } }, rim: { brand: "Other" } };
  const snapshot = app.bridge.snapshot("history");
  assert.deepEqual(Array.from(snapshot.rows, (row) => row.jobId), ["B", "A"]);
  assert.equal(snapshot.rows[1].title, "Zeekr A");
  assert.equal(snapshot.rows[1].rimName, "RZ XL6002");
  assert.match(snapshot.rows[1].specs, /ET 0/);
  assert.doesNotMatch(snapshot.rows[1].specs, /DIA|J|PCD/);
});

test("historical detail and Fitment do not overwrite current Create job", () => {
  const app = runtime();
  app.state.jobId = "B";
  app.state.createJobDraftId = "draft-B";
  app.state.renderHistory = [job("A"), job("B")];
  app.openRenderDetail("A");
  assert.equal(app.state.jobId, "B");
  assert.equal(app.state.createJobDraftId, "draft-B");
  let received;
  app.setFitment((id) => { received = id; });
  app.bridge.action("fitment", "A");
  assert.equal(received, "A");
  assert.equal(app.state.jobId, "B");
  assert.equal(app.bridge.snapshot("current-result").jobId, "B");
});

test("history failure/retry and late history refresh retain the active screen", async () => {
  const app = runtime();
  app.setHistoryFetch(async () => {throw new Error("network");});
  await app.loadRenderHistory();
  assert.equal(app.bridge.snapshot("history").error, "network");
  let respond;
  app.setHistoryFetch(() => new Promise(resolve => {respond = resolve;}));
  app.state.view = "renders";
  const pending = app.loadRenderHistory();
  app.state.view = "create";
  respond({jobs:[job("A")]}); await pending;
  assert.equal(app.state.view, "create");
  assert.equal(app.bridge.snapshot("history").error, "");
  assert.equal(app.bridge.snapshot("history").rows[0].jobId, "A");
});

test("one failed thumbnail cannot affect another row; protected retry recovers the failed asset", async () => {
  const app = runtime(); app.state.renderHistory=[job("A"),job("B")];
  app.bridge.assetError("A", "result");
  assert.equal(app.bridge.snapshot("history").rows[0].thumbnailFailed, true);
  assert.equal(app.bridge.snapshot("history").rows[1].thumbnailFailed, false);
  app.setObjectURL(() => "blob:recovered");
  app.setFetch(async () => ({ok:true,blob:async()=>new Blob(["image"])}));
  app.bridge.action("asset-retry", "A");
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(app.bridge.snapshot("history").rows[0].thumbnailUrl, "blob:recovered");
  assert.equal(app.bridge.snapshot("history").rows[0].thumbnailFailed, false);
});

test("late detail A cannot replace B or clear B loading/error", async () => {
  const app = runtime();
  let resolveA;
  app.setFetch((path) => path.endsWith("A") ? new Promise((resolve) => { resolveA = resolve; }) : Promise.resolve({ ok: true, json: async () => job("B") }));
  app.state.renderDetailJobId = "A";
  const pending = app.loadRenderDetailJob("A");
  app.state.renderDetailJobId = "B";
  await app.loadRenderDetailJob("B");
  resolveA({ ok: true, json: async () => job("A") });
  await pending;
  assert.equal(app.bridge.snapshot("result").jobId, "B");
  assert.equal(app.bridge.snapshot("result").title, "Zeekr B");
});

test("positive/negative feedback persists on correct job and guards duplicate submissions", async () => {
  const app = runtime();
  app.state.renderHistory = [job("A"), job("B")];
  let complete; const calls = [];
  app.setFetch((path, options) => { calls.push([path, JSON.parse(options.body)]); return new Promise((resolve) => { complete = resolve; }); });
  const pending = app.submitHistoryFeedback("A", "liked");
  await app.submitHistoryFeedback("A", "liked");
  assert.equal(calls.length, 1);
  assert.equal(app.state.feedbackBusyByJob.A, true);
  complete({ ok: true, json: async () => ({ feedback: { sentiment: "liked" } }) });
  await pending;
  app.state.renderDetailJobId = "A";
  assert.equal(app.bridge.snapshot("result").feedback.sentiment, "liked");
  assert.equal(app.state.renderHistory[1].feedback, undefined);
  app.setFetch(async (path, options) => ({ ok: true, json: async () => ({ feedback: JSON.parse(options.body) }) }));
  await app.submitHistoryFeedback("A", "disliked", "wheel_differs");
  assert.equal(app.bridge.snapshot("result").feedback.reason, "wheel_differs");
  assert.equal(app.state.renderHistory[0].status, "completed");
});

test("feedback failure rolls back, exposes retry, and preserves completed status", async () => {
  const app = runtime(); app.state.renderHistory = [job("A")]; app.state.renderDetailJobId = "A";
  app.setFetch(async () => { throw new Error("network failed"); });
  await app.submitHistoryFeedback("A", "disliked", "other");
  assert.equal(app.bridge.snapshot("result").feedback.sentiment, "");
  assert.ok(app.bridge.snapshot("result").feedback.error);
  assert.equal(app.state.renderHistory[0].status, "completed");
  app.setFetch(async (_, options) => ({ ok: true, json: async () => ({ feedback: JSON.parse(options.body) }) }));
  app.bridge.action("feedback-retry", "A");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(app.bridge.snapshot("result").feedback.reason, "other");
});

test("server feedback is visible without transient browser map", () => {
  const app = runtime(); app.state.renderHistory = [{ ...job("A"), feedback: { sentiment: "disliked", reason: "other" } }]; app.state.renderDetailJobId = "A";
  assert.equal(app.bridge.snapshot("result").feedback.reason, "other");
  assert.equal(app.bridge.snapshot("result").feedback.error, "");
});

test("protected result download retains Authorization fetch+blob; original signing failure does not change job", async () => {
  const app = runtime(); const owned = { ...job("A"), result_url: "" }; app.state.renderHistory = [owned];
  const calls = []; app.setObjectURL(() => "blob:private");
  app.setFetch(async (url, options) => { calls.push({ url, options }); return { ok: true, blob: async () => new Blob(["image"]) }; });
  assert.equal(await app.ensureAssetBlobUrl(owned, "result"), "blob:private");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
  app.setFetch(async () => { throw new Error("404"); });
  await app.ensureAssetBlobUrl(owned, "original");
  assert.equal(app.state.renderAssetErrorsByJob.A.car_original, true);
  assert.equal(owned.status, "completed");
});

test("historical download uses owned job route without changing current render context", async () => {
  const app = runtime(); app.website(); app.state.jobId = "B"; app.state.resultDownloadUrl = "/jobs/B/download"; app.state.renderHistory = [job("A")];
  app.setObjectURL(() => "blob:download"); let request;
  app.setFetch(async (url, options) => { request = { url, options }; return { ok: true, blob: async () => new Blob(["image"]) }; });
  await app.downloadResult({ jobId: "A" });
  assert.equal(request.url, "/jobs/A/download");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(app.state.jobId, "B");
  assert.equal(app.state.resultDownloadUrl, "/jobs/B/download");
});

test("missing historical job never falls back to current-job download", async () => {
  const app=runtime(); app.website(); app.state.jobId="B"; app.state.resultDownloadUrl="/jobs/B/download";
  let called=false; app.setFetch(async()=>{called=true;});
  await app.downloadResult({jobId:"gone"});
  assert.equal(called,false); assert.equal(app.state.jobId,"B");
});

test("protected original succeeds; asset auth/network errors remain asset errors, not render failure", async () => {
  const app=runtime(); const owned=job("A"); app.state.renderHistory=[owned];
  app.setObjectURL(()=>{throw new Error("Original must not create Blob URLs");});
  const signed="https://project.supabase.co/storage/v1/object/sign/raw/original.jpg?token=fixture-only";
  app.setFetch(async()=>({ok:true,json:async()=>({kind:"car_original",url:signed,expires_at:new Date(Date.now()+600_000).toISOString()})}));
  assert.equal(await app.ensureAssetBlobUrl(owned,"original"),signed);
  for(const message of ["401 unauthorized","network failed"]){
    app.setFetch(async()=>{throw new Error(message);});
    await app.ensureAssetBlobUrl(owned,"result");
    assert.equal(owned.status,"completed");
    assert.equal(app.state.renderAssetErrorsByJob.A.result,true);
  }
});

for (const failure of ["401", "404", "network"]) test(`download ${failure} is recoverable without changing completed status`, async () => {
  const app = runtime(); app.website(); app.state.renderHistory = [job("A")];
  app.setFetch(async () => { throw new Error(failure); });
  await app.downloadResult({ jobId: "A" });
  assert.equal(app.state.downloading, false);
  assert.match(app.state.downloadNoticeByJob.A, /Не удалось/);
  assert.equal(app.state.renderHistory[0].status, "completed");
});

test("pure presentation covers real statuses, empty/error, feedback and unavailable media without API/polling", () => {
  for (const status of ["queued", "processing"]) assert.match(processingMarkup({ status }), /Создаём виртуальную примерку/);
  assert.match(processingMarkup({ error: { title: "Недостаточно рендеров", actionLabel: "Пополнить счёт" } }), /Недостаточно рендеров/);
  assert.match(resultMarkup({ jobId: "A", status: "completed", resultUrl: "/result", originalUrl: "/original", feedback: { sentiment: "disliked", error: "failure" } }), /vnext-compare-range/);
  assert.match(resultMarkup({ jobId: "A", status: "completed", resultFailed: true }), /Изображение временно недоступно/);
  assert.match(historyMarkup({ rows: [] }), /Готовых рендеров пока нет/);
  assert.match(historyMarkup({ error: "network" }), /Повторить/);
  for (const status of ["completed", "processing", "queued", "failed"]) {
    const markup = historyMarkup({ rows: [{ jobId: "A", status, title: "Zeekr" }] });
    assert.equal(markup.includes('data-render-action="open"'), status === "completed");
    assert.equal(markup.includes('data-render-action="retry-create"'), status === "failed");
  }
  const viewSource = fs.readFileSync(new URL("../vnext/views/render.js", import.meta.url), "utf8");
  assert.doesNotMatch(viewSource, /fetch\(|setInterval\(|setTimeout\(/);
  assert.doesNotMatch(viewSource, /result_url|identityProposal/);
});


for (const display of [true,false]) test(`signed source selects ${display ? "display" : "historical original"}, direct img and one request`, async () => {
 const app=runtime(); app.setAuth(true); const owned=job("A");
 if(display) owned.assets.car_display={id:"display"};
 app.state.renderHistory=[owned]; app.state.renderDetailJobId="A";
 const kind=display ? "car_display" : "car_original";
 const signed=`https://project.supabase.co/storage/v1/object/sign/raw/${kind}.webp?token=fixture-only`;
 let calls=0;
 app.setObjectURL(()=>{throw new Error("No Blob URLs");});
 app.setFetch(async(url,options)=>{calls++; assert.equal(url,`/jobs/A/assets/${kind}/signed-url`); assert.equal(options.headers.Authorization,"Bearer test-token"); return {ok:true,blob:()=>{throw new Error("No Blob body");},json:async()=>({kind,url:signed,expires_at:new Date(Date.now()+600_000).toISOString()})};});
 const [url]=await Promise.all([app.ensureOriginalDisplayUrl(owned),app.ensureOriginalDisplayUrl(owned)]);
 assert.equal(url,signed);
 assert.equal(await app.ensureOriginalDisplayUrl(owned),signed);
 assert.equal(calls,1);
 assert.match(resultMarkup(app.bridge.snapshot("result")),/src="https:\/\/project.supabase.co\/storage\/v1\/object\/sign/);
 assert.equal(app.bridge.snapshot("result").resultUrl,"/result-A.jpg");
});

test("near expiry refreshes signing metadata before using URL", async()=>{
 const app=runtime(); app.setAuth(true); const owned=job("A"); let calls=0;
 app.setFetch(async()=>({ok:true,json:async()=>({kind:"car_original",url:`https://project.supabase.co/storage/v1/object/sign/raw/original.webp?token=fixture-${++calls}`,expires_at:new Date(Date.now()+600_000).toISOString()})}));
 await app.ensureOriginalDisplayUrl(owned);
 app.state.renderAssetSignedUrlsByJob.A.expiresAt=Date.now()+59_000;
 assert.equal(app.originalSignedUrlForJob(owned),"");
 await app.ensureOriginalDisplayUrl(owned); assert.equal(calls,2);
});

test("source image error refreshes only once and then becomes unavailable",async()=>{
 const app=runtime(); app.setAuth(true); const owned=job("A");app.state.renderHistory=[owned]; let calls=0;
 app.setFetch(async()=>({ok:true,json:async()=>({kind:"car_original",url:`https://project.supabase.co/storage/v1/object/sign/raw/original.webp?token=fixture-${++calls}`,expires_at:new Date(Date.now()+600_000).toISOString()})}));
 await app.ensureOriginalDisplayUrl(owned);
 app.bridge.assetError("A","original"); await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(calls,2);assert.equal(app.state.renderAssetErrorsByJob.A.car_original,false);
 app.bridge.assetError("A","original"); await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(calls,2);assert.equal(app.state.renderAssetErrorsByJob.A.car_original,true);
});

test("unauthenticated viewer never signs and ignores cached signed URLs",async()=>{
 const app=runtime();app.setAuth(false);let called=false;app.setFetch(async()=>{called=true;});
 assert.equal(await app.ensureOriginalDisplayUrl(job("A")),"");assert.equal(called,false);
});


test("in-flight signing response is discarded after auth identity changes",async()=>{
 const app=runtime();app.setAuth(true);let resolve;
 app.setFetch(()=>new Promise(r=>{resolve=r;}));
 const pending=app.ensureOriginalDisplayUrl(job("A"));
 app.setAuthIdentity("different-user-token");
 resolve({ok:true,json:async()=>({kind:"car_original",url:"https://project.supabase.co/storage/v1/object/sign/raw/original.webp?token=fixture-only",expires_at:new Date(Date.now()+600_000).toISOString()})});
 assert.equal(await pending,"");assert.equal(app.state.renderAssetSignedUrlsByJob.A,undefined);
});
