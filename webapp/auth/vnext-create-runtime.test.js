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
