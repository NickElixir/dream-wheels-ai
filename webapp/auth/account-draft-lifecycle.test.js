import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { AccountDraftStore } from "../vnext/account-drafts.mjs";
import { extractFunction } from "../../tests/helpers/source-extract.mjs";
const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function lifecycle() {
  const state = {
    draftEpoch: 0,
    files: { car: null, wheel: null },
    previewUrls: { car: "blob:old-car", wheel: "blob:old-wheel" },
    createInputVersion: 0,
    createProductUrlSaveToken: 0,
    wheelReplacementToken: 0,
    photoConsentAccepted: true,
  };
  const store = new AccountDraftStore({ indexedDB: new IDBFactory() });
  const revoked = [];
  let credential = "A";
  let responseOwner = "42";
  let getMe = async () => ({
    ok: true,
    json: async () => ({ authenticated: true, account_id: responseOwner }),
  });
  let writes = 0;
  const context = {
    state,
    applicationDataGeneration: 0,
    applicationDataPromise: null,
    AbortController,
    DOMException,
    Blob,
    URL: { revokeObjectURL: (url) => revoked.push(url) },
    setTimeout,
    clearTimeout,
    document: { querySelector: () => null },
    getAccountDraftStore: () => store,
    draftCredentialMarker: () => credential,
    cancelPhotoPreparation() {},
    catalogHandoff: { cancel() {} },
    resetCreateAssets() {
      state.createInputVersion++;
    },
    notifyCreateBridge() {},
    renderCreateInputs() {},
    renderPreviewFromFile() {},
    resolveCatalogSelection: () => null,
    createProductUrlValue: (v) => v,
    getIdentitySearchParams: () => new URLSearchParams(),
    apiUrl: () => "/auth/me",
    withAuthHeaders: () => ({}),
    authenticatedFetch: (url, options = {}) => {
      if (options.method && options.method !== "GET") {
        writes++;
        throw Error("Unexpected API write");
      }
      return getMe();
    },
    trackEvent: async () => {},
    haptic() {},
    refreshButtonsForCurrentView() {},
  };
  const names = [
    "cancelAccountMergeOperation",
    "draftScope",
    "invalidateAccountDraft",
    "resolveAccountDraftOwner",
    "awaitDraftOwnerRequest",
    "draftFileRecord",
    "saveDraftFile",
    "saveDraftFiles",
    "persistCreateProductUrl",
    "hydrateFilesFromDraft",
    "restoreLegacyAccountDraft",
    "revokePreviewUrl",
    "handleFileSelected",
  ];
  vm.runInNewContext(
    "let draftOwnerPromise=null;const dismissedLegacyOwners=new Set();\n" +
      names.map((n) => extractFunction(source, n)).join("\n"),
    context,
  );
  return {
    state,
    store,
    revoked,
    context,
    async login(id) {
      credential = id;
      responseOwner = id === "A" ? "42" : "9";
      await context.resolveAccountDraftOwner();
      await context.hydrateFilesFromDraft();
    },
    setCredential: (v) => {
      credential = v;
    },
    setMe: (fn) => {
      getMe = fn;
    },
    get writes() {
      return writes;
    },
  };
}
const photo = (name) => ({
  kind: "car",
  name,
  bytes: new Uint8Array([1]).buffer,
  type: "image/jpeg",
  size: 1,
});
test("real owner resolution gates IndexedDB and A/logout/B never paints A photos", async () => {
  const app = lifecycle();
  await app.store.update("account:42", (d) => ({
    ...d,
    car: photo("private-A.jpg"),
  }));
  await app.login("A");
  assert.equal(app.state.files.car.name, "private-A.jpg");
  assert.equal(app.state.draftOwner, "account:42");
  app.context.invalidateAccountDraft();
  assert.equal(app.state.files.car, null);
  assert.deepEqual(app.revoked, ["blob:old-car", "blob:old-wheel"]);
  assert.equal(app.state.photoConsentAccepted, false);
  await app.login("B");
  assert.equal(app.state.files.car, null);
  await app.login("A");
  assert.equal(app.state.files.car.name, "private-A.jpg");
});
test("late auth probe and hydration cannot apply to a different account", async () => {
  const app = lifecycle();
  let release;
  app.setMe(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = app.context.resolveAccountDraftOwner();
  await Promise.resolve();
  await Promise.resolve();
  app.setCredential("B");
  app.context.invalidateAccountDraft();
  release({
    ok: true,
    json: async () => ({ authenticated: true, account_id: "42" }),
  });
  await pending;
  assert.equal(app.state.draftOwner, null);
  app.setMe(async () => ({
    ok: true,
    json: async () => ({ authenticated: true, account_id: "9" }),
  }));
  await app.login("B");
  let resolveRead;
  app.store.read = () =>
    new Promise((resolve) => {
      resolveRead = resolve;
    });
  const reading = app.context.hydrateFilesFromDraft();
  app.context.invalidateAccountDraft();
  resolveRead({ draft: { car: photo("B-private") } });
  await reading;
  assert.equal(app.state.files.car, null);
});
test("old backend response or failed probe fails closed without reading photographs", async () => {
  const app = lifecycle();
  let reads = 0;
  app.store.read = async () => {
    reads++;
    throw Error("must not read");
  };
  app.setMe(async () => ({
    ok: true,
    json: async () => ({ authenticated: true }),
  }));
  assert.equal(await app.context.resolveAccountDraftOwner(), false);
  assert.equal(app.state.draftError, true);
  assert.equal(reads, 0);
  assert.equal(app.state.draftOwner, null);
});
test("late manual file bytes after account switch neither paint nor persist", async () => {
  const app = lifecycle();
  await app.login("A");
  let release;
  const file = {
    name: "private-A.jpg",
    type: "image/jpeg",
    size: 1,
    arrayBuffer: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  };
  app.context.handleFileSelected("car", file);
  await app.login("B");
  release(new Uint8Array([1]).buffer);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.state.files.car, null);
  assert.equal((await app.store.read("account:9")).draft, null);
});
test("account change during URL save cancels its transaction", async () => {
  const app = lifecycle();
  await app.login("A");
  const pending = app.context.persistCreateProductUrl("https://private-A.test");
  app.context.invalidateAccountDraft();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal((await app.store.read("account:9")).draft, null);
});
test("owner resolution and hydration cannot trigger upload or render", async () => {
  const app = lifecycle();
  await app.login("A");
  assert.equal(app.writes, 0);
  assert.equal(app.state.submitting, undefined);
  assert.equal(app.state.files.car, null);
});
test("cross-tab boundary clears previews immediately and never reads storage by itself", async () => {
  const app = lifecycle();
  await app.login("A");
  const handlers = {};
  let channel;
  let reads = 0;
  app.store.read = async () => {
    reads++;
  };
  app.context.window = {
    addEventListener: (name, fn) => (handlers[name] = fn),
  };
  app.context.localStorage = { setItem() {} };
  app.context.BroadcastChannel = class {
    constructor() {
      channel = this;
    }
    postMessage() {}
  };
  vm.runInNewContext(
    extractFunction(source, "bindDraftSessionBoundary"),
    app.context,
  );
  app.context.bindDraftSessionBoundary();
  channel.onmessage();
  assert.equal(app.state.draftOwner, null);
  assert.equal(app.state.files.car, null);
  assert.equal(app.state.draftError, true);
  assert.equal(reads, 0);
  await app.context.resolveAccountDraftOwner();
  handlers.storage({ key: "sb-project-auth-token" });
  assert.equal(app.state.draftOwner, null);
  assert.equal(reads, 0);
});
test("owner deadline settles even when auth request ignores AbortSignal; late success is discarded", async () => {
  const app = lifecycle();
  let timeout, release;
  app.context.setTimeout = (fn) => {
    timeout = fn;
    return 1;
  };
  app.context.clearTimeout = () => {};
  app.setMe(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = app.context.resolveAccountDraftOwner();
  await Promise.resolve();
  await Promise.resolve();
  timeout();
  assert.equal(await pending, false);
  assert.equal(app.state.draftLoading, false);
  assert.equal(app.state.draftError, true);
  release({
    ok: true,
    json: async () => ({ authenticated: true, account_id: "42" }),
  });
  await Promise.resolve();
  assert.equal(app.state.draftOwner, null);
});
test("numeric or malformed canonical IDs cannot create an owner namespace", async () => {
  for (const id of [42, ["42"], "0", "-1", "42x"]) {
    const app = lifecycle();
    app.setMe(async () => ({
      ok: true,
      json: async () => ({ authenticated: true, account_id: id }),
    }));
    assert.equal(await app.context.resolveAccountDraftOwner(), false);
    assert.equal(app.state.draftOwner, null);
  }
});

test("account change during bootstrap starts a fresh bootstrap instead of joining the old promise", async () => {
  const app = lifecycle();
  let oldReply;
  app.setMe(
    () =>
      new Promise((resolve) => {
        oldReply = resolve;
      }),
  );
  Object.assign(app.context, {
    isApplicationAuthSessionReady: () => true,
    syncApplicationAuthWall() {},
    initializeCatalogHandoff() {},
    refreshButtonsForCurrentView() {},
    loadDashboardData: async () => {},
    restoreWebRoute() {},
  });
  app.context.catalogHandoff.resume = async () => {};
  app.state.applicationAuthRequired = true;
  vm.runInNewContext(
    extractFunction(source, "bootstrapAuthenticatedApplication"),
    app.context,
  );
  const oldBootstrap = app.context.bootstrapAuthenticatedApplication();
  await Promise.resolve();
  await Promise.resolve();
  app.context.invalidateAccountDraft();
  app.setCredential("B");
  app.setMe(async () => ({
    ok: true,
    json: async () => ({ authenticated: true, account_id: "9" }),
  }));
  assert.equal(await app.context.bootstrapAuthenticatedApplication(), true);
  assert.equal(app.state.draftOwner, "account:9");
  assert.equal(await oldBootstrap, false);
  oldReply({
    ok: true,
    json: async () => ({ authenticated: true, account_id: "42" }),
  });
  await Promise.resolve();
  assert.equal(app.state.draftOwner, "account:9");
});

test("a late failed file read cannot block a newer successful selection", async () => {
  const app = lifecycle();
  await app.login("A");
  let rejectOld;
  app.context.handleFileSelected("car", {
    name: "old",
    arrayBuffer: () =>
      new Promise((_, reject) => {
        rejectOld = reject;
      }),
  });
  app.context.handleFileSelected("car", {
    name: "new",
    type: "image/png",
    size: 1,
    arrayBuffer: async () => new Uint8Array([1]).buffer,
  });
  while (!app.state.files.car)
    await new Promise((resolve) => setImmediate(resolve));
  rejectOld(Error("old read failed"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.state.files.car.name, "new");
  assert.equal(app.state.draftError, false);
});
