import assert from "node:assert/strict";
import { test } from "node:test";

import {
    AUTH_SESSION_STATES,
    AuthOtpError,
    createEmailOtpController,
    createAuthSessionController,
    getAuthRuntimeConfig,
    RELEASE_1_EMAIL_OTP_LENGTH,
} from "./supabase-client.js";
import { trackAuthEvent } from "./telemetry.js";

const session = {
    access_token: "access-token-for-test-only",
    refresh_token: "refresh-token-for-test-only",
    expires_at: 1_800_000_000,
};

function fakeClient({ initialSession = null, refreshResult = {}, otpRequestResult = {}, verifyResult = {} } = {}) {
    let currentSession = initialSession;
    let callback;
    let signOutCalls = 0;
    let otpRequest;
    const auth = {
        onAuthStateChange(listener) {
            callback = listener;
            return { data: { subscription: { unsubscribe() { callback = null; } } } };
        },
        async getSession() {
            return { data: { session: currentSession }, error: null };
        },
        async refreshSession() {
            if (refreshResult.error) return { data: { session: null }, error: refreshResult.error };
            currentSession = refreshResult.session || currentSession;
            callback?.("TOKEN_REFRESHED", currentSession);
            return { data: { session: currentSession }, error: null };
        },
        async signInWithOtp(request) {
            otpRequest = request;
            if (otpRequestResult.throwError) throw otpRequestResult.throwError;
            return { data: { user: null, session: null }, error: otpRequestResult.error || null };
        },
        async verifyOtp(request) {
            if (verifyResult.throwError) throw verifyResult.throwError;
            if (verifyResult.error) return { data: { session: null }, error: verifyResult.error };
            currentSession = verifyResult.session || { ...session, access_token: "verified-access-token" };
            callback?.("SIGNED_IN", currentSession);
            return { data: { session: currentSession }, error: null };
        },
        async signOut() {
            signOutCalls += 1;
            currentSession = null;
            callback?.("SIGNED_OUT", null);
            return { error: null };
        },
        emit(event, nextSession) {
            currentSession = nextSession;
            callback?.(event, nextSession);
        },
    };
    return {
        client: { auth },
        refreshResult,
        get signOutCalls() { return signOutCalls; },
        get otpRequest() { return otpRequest; },
    };
}

test("initialization distinguishes no stored session from bootstrapping", async () => {
    const { client } = fakeClient();
    const controller = createAuthSessionController({ client });

    assert.equal(controller.getAuthSessionState().status, AUTH_SESSION_STATES.BOOTSTRAPPING);
    await controller.initializeAuthSession();
    assert.equal(controller.getAuthSessionState().status, AUTH_SESSION_STATES.UNAUTHENTICATED);
});

test("stored session restores as authenticated with safe metadata only", async () => {
    const { client } = fakeClient({ initialSession: session });
    const controller = createAuthSessionController({ client });

    await controller.initializeAuthSession();
    assert.deepEqual(controller.getAuthSessionState(), {
        status: AUTH_SESSION_STATES.AUTHENTICATED,
        sessionPresent: true,
        accessTokenExpiresAt: 1_800_000_000,
        lastEvent: "INITIAL_SESSION",
        errorCode: null,
    });
});

test("access token is obtained on demand and not stored in state", async () => {
    const { client } = fakeClient({ initialSession: session });
    const controller = createAuthSessionController({ client });

    await controller.initializeAuthSession();
    assert.equal(await controller.getAccessToken(), "access-token-for-test-only");
    assert.equal("access_token" in controller.getAuthSessionState(), false);
    assert.equal("refresh_token" in controller.getAuthSessionState(), false);
});

test("auth events update isolated state without application integration", async () => {
    const { client } = fakeClient();
    const controller = createAuthSessionController({ client });
    const events = [];
    controller.subscribeToAuthChanges((nextState, event) => events.push([nextState.status, event]));

    await controller.initializeAuthSession();
    client.auth.emit("SIGNED_IN", session);
    client.auth.emit("USER_UPDATED", session);
    client.auth.emit("SIGNED_OUT", null);

    assert.deepEqual(events.slice(-3), [
        [AUTH_SESSION_STATES.AUTHENTICATED, "SIGNED_IN"],
        [AUTH_SESSION_STATES.AUTHENTICATED, "USER_UPDATED"],
        [AUTH_SESSION_STATES.UNAUTHENTICATED, "SIGNED_OUT"],
    ]);
});

