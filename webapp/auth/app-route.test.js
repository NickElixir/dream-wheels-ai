import test from "node:test";
import assert from "node:assert/strict";
import {
    applicationRouteContext,
    applicationRouteView,
    applicationTopLevelReturnPath,
    isApplicationRoute,
    safeApplicationReturnPath,
} from "../app-route.mjs";

const ORIGIN = "https://dreamwheels.example";

test("application routes cover the browser App namespace entry points", () => {
    assert.equal(isApplicationRoute(new URL("/app", ORIGIN)), true);
    assert.equal(isApplicationRoute(new URL("/app/new", ORIGIN)), true);
    assert.equal(isApplicationRoute(new URL("/app/history", ORIGIN)), true);
    assert.equal(applicationRouteView(new URL("/app/new", ORIGIN)), "create");
    assert.equal(applicationRouteView(new URL("/app/history", ORIGIN)), "renders");
});

test("post-login return keeps market and supported UTM values only", () => {
    const entry = new URL(
        "/app/new?market=ru&utm_source=landing&utm_campaign=summer&unknown=drop",
        ORIGIN,
    );

    assert.equal(
        safeApplicationReturnPath(entry),
        "/app/new?market=ru&utm_source=landing&utm_campaign=summer",
    );
    assert.equal(applicationRouteContext(entry).market, "ru");
});

test("top-level navigation maps views to canonical paths and preserves only allowed query", () => {
    const location = new URL("/app?market=ru&utm_source=landing&payment=success&unknown=drop", ORIGIN);
    assert.equal(applicationTopLevelReturnPath("dashboard", location), "/app?market=ru&utm_source=landing");
    assert.equal(applicationTopLevelReturnPath("renders", location), "/app/history?market=ru&utm_source=landing");
    assert.equal(applicationTopLevelReturnPath("wallet", location), "/app/wallet?market=ru&utm_source=landing");
    assert.equal(applicationTopLevelReturnPath("settings", location), "/app/settings?market=ru&utm_source=landing");
    assert.equal(applicationTopLevelReturnPath("fitment", location), null);
});

test("unsafe and non-application return targets are rejected", () => {
    for (const target of [
        "https://evil.example/",
        "//evil.example/app/new",
        "javascript:alert(1)",
        "data:text/html,unsafe",
        "/admin",
        "/api/backend/auth/me",
        "/t/",
        "/app/unknown",
    ]) {
        assert.equal(safeApplicationReturnPath(target, ORIGIN), null, target);
    }
});
