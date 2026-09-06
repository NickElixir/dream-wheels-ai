import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    AUTH_SESSION_STATES,
} from "./supabase-client.js";
import { createFrontendAuthController } from "./app-auth.js";

function fakeSessionController({ sessionPresent = false, accessToken = "opaque-test-token" } = {}) {
    let current = {
        status: sessionPresent ? AUTH_SESSION_STATES.AUTHENTICATED : AUTH_SESSION_STATES.UNAUTHENTICATED,
        sessionPresent,
    };
    let listener = null;
    return {
        initializeAuthSession: async () => current,
        getAccessToken: async () => accessToken,
        getAuthSessionState: () => ({ ...current }),
        subscribeToAuthChanges: (next) => {
            listener = next;
            return () => { listener = null; };
        },
        signOut: async () => {
            current = { status: AUTH_SESSION_STATES.UNAUTHENTICATED, sessionPresent: false };
            listener?.(current, "SIGNED_OUT");
        },
    };
}

function okMeResponse() {
    return {
        ok: true,
        status: 200,
        json: async () => ({ authenticated: true, authority: "supabase", auth_channel: "email_otp" }),
    };
}

test("no stored Supabase session resolves to unauthenticated", async () => {
    const session = fakeSessionController();
    let probeCalls = 0;
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async () => {
            probeCalls += 1;
            return okMeResponse();
        },
    });

    await auth.initialize();

    assert.equal(auth.getState().status, AUTH_SESSION_STATES.UNAUTHENTICATED);
    assert.equal(auth.getState().authority, null);
    assert.equal(probeCalls, 0);
});

test("valid Supabase session is principal-verified but protected API remains gated", async () => {
    const session = fakeSessionController({ sessionPresent: true });
    let request;
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async (...args) => {
            request = args;
            return okMeResponse();
        },
    });

    await auth.initialize();

    assert.deepEqual(auth.getState(), {
        status: AUTH_SESSION_STATES.AUTHENTICATED,
        authority: "supabase",
        authChannel: "email_otp",
        principalVerified: true,
        protectedApiReady: false,
        sessionPresent: true,
        errorCode: null,
    });
    assert.equal(request[0], "/api/backend/auth/me");
    assert.match(request[1].headers.Authorization, /^Bearer /u);
    assert.equal(Object.hasOwn(auth.getState(), "accessToken"), false);
});

test("a 401 keeps the Supabase session isolated and marks it expired", async () => {
    const session = fakeSessionController({ sessionPresent: true });
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }),
        hasLegacyWebsiteAuth: () => true,
    });

    await auth.initialize();

    assert.equal(auth.getState().status, AUTH_SESSION_STATES.SESSION_EXPIRED);
    assert.equal(auth.getState().authority, "supabase");
    assert.equal(auth.getState().protectedApiReady, false);
});

test("network failure does not destructively clear a persisted session", async () => {
    const session = fakeSessionController({ sessionPresent: true });
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async () => { throw new TypeError("network unavailable"); },
    });

    await auth.initialize();

    assert.equal(auth.getState().status, AUTH_SESSION_STATES.NETWORK_ERROR);
    assert.equal(auth.getState().sessionPresent, true);
    assert.equal(auth.getState().authority, "supabase");
});

test("Telegram Mini App authority prevents Supabase initialization", async () => {
    let initialized = false;
    const auth = createFrontendAuthController({
        sessionController: {
            ...fakeSessionController({ sessionPresent: true }),
            initializeAuthSession: async () => { initialized = true; },
        },
        integrationEnabled: () => true,
        isTelegramMiniApp: () => true,
        fetchImpl: async () => okMeResponse(),
    });

    await auth.initialize();

    assert.equal(initialized, false);
    assert.equal(auth.getState().authority, "telegram");
    assert.equal(auth.getState().authChannel, "mini_app");
    assert.equal(auth.getState().protectedApiReady, true);
});

test("legacy website Telegram remains the fallback when Supabase has no session", async () => {
    const session = fakeSessionController();
    let legacyLogoutCalls = 0;
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        hasLegacyWebsiteAuth: () => true,
        legacySignOut: () => { legacyLogoutCalls += 1; },
    });

    await auth.initialize();
    assert.equal(auth.getState().authority, "telegram");
    assert.equal(auth.getState().authChannel, "website_telegram");
    assert.equal(auth.getState().protectedApiReady, true);

    await auth.signOut();
    assert.equal(legacyLogoutCalls, 1);
    assert.equal(auth.getState().status, AUTH_SESSION_STATES.UNAUTHENTICATED);
});

test("OTP verification delegates to the foundation and probes the canonical principal", async () => {
    const session = fakeSessionController({ sessionPresent: true });
    let verifiedArgs;
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        otpVerify: async (...args) => {
            verifiedArgs = args;
            return { authenticated: true };
        },
        fetchImpl: async () => okMeResponse(),
    });

    await auth.verifyEmailOtp("user@example.test", "123456");

    assert.deepEqual(verifiedArgs, ["user@example.test", "123456"]);
    assert.equal(auth.getState().principalVerified, true);
    assert.equal(auth.getState().protectedApiReady, false);
});

test("main WebApp keeps Supabase UI auth separate from the legacy protected API boundary", async () => {
    const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

    assert.match(appSource, /state\.frontendAuthState\?\.protectedApiReady === true/u);
    assert.match(appSource, /state\.frontendAuthState\?\.authority === "supabase"/u);
    assert.match(appSource, /const accessToken = getWebsiteAuthToken\(\);/u);
    assert.doesNotMatch(appSource, /function withAuthHeaders[\s\S]*?getAccessToken\(\)/u);
});