test("successful refresh preserves authentication and emits TOKEN_REFRESHED", async () => {
    const refreshed = { ...session, access_token: "new-access-token", expires_at: 1_800_001_000 };
    const { client } = fakeClient({ initialSession: session, refreshResult: { session: refreshed } });
    const controller = createAuthSessionController({ client });
    const states = [];
    controller.subscribeToAuthChanges((nextState) => states.push(nextState.status));

    await controller.initializeAuthSession();
    const result = await controller.refreshSession();

    assert.equal(result.access_token, "new-access-token");
    assert.equal(controller.getAuthSessionState().status, AUTH_SESSION_STATES.AUTHENTICATED);
    assert.ok(states.includes(AUTH_SESSION_STATES.REFRESHING));
});

test("temporary refresh failure is non-destructive and recoverable", async () => {
    const refreshResult = { error: { code: "network_error", message: "Network timeout" } };
    const { client } = fakeClient({
        initialSession: session,
        refreshResult,
    });
    const controller = createAuthSessionController({ client });
    await controller.initializeAuthSession();

    await assert.rejects(controller.refreshSession(), { code: AUTH_SESSION_STATES.NETWORK_ERROR });
    assert.equal(controller.getAuthSessionState().sessionPresent, true);
    assert.equal(controller.getAuthSessionState().status, AUTH_SESSION_STATES.NETWORK_ERROR);

    refreshResult.error = null;
    await controller.refreshSession();
    assert.equal(controller.getAuthSessionState().status, AUTH_SESSION_STATES.AUTHENTICATED);
});

test("invalid refresh token becomes SESSION_EXPIRED without calling signOut", async () => {
    const fake = fakeClient({
        initialSession: session,
        refreshResult: { error: { code: "invalid_grant", message: "Invalid refresh token" } },
    });
    const controller = createAuthSessionController({ client: fake.client });
    await controller.initializeAuthSession();

    await assert.rejects(controller.refreshSession(), { code: AUTH_SESSION_STATES.SESSION_EXPIRED });
    assert.equal(controller.getAuthSessionState().status, AUTH_SESSION_STATES.SESSION_EXPIRED);
    assert.equal(fake.signOutCalls, 0);
});

test("logout delegates storage cleanup to Supabase and does not touch unrelated state", async () => {
    const fake = fakeClient({ initialSession: session });
    const controller = createAuthSessionController({ client: fake.client });
    await controller.initializeAuthSession();

    await controller.signOut();

    assert.equal(fake.signOutCalls, 1);
    assert.equal(controller.getAuthSessionState().status, AUTH_SESSION_STATES.UNAUTHENTICATED);
    assert.equal(controller.getAuthSessionState().sessionPresent, false);
});

test("a second controller restores the same shared browser session", async () => {
    const sharedStorage = { session };
    const first = fakeClient({ initialSession: sharedStorage.session });
    const second = fakeClient({ initialSession: sharedStorage.session });
    const firstController = createAuthSessionController({ client: first.client });
    const secondController = createAuthSessionController({ client: second.client });

    await firstController.initializeAuthSession();
    await secondController.initializeAuthSession();

    assert.equal(firstController.getAuthSessionState().sessionPresent, true);
    assert.equal(secondController.getAuthSessionState().sessionPresent, true);
    assert.equal(firstController.getAuthSessionState().accessTokenExpiresAt, 1_800_000_000);
    assert.equal(secondController.getAuthSessionState().accessTokenExpiresAt, 1_800_000_000);
});

test("persistent session restoration emits one safe telemetry event", async () => {
    const events = [];
    const { client } = fakeClient({ initialSession: session });
    const controller = createAuthSessionController({
        client,
        telemetry: (eventName, properties) => events.push([eventName, properties]),
    });

    await controller.initializeAuthSession();
    client.auth.emit("INITIAL_SESSION", session);

    assert.deepEqual(events, [["session_restored", { source: "persistent_storage", outcome: "success" }]]);
});

