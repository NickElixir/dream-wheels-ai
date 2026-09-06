import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    AUTH_SESSION_STATES,
} from "./supabase-client.js";
import { createFrontendAuthController } from "./app-auth.js";

function fakeSessionController({ sessionPresent = false, accessToken = "opaque-test-token", refreshAccessToken = "refreshed-test-token", onRefresh = null } = {}) {
    let currentAccessToken = accessToken;
    let refreshCalls = 0;
    let current = {
        status: sessionPresent ? AUTH_SESSION_STATES.AUTHENTICATED : AUTH_SESSION_STATES.UNAUTHENTICATED,
        sessionPresent,
    };
    let listener = null;
    return {
        initializeAuthSession: async () => current,
        getAccessToken: async () => currentAccessToken,
        refreshSession: async () => {
            refreshCalls += 1;
            await onRefresh?.();
            currentAccessToken = refreshAccessToken;
            current = { ...current, status: AUTH_SESSION_STATES.AUTHENTICATED, sessionPresent: true };
            listener?.(current, "TOKEN_REFRESHED");
            return { session: { access_token: currentAccessToken } };
        },
        getRefreshCalls: () => refreshCalls,
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

function okBootstrapResponse() {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            account: {
                balance: 3,
                starter_grant_granted_now: false,
                saved_name: null,
            },
        }),
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

test("requesting an email code never authenticates an unauthenticated session", async () => {
    const session = fakeSessionController();
    let otpCalls = 0;
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        otpRequest: async () => {
            otpCalls += 1;
            return { accepted: true };
        },
    });

    await auth.initialize();
    await auth.requestEmailOtp("person@example.test", "turnstile-token");

    assert.equal(otpCalls, 1);
    assert.equal(auth.getState().status, AUTH_SESSION_STATES.UNAUTHENTICATED);
    assert.equal(auth.getState().interactionState, "otp_requested");
});

test("restored-session race blocks OTP and never invokes the provider", async () => {
    let releaseInitialization;
    const initialization = new Promise((resolve) => { releaseInitialization = resolve; });
    let otpCalls = 0;
    const session = {
        ...fakeSessionController({ sessionPresent: true }),
        initializeAuthSession: async () => initialization,
    };
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        otpRequest: async () => {
            otpCalls += 1;
            return { accepted: true };
        },
        fetchImpl: async (input) => input === "/api/backend/auth/me"
            ? okMeResponse()
            : okBootstrapResponse(),
    });

    const request = auth.requestEmailOtp("person@example.test", "turnstile-token");
    releaseInitialization();

    await assert.rejects(request, (error) => error?.code === "ALREADY_AUTHENTICATED");
    assert.equal(otpCalls, 0);
    assert.equal(auth.getState().interactionState, "authenticated");
    assert.equal(auth.getState().authenticationSource, "restored_session");
});

test("repeated request-code attempts with a restored session are rejected deterministically", async () => {
    const session = fakeSessionController({ sessionPresent: true });
    let otpCalls = 0;
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        otpRequest: async () => {
            otpCalls += 1;
            return { accepted: true };
        },
        fetchImpl: async (input) => input === "/api/backend/auth/me"
            ? okMeResponse()
            : okBootstrapResponse(),
    });

    await auth.initialize();
    await assert.rejects(
        auth.requestEmailOtp("person@example.test", "turnstile-token"),
        (error) => error?.code === "ALREADY_AUTHENTICATED",
    );

    assert.equal(otpCalls, 0);
});

test("valid Supabase session is principal-verified and opens the protected API boundary", async () => {
    const session = fakeSessionController({ sessionPresent: true });
    const requests = [];
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async (...args) => {
            requests.push(args);
            return okMeResponse();
        },
    });

    await auth.initialize();

    assert.deepEqual(auth.getState(), {
        status: AUTH_SESSION_STATES.AUTHENTICATED,
        authority: "supabase",
        authChannel: "email_otp",
        principalVerified: true,
        protectedApiReady: true,
        sessionPresent: true,
        errorCode: null,
        interactionState: "authenticated",
        authenticationSource: "restored_session",
        account: null,
    });
    assert.equal(requests[0][0], "/api/backend/auth/me");
    assert.match(requests[0][1].headers.Authorization, /^Bearer /u);
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
    assert.equal(auth.getState().protectedApiReady, true);
});

test("Supabase authenticatedFetch adds the current bearer and preserves the response", async () => {
    const session = fakeSessionController({ sessionPresent: true, accessToken: "supabase-token-a" });
    const requests = [];
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async (...args) => {
            requests.push(args);
            if (requests.length === 1) return okMeResponse();
            if (requests.length === 2) return okBootstrapResponse();
            return { ok: true, status: 200, marker: "business" };
        },
    });

    await auth.initialize();
    const response = await auth.authenticatedFetch("/api/jobs", {
        headers: { Accept: "application/json", Authorization: "Bearer stale" },
    });

    assert.equal(response.marker, "business");
    assert.equal(requests[2][1].headers.get("Authorization"), "Bearer supabase-token-a");
    assert.equal(requests[2][1].headers.get("Accept"), "application/json");
});

