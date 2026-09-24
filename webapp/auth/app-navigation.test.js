import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { applicationRouteContext, applicationTopLevelReturnPath } from "../app-route.mjs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const origin = "https://dreamwheels.example";

function sourceBetween(startMarker, endMarker) {
    const start = app.indexOf(startMarker);
    const end = app.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `source markers missing: ${startMarker}`);
    return app.slice(start, end);
}

function element() {
    return {
        hidden: false,
        dataset: {},
        setAttribute() {},
        toggleAttribute(name, hidden) { if (name === "hidden") this.hidden = hidden; },
    };
}

test("setView keeps the browser URL and application route aligned only for top-level views", () => {
    const state = {
        view: "dashboard",
        applicationAuthRequired: true,
        applicationRoute: applicationRouteContext(new URL("/app?market=ru", origin)),
    };
    const window = {
        location: new URL("/app?market=ru", origin),
        history: {
            state: { marker: true },
            replaceState(nextState, unused, target) {
                this.state = nextState;
                window.location = new URL(target, origin);
            },
        },
        scrollTo() {},
    };
    const context = {
        state,
        window,
        document: { querySelectorAll: () => [], querySelector: () => null },
        HAS_TG: false,
        PERSISTED_TOP_LEVEL_VIEWS: new Set(["dashboard", "renders", "wallet", "settings"]),
        applicationTopLevelReturnPath,
        applicationRouteContext,
        clearFitmentCheckPolling() {},
        clearRenderHistoryPolling() {},
        updateTopbarCaption() {},
        setMenuOpen() {},
        setMoreOpen() {},
        refreshButtonsForCurrentView() {},
    };
    const setView = runInNewContext(
        `${sourceBetween("function setView(", "function lastTelegramTopLevelView()")}; setView`,
        context,
    );

    setView("renders", { refreshData: false });
    assert.equal(window.location.pathname, "/app/history");
    assert.equal(window.location.search, "?market=ru");
    assert.equal(state.applicationRoute.view, "renders");
    assert.equal(state.applicationAuthReturnPath, "/app/history?market=ru");

    setView("fitment", { refreshData: false });
    assert.equal(window.location.pathname, "/app/history");
    assert.equal(state.applicationRoute.view, "renders");
});

test("an already-unlocked auth wall stays open during a transient recheck but closes on revocation", () => {
    const appElement = element();
    const gateElement = element();
    const elements = new Map([
        ["#app", appElement],
        ["[data-application-auth-gate]", gateElement],
        [".desktop-sidebar", element()],
        [".mobile-bottom-nav", element()],
    ]);
    const state = {
        applicationAuthRequired: true,
        applicationAuthGateReady: false,
        applicationRoute: { view: "dashboard" },
        view: "dashboard",
        frontendAuthState: {
            status: "AUTHENTICATED",
            authority: "supabase",
            principalVerified: true,
            protectedApiReady: true,
            sessionPresent: true,
        },
    };
    const context = {
        state,
        document: { querySelector: (selector) => elements.get(selector) || null },
        t: (key) => key,
        setView() { throw new Error("unexpected route reset"); },
    };
    const syncApplicationAuthWall = runInNewContext(
        `${sourceBetween("function isApplicationAuthGranted()", "function initializeApplicationRoute()")}; syncApplicationAuthWall`,
        context,
    );

    syncApplicationAuthWall();
    assert.equal(appElement.hidden, false);
    assert.equal(gateElement.hidden, true);
    state.view = "fitment";
    syncApplicationAuthWall();

    state.frontendAuthState = {
        ...state.frontendAuthState,
        status: "BOOTSTRAPPING",
        principalVerified: false,
        protectedApiReady: false,
    };
    state.frontendAuthEvent = "PROBING_PRINCIPAL";
    syncApplicationAuthWall();
    assert.equal(appElement.hidden, false);
    assert.equal(gateElement.hidden, true);
    assert.equal(state.view, "fitment");

    state.frontendAuthState.status = "SESSION_EXPIRED";
    state.frontendAuthEvent = "ME_REJECTED";
    syncApplicationAuthWall();
    assert.equal(appElement.hidden, true);
    assert.equal(gateElement.hidden, false);

    state.frontendAuthState.status = "AUTHENTICATED";
    state.frontendAuthState.principalVerified = true;
    state.frontendAuthState.protectedApiReady = true;
    state.view = "dashboard";
    syncApplicationAuthWall();
    state.frontendAuthState.status = "BOOTSTRAPPING";
    state.frontendAuthState.principalVerified = false;
    state.frontendAuthState.protectedApiReady = false;
    state.frontendAuthEvent = "AUTH_IDENTITY_CHANGED";
    syncApplicationAuthWall();
    assert.equal(appElement.hidden, true);
    assert.equal(gateElement.hidden, false);
});