test("valid OTP request accepts new-user creation and emits the approved sequence prefix", async () => {
    const events = [];
    const fake = fakeClient();
    const sessionController = createAuthSessionController({ client: fake.client });
    const otp = createEmailOtpController({
        client: fake.client,
        sessionController,
        telemetry: (eventName, properties) => events.push([eventName, properties]),
    });

    assert.deepEqual(await otp.requestEmailOtp("person@example.com"), { accepted: true });
    assert.deepEqual(fake.otpRequest, {
        email: "person@example.com",
        options: { shouldCreateUser: true },
    });
    assert.deepEqual(events, [
        ["auth_started", { outcome: "success" }],
        ["otp_requested", { outcome: "success" }],
    ]);
});

test("Release 1 defaults to a six-digit OTP and only exposes a public Turnstile site key", () => {
    const originalConfig = globalThis.__DREAM_WHEELS_AUTH_CONFIG__;
    try {
        globalThis.__DREAM_WHEELS_AUTH_CONFIG__ = { turnstileSiteKey: "  1x00000000000000000000AA  " };
        assert.deepEqual(getAuthRuntimeConfig(), {
            otpLength: RELEASE_1_EMAIL_OTP_LENGTH,
            resendWindowSeconds: 60,
            resendWindowConfigured: false,
            turnstileSiteKey: "1x00000000000000000000AA",
        });
    } finally {
        if (originalConfig === undefined) delete globalThis.__DREAM_WHEELS_AUTH_CONFIG__;
        else globalThis.__DREAM_WHEELS_AUTH_CONFIG__ = originalConfig;
    }
});

test("OTP request passes a one-time Turnstile token to Supabase without telemetry leakage", async () => {
    const fake = fakeClient();
    const otp = createEmailOtpController({
        client: fake.client,
        sessionController: createAuthSessionController({ client: fake.client }),
    });

    await otp.requestEmailOtp("person@example.com", "turnstile-token-for-test-only");
    assert.deepEqual(fake.otpRequest, {
        email: "person@example.com",
        options: {
            shouldCreateUser: true,
            captchaToken: "turnstile-token-for-test-only",
        },
    });
});

test("OTP request normalizes invalid email, rate limit, and network failures", async () => {
    const fake = fakeClient({ otpRequestResult: { error: { status: 429, message: "too many requests" } } });
    const otp = createEmailOtpController({
        client: fake.client,
        sessionController: createAuthSessionController({ client: fake.client }),
    });

    await assert.rejects(otp.requestEmailOtp("not-an-email"), (error) => error instanceof AuthOtpError && error.code === "unknown");
    await assert.rejects(otp.requestEmailOtp("person@example.com"), (error) => error.code === "rate_limited");

    const networkFake = fakeClient({ otpRequestResult: { throwError: new TypeError("network down") } });
    const networkOtp = createEmailOtpController({
        client: networkFake.client,
        sessionController: createAuthSessionController({ client: networkFake.client }),
    });
    await assert.rejects(networkOtp.requestEmailOtp("person@example.com"), (error) => error.code === "network_error");
});

test("correct OTP creates a session and emits otp_verified then auth_completed", async () => {
    const events = [];
    const verifiedSession = { ...session, access_token: "verified-access-token" };
    const fake = fakeClient({ verifyResult: { session: verifiedSession } });
    const sessionController = createAuthSessionController({ client: fake.client });
    const otp = createEmailOtpController({
        client: fake.client,
        sessionController,
        telemetry: (eventName, properties) => events.push([eventName, properties]),
    });

    assert.deepEqual(await otp.verifyEmailOtp("person@example.com", "123456"), { authenticated: true });
    assert.equal(sessionController.getAuthSessionState().status, AUTH_SESSION_STATES.AUTHENTICATED);
    assert.deepEqual(events, [
        ["otp_verified", { outcome: "success" }],
        ["auth_completed", { outcome: "success" }],
    ]);
});

test("OTP verification normalizes invalid and expired codes without exposing provider text", async () => {
    for (const [providerError, expectedCode] of [
        [{ code: "invalid_otp", message: "provider detail" }, "invalid_otp"],
        [{ code: "otp_expired", message: "provider detail" }, "expired_otp"],
    ]) {
        const fake = fakeClient({ verifyResult: { error: providerError } });
        const otp = createEmailOtpController({
            client: fake.client,
            sessionController: createAuthSessionController({ client: fake.client }),
        });
        await assert.rejects(otp.verifyEmailOtp("person@example.com", "123456"), (error) => error.code === expectedCode && !error.message.includes("provider detail"));
    }
});

