const OWNED = "account-drafts";
const CLAIMS = "legacy-draft-claims";
const LEGACY_CLAIM = "unowned-v1";
const abortError = () =>
  new DOMException("Draft session changed", "AbortError");
const validOwner = (owner) => /^account:[1-9]\d{0,19}$/.test(owner || "");

// One owner record keeps photographs, URL and catalog selection in one transaction.
export class AccountDraftStore {
  constructor({
    indexedDB = globalThis.indexedDB,
    name = "dream-wheels-upload-draft",
    legacyStore = "files",
  } = {}) {
    Object.assign(this, { indexedDB, name, legacyStore });
  }
  open() {
    return new Promise((resolve, reject) => {
      if (!this.indexedDB) {
        reject(Error("Draft storage unavailable"));
        return;
      }
      const request = this.indexedDB.open(this.name, 2);
      let expired = false;
      const fail = (error) => {
        expired = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(
        () => fail(Error("Draft storage timed out")),
        4000,
      );
      request.onupgradeneeded = () => {
        if (expired) {
          request.transaction.abort();
          return;
        }
        const db = request.result;
        if (!db.objectStoreNames.contains(this.legacyStore))
          db.createObjectStore(this.legacyStore, { keyPath: "kind" });
        if (!db.objectStoreNames.contains(OWNED))
          db.createObjectStore(OWNED, { keyPath: "owner" });
        if (!db.objectStoreNames.contains(CLAIMS))
          db.createObjectStore(CLAIMS, { keyPath: "id" });
      };
      request.onblocked = () =>
        fail(
          Object.assign(
            Error("Close an older application tab to restore drafts"),
            { name: "DraftStorageBlockedError" },
          ),
        );
      request.onerror = () => fail(request.error);
      request.onsuccess = () => {
        clearTimeout(timer);
        if (expired) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }
  async transaction(owner, mode, scope, run) {
    if (!validOwner(owner)) throw Error("Verified draft owner required");
    const current = () =>
      !scope?.signal?.aborted && (scope?.isCurrent?.() ?? true);
    if (!current()) throw abortError();
    const db = await this.open();
    try {
      if (!current()) throw abortError();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction([OWNED, CLAIMS, this.legacyStore], mode);
        let result;
        const abort = () => {
          try {
            tx.abort();
          } catch {
            /* Already committed; caller still checks scope. */
          }
        };
        scope?.signal?.addEventListener("abort", abort, { once: true });
        if (scope?.operation) scope.operation.abortDraft = abort;
        const cleanup = () => {
          scope?.signal?.removeEventListener("abort", abort);
          if (scope?.operation) scope.operation.abortDraft = null;
        };
        tx.oncomplete = () => {
          cleanup();
          current() ? resolve(result) : reject(abortError());
        };
        tx.onabort = () => {
          cleanup();
          reject(tx.error || abortError());
        };
        tx.onerror = () => {}; // onabort reports transaction failures, including quota.
        const checked =
          (callback) =>
          (...args) => {
            if (!current()) {
              abort();
              return;
            }
            try {
              callback(...args);
            } catch (error) {
              abort();
              cleanup();
              reject(error);
            }
          };
        try {
          run(tx, checked, (value) => {
            result = value;
          });
        } catch (error) {
          abort();
          cleanup();
          reject(error);
        }
      });
    } finally {
      db.close();
    }
  }
  read(owner, scope) {
    return this.transaction(owner, "readonly", scope, (tx, checked, done) => {
      const requests = [
        tx.objectStore(OWNED).get(owner),
        tx.objectStore(CLAIMS).get(LEGACY_CLAIM),
        tx.objectStore(this.legacyStore).getKey("car"),
        tx.objectStore(this.legacyStore).getKey("wheel"),
      ];
      const values = [];
      let count = 0;
      requests.forEach((request, index) => {
        request.onsuccess = checked(() => {
          values[index] = request.result;
          if (++count === requests.length)
            done({
              draft: values[0] || null,
              legacyAvailable: !values[1] && Boolean(values[2] || values[3]),
            });
        });
      });
    });
  }
  update(owner, change, scope) {
    return this.transaction(owner, "readwrite", scope, (tx, checked, done) => {
      const store = tx.objectStore(OWNED),
        request = store.get(owner);
      request.onsuccess = checked(() => {
        const draft = request.result || {
          owner,
          car: null,
          wheel: null,
          productUrl: "",
          catalog: null,
        };
        const updated = change(draft);
        if (updated.owner !== owner) throw Error("Draft owner cannot change");
        store.put(updated);
        done(updated);
      });
    });
  }
  importLegacy(owner, scope) {
    return this.transaction(owner, "readwrite", scope, (tx, checked, done) => {
      const owned = tx.objectStore(OWNED),
        legacy = tx.objectStore(this.legacyStore),
        claims = tx.objectStore(CLAIMS);
      const requests = [
        owned.get(owner),
        claims.get(LEGACY_CLAIM),
        legacy.get("car"),
        legacy.get("wheel"),
        legacy.get("product-url"),
        legacy.get("catalog-wheel"),
      ];
      const values = [];
      let count = 0;
      requests.forEach((request, index) => {
        request.onsuccess = checked(() => {
          values[index] = request.result;
          if (++count !== requests.length) return;
          if (values[1]) throw Error("Legacy draft was already restored");
          if (values[0]?.car || values[0]?.wheel)
            throw Error("Current draft already has photographs");
          if (!values[2]?.bytes && !values[3]?.bytes)
            throw Error("Legacy draft unavailable");
          const draft = {
            owner,
            car: values[2]?.bytes ? values[2] : null,
            wheel: values[3]?.bytes ? values[3] : null,
            productUrl: values[4]?.value || "",
            catalog: values[5]?.value ? { ...values[5].value, owner } : null,
          };
          owned.put(draft);
          claims.put({ id: LEGACY_CLAIM, owner });
          done(draft);
          // Preserve unowned source records. The claim prevents importing them for another account.
        });
      });
    });
  }
}
