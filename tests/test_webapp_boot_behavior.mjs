import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(root, "webapp", "app.js"), "utf8").replace(
    /^import \{[\s\S]*?\} from "\.\/app-route\.mjs";\n\n/u,
    "",
);

function storage() {
    const values = new Map();
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
    };
}

function bootApi({ savedStorage = storage(), telegram = true, deployedBuild = "new-build" } = {}) {
    let reloads = 0;
    const document = {
        documentElement: { dataset: { appBuild: "old-build" } },
        body: { classList: { add() {}, remove() {} } },
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
    };
    const window = {
        Telegram: telegram ? { WebApp: { platform: "ios", expand() {} } } : {},
        location: { search: "", reload() { reloads += 1; } },
        scrollTo() {},
    };
    const sessionStorage = storage();
    const context = {
        URL, URLSearchParams, console, document, window,
        fetch: async () => ({ ok: true, async json() { return { build: deployedBuild }; } }),
        localStorage: savedStorage,
        sessionStorage,
        navigator: { language: "ru-RU", userAgent: "test" },
        setTimeout, clearTimeout,
    };
    vm.runInNewContext(`
const applicationRouteContext = () => null;
const isApplicationRoute = () => false;
const safeApplicationReturnPath = () => null;
${appSource}
globalThis.__bootApi = { checkCurrentBuild, setView, restoreTelegramTopLevelView, getView: () => state.view };
`, context);
    return { ...context.__bootApi, storage: savedStorage, sessionStorage, reloadCount: () => reloads };
}

test("one stale build triggers at most one reload per session", async () => {
    const app = bootApi();
    await app.checkCurrentBuild();
    await app.checkCurrentBuild();
    assert.equal(app.reloadCount(), 1);
});

test("Telegram restores the last top-level view after a fresh boot", () => {
    const savedStorage = storage();
    bootApi({ savedStorage }).setView("wallet", { refreshData: false });
    const reopened = bootApi({ savedStorage });
    reopened.restoreTelegramTopLevelView();
    assert.equal(reopened.getView(), "wallet");
});

test("job-specific views do not replace the saved top-level view", () => {
    const savedStorage = storage();
    const app = bootApi({ savedStorage });
    app.setView("wallet", { refreshData: false });
    app.setView("fitment", { refreshData: false });
    const reopened = bootApi({ savedStorage });
    reopened.restoreTelegramTopLevelView();
    assert.equal(reopened.getView(), "wallet");
});