test("OTP verification rejects a non-six-digit code before contacting Supabase", async () => {
    const fake = fakeClient();
    const otp = createEmailOtpController({
        client: fake.client,
        sessionController: createAuthSessionController({ client: fake.client }),
    });

    await assert.rejects(
        otp.verifyEmailOtp("person@example.com", "12345"),
        (error) => error instanceof AuthOtpError && error.code === "invalid_otp",
    );
});

test("CAPTCHA failures normalize safely without provider detail", async () => {
    const fake = fakeClient({
        otpRequestResult: { error: { code: "captcha_failed", message: "CAPTCHA provider rejected a private token" } },
    });
    const otp = createEmailOtpController({
        client: fake.client,
        sessionController: createAuthSessionController({ client: fake.client }),
    });

    await assert.rejects(
        otp.requestEmailOtp("person@example.com", "turnstile-token-for-test-only"),
        (error) => error instanceof AuthOtpError
            && error.code === "provider_error"
            && !error.message.includes("private token"),
    );

    const expiredCaptcha = fakeClient({
        otpRequestResult: { error: { message: "CAPTCHA token expired" } },
    });
    const expiredCaptchaOtp = createEmailOtpController({
        client: expiredCaptcha.client,
        sessionController: createAuthSessionController({ client: expiredCaptcha.client }),
    });
    await assert.rejects(
        expiredCaptchaOtp.requestEmailOtp("person@example.com", "turnstile-token-for-test-only"),
        (error) => error instanceof AuthOtpError && error.code === "provider_error",
    );
});

test("analytics failure cannot block OTP verification", async () => {
    const fake = fakeClient({ verifyResult: { session } });
    const otp = createEmailOtpController({
        client: fake.client,
        sessionController: createAuthSessionController({ client: fake.client }),
        telemetry: () => { throw new Error("analytics unavailable"); },
    });

    assert.deepEqual(await otp.verifyEmailOtp("person@example.com", "123456"), { authenticated: true });
});

test("analytics payload allowlists safe fields and excludes email, OTP, tokens, session, and raw errors", async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    const originalStorage = globalThis.localStorage;
    globalThis.fetch = async (_url, options) => {
        calls.push(JSON.parse(options.body));
        return { ok: true };
    };
    globalThis.localStorage = {
        getItem() { return null; },
        setItem() {},
    };
    try {
        await trackAuthEvent("auth_failed", {
            outcome: "failed",
            error_code: "invalid_otp",
            email: "person@example.com",
            otp: "123456",
            access_token: "access-token",
            refresh_token: "refresh-token",
            session: { access_token: "access-token" },
            raw_error: "provider detail",
        });
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.localStorage = originalStorage;
    }
    assert.deepEqual(calls[0].properties, {
        provider: "email",
        authority: "supabase",
        flow: "otp",
        site: "ru",
        outcome: "failed",
        error_code: "invalid_otp",
    });
    assert.equal(JSON.stringify(calls[0]).includes("person@example.com"), false);
    assert.equal(JSON.stringify(calls[0]).includes("123456"), false);
    assert.equal(JSON.stringify(calls[0]).includes("access-token"), false);
    assert.equal(JSON.stringify(calls[0]).includes("provider detail"), false);
});

test("successful TOKEN_REFRESHED does not emit refresh telemetry", async () => {
    const events = [];
    const fake = fakeClient({ initialSession: session, refreshResult: { session } });
    const controller = createAuthSessionController({
        client: fake.client,
        telemetry: (eventName) => events.push(eventName),
    });
    await controller.initializeAuthSession();
    await controller.refreshSession();
    assert.deepEqual(events, ["session_restored"]);
});

test("failed refresh and completed logout emit normalized telemetry", async () => {
    const events = [];
    const fake = fakeClient({
        initialSession: session,
        refreshResult: { error: { code: "invalid_grant", message: "invalid refresh token" } },
    });
    const controller = createAuthSessionController({
        client: fake.client,
        telemetry: (eventName, properties) => events.push([eventName, properties]),
    });
    await controller.initializeAuthSession();
    await assert.rejects(controller.refreshSession());
    await controller.signOut();
    assert.deepEqual(events, [
        ["session_restored", { source: "persistent_storage", outcome: "success" }],
        ["session_refresh_failed", { outcome: "failed", error_code: "refresh_failed" }],
        ["auth_signed_out", { outcome: "success" }],
    ]);
});
