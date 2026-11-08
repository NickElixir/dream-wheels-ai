import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { AccountDraftStore } from "../vnext/account-drafts.mjs";
import {
  CatalogHandoffController,
  captureCatalogHandoff,
  readCatalogHandoff,
  resolveCatalogSelection,
  catalogRimProposal,
} from "../vnext/catalog-handoff.mjs";
import { catalogEntries } from "../vnext/catalog-data.mjs";
import {
  copy as uiCopy,
  legacyTranslations,
  errorCopy,
} from "../vnext/copy.mjs";
import { buildFitmentRimReadiness } from "../vnext/fitment-readiness.mjs";
import { fitmentDisplayValue } from "../vnext/fitment-display.mjs";
import * as routes from "../app-route.mjs";

// Run the entire production runtime. Only presentation sinks, Dashboard data and
// external transports are replaced; auth callbacks, bootstrap, bridge Retry,
// merge, canonical owner resolution, handoff and IndexedDB transactions are real.
const appSource = fs
  .readFileSync(
    process.env.DW_CALLBACK_RUNTIME_SOURCE ||
      new URL("../app.js", import.meta.url),
    "utf8",
  )
  .replace(/^import\s+[\s\S]*?\sfrom\s+["'][^"']+["'];\s*/gm, "");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async (predicate) => {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw Error("Runtime condition not reached");
};
const record = (name) => ({
  name,
  type: "image/jpeg",
  size: 1,
  bytes: new Uint8Array([1]).buffer,
});
function runtime() {
  const indexedDB = new IDBFactory();
  class RuntimeDraftStore extends AccountDraftStore {
    constructor(options) {
      super({ ...options, indexedDB });
    }
  }
  const values = new Map(),
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, String(v)),
      removeItem: (k) => values.delete(k),
    };
  let subject = "A",
    canonical = { A: "42", B: "9" },
    fetches = [],
    broadcasts = 0,
    imageFetches = 0;
  let me = async (id) => ({
    ok: true,
    json: async () => ({ authenticated: true, account_id: canonical[id] }),
  });
  let merge = async () => ({ ok: true });
  let account = async () => ({
    ok: true,
    json: async () => ({ identity: subject }),
  });
  const location = new URL("https://app.test/new");
  const controller = {
    getCurrentAuthUser: () => ({ id: subject }),
    authenticatedFetch: async (url, options = {}) => {
      const path = new URL(url, location).pathname;
      fetches.push({ path, subject });
      if (path === "/auth/me") return me(subject);
      if (path === "/auth/account/merge") return merge(options, subject);
      if (path === "/auth/account") return account(subject);
      throw Error(`Unexpected transport ${path}`);
    },
  };
  const context = {
    ...routes,
    AccountDraftStore: RuntimeDraftStore,
    CatalogHandoffController,
    captureCatalogHandoff,
    readCatalogHandoff,
    resolveCatalogSelection,
    catalogRimProposal,
    uiCopy,
    legacyTranslations,
    errorCopy,
    buildFitmentRimReadiness,
    fitmentDisplayValue,
    AbortController,
    DOMException,
    Blob,
    URL,
    URLSearchParams,
    Event,
    FormData,
    console,
    setTimeout,
    clearTimeout,
    document: {
      documentElement: { dataset: {} },
      body: { classList: { add() {}, remove() {} } },
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    window: {
      DreamWheelsAuth: controller,
      Telegram: {},
      location,
      history: { replaceState() {} },
      addEventListener() {},
      dispatchEvent: (event) => {
        if (event.type === "dreamwheels:draft-session-boundary") broadcasts++;
      },
    },
    navigator: { language: "ru-RU", userAgent: "test" },
    localStorage: storage,
    sessionStorage: storage,
  };
  vm.runInNewContext(
    `${appSource}
renderCreateInputs=()=>{};refreshButtonsForCurrentView=()=>{};notifyCreateBridge=()=>{};notifyRenderBridge=()=>{};
renderPreviewFromFile=()=>{};renderAccountSettings=()=>{};renderConfirmation=()=>{};renderWalletStatus=()=>{};renderDashboard=()=>{};
updateWebsiteAuthUi=()=>{};syncApplicationAuthWall=()=>{};restoreWebRoute=()=>{};loadDashboardData=async()=>{};
trackEvent=async()=>{};apiUrl=path=>new URL(path,'https://app.test').href;
globalThis.callbackApi={state,bridge:window.dreamwheelsCreateBridge,handleFrontendAuthState,bootstrapAuthenticatedApplication,
 confirmAccountMerge,showAccountMerge,loadAccountState,clearApplicationSessionState,getAccountDraftStore,catalogHandoff};`,
    context,
  );
  const api = context.callbackApi;
  api.state.applicationAuthRequired = true;
  api.catalogHandoff.isReady = () => true;
  api.catalogHandoff.verifyImage = async () => true;
  api.catalogHandoff.fetchImage = async () => {
    imageFetches++;
    return {
      ok: true,
      blob: async () =>
        new Blob(["controlled catalog photo"], { type: "image/jpeg" }),
    };
  };
  return {
    ...api,
    storage,
    context,
    canonical,
    fetches,
    get broadcasts() {
      return broadcasts;
    },
    get imageFetches() {
      return imageFetches;
    },
    setMe: (fn) => {
      me = fn;
    },
    setMerge: (fn) => {
      merge = fn;
    },
    setAccount: (fn) => {
      account = fn;
    },
    switchAccount(id) {
      subject = id;
      api.handleFrontendAuthState({
        status: "AUTHENTICATED",
        authority: "supabase",
        principalVerified: true,
        protectedApiReady: true,
      });
      return api.bootstrapAuthenticatedApplication();
    },
    capture() {
      const e = catalogEntries.find((e) => e.selectedSkuId);
      captureCatalogHandoff(
        new URL(
          `https://app.test/new?catalog_variant=${e.variantId}&catalog_sku=${e.selectedSkuId}&catalog_locale=ru&catalog_source=catalog`,
        ),
        storage,
      );
    },
  };
}
async function prepared() {
  const app = runtime();
  await app
    .getAccountDraftStore()
    .update("account:42", (d) => ({
      ...d,
      car: record("A-car.jpg"),
      wheel: record("A-wheel.jpg"),
    }));
  await app
    .getAccountDraftStore()
    .update("account:9", (d) => ({
      ...d,
      car: record("B-car.jpg"),
      wheel: record("B-existing-wheel.jpg"),
    }));
  await app.switchAccount("B");
  return app;
}

