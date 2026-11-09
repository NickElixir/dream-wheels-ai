import test from "node:test";
import assert from "node:assert/strict";
import { registrationTouchPayload } from "./registration-touch.mjs";

test("a new landing touch replaces earlier UTM and direct visits preserve it", t => {
    const entries = new Map();
    const location = { href: "https://app.dream-wheels.ru/new?registration_source=catalog&registration_locale=ru&utm_campaign=зима&catalog_sku=one" };
    Object.defineProperty(globalThis, "location", { configurable: true, value: location });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
        getItem: key => entries.get(key),
        setItem: (key, value) => entries.set(key, value),
    } });
    Object.defineProperty(globalThis, "history", { configurable: true, value: {
        replaceState: (_state, _title, url) => { location.href = url.href; },
    } });
    t.after(() => { for (const key of ["location", "localStorage", "history"]) delete globalThis[key]; });
    const first = registrationTouchPayload();
    assert.match(first, /\\u0437/);
    assert.equal(JSON.parse(first).utm_campaign, "зима");
    assert.equal(new URL(location.href).searchParams.get("catalog_sku"), "one");
    assert.ok(!location.href.includes("registration_source"));
    location.href = "https://app.dream-wheels.ru/new";
    assert.equal(registrationTouchPayload(), first);
    location.href += "?registration_source=landing&registration_locale=ru";
    const second = JSON.parse(registrationTouchPayload());
    assert.equal(second.source, "landing");
    assert.equal(second.utm_campaign, undefined);
    t.mock.method(Date, "now", () => Date.parse(second.touched_at) + 25 * 60 * 60 * 1000);
    assert.equal(registrationTouchPayload(), null);
});
