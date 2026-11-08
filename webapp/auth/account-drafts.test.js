import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { AccountDraftStore } from "../vnext/account-drafts.mjs";
const A = "account:42",
  B = "account:9";
const photo = (name) => ({
  kind: "car",
  name,
  bytes: new Uint8Array([1, 2]).buffer,
  type: "image/png",
  size: 2,
});
function setup() {
  const indexedDB = new IDBFactory();
  return { indexedDB, store: new AccountDraftStore({ indexedDB }) };
}
async function legacy(indexedDB) {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("dream-wheels-upload-draft", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("files", { keyPath: "kind" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const s = tx.objectStore("files");
    s.put(photo("legacy.png"));
    s.put({ kind: "product-url", value: "https://shop.test/old" });
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
test("A -> B -> A and reload preserve only the verified owner record", async () => {
  const { store, indexedDB } = setup();
  await store.update(A, (d) => ({
    ...d,
    car: photo("A.png"),
    wheel: photo("A-wheel.png"),
    productUrl: "https://shop.test/a",
    catalog: { owner: A, skuId: "one" },
  }));
  assert.equal((await store.read(B)).draft, null);
  await store.update(B, (d) => ({ ...d, car: photo("B.png") }));
  const reopened = new AccountDraftStore({ indexedDB });
  assert.equal((await reopened.read(A)).draft.car.name, "A.png");
  assert.equal((await reopened.read(B)).draft.car.name, "B.png");
  assert.equal((await reopened.read(A)).draft.catalog.skuId, "one");
});
test("unverified owner is rejected before opening storage", async () => {
  const { store } = setup();
  for (const id of [
    null,
    "anonymous",
    "telegram:123",
    "supabase:email",
    "account:0",
  ])
    await assert.rejects(store.read(id), /Verified/);
});
test("abort before and during pending open cannot write to either account", async () => {
  const { store } = setup();
  const controller = new AbortController();
  const opening = store.open.bind(store);
  let release;
  store.open = () =>
    new Promise((resolve) => {
      release = async () => resolve(await opening());
    });
  const pending = store.update(A, (d) => ({ ...d, car: photo("late.png") }), {
    signal: controller.signal,
  });
  controller.abort();
  await release();
  await assert.rejects(pending, { name: "AbortError" });
  store.open = opening;
  assert.equal((await store.read(A)).draft, null);
  assert.equal((await store.read(B)).draft, null);
});
test("atomic update failure retains both old photos, URL and SKU", async () => {
  const { store } = setup();
  await store.update(A, (d) => ({
    ...d,
    car: photo("old.png"),
    productUrl: "old",
    catalog: { skuId: "old" },
  }));
  await assert.rejects(
    store.update(A, (d) => ({ ...d, car: photo("new.png"), bad: () => {} })),
    { name: "DataCloneError" },
  );
  const d = (await store.read(A)).draft;
  assert.equal(d.car.name, "old.png");
  assert.equal(d.productUrl, "old");
  assert.equal(d.catalog.skuId, "old");
});
test("session invalidation while transaction is active rolls back", async () => {
  const { store } = setup();
  const controller = new AbortController();
  await assert.rejects(
    store.update(
      A,
      (d) => {
        controller.abort();
        return { ...d, car: photo("late") };
      },
      { signal: controller.signal },
    ),
  );
  assert.equal((await store.read(A)).draft, null);
});
test("legacy upgrade reveals only availability, never bytes or metadata", async () => {
  const { indexedDB, store } = setup();
  await legacy(indexedDB);
  const result = await store.read(A);
  assert.deepEqual(result, { draft: null, legacyAvailable: true });
  // Choosing Not now causes no transaction or ownership claim.
  assert.equal((await store.read(B)).legacyAvailable, true);
  await store.importLegacy(A);
  assert.equal((await store.read(A)).draft.car.name, "legacy.png");
  assert.equal((await store.read(A)).draft.productUrl, "https://shop.test/old");
  assert.equal((await store.read(B)).draft, null);
  assert.equal((await store.read(B)).legacyAvailable, false);
  await assert.rejects(store.importLegacy(B), /already restored/);
  const db = await store.open();
  const r = db.transaction("files").objectStore("files").get("car");
  await new Promise((resolve) => (r.onsuccess = resolve));
  assert.equal(r.result.name, "legacy.png");
  db.close();
});
test("two tabs cannot claim the same legacy draft for different accounts", async () => {
  const { indexedDB, store } = setup();
  await legacy(indexedDB);
  const other = new AccountDraftStore({ indexedDB });
  const results = await Promise.allSettled([
    store.importLegacy(A),
    other.importLegacy(B),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    Boolean((await store.read(A)).draft) + Boolean((await store.read(B)).draft),
    1,
  );
});
test("legacy import refuses to overwrite a personal draft and can retry after cancellation", async () => {
  const { indexedDB, store } = setup();
  await legacy(indexedDB);
  await store.update(A, (d) => ({ ...d, wheel: photo("mine") }));
  await assert.rejects(store.importLegacy(A), /already has/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(store.importLegacy(B, { signal: controller.signal }));
  assert.equal((await store.read(B)).legacyAvailable, true);
  await store.importLegacy(B);
  assert.equal((await store.read(A)).draft.wheel.name, "mine");
});
test("quota failure after copying legacy photos rolls back owner and claim together", async () => {
  const { indexedDB, store } = setup();
  await legacy(indexedDB);
  const open = store.open.bind(store);
  store.open = async () => {
    const db = await open();
    const transaction = db.transaction.bind(db);
    db.transaction = (...args) => {
      const tx = transaction(...args);
      const objectStore = tx.objectStore.bind(tx);
      tx.objectStore = (name) => {
        const os = objectStore(name);
        if (name === "legacy-draft-claims")
          os.put = () => {
            throw new DOMException("quota", "QuotaExceededError");
          };
        return os;
      };
      return tx;
    };
    return db;
  };
  await assert.rejects(store.importLegacy(A), { name: "QuotaExceededError" });
  store.open = open;
  assert.deepEqual(await store.read(A), { draft: null, legacyAvailable: true });
  await store.importLegacy(A);
  assert.equal((await store.read(A)).draft.car.name, "legacy.png");
});
test("a stale v1 tab blocks upgrade without deleting its draft; closing it enables retry", async () => {
  const { indexedDB, store } = setup();
  await legacy(indexedDB);
  const old = await new Promise((resolve) => {
    const r = indexedDB.open("dream-wheels-upload-draft", 1);
    r.onsuccess = () => resolve(r.result);
  });
  await assert.rejects(store.read(A), /older application tab/);
  old.close();
  assert.equal((await store.read(A)).legacyAvailable, true);
});
