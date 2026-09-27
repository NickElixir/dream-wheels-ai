import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { historyMarkup, processingMarkup, resultMarkup } from "../vnext/views/render.js";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8").replace(/^import \{[\s\S]*?\} from "\.\/app-route\.mjs";\n\n/u, "");
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

test("desktop Result groups comparison with compact available context and actions", () => {
  const markup = resultMarkup({ jobId: "A", status: "completed", title: "ZEEKR 007", rimName: "X-Trike", specs: "20″ / 9J / 5×112", createdLabel: "25 сентября, 14:32", resultUrl: "/result", originalUrl: "/original", canFitment: true, canDownload: true });
  assert.ok(markup.indexOf('class="vnext-compare"') < markup.indexOf('class="vnext-result-aside"'));
  assert.match(markup, /Автомобиль[\s\S]*?ZEEKR 007[\s\S]*?Диск[\s\S]*?X-Trike[\s\S]*?20″ \/ 9J \/ 5×112[\s\S]*?Создано[\s\S]*?25 сентября, 14:32/);
  assert.ok(markup.indexOf('aria-label="Оценка результата"') > markup.indexOf('class="vnext-result-layout"'));
  assert.match(markup, /Создать ещё вариант[\s\S]*?Проверить совместимость[\s\S]*?Скачать изображение[\s\S]*?К моим примеркам/);
  const sparse = resultMarkup({ jobId: "B", status: "completed", resultUrl: "/result", originalUrl: "/original" });
  assert.doesNotMatch(sparse, /<h3>(?:Автомобиль|Диск|Создано)<\/h3>|—/);
});

test("Generation Error uses available car/wheel context and preserves its existing primary action", () => {
  const markup = processingMarkup({ carUrl: "/car.jpg", wheelUrl: "/wheel.jpg", error: { title: "Не удалось создать виртуальную примерку", copy: "Попробуйте ещё раз. Если ошибка повторится, обратитесь в поддержку.", actionLabel: "Повторить", showSupport: true } });
  assert.match(markup, /vnext-generation-error/);
  assert.match(markup, /Фото автомобиля[\s\S]*?Фото колесного диска/);
  assert.match(markup, /class="vnext-button vnext-button--primary[^>]*data-render-action="generation-retry"[^>]*>Повторить/);
  assert.match(markup, /data-render-action="support"/);
  assert.doesNotMatch(markup, /vnext-system-card|vnext-system-mark|provider[_ -]?(?:error|failure)/i);
  const noMedia = processingMarkup({ error: { title: "Ошибка", copy: "Попробуйте ещё раз.", actionLabel: "Повторить" } });
  assert.match(noMedia, /vnext-generation-error--empty/);
  assert.doesNotMatch(noMedia, /vnext-render-media/);
  const bootstrap = fs.readFileSync(new URL("../vnext/bootstrap.js", import.meta.url), "utf8");
  assert.match(bootstrap, /model\.error \? "Виртуальная примерка"/);
  assert.match(bootstrap, /if \(heading && heading\.textContent !== title\) heading\.textContent = title/);
  const css = fs.readFileSync(new URL("../vnext/styles/render.css", import.meta.url), "utf8");
  assert.match(css, /\.vnext-generation-error\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.vnext-generation-context\s*\{[^}]*width:min\(720px,100%\)/);
  assert.match(css, /\.vnext-generation-copy\s*\{[^}]*margin-top:24px/);
  assert.match(css, /\.vnext-generation-copy\s*\{ margin-top:0; \}/);
});

test("History rows share inset and thumbnail grid at mobile widths", () => {
  const css = fs.readFileSync(new URL("../vnext/styles/render.css", import.meta.url), "utf8");
  assert.match(css, /\.vnext-history-row\s*\{[^}]*padding:16px/);
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /\.vnext-history-row\s*\{[^}]*grid-template-columns:88px minmax\(0,1fr\); gap:14px; align-items:start; padding:16px/);
  assert.match(css, /\.vnext-history-actions\s*\{[^}]*grid-column:2/);
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

test("protected result and original use Authorization fetch+blob; failure does not change job", async () => {
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
  app.setObjectURL(()=>"blob:original");
  app.setFetch(async()=>({ok:true,blob:async()=>new Blob(["image"])}));
  assert.equal(await app.ensureAssetBlobUrl(owned,"original"),"blob:original");
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