test("Supabase 401 refreshes once and retries with a fresh bearer", async () => {
    const session = fakeSessionController({ sessionPresent: true, accessToken: "supabase-token-a", refreshAccessToken: "supabase-token-b" });
    const requests = [];
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async (...args) => {
            requests.push(args);
            if (requests.length === 1) return okMeResponse();
            if (requests.length === 2) return okBootstrapResponse();
            return requests.length === 3 ? { ok: false, status: 401 } : { ok: true, status: 200 };
        },
    });

    await auth.initialize();
    const response = await auth.authenticatedFetch("/api/jobs", { method: "GET" });

    assert.equal(response.status, 200);
    assert.equal(session.getRefreshCalls(), 1);
    assert.equal(requests.length, 4);
    assert.equal(requests[2][1].headers.get("Authorization"), "Bearer supabase-token-a");
    assert.equal(requests[3][1].headers.get("Authorization"), "Bearer supabase-token-b");
});

test("a second Supabase 401 expires the session without a third request", async () => {
    const session = fakeSessionController({ sessionPresent: true });
    let businessCalls = 0;
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async (input) => {
            if (input === "/api/backend/auth/me") return okMeResponse();
            if (input === "/api/backend/auth/bootstrap") return okBootstrapResponse();
            businessCalls += 1;
            return { ok: false, status: 401 };
        },
    });

    await auth.initialize();
    const response = await auth.authenticatedFetch("/api/jobs");

    assert.equal(response.status, 401);
    assert.equal(businessCalls, 2);
    assert.equal(session.getRefreshCalls(), 1);
    assert.equal(auth.getState().status, AUTH_SESSION_STATES.SESSION_EXPIRED);
    assert.equal(auth.getState().protectedApiReady, false);
});

test("concurrent Supabase 401s share one refresh attempt", async () => {
    const session = fakeSessionController({
        sessionPresent: true,
        accessToken: "supabase-token-a",
        refreshAccessToken: "supabase-token-b",
        onRefresh: () => new Promise((resolve) => setTimeout(resolve, 10)),
    });
    let calls = 0;
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async (input) => {
            if (input === "/api/backend/auth/me") return okMeResponse();
            if (input === "/api/backend/auth/bootstrap") return okBootstrapResponse();
            calls += 1;
            if (calls === 1 || calls === 2) return { ok: false, status: 401 };
            return { ok: true, status: 200 };
        },
    });

    await auth.initialize();
    const responses = await Promise.all([
        auth.authenticatedFetch("/api/jobs/1"),
        auth.authenticatedFetch("/api/jobs/2"),
    ]);

    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(session.getRefreshCalls(), 1);
    assert.equal(calls, 4);
});

test("missing authority fails locally without sending an anonymous protected request", async () => {
    let fetchCalls = 0;
    const auth = createFrontendAuthController({
        integrationEnabled: () => true,
        fetchImpl: async () => {
            fetchCalls += 1;
            return okMeResponse();
        },
    });

    await assert.rejects(
        auth.authenticatedFetch("/api/jobs"),
        (error) => error?.code === "AUTH_REQUIRED",
    );
    assert.equal(fetchCalls, 0);
});

test("FormData keeps caller headers and does not receive a manual multipart content type", async () => {
    const session = fakeSessionController({ sessionPresent: true });
    const requests = [];
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        fetchImpl: async (...args) => {
            requests.push(args);
            if (requests.length === 1) return okMeResponse();
            if (requests.length === 2) return okBootstrapResponse();
            return { ok: true, status: 200 };
        },
    });

    await auth.initialize();
    const formData = new FormData();
    formData.append("file", "fixture");
    await auth.authenticatedFetch("/api/identity/resolve", {
        method: "POST",
        headers: new Headers({ Accept: "application/json" }),
        body: formData,
    });

    const headers = requests[2][1].headers;
    assert.equal(headers.get("Authorization"), "Bearer opaque-test-token");
    assert.equal(headers.has("Content-Type"), false);
    assert.equal(headers.get("Accept"), "application/json");
});

test("legacy website Telegram routing does not look up a Supabase token", async () => {
    const session = fakeSessionController();
    let legacyTokenReads = 0;
    let requests = [];
    const auth = createFrontendAuthController({
        sessionController: session,
        integrationEnabled: () => true,
        hasLegacyWebsiteAuth: () => true,
        fetchImpl: async (...args) => {
            requests.push(args);
            return requests.length === 1 ? okMeResponse() : { ok: true, status: 200 };
        },
    });
    auth.configure({
        getLegacyWebsiteAuthToken: () => {
            legacyTokenReads += 1;
            return "legacy-telegram-bearer";
        },
    });

    await auth.initialize();
    await auth.authenticatedFetch("/api/payments/cabinet");

    assert.equal(requests.length, 1);
    assert.equal(requests[0][1].headers.get("Authorization"), "Bearer legacy-telegram-bearer");
    assert.equal(legacyTokenReads > 0, true);
});

test("main WebApp keeps Supabase UI auth separate from the legacy protected API boundary", async () => {
    const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

    assert.match(appSource, /state\.frontendAuthState\?\.protectedApiReady === true/u);
    assert.match(appSource, /state\.frontendAuthState\?\.authority === "supabase"/u);
    assert.match(appSource, /const accessToken = getWebsiteAuthToken\(\);/u);
    assert.doesNotMatch(appSource, /function withAuthHeaders[\s\S]*?getAccessToken\(\)/u);
});
