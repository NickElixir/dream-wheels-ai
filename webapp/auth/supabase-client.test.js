import assert from "node:assert/strict";
import { test } from "node:test";

import {
    AUTH_SESSION_STATES,
    createAuthSessionController,
} from "./supabase-client.js";

const session = {
    access_token: "access-token-for-test-only",
    refresh_token: "refresh-token-for-test-only",
    expires_at: 1_800_000_000,
};

function fakeClient({ initialSession = null, refreshResult = {} } = {}) {
    let currentSession = initialSession;
    let callback;
    let signOutCalls = 0;
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
    return { client: { auth }, refreshResult, get signOutCalls() { return signOutCalls; } };
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
