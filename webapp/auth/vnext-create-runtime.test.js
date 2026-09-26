import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8").replace(/^import \{[\s\S]*?\} from "\.\/app-route\.mjs";\n\n/u, "");

function runtime() {
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const revoked = [];
  let asset = 0;
  class AssetURL extends URL {
    static createObjectURL() { return `blob:asset-${++asset}`; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const context = {
    URL: AssetURL, URLSearchParams, Blob, FormData, console: { log() {}, warn() {}, error() {} },
    document: { documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    window: { Telegram: {}, location: { search: "" }, dispatchEvent() {} },
    localStorage: storage, sessionStorage: storage, navigator: { language: "ru-RU", userAgent: "test" },
    setTimeout, clearTimeout, requestAnimationFrame: (callback) => callback(),
  };
  vm.runInNewContext(`
const applicationRouteContext = () => null;
const isApplicationRoute = () => false;
const safeApplicationReturnPath = () => null;
${source}
renderIdentityFlow = () => {};
refreshButtonsForCurrentView = () => {};
notifyCreateBridge = () => {};
haptic = () => {};
trackEvent = async () => {};
saveDraftFile = async () => {};
sleep = async () => {};
loadRenderHistory = async () => {};
openRenderDetail = () => {};
withAuthHeaders = () => ({ Authorization: 'Bearer test-token' });
getIdentityPayload = () => ({ init_data: 'test-init-data' });
apiUrl = (path) => path;
globalThis.api = { state, bridge: window.dreamwheelsCreateBridge, resolveIdentity, handleFileSelected, submitJob,
  setFetch: (fetcher) => { authenticatedFetch = fetcher; },
  setRender: (render) => { submitJob = render; },
  setFitment: (fitment) => { openFitmentView = fitment; }
};`, context);
  return { ...context.api, revoked };
}

function resolvedRuntime() {
  const app = runtime();
  app.state.identityDraftId = "draft";
  app.state.identityProposal = { vehicle: { primary: { make: "Audi", model: "Q8" }, alternatives: [] }, rim: { revision: 1 }, rimAssetId: "old-rim" };
  app.bridge.chooseVehicle(0);
  app.state.files.car = { blob: new Blob(["car"]), name: "car.jpg" };
  app.state.files.wheel = { blob: new Blob(["old wheel"]), name: "wheel.jpg" };
  app.state.previewUrls = { car: "blob:car", wheel: "blob:old-wheel" };
  app.state.jobId = "old-job";
  app.state.createJobDraftId = "draft";
  app.state.resultUrl = "/old-result.jpg";
  return app;
}

const refreshed = (url, rim = {}) => ({ draft_id: "draft", rim_asset_id: "new-rim", rim: { status: "resolved", revision: 2, product_url: url, brand: "BBS", offset_et_mm: 0, variant_state: "none", ...rim } });
const imageResponse = () => ({ ok: true, blob: async () => new Blob(["parsed image"], { type: "image/png" }) });

test("wheel URL refresh sends only draft and URL, preserves corrected vehicle, loads private image and invalidates current render", async () => {
  const app = resolvedRuntime();
  app.bridge.setManualVehicleMode(true);
  app.bridge.saveManualVehicle({ make: "Audi", model: "Q7", year: "2022" });
  const originalVehicle = app.state.identityProposal.vehicle;
  const carFile = app.state.files.car;
  const requests = [];
  app.setFetch(async (path, options) => {
    requests.push(path);
    assert.equal(options.headers.Authorization, "Bearer test-token");
    if (path !== "/identity/resolve") return imageResponse();
    assert.equal(options.body.get("draft_id"), "draft");
    assert.equal(options.body.get("rim_product_url"), "https://shop.example/new");
    assert.equal(options.body.has("car_image"), false);
    assert.equal(options.body.has("wheel_image"), false);
    assert.equal(JSON.parse(options.body.get("vehicle")).model, "Q7");
    assert.equal(options.body.get("vehicle_user_confirmed"), "true");
    return { ok: true, json: async () => refreshed("https://shop.example/new") };
  });
  await app.bridge.saveRimProductUrl("https://shop.example/new");
  assert.deepEqual(requests, ["/identity/resolve", "/identity/drafts/draft/assets/new-rim"]);
  assert.equal(app.state.identityProposal.vehicle, originalVehicle);
  assert.equal(app.state.files.car, carFile);
  assert.equal(app.bridge.snapshot().selectedVehicle.model, "Q7");
  assert.equal(app.state.rimSourceStatus, "success");
  assert.equal(app.state.rimSourceResolving, false);
  assert.equal(app.state.rimAssetPreviewPending, false);
  assert.equal(app.state.identityProposal.rim.offset_et_mm, 0);
  assert.equal(app.state.identityProposal.rim.center_bore_mm, undefined);
  assert.equal(app.state.previewUrls.car, "blob:car");
  assert.deepEqual(app.revoked, ["blob:old-wheel"]);
  assert.equal(app.bridge.snapshot().fitmentJobId, "");
  assert.equal(app.state.resultUrl, "/old-result.jpg", "previous result remains immutable");
});

test("provider failure keeps previous wheel and draft usable; another URL retries explicitly", async () => {
  const app = resolvedRuntime();
  const oldRim = app.state.identityProposal.rim;
  const oldWheel = app.state.files.wheel;
  let calls = 0;
  app.setFetch(async (path) => {
    if (path !== "/identity/resolve") return imageResponse();
    calls++;
    return calls === 1
      ? { ok: false, status: 502, json: async () => ({ detail: { error_code: "rim_source_fetch_failed", retryable: true, manual_fallback: true } }) }
      : { ok: true, json: async () => refreshed("https://shop.example/retry") };
  });
  await app.bridge.saveRimProductUrl("https://shop.example/fails");
  assert.equal(app.state.identityProposal.rim, oldRim);
  assert.equal(app.state.files.wheel, oldWheel);
  assert.equal(app.bridge.snapshot().fitmentJobId, "old-job");
  assert.equal(app.state.rimSourceError.manualFallback, true);
  assert.equal(app.state.rimSourceResolving, false);
  assert.equal(calls, 1);
  await app.bridge.saveRimProductUrl("https://shop.example/retry");
  assert.equal(calls, 2);
  assert.equal(app.state.rimSourceStatus, "success");
});

test("image download retry never re-runs a committed URL resolution", async () => {
  const app = resolvedRuntime();
  let resolves = 0;
  let downloads = 0;
  app.setFetch(async (path) => {
    if (path === "/identity/resolve") {
      resolves++;
      return { ok: true, json: async () => refreshed("https://shop.example/new") };
    }
    downloads++;
    return downloads === 1 ? { ok: false } : imageResponse();
  });
  await app.bridge.saveRimProductUrl("https://shop.example/new");
  assert.equal(app.state.rimAssetPreviewPending, true);
  assert.equal(app.state.rimSourceStatus, "error");
  await app.bridge.retryRimSource();
  assert.equal(resolves, 1);
  assert.equal(downloads, 2);
  assert.equal(app.state.rimAssetPreviewPending, false);
});

test("revision conflict restores server rim without silently retrying or overwriting vehicle", async () => {
  const app = resolvedRuntime();
  const vehicle = app.state.identityProposal.vehicle;
  let resolves = 0;
  app.setFetch(async (path) => {
    if (path !== "/identity/resolve") return imageResponse();
    resolves++;
    return { ok: false, status: 409, json: async () => ({ detail: { error_code: "identity_draft_rim_revision_conflict", retryable: true, current_draft: refreshed("https://shop.example/current", { revision: 3 }) } }) };
  });
  await app.bridge.saveRimProductUrl("https://shop.example/race");
  assert.equal(resolves, 1);
  assert.equal(app.state.identityProposal.rim.revision, 3);
  assert.equal(app.state.rimProductUrl, "https://shop.example/current");
  assert.equal(app.state.identityProposal.vehicle, vehicle);
  assert.equal(app.state.rimSourceError.code, "identity_draft_rim_revision_conflict");
  assert.equal(app.bridge.snapshot().fitmentJobId, "");
});

test("unavailable draft and expired auth surface recovery; URL flow never starts render", async () => {
  for (const [status, code] of [[404, "identity_draft_unavailable"], [401, "identity_auth_required"]]) {
    const app = resolvedRuntime();
    app.setFetch(async () => ({ ok: false, status, json: async () => ({ detail: { error_code: code } }) }));
    await app.bridge.saveRimProductUrl("https://shop.example/new");
    assert.equal(app.state.rimSourceError.code, code);
    assert.equal(app.state.rimSourceResolving, false);
    assert.equal(app.state.files.car.name, "car.jpg");
    if (status === 404) assert.equal(app.state.identityDraftId, "");
    else assert.equal(app.state.rimSourceError.auth, true);
  }
});

test("manual wheel fallback preserves car and selected correction; replacing car resets correction", async () => {
  for (const kind of ["wheel", "car"]) {
    const app = resolvedRuntime();
    app.bridge.setManualVehicleMode(true);
    app.bridge.saveManualVehicle({ make: "Audi", model: "Q7", year: "2022" });
    const car = app.state.files.car;
    app.handleFileSelected(kind, { name: "manual.png", size: 3, type: "image/png", arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    await Promise.resolve();
    await Promise.resolve();
    if (kind === "wheel") {
      assert.equal(app.state.files.car, car);
      assert.equal(app.bridge.snapshot().selectedVehicle.model, "Q7");
      assert.equal(app.state.rimProductUrl, "");
    } else assert.equal(app.bridge.snapshot().selectedVehicle, null);
  }
});

test("duplicate clicks and obsolete URL responses never replace a newly selected manual wheel", async () => {
  const app = resolvedRuntime();
  let finish;
  let calls = 0;
  app.setFetch(() => { calls++; return new Promise((resolve) => { finish = resolve; }); });
  const pending = app.bridge.saveRimProductUrl("https://shop.example/slow");
  await app.bridge.saveRimProductUrl("https://shop.example/duplicate");
  assert.equal(calls, 1);
  app.handleFileSelected("wheel", { name: "manual.png", size: 3, type: "image/png", arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
  await Promise.resolve();
  finish({ ok: true, json: async () => refreshed("https://shop.example/slow") });
  await pending;
  assert.equal(app.state.files.wheel.name, "manual.png");
  assert.equal(app.state.identityDraftId, "");
  assert.equal(app.state.rimSourceStatus, "idle");
});

test("full identity sends both files and auth, releases loading after failure, and retries the same flow", async () => {
  const app = runtime();
  app.state.photoConsentAccepted = true;
  app.state.files.car = { blob: new Blob(["car"]), name: "car.jpg" };
  app.state.files.wheel = { blob: new Blob(["wheel"]), name: "wheel.png" };
  app.state.rimProductUrl = "https://example.com/wheel";
  let attempts = 0;
  app.setFetch(async (path, options) => {
    assert.equal(path, "/identity/resolve");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(options.body.get("car_image").name, "car.jpg");
    assert.equal(options.body.get("wheel_image").name, "wheel.png");
    assert.equal(options.body.get("rim_product_url"), app.state.rimProductUrl);
    assert.equal(options.body.get("init_data"), "test-init-data");
    assert.equal(options.body.has("draft_id"), false);
    attempts++;
    return attempts === 1
      ? { ok: false, status: 503, json: async () => ({ detail: "provider unavailable" }) }
      : { ok: true, json: async () => ({ draft_id: "draft", vehicle: { primary: { make: "Audi", model: "Q8" }, alternatives: [] }, rim: {} }) };
  });
  await app.bridge.resolveIdentity();
  assert.equal(app.state.identityResolving, false);
  assert.ok(app.state.identityError);
  await app.bridge.resolveIdentity();
  assert.equal(attempts, 2);
  assert.equal(app.state.identityResolving, false);
  assert.equal(app.state.identityError, "");
  assert.equal(app.state.identityDraftId, "draft");
  assert.equal(app.bridge.snapshot().selectedVehicle, null, "recognition needs explicit confirmation");
  app.bridge.chooseVehicle(0);
  assert.equal(app.bridge.snapshot().selectedVehicle.make, "Audi");
  app.bridge.setManualVehicleMode(true);
  app.bridge.cancelVehicleEditing();
  assert.equal(app.bridge.snapshot().selectedVehicle.source, undefined, "cancel retains the recognized candidate");
  app.bridge.setManualVehicleMode(true);
  app.bridge.saveManualVehicle({ make: "Audi", model: "Q7", year: "2022" });
  assert.equal(app.bridge.snapshot().selectedVehicle.model, "Q7");
  assert.equal(app.state.identityProposal.vehicle.primary.model, "Q8", "correction never overwrites recognition");
  assert.equal(app.bridge.snapshot().vehicleEditing, false);
});

test("failed repeat render cannot use an older result to enable Fitment", async () => {
  const app = runtime();
  app.state.identityDraftId = "draft";
  app.state.identityProposal = { vehicle: { primary: { make: "Audi", model: "Q8" }, alternatives: [] }, rim: {} };
  app.bridge.chooseVehicle(0);
  app.state.jobId = "old-job";
  app.state.createJobDraftId = "draft";
  app.state.resultUrl = "/old-result.jpg";
  let creates = 0;
  app.setFetch(async (path, options) => {
    if (path === "/jobs/from-assets") {
      const payload = JSON.parse(options.body);
      assert.equal(payload.draft_id, "draft");
      assert.equal(payload.vehicle_user_confirmed, true);
      assert.equal(payload.vehicle.model, "Q8");
      creates++;
      return { ok: true, json: async () => ({ job_id: "new-job" }) };
    }
    assert.equal(path, "/jobs/new-job");
    return { ok: true, json: async () => ({ status: "failed", error: "provider unavailable" }) };
  });
  await app.submitJob();
  assert.equal(creates, 1);
  assert.equal(app.state.submitting, false);
  assert.equal(app.bridge.snapshot().fitmentJobId, "");
});

test("replace either file revokes only its preview, invalidates identity and never starts render or Fitment", async () => {
  for (const kind of ["car", "wheel"]) {
    const app = runtime();
    const other = kind === "car" ? "wheel" : "car";
    app.state.files.car = { blob: new Blob(["old car"]), name: "old-car.jpg" };
    app.state.files.wheel = { blob: new Blob(["old wheel"]), name: "old-wheel.jpg" };
    app.state.previewUrls = { car: "blob:old-car", wheel: "blob:old-wheel" };
    app.state.identityDraftId = "stale-draft";
    app.state.identityProposal = { vehicle: {}, rim: {} };
    const otherFile = app.state.files[other];
    let rendered = 0;
    app.setRender(() => rendered++);
    app.setFitment(() => rendered++);
    app.handleFileSelected(kind, { name: "new.jpg", size: 3, type: "image/jpeg", arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(app.state.files[kind].name, "new.jpg");
    assert.equal(app.state.files[other], otherFile);
    assert.equal(app.state.previewUrls[other], `blob:old-${other}`);
    assert.deepEqual(app.revoked, [`blob:old-${kind}`]);
    assert.equal(app.state.identityDraftId, "");
    assert.equal(app.state.identityProposal, null);
    assert.equal(rendered, 0);
  }
});

test("Create bridge delegates rendering independently of Fitment and only hands off current completed jobs", () => {
  const app = runtime();
  let renders = 0;
  const checked = [];
  app.setRender(() => renders++);
  app.setFitment((job, options) => checked.push([job, options.originView]));
  for (const verdict of ["compatible", "unknown", "incompatible", "failure"]) {
    app.state.fitmentVerdict = verdict;
    app.bridge.createImage();
  }
  assert.equal(renders, 4);
  app.state.jobId = "job";
  app.state.identityDraftId = "current";
  app.state.createJobDraftId = "stale";
  app.state.resultUrl = "/result.jpg";
  app.bridge.checkCompatibility();
  assert.equal(checked.length, 0);
  app.state.createJobDraftId = "current";
  app.bridge.checkCompatibility();
  assert.deepEqual(checked, [["job", "create"]]);
});

test("completed Create render accepts the staging job result contract and enables Fitment", async () => {
  const app = runtime();
  app.state.photoConsentAccepted = true;
  app.state.identityDraftId = "draft";
  app.state.identityProposal = { vehicle: { primary: { make: "Audi", model: "Q8" }, alternatives: [] }, rim: {} };
  app.bridge.chooseVehicle(0);
  app.state.files.car = { blob: new Blob(["car"]), name: "car.jpg" };
  app.state.files.wheel = { blob: new Blob(["wheel"]), name: "wheel.jpg" };
  app.setFetch(async (path) => {
    if (path === "/jobs/from-assets") return { ok: true, json: async () => ({ job_id: "render-job" }) };
    assert.equal(path, "/jobs/render-job");
    return {
      ok: true,
      json: async () => ({
        status: "completed",
        output_image_url: "https://assets.example/result.png",
        assets: { result: { url: "https://assets.example/result.png" } },
      }),
    };
  });

  await app.bridge.createImage();

  assert.equal(app.state.resultUrl, "https://assets.example/result.png");
  assert.equal(app.bridge.snapshot().fitmentJobId, "render-job");
});
