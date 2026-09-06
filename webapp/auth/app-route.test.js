import test from "node:test";
import assert from "node:assert/strict";
import {
    applicationRouteContext,
    applicationRouteView,
    isApplicationRoute,
    safeApplicationReturnPath,
} from "../app-route.js";

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