for (const order of ["A-first", "B-first"])
  test(`late Retry A cannot replace stored wheel B: ${order}`, async () => {
    const app = await prepared();
    app.capture();
    await app.catalogHandoff.resume();
    assert.equal(app.catalogHandoff.pending.account, "account:9");
    const store = app.getAccountDraftStore(),
      read = store.read.bind(store);
    store.read = (owner, scope) =>
      owner === "account:42"
        ? Promise.reject(Error("controlled read failure"))
        : read(owner, scope);
    await app.switchAccount("A");
    assert.equal(app.state.draftError, true);
    store.read = read;
    const held = new Map();
    store.read = (owner, scope) => {
      const d = deferred();
      held.set(owner, () => read(owner, scope).then(d.resolve, d.reject));
      return d.promise;
    };
    const retry = app.bridge.retryAccountDraft();
    await flush(() => held.has("account:42"));
    const switching = app.switchAccount("B");
    await flush(() => held.has("account:9"));
    assert.equal(app.state.files.wheel, null);
    if (order === "A-first") {
      held.get("account:42")();
      await retry;
      assert.equal(app.imageFetches, 0);
      held.get("account:9")();
      await switching;
    } else {
      held.get("account:9")();
      await switching;
      held.get("account:42")();
      await retry;
    }
    assert.equal(app.state.files.wheel.name, "B-existing-wheel.jpg");
    assert.equal(
      (await read("account:9")).draft.wheel.name,
      "B-existing-wheel.jpg",
    );
    assert.equal(app.state.catalogWheel, null);
    assert.equal(app.catalogHandoff.pending.account, "account:9");
    assert.equal(app.imageFetches, 0);
  });
for (const outcome of ["success", "failure", "network-error"])
  test(`late merge A ${outcome} cannot reset B or publish a notice`, async () => {
    const app = await prepared();
    await app.switchAccount("A");
    const held = deferred();
    app.setMerge(() => held.promise);
    app.showAccountMerge({ merge_token: "merge-A" }, "telegram");
    const pending = app.confirmAccountMerge();
    await app.switchAccount("B");
    app.state.rimProductUrl = "https://B-unsaved.test/rim";
    app.state.accountSettingsNotice = "B notice";
    const epoch = app.state.draftEpoch,
      broadcasts = app.broadcasts;
    if (outcome === "network-error")
      held.reject(Error("controlled network error"));
    else
      held.resolve({
        ok: outcome === "success",
        json: async () => ({ detail: "controlled refusal" }),
      });
    await pending;
    assert.equal(app.state.draftEpoch, epoch);
    assert.equal(app.state.rimProductUrl, "https://B-unsaved.test/rim");
    assert.equal(app.state.accountSettingsNotice, "B notice");
    assert.equal(app.state.files.wheel.name, "B-existing-wheel.jpg");
    assert.equal(app.broadcasts, broadcasts);
    assert.equal(app.state.accountMergeBusy, false);
    assert.equal(app.state.accountMergeStatus, "");
  });
