import { createClient } from "@supabase/supabase-js";

export const AUTH_SESSION_STATES = Object.freeze({
    BOOTSTRAPPING: "BOOTSTRAPPING",
    UNAUTHENTICATED: "UNAUTHENTICATED",
    AUTHENTICATED: "AUTHENTICATED",
    REFRESHING: "REFRESHING",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    NETWORK_ERROR: "NETWORK_ERROR",
});

const SESSION_EVENTS = new Set([
    "INITIAL_SESSION",
    "SIGNED_IN",
    "SIGNED_OUT",
    "TOKEN_REFRESHED",
    "USER_UPDATED",
]);

const PERMANENT_REFRESH_ERROR_CODES = new Set([
    "invalid_grant",
    "invalid_refresh_token",
    "refresh_token_not_found",
    "refresh_token_already_used",
]);

export class AuthSessionError extends Error {
    constructor(code) {
        super(code);
        this.name = "AuthSessionError";
        this.code = code;
    }
}

function publicConfig() {
    const config = globalThis.__DREAM_WHEELS_SUPABASE_CONFIG__;
    const url = typeof config?.url === "string" ? config.url.trim().replace(/\/$/, "") : "";
    const publishableKey = typeof config?.publishableKey === "string"
        ? config.publishableKey.trim()
        : "";
    if (!url || !publishableKey) throw new AuthSessionError("CONFIGURATION_ERROR");
    return { url, publishableKey };
}

function sessionMetadata(session) {
    const expiresAt = Number(session?.expires_at);
    return {
        sessionPresent: Boolean(session),
        accessTokenExpiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null,
    };
}

function errorCode(error) {
    if (PERMANENT_REFRESH_ERROR_CODES.has(error?.code)) return "SESSION_EXPIRED";
    const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
    if (message.includes("refresh token") && (message.includes("invalid") || message.includes("expired"))) {
        return "SESSION_EXPIRED";
    }
    return "NETWORK_ERROR";
}

function failureForOperation(error, operation) {
    const state = operation === "refresh" ? errorCode(error) : "NETWORK_ERROR";
    return new AuthSessionError(state);
}

