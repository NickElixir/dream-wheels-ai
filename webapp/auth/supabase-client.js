import { createClient } from "@supabase/supabase-js";
import { trackAuthEvent } from "./telemetry.js";

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

const OTP_ERROR_CODES = new Set([
    "invalid_otp",
    "expired_otp",
    "rate_limited",
    "network_error",
    "session_missing",
    "refresh_failed",
    "provider_cancelled",
    "provider_error",
    "identity_conflict",
    "backend_rejected",
    "unknown",
]);

const DEFAULT_OTP_RESEND_WINDOW_SECONDS = 60;

export class AuthSessionError extends Error {
    constructor(code) {
        super(code);
        this.name = "AuthSessionError";
        this.code = code;
    }
}

export class AuthOtpError extends Error {
    constructor(code) {
        super(code);
        this.name = "AuthOtpError";
        this.code = code;
    }
}

export function getAuthRuntimeConfig() {
    const config = globalThis.__DREAM_WHEELS_AUTH_CONFIG__ || {};
    const otpLength = Number(config.otpLength);
    const resendWindowSeconds = Number(config.resendWindowSeconds);
    return Object.freeze({
        otpLength: Number.isInteger(otpLength) && otpLength > 0 ? otpLength : null,
        resendWindowSeconds: Number.isInteger(resendWindowSeconds) && resendWindowSeconds > 0
            ? resendWindowSeconds
            : DEFAULT_OTP_RESEND_WINDOW_SECONDS,
        resendWindowConfigured: Number.isInteger(resendWindowSeconds) && resendWindowSeconds > 0,
    });
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

function statusCode(error) {
    return Number(error?.status || error?.statusCode || 0);
}

export function normalizeAuthError(error, operation = "provider") {
    if (error instanceof AuthOtpError) return error;
    const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
    const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
    if (statusCode(error) === 429 || code === "over_email_send_rate_limit" || code === "rate_limit_exceeded"
        || message.includes("rate limit") || message.includes("too many")) {
        return new AuthOtpError("rate_limited");
    }
    if (code === "otp_expired" || code === "expired_otp" || message.includes("expired")) {
        return new AuthOtpError("expired_otp");
    }
    if (code === "invalid_otp" || code === "otp_invalid" || message.includes("invalid otp")
        || (operation === "verify" && message.includes("token"))) {
        return new AuthOtpError("invalid_otp");
    }
    if (code === "captcha_failed" || code === "captcha_verification_failed") {
        return new AuthOtpError("provider_error");
    }
    if (error?.name === "AuthRetryableFetchError" || error instanceof TypeError
        || message.includes("network") || message.includes("fetch") || message.includes("timeout")
        || message.includes("offline")) {
        return new AuthOtpError("network_error");
    }
    if (operation === "verify" && code === "auth_session_missing") {
        return new AuthOtpError("session_missing");
    }
    return new AuthOtpError(OTP_ERROR_CODES.has(code) ? code : "provider_error");
}

function failureForOperation(error, operation) {
    const state = operation === "refresh" ? errorCode(error) : "NETWORK_ERROR";
    return new AuthSessionError(state);
}

function emitTelemetry(telemetry, eventName, details) {
    if (typeof telemetry !== "function") return;
    try {
        void Promise.resolve(telemetry(eventName, details)).catch(() => undefined);
    } catch {
        // Analytics is best-effort and must never block authentication.
    }
}

export function createAuthSessionController({ client, telemetry = null }) {
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
    let sessionRestoredReported = false;
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
            if (event === "INITIAL_SESSION" && session && !sessionRestoredReported) {
                sessionRestoredReported = true;
                emitTelemetry(telemetry, "session_restored", { source: "persistent_storage", outcome: "success" });
            }
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
            if (data.session && !sessionRestoredReported) {
                sessionRestoredReported = true;
                emitTelemetry(telemetry, "session_restored", { source: "persistent_storage", outcome: "success" });
            }
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
            emitTelemetry(telemetry, "session_refresh_failed", {
                outcome: "failed",
                error_code: code === AUTH_SESSION_STATES.SESSION_EXPIRED ? "refresh_failed" : "network_error",
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
        emitTelemetry(telemetry, "auth_signed_out", { outcome: "success" });
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

function normalizeEmail(email) {
    return typeof email === "string" ? email.trim() : "";
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

function normalizeOtpToken(token) {
    return typeof token === "string" ? token.trim() : "";
}

export function createEmailOtpController({ client, sessionController, telemetry = null }) {
    if (!client?.auth || !sessionController?.getSession) throw new AuthOtpError("provider_error");
    let interactionStarted = false;

    function markAuthStarted() {
        if (interactionStarted) return;
        interactionStarted = true;
        emitTelemetry(telemetry, "auth_started", { outcome: "success" });
    }

    async function requestEmailOtp(email, captchaToken = null) {
        markAuthStarted();
        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail)) {
            const normalizedError = new AuthOtpError("unknown");
            emitTelemetry(telemetry, "auth_failed", { outcome: "failed", error_code: normalizedError.code });
            throw normalizedError;
        }
        const options = { shouldCreateUser: true };
        if (typeof captchaToken === "string" && captchaToken.trim()) options.captchaToken = captchaToken.trim();
        const { error } = await client.auth.signInWithOtp({ email: normalizedEmail, options }).catch((error) => ({ error }));
        if (error) {
            const normalizedError = normalizeAuthError(error, "request");
            emitTelemetry(telemetry, "auth_failed", { outcome: "failed", error_code: normalizedError.code });
            throw normalizedError;
        }
        emitTelemetry(telemetry, "otp_requested", { outcome: "success" });
        return { accepted: true };
    }

    async function verifyEmailOtp(email, otp) {
        const normalizedEmail = normalizeEmail(email);
        const normalizedOtp = normalizeOtpToken(otp);
        const configuredLength = getAuthRuntimeConfig().otpLength;
        if (!isValidEmail(normalizedEmail)) {
            const normalizedError = new AuthOtpError("unknown");
            emitTelemetry(telemetry, "auth_failed", { outcome: "failed", error_code: normalizedError.code });
            throw normalizedError;
        }
        if (!normalizedOtp || !/^\d+$/u.test(normalizedOtp)
            || (configuredLength !== null && normalizedOtp.length !== configuredLength)) {
            const normalizedError = new AuthOtpError("invalid_otp");
            emitTelemetry(telemetry, "auth_failed", { outcome: "failed", error_code: normalizedError.code });
            throw normalizedError;
        }
        let response;
        try {
            response = await client.auth.verifyOtp({ email: normalizedEmail, token: normalizedOtp, type: "email" });
        } catch (error) {
            response = { error };
        }
        if (response?.error) {
            const normalizedError = normalizeAuthError(response.error, "verify");
            emitTelemetry(telemetry, "auth_failed", { outcome: "failed", error_code: normalizedError.code });
            throw normalizedError;
        }
        const session = response?.data?.session;
        if (!session) {
            const normalizedError = new AuthOtpError("session_missing");
            emitTelemetry(telemetry, "auth_failed", { outcome: "failed", error_code: normalizedError.code });
            throw normalizedError;
        }
        const restoredSession = await sessionController.getSession();
        if (!restoredSession) {
            const normalizedError = new AuthOtpError("session_missing");
            void telemetry?.("auth_failed", { outcome: "failed", error_code: normalizedError.code });
            throw normalizedError;
        }
        emitTelemetry(telemetry, "otp_verified", { outcome: "success" });
        emitTelemetry(telemetry, "auth_completed", { outcome: "success" });
        return { authenticated: true };
    }

    return Object.freeze({ requestEmailOtp, verifyEmailOtp });
}

let defaultController;
let defaultClient;
let defaultOtpController;

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
        defaultClient = client;
        defaultController = createAuthSessionController({ client, telemetry: trackAuthEvent });
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

function defaultAuthOtp() {
    if (defaultOtpController) return defaultOtpController;
    const sessionController = defaultAuthSession();
    if (!defaultClient) throw new AuthOtpError("provider_error");
    defaultOtpController = createEmailOtpController({
        client: defaultClient,
        sessionController,
        telemetry: trackAuthEvent,
    });
    return defaultOtpController;
}

export const requestEmailOtp = (email, captchaToken = null) => defaultAuthOtp().requestEmailOtp(email, captchaToken);
export const verifyEmailOtp = (email, otp) => defaultAuthOtp().verifyEmailOtp(email, otp);