test("late merge A cleanup cannot clear the busy state of a new merge B", async () => {
  const app = await prepared();
  await app.switchAccount("A");
  const a = deferred(),
    b = deferred();
  app.setMerge((_, subject) => (subject === "A" ? a.promise : b.promise));
  app.showAccountMerge({ merge_token: "merge-A" }, "telegram");
  const first = app.confirmAccountMerge();
  await app.switchAccount("B");
  app.showAccountMerge({ merge_token: "merge-B" }, "telegram");
  const second = app.confirmAccountMerge();
  const operation = app.state.accountMergeOperation,
    status = app.state.accountMergeStatus;
  a.resolve({ ok: true });
  await first;
  assert.equal(app.state.accountMergeOperation, operation);
  assert.equal(app.state.accountMergeBusy, true);
  assert.equal(app.state.accountMergeStatus, status);
  assert.equal(app.state.accountMergeToken, "merge-B");
  b.resolve({ ok: true });
  await second;
  assert.equal(app.state.accountMergeBusy, false);
});
test("legitimate merge re-resolves a changed canonical owner without cancelling itself", async () => {
  const app = await prepared();
  await app.switchAccount("A");
  await app
    .getAccountDraftStore()
    .update("account:77", (d) => ({
      ...d,
      car: record("merged-car.jpg"),
      wheel: record("merged-wheel.jpg"),
    }));
  app.setMerge(async () => {
    app.canonical.A = "77";
    return { ok: true };
  });
  app.showAccountMerge({ merge_token: "merge-A" }, "telegram");
  await app.confirmAccountMerge();
  assert.equal(app.state.draftOwner, "account:77");
  assert.equal(app.state.files.wheel.name, "merged-wheel.jpg");
  assert.equal(app.state.accountSettingsNoticeKey, "account.merge.success");
  assert.equal(app.state.accountMergeBusy, false);
  assert.equal(app.state.accountMergeOpen, false);
  assert.equal(app.state.accountMergeOperation, null);
});
test("account change during post-merge account refresh discards its response and cleanup", async () => {
  const app = await prepared();
  await app.switchAccount("A");
  const held = deferred();
  let entered = false;
  app.setAccount((subject) => {
    if (subject === "A") {
      entered = true;
      return held.promise;
    }
    return { ok: true, json: async () => ({ identity: "B" }) };
  });
  app.showAccountMerge({ merge_token: "merge-A" }, "telegram");
  const pending = app.confirmAccountMerge();
  await flush(() => entered);
  await app.switchAccount("B");
  app.state.rimProductUrl = "https://B-unsaved.test/rim";
  held.resolve({ ok: true, json: async () => ({ identity: "A" }) });
  await pending;
  assert.equal(app.state.accountState.identity, "B");
  assert.equal(app.state.rimProductUrl, "https://B-unsaved.test/rim");
  assert.notEqual(app.state.accountSettingsNoticeKey, "account.merge.success");
});
for (const stage of ["owner-probe", "photo-hydration"])
  test(`account change during post-merge ${stage} leaves B unchanged`, async () => {
    const app = await prepared();
    await app.switchAccount("A");
    const held = deferred();
    let entered = false;
    if (stage === "owner-probe")
      app.setMe((id) => {
        if (id === "A") {
          entered = true;
          return held.promise;
        }
        return {
          ok: true,
          json: async () => ({
            authenticated: true,
            account_id: app.canonical[id],
          }),
        };
      });
    else {
      const store = app.getAccountDraftStore(),
        read = store.read.bind(store);
      store.read = (owner, scope) => {
        if (owner === "account:42") {
          entered = true;
          return held.promise.then(() => read(owner, scope));
        }
        return read(owner, scope);
      };
    }
    app.showAccountMerge({ merge_token: "merge-A" }, "telegram");
    const pending = app.confirmAccountMerge();
    await flush(() => entered);
    await app.switchAccount("B");
    app.state.rimProductUrl = "https://B-unsaved.test/rim";
    const epoch = app.state.draftEpoch,
      broadcasts = app.broadcasts;
    held.resolve({
      ok: true,
      json: async () => ({ authenticated: true, account_id: "42" }),
    });
    await pending;
    assert.equal(app.state.draftEpoch, epoch);
    assert.equal(app.state.rimProductUrl, "https://B-unsaved.test/rim");
    assert.equal(app.state.files.wheel.name, "B-existing-wheel.jpg");
    assert.equal(app.broadcasts, broadcasts);
    assert.notEqual(
      app.state.accountSettingsNoticeKey,
      "account.merge.success",
    );
  });
test("account change while decoding a merge error cannot write a stale error or cleanup", async () => {
  const app = await prepared();
  await app.switchAccount("A");
  const body = deferred();
  let entered = false;
  app.setMerge(async () => ({
    ok: false,
    json: () => {
      entered = true;
      return body.promise;
    },
  }));
  app.showAccountMerge({ merge_token: "merge-A" }, "telegram");
  const pending = app.confirmAccountMerge();
  await flush(() => entered);
  await app.switchAccount("B");
  app.state.accountMergeStatus = "B status";
  app.state.accountMergeBusy = true;
  body.resolve({ detail: "A failure" });
  await pending;
  assert.equal(app.state.accountMergeStatus, "B status");
  assert.equal(app.state.accountMergeBusy, true);
});