export function createAuthSessionController({ client }) {
    if (!client?.auth) throw new AuthSessionError("CONFIGURATION_ERROR");

    let state = {
        status: AUTH_SESSION_STATES.BOOTSTRAPPING,
        sessionPresent: false,
        accessTokenExpiresAt: null,
        lastEvent: null,
        errorCode: null,
    };
    let readyPromise = null;
    let authSubscription = null;
    const listeners = new Set();

    function getState() {
        return { ...state };
    }

    function emit(event = null) {
        if (event) state = { ...state, lastEvent: event };
        const snapshot = getState();
        listeners.forEach((listener) => listener(snapshot, event));
    }

    function setState(nextState, event = null) {
        state = { ...state, ...nextState };
        emit(event);
    }

    function setFromSession(status, session, event = null) {
        setState({
            status,
            ...sessionMetadata(session),
            errorCode: null,
        }, event);
    }

    function onAuthEvent(event, session) {
        if (!SESSION_EVENTS.has(event)) return;
        if (event === "SIGNED_OUT") {
            setFromSession(AUTH_SESSION_STATES.UNAUTHENTICATED, null, event);
            return;
        }
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
            setFromSession(
                session ? AUTH_SESSION_STATES.AUTHENTICATED : AUTH_SESSION_STATES.UNAUTHENTICATED,
                session,
                event,
            );
        }
    }

    function attachAuthListener() {
        if (authSubscription) return;
        const subscription = client.auth.onAuthStateChange(onAuthEvent);
        authSubscription = subscription?.data?.subscription || subscription?.subscription || null;
    }

    async function initialize() {
        if (readyPromise) return readyPromise;
        setState({ status: AUTH_SESSION_STATES.BOOTSTRAPPING, errorCode: null }, "BOOTSTRAPPING");
        attachAuthListener();
        readyPromise = client.auth.getSession().then(({ data, error }) => {
            if (error) {
                setState({ status: AUTH_SESSION_STATES.NETWORK_ERROR, errorCode: "NETWORK_ERROR" }, "INITIAL_SESSION");
                return getState();
            }
            setFromSession(
                data.session ? AUTH_SESSION_STATES.AUTHENTICATED : AUTH_SESSION_STATES.UNAUTHENTICATED,
                data.session,
                "INITIAL_SESSION",
            );
            return getState();
        }).catch((error) => {
            setState({ status: AUTH_SESSION_STATES.NETWORK_ERROR, errorCode: "NETWORK_ERROR" }, "INITIAL_SESSION");
            return getState();
        });
        return readyPromise;
    }

    async function getSession() {
        await initialize();
        const { data, error } = await client.auth.getSession();
        if (error) {
            setState({ status: AUTH_SESSION_STATES.NETWORK_ERROR, errorCode: "NETWORK_ERROR" });
            throw failureForOperation(error, "getSession");
        }
        setFromSession(
            data.session ? AUTH_SESSION_STATES.AUTHENTICATED : AUTH_SESSION_STATES.UNAUTHENTICATED,
            data.session,
        );
        return data.session;
    }

    async function getAccessToken() {
        const session = await getSession();
        return session?.access_token || null;
    }

    async function refreshSession() {
        await initialize();
        setState({ status: AUTH_SESSION_STATES.REFRESHING, errorCode: null });
        const { data, error } = await client.auth.refreshSession();
        if (error) {
            const code = errorCode(error);
            setState({
                status: code === AUTH_SESSION_STATES.SESSION_EXPIRED
                    ? AUTH_SESSION_STATES.SESSION_EXPIRED
                    : AUTH_SESSION_STATES.NETWORK_ERROR,
                errorCode: code,
            });
            throw failureForOperation(error, "refresh");
        }
        setFromSession(
            data.session ? AUTH_SESSION_STATES.AUTHENTICATED : AUTH_SESSION_STATES.UNAUTHENTICATED,
            data.session,
            "TOKEN_REFRESHED",
        );
        return data.session;
    }

    async function signOut() {
        await initialize();
        const { error } = await client.auth.signOut();
        if (error) throw failureForOperation(error, "signOut");
        setFromSession(AUTH_SESSION_STATES.UNAUTHENTICATED, null, "SIGNED_OUT");
    }

    function subscribeToAuthChanges(listener) {
        if (typeof listener !== "function") throw new TypeError("listener must be a function");
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    return Object.freeze({
        initializeAuthSession: initialize,
        getSession,
        getAccessToken,
        refreshSession,
        signOut,
        subscribeToAuthChanges,
        getAuthSessionState: getState,
    });
}

let defaultController;

function defaultAuthSession() {
    if (defaultController) return defaultController;
    try {
        const { url, publishableKey } = publicConfig();
        const client = createClient(url, publishableKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
            },
        });
        defaultController = createAuthSessionController({ client });
    } catch (error) {
        const code = error instanceof AuthSessionError ? error.code : "CONFIGURATION_ERROR";
        let errorState = {
            status: AUTH_SESSION_STATES.NETWORK_ERROR,
            sessionPresent: false,
            accessTokenExpiresAt: null,
            lastEvent: null,
            errorCode: code,
        };
        const unavailable = {
            async initializeAuthSession() { return { ...errorState }; },
            async getSession() { throw new AuthSessionError(code); },
            async getAccessToken() { throw new AuthSessionError(code); },
            async refreshSession() { throw new AuthSessionError(code); },
            async signOut() { throw new AuthSessionError(code); },
            subscribeToAuthChanges() { return () => {}; },
            getAuthSessionState() { return { ...errorState }; },
        };
        defaultController = Object.freeze(unavailable);
    }
    return defaultController;
}

export const initializeAuthSession = () => defaultAuthSession().initializeAuthSession();
export const getSession = () => defaultAuthSession().getSession();
export const getAccessToken = () => defaultAuthSession().getAccessToken();
export const refreshSession = () => defaultAuthSession().refreshSession();
export const signOut = () => defaultAuthSession().signOut();
export const subscribeToAuthChanges = (listener) => defaultAuthSession().subscribeToAuthChanges(listener);
export const getAuthSessionState = () => defaultAuthSession().getAuthSessionState();
export const authSessionReady = initializeAuthSession();
