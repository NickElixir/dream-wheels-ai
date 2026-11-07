import test from "node:test";
import assert from "node:assert/strict";
import {
    applicationRouteContext,
    applicationRouteRequiresAuth,
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
        "/new?market=ru&utm_source=landing&utm_campaign=summer",
    );
    assert.equal(applicationRouteContext(entry).market, "ru");
});

test("top-level navigation maps views to canonical paths and preserves only allowed query", () => {
    const location = new URL("/?market=ru&utm_source=landing&payment=success&unknown=drop", ORIGIN);
    assert.equal(applicationTopLevelReturnPath("dashboard", location), "/?market=ru&utm_source=landing");
    assert.equal(applicationTopLevelReturnPath("renders", location), "/history?market=ru&utm_source=landing");
    assert.equal(applicationTopLevelReturnPath("wallet", location), "/balance?market=ru&utm_source=landing");
    assert.equal(applicationTopLevelReturnPath("settings", location), "/account?market=ru&utm_source=landing");
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

test("new, create aliases and dashboard require auth; support stays public", () => {
    for (const path of ["/", "/new", "/create", "/app/new", "/history", "/balance", "/account"]) {
        assert.equal(applicationRouteRequiresAuth(applicationRouteContext(new URL(path, ORIGIN))), true, path);
    }
    for (const path of ["/help", "/help/photos", "/documents"]) {
        assert.equal(applicationRouteRequiresAuth(applicationRouteContext(new URL(path, ORIGIN))), false, path);
    }
    assert.equal(applicationRouteRequiresAuth(null), false);
});
test("legacy entries resolve to root canonical return paths", () => {
    for (const [old, canonical] of [["/app", "/"], ["/app/new", "/new"], ["/create", "/new"], ["/app/history", "/history"], ["/app/wallet", "/balance"], ["/app/settings", "/account"], ["/app/support", "/help"], ["/app/photo-guide", "/help/photos"], ["/app/docs", "/documents"]]) {
        const url = new URL(old + "?utm_source=landing&token=secret", ORIGIN);
        assert.equal(safeApplicationReturnPath(url), canonical + "?utm_source=landing");
        assert.equal(applicationRouteContext(url).path, canonical);
    }
});
