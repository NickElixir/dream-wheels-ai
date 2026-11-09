import { captureRegistrationTouch, registrationTouchPayload } from "./registration-touch.mjs";
import {
    AUTH_SESSION_STATES,
    getAccessToken as getSupabaseAccessToken,
    getCurrentAuthUser as getSupabaseCurrentAuthUser,
    getAuthSessionState as getSupabaseSessionState,
    createEphemeralEmailLinkController,
    initializeAuthSession,
    requestEmailOtp,
    signOut as signOutSupabase,
    subscribeToAuthChanges,
    verifyEmailOtp,
} from "./supabase-client.js";

captureRegistrationTouch();

const DEFAULT_STATE = Object.freeze({
    status: AUTH_SESSION_STATES.BOOTSTRAPPING,
    authority: null,
    authChannel: null,
    principalVerified: false,
    protectedApiReady: false,
    sessionPresent: false,
    errorCode: null,
    interactionState: "restoring",
    authenticationSource: null,
    account: null,
});

export const AUTH_INTERACTION_STATES = Object.freeze({
    RESTORING: "restoring",
    UNAUTHENTICATED: "unauthenticated",
    OTP_REQUESTED: "otp_requested",
    OTP_VERIFYING: "otp_verifying",
    AUTHENTICATED: "authenticated",
});

const SUPABASE_AUTH_EVENTS = new Set([
    "INITIAL_SESSION",
    "SIGNED_IN",
    "SIGNED_OUT",
    "TOKEN_REFRESHED",
    "USER_UPDATED",
]);

const TIMEWEB_PRODUCTION_API_BASE_URL = "https://gateway.dreamwheels.deno.net/api/backend";
const DENO_TEST_API_BASE_URL = "https://gateway-test.dreamwheels.deno.net/api/backend";

export function backendApiUrl(path) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const hostname = globalThis.location?.hostname || "";
    const configured = globalThis.__DREAM_WHEELS_DEPLOYMENT_CONFIG__?.apiBaseUrl;
    if (typeof configured === "string") {
        try {
            const url = new URL(configured);
            if (hostname === "app.dream-wheels.ru"
                && globalThis.__DREAM_WHEELS_DEPLOYMENT_CONFIG__?.profile === "ru-production"
                && globalThis.__DREAM_WHEELS_DEPLOYMENT_CONFIG__?.environment === "production"
                && configured === TIMEWEB_PRODUCTION_API_BASE_URL
                && url.origin === "https://gateway.dreamwheels.deno.net"
                && !url.username && !url.password && url.pathname === "/api/backend" && !url.search && !url.hash) {
                return `${TIMEWEB_PRODUCTION_API_BASE_URL}${normalizedPath}`;
            }
            if (hostname === "app-test.dream-wheels.ru"
                && globalThis.__DREAM_WHEELS_DEPLOYMENT_CONFIG__?.profile === "ru-test"
                && globalThis.__DREAM_WHEELS_DEPLOYMENT_CONFIG__?.environment === "test"
                && configured === DENO_TEST_API_BASE_URL && url.origin === "https://gateway-test.dreamwheels.deno.net"
                && !url.username && !url.password && url.pathname === "/api/backend" && !url.search && !url.hash) {
                return `${DENO_TEST_API_BASE_URL}${normalizedPath}`;
            }
        } catch {
            // Fall back to the existing same-origin Vercel gateway.
        }
    }
    return `/api/backend${normalizedPath}`;
}

const defaultSessionController = Object.freeze({
    initializeAuthSession,
    getAccessToken: getSupabaseAccessToken,
    getAuthSessionState: getSupabaseSessionState,
    getCurrentAuthUser: getSupabaseCurrentAuthUser,
    signOut: signOutSupabase,
    subscribeToAuthChanges,
});

function configuredHostIsAllowed(hostname = "") {
    if (["localhost", "127.0.0.1"].includes(hostname)) return true;
    if (["dreamwheels.pro", "app.dreamwheels.pro", "app.dream-wheels.ru", "app-test.dream-wheels.ru", "dream-wheels-ai-webapp.vercel.app",
        "dream-wheels-ai-webapp-nicks-projects-bd58cb33.vercel.app"].includes(hostname)) return true;
    if (hostname === "dream-wheels-ai-webapp-staging.vercel.app") return true;
    return /^dream-wheels-ai-webapp-git-feature-auth-v11-integration-[a-z0-9-]+\.vercel\.app$/u.test(hostname);
}

export function isMainWebAppAuthEnabled(config = globalThis.__DREAM_WHEELS_AUTH_CONFIG__ || {}) {
    return config.mainWebAppEnabled === true && configuredHostIsAllowed(globalThis.location?.hostname || "");
}

function normalizedSessionState(sessionController) {
    try {
        return sessionController.getAuthSessionState?.() || {};
    } catch {
        return {};
    }
}

export function createFrontendAuthController({
    sessionController = defaultSessionController,
    otpRequest = requestEmailOtp,
    otpVerify = verifyEmailOtp,
    fetchImpl = (...args) => globalThis.fetch?.(...args),
    integrationEnabled = () => isMainWebAppAuthEnabled(),
    isTelegramMiniApp = () => false,
    hasLegacyWebsiteAuth = () => false,
    legacySignOut = null,
    finalizationTimeoutMs = 20_000,
    onFinalizationDiagnostic = (entry) => console.info("[DW] auth finalization", entry),
} = {}) {
    let state = { ...DEFAULT_STATE };
    let initialized = false;
    let initializationPromise = null;
    let reconciliationPromise = null;
    let authUnsubscribe = null;
    let legacyWebsiteAuthToken = () => null;
    let refreshPromise = null;
    let suppressLegacyFallback = false;
    let verifiedSupabaseUserId = null;
    let authRevision = 0;
    let activeProbe = null;

    function cancelProbe() {
        activeProbe?.cancel();
        activeProbe = null;
        reconciliationPromise = null;
    }
    const listeners = new Set();

    function getState() {
        return { ...state };
    }

    function emit(event = null) {
        const snapshot = getState();
        listeners.forEach((listener) => listener(snapshot, event));
    }

    function setState(nextState, event = null) {
        state = { ...state, ...nextState };
        emit(event);
    }

    function configure(options = {}) {
        if (typeof options.integrationEnabled === "function") integrationEnabled = options.integrationEnabled;
        if (typeof options.isTelegramMiniApp === "function") isTelegramMiniApp = options.isTelegramMiniApp;
        if (typeof options.hasLegacyWebsiteAuth === "function") hasLegacyWebsiteAuth = options.hasLegacyWebsiteAuth;
        if (typeof options.legacySignOut === "function") legacySignOut = options.legacySignOut;
        if (typeof options.getLegacyWebsiteAuthToken === "function") {
            legacyWebsiteAuthToken = options.getLegacyWebsiteAuthToken;
        }
        return getState();
    }

    function setUnauthenticated(event = null) {
        cancelProbe();
        authRevision += 1;
        verifiedSupabaseUserId = null;
        setState({
            status: AUTH_SESSION_STATES.UNAUTHENTICATED,
            authority: null,
            authChannel: null,
            principalVerified: false,
            protectedApiReady: false,
            sessionPresent: false,
            errorCode: null,
            interactionState: AUTH_INTERACTION_STATES.UNAUTHENTICATED,
            authenticationSource: null,
            account: null,
        }, event);
    }

    function setSupabaseExpired(errorCode = "SESSION_EXPIRED", event = "SESSION_EXPIRED") {
        cancelProbe();
        authRevision += 1;
        verifiedSupabaseUserId = null;
        setState({
            status: AUTH_SESSION_STATES.SESSION_EXPIRED,
            authority: "supabase",
            authChannel: "email_otp",
            principalVerified: false,
            protectedApiReady: false,
            sessionPresent: true,
            errorCode,
            interactionState: AUTH_INTERACTION_STATES.UNAUTHENTICATED,
            authenticationSource: null,
            account: null,
        }, event);
    }

    function resolveTelegramAuthority() {
        if (isTelegramMiniApp()) {
            verifiedSupabaseUserId = null;
            setState({
                status: AUTH_SESSION_STATES.AUTHENTICATED,
                authority: "telegram",
                authChannel: "mini_app",
                principalVerified: true,
                protectedApiReady: true,
                sessionPresent: false,
                errorCode: null,
                interactionState: AUTH_INTERACTION_STATES.AUTHENTICATED,
                authenticationSource: "telegram",
                account: null,
            }, "TELEGRAM_MINI_APP");
            return true;
        }
        return false;
    }

    async function probeCurrentUser() {
        if (resolveTelegramAuthority()) return getState();
        const sessionState = normalizedSessionState(sessionController);
        if (!sessionState.sessionPresent) {
            verifiedSupabaseUserId = null;
            if (hasLegacyWebsiteAuth()) {
                setState({
                    status: AUTH_SESSION_STATES.AUTHENTICATED,
                    authority: "telegram",
                    authChannel: "website_telegram",
                    principalVerified: true,
                    protectedApiReady: true,
                    sessionPresent: false,
                    errorCode: null,
                    interactionState: AUTH_INTERACTION_STATES.AUTHENTICATED,
                    authenticationSource: "telegram",
                    account: null,
                }, "LEGACY_WEBSITE_SESSION");
            } else {
                setUnauthenticated("NO_SESSION");
            }
            return getState();
        }

        cancelProbe();
        const abortController = new AbortController();
        let rejectPending;
        const pending = new Promise((_, reject) => { rejectPending = reject; });
        // A cancellation can precede the first await (synchronous auth listeners).
        pending.catch(() => {});
        let stageStarted = performance.now();
        let stage = "session_token";
        const diagnostic = (outcome) => {
            try {
                onFinalizationDiagnostic({ stage, outcome, duration_ms: Math.round(performance.now() - stageStarted) });
            } catch { /* Diagnostics must never prevent sign-in. */ }
        };
        const attempt = {
            userId: sessionController.getCurrentAuthUser?.()?.id || null,
            cancel() {
                rejectPending(authRequestError("AUTH_FINALIZATION_CANCELLED"));
                abortController.abort();
            },
        };
        activeProbe = attempt;
        const timer = setTimeout(() => {
            diagnostic("timeout");
            rejectPending(authRequestError("AUTH_FINALIZATION_TIMEOUT"));
            abortController.abort();
        }, finalizationTimeoutMs);
        const bounded = (operation) => Promise.race([pending, operation]);
        const sessionUserId = sessionController.getCurrentAuthUser?.()?.id || null;
        const probeRevision = authRevision;
        const probeStillCurrent = () => activeProbe === attempt && authRevision === probeRevision
            && (sessionController.getCurrentAuthUser?.()?.id || null) === sessionUserId;
        const wasVerifiedSupabase = state.status === AUTH_SESSION_STATES.AUTHENTICATED
            && state.authority === "supabase"
            && state.principalVerified && state.protectedApiReady;
        const silentlyRecheck = wasVerifiedSupabase
            && Boolean(sessionUserId && sessionUserId === verifiedSupabaseUserId);
        if (!silentlyRecheck) {
            verifiedSupabaseUserId = null;
            setState({
                status: AUTH_SESSION_STATES.BOOTSTRAPPING,
                authority: "supabase",
                authChannel: "email_otp",
                principalVerified: false,
                protectedApiReady: false,
                sessionPresent: true,
                errorCode: null,
            }, wasVerifiedSupabase ? "AUTH_IDENTITY_CHANGED" : "PROBING_PRINCIPAL");
        }

        try {
            const accessToken = await bounded(sessionController.getAccessToken());
            if (!probeStillCurrent()) return getState();
            if (!accessToken) {
                setSupabaseExpired("SESSION_EXPIRED", "ME_REJECTED");
                return getState();
            }
            diagnostic("success");
            stage = "auth_me";
            stageStarted = performance.now();
            const touch = registrationTouchPayload();
            const response = await bounded(fetchImpl(backendApiUrl("/auth/me"), {
                headers: { Authorization: `Bearer ${accessToken}`, ...(touch ? { "X-Registration-Touch": touch } : {}) },
                signal: abortController.signal,
            }));
            if (!probeStillCurrent()) return getState();
            if (response?.status === 401) {
                setSupabaseExpired("SESSION_EXPIRED", "ME_REJECTED");
                return getState();
            }
            if (!response?.ok) throw await bounded(backendAuthError(response));
            const payload = await bounded(response.json().catch(() => null));
            if (!probeStillCurrent()) return getState();
            if (payload?.authenticated !== true || payload.authority !== "supabase") {
                setSupabaseExpired("BACKEND_REJECTED", "ME_REJECTED");
                return getState();
            }
            diagnostic("success");
            stage = "auth_bootstrap";
            stageStarted = performance.now();
            const account = await bounded(bootstrapSupabaseAccount(accessToken, abortController.signal));
            if (!probeStillCurrent()) return getState();
            diagnostic("success");
            verifiedSupabaseUserId = sessionUserId;
            setState({
                status: AUTH_SESSION_STATES.AUTHENTICATED,
                authority: "supabase",
                authChannel: "email_otp",
                principalVerified: true,
                protectedApiReady: true,
                sessionPresent: true,
                errorCode: null,
                interactionState: AUTH_INTERACTION_STATES.AUTHENTICATED,
                authenticationSource: "restored_session",
                account,
            }, "PRINCIPAL_VERIFIED");
        } catch (error) {
            if (!probeStillCurrent()) return getState();
            if (error?.code === "SESSION_EXPIRED") {
                setSupabaseExpired("SESSION_EXPIRED", "BOOTSTRAP_REJECTED");
                return getState();
            }
            verifiedSupabaseUserId = null;
            setState({
                status: AUTH_SESSION_STATES.NETWORK_ERROR,
                authority: "supabase",
                authChannel: "email_otp",
                principalVerified: false,
                protectedApiReady: false,
                sessionPresent: true,
                errorCode: ["MAINTENANCE", "AUTH_FINALIZATION_TIMEOUT"].includes(error?.code) ? error.code : "NETWORK_ERROR",
                interactionState: AUTH_INTERACTION_STATES.UNAUTHENTICATED,
                authenticationSource: null,
                account: null,
            }, "ME_UNAVAILABLE");
            if (error?.code !== "AUTH_FINALIZATION_TIMEOUT") diagnostic("error");
        } finally {
            clearTimeout(timer);
            if (activeProbe === attempt) activeProbe = null;
        }
        return getState();
    }

    function reconcile() {
        if (reconciliationPromise) return reconciliationPromise;
        const promise = probeCurrentUser().finally(() => {
            if (reconciliationPromise === promise) reconciliationPromise = null;
        });
        reconciliationPromise = promise;
        return promise;
    }

    function attachAuthListener() {
        if (authUnsubscribe || typeof sessionController.subscribeToAuthChanges !== "function") return;
        authUnsubscribe = sessionController.subscribeToAuthChanges((sessionState, event) => {
            if (!SUPABASE_AUTH_EVENTS.has(event) || isTelegramMiniApp()) return;
            if (event === "SIGNED_OUT") {
                setUnauthenticated(event);
                return;
            }
            const eventUserId = sessionController.getCurrentAuthUser?.()?.id || null;
            const hasVerifiedSupabasePrincipal = state.status === AUTH_SESSION_STATES.AUTHENTICATED
                && state.authority === "supabase" && state.principalVerified && state.protectedApiReady;
            if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
                && hasVerifiedSupabasePrincipal && sessionState?.sessionPresent
                && eventUserId && eventUserId === verifiedSupabaseUserId) {
                return;
            }
            if (hasVerifiedSupabasePrincipal && eventUserId && verifiedSupabaseUserId
                && eventUserId !== verifiedSupabaseUserId) {
                cancelProbe();
                authRevision += 1;
                verifiedSupabaseUserId = null;
                setState({
                    status: AUTH_SESSION_STATES.BOOTSTRAPPING,
                    principalVerified: false,
                    protectedApiReady: false,
                    interactionState: AUTH_INTERACTION_STATES.RESTORING,
                    account: null,
                }, "AUTH_IDENTITY_CHANGED");
            }
            if (sessionState?.sessionPresent) {
                if (activeProbe && activeProbe.userId !== eventUserId) {
                    cancelProbe();
                    authRevision += 1;
                }
                void reconcile();
            } else if (!hasLegacyWebsiteAuth()) {
                setUnauthenticated(event);
            }
        });
    }

    function selectedAuthority() {
        if (isTelegramMiniApp()) return "telegram_mini_app";
        if (state.authority === "supabase" && state.principalVerified) return "supabase";
        if (state.authority === "telegram" && state.authChannel === "website_telegram") return "telegram_website";
        if (!suppressLegacyFallback && hasLegacyWebsiteAuth() && legacyWebsiteAuthToken()) return "telegram_website";
        return null;
    }

    function authRequestError(code) {
        const error = new Error(code);
        error.name = "AuthRequestError";
        error.code = code;
        return error;
    }

    async function backendAuthError(response) {
        const payload = await response?.json?.().catch(() => null);
        return authRequestError(response?.status === 503 && /maintenance/i.test(String(payload?.detail || ""))
            ? "MAINTENANCE" : "NETWORK_ERROR");
    }

    async function bootstrapSupabaseAccount(accessToken, signal) {
        if (!accessToken) throw authRequestError("SESSION_EXPIRED");
        const response = await fetchImpl(backendApiUrl("/auth/bootstrap"), {
            method: "POST",
            signal,
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response?.status === 401) throw authRequestError("SESSION_EXPIRED");
        if (!response?.ok) throw await backendAuthError(response);
        const payload = typeof response?.json === "function"
            ? await response.json().catch(() => null)
            : null;
        const account = payload?.account;
        if (!account || typeof account !== "object") return null;
        return {
            balance: Number.isFinite(Number(account.balance)) ? Number(account.balance) : null,
            starterGrantGrantedNow: account.starter_grant_granted_now === true,
            savedName: typeof account.saved_name === "string" && account.saved_name.trim()
                ? account.saved_name.trim()
                : null,
        };
    }

    function replayableBody(body) {
        if (body === undefined || body === null || typeof body === "string") return true;
        if (typeof FormData !== "undefined" && body instanceof FormData) return true;
        if (typeof Blob !== "undefined" && body instanceof Blob) return true;
        if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return true;
        if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(body)) return true;
        if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true;
        return false;
    }

    function requestInitWithAuth(init = {}, token = null) {
        const nextInit = { ...init };
        const headers = new Headers(init.headers || {});
        headers.delete("Authorization");
        if (token) headers.set("Authorization", `Bearer ${token}`);
        nextInit.headers = headers;
        return nextInit;
    }

    async function refreshSupabaseOnce() {
        if (!refreshPromise) {
            refreshPromise = (async () => {
                try {
                    await sessionController.refreshSession();
                    const token = await sessionController.getAccessToken();
                    if (!token) throw authRequestError("SESSION_EXPIRED");
                    return token;
                } catch (error) {
                    if (error?.code === "SESSION_EXPIRED") {
                        setSupabaseExpired("SESSION_EXPIRED", "REFRESH_FAILED");
                        throw authRequestError("SESSION_EXPIRED");
                    }
                    throw authRequestError("NETWORK_ERROR");
                } finally {
                    refreshPromise = null;
                }
            })();
        }
        return refreshPromise;
    }

    async function authenticatedFetch(input, init = {}, options = {}) {
        const authRequired = options.authRequired !== false;
        const retryOnAuth401 = options.retryOnAuth401 !== false;
        const authority = selectedAuthority();
        if (authRequired && !authority) throw authRequestError("AUTH_REQUIRED");
        if (!authRequired) return fetchImpl(input, init);

        let token = null;
        if (authority === "supabase") {
            token = await sessionController.getAccessToken();
            if (!token) {
                setSupabaseExpired("SESSION_EXPIRED", "TOKEN_MISSING");
                throw authRequestError("SESSION_EXPIRED");
            }
        } else if (authority === "telegram_website") {
            token = legacyWebsiteAuthToken();
            if (!token) throw authRequestError("AUTH_REQUIRED");
        }

        const requestInit = requestInitWithAuth(init, token);
        const response = await fetchImpl(input, requestInit);
        if (response?.status !== 401 || authority !== "supabase" || !retryOnAuth401 || !replayableBody(init.body)) {
            return response;
        }

        token = await refreshSupabaseOnce();
        const retryResponse = await fetchImpl(input, requestInitWithAuth(init, token));
        if (retryResponse?.status === 401) setSupabaseExpired("SESSION_EXPIRED", "RETRY_REJECTED");
        return retryResponse;
    }

    function markLegacyWebsiteAuthenticated() {
        suppressLegacyFallback = false;
        setState({
            status: AUTH_SESSION_STATES.AUTHENTICATED,
            authority: "telegram",
            authChannel: "website_telegram",
            principalVerified: true,
            protectedApiReady: true,
            sessionPresent: false,
            errorCode: null,
            interactionState: AUTH_INTERACTION_STATES.AUTHENTICATED,
            authenticationSource: "telegram",
            account: null,
        }, "LEGACY_WEBSITE_SESSION");
    }

    function markLegacyWebsiteSignedOut() {
        if (state.authority === "telegram" && state.authChannel === "website_telegram") {
            setUnauthenticated("SIGNED_OUT");
        }
    }

    async function initialize() {
        if (initializationPromise) return initializationPromise;
        initialized = true;
        initializationPromise = (async () => {
            setState({ ...DEFAULT_STATE }, "BOOTSTRAPPING");
            if (!integrationEnabled() || resolveTelegramAuthority()) return getState();
            attachAuthListener();
            try {
                await sessionController.initializeAuthSession();
            } catch {
                if (hasLegacyWebsiteAuth()) return probeCurrentUser();
                setState({ status: AUTH_SESSION_STATES.NETWORK_ERROR, errorCode: "NETWORK_ERROR" }, "INITIAL_SESSION");
                return getState();
            }
            return reconcile();
        })();
        return initializationPromise;
    }

    function subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("listener must be a function");
        listeners.add(listener);
        listener(getState(), null);
        return () => listeners.delete(listener);
    }

    async function requestEmailCode(email, captchaToken = null) {
        if (!initialized) await initialize();
        await reconcile();
        if (state.status === AUTH_SESSION_STATES.AUTHENTICATED && state.principalVerified) {
            throw authRequestError("ALREADY_AUTHENTICATED");
        }
        if (state.status === AUTH_SESSION_STATES.SESSION_EXPIRED) {
            await sessionController.signOut();
        }
        if (state.status === AUTH_SESSION_STATES.BOOTSTRAPPING || state.sessionPresent) {
            throw authRequestError(state.errorCode || "AUTHENTICATION_IN_PROGRESS");
        }
        const result = await otpRequest(email, captchaToken);
        setState({
            interactionState: AUTH_INTERACTION_STATES.OTP_REQUESTED,
            authenticationSource: null,
            errorCode: null,
        }, "OTP_REQUESTED");
        return result;
    }

    async function verifyEmailCode(email, otp) {
        if (!initialized) await initialize();
        setState({ interactionState: AUTH_INTERACTION_STATES.OTP_VERIFYING, errorCode: null }, "OTP_VERIFYING");
        let result;
        try {
            result = await otpVerify(email, otp);
            const verificationRevision = authRevision;
            await reconcile();
            if (authRevision !== verificationRevision) throw authRequestError("AUTH_FINALIZATION_CANCELLED");
        } catch (error) {
            if (error?.code === "AUTH_FINALIZATION_CANCELLED") throw error;
            setState({ interactionState: AUTH_INTERACTION_STATES.OTP_REQUESTED }, "OTP_VERIFY_FAILED");
            throw error;
        }
        if (!(state.status === AUTH_SESSION_STATES.AUTHENTICATED && state.principalVerified)) {
            setState({ interactionState: AUTH_INTERACTION_STATES.OTP_REQUESTED }, "OTP_SESSION_MISSING");
            throw authRequestError(state.errorCode || "SESSION_EXPIRED");
        }
        setState({
            interactionState: AUTH_INTERACTION_STATES.AUTHENTICATED,
            authenticationSource: "fresh_email_otp",
        }, "OTP_VERIFIED");
        return result;
    }

    async function signOutCurrentAuthority() {
        cancelProbe();
        authRevision += 1;
        if (state.authority === "supabase" || normalizedSessionState(sessionController).sessionPresent) {
            await sessionController.signOut();
            suppressLegacyFallback = true;
        } else if (state.authority === "telegram" && state.authChannel === "website_telegram") {
            legacySignOut?.();
        }
        setUnauthenticated("SIGNED_OUT");
    }

    return Object.freeze({
        configure,
        isIntegrationEnabled: () => Boolean(integrationEnabled()),
        initialize,
        getState,
        subscribe,
        requestEmailOtp: requestEmailCode,
        verifyEmailOtp: verifyEmailCode,
        getCurrentAuthUser: () => sessionController.getCurrentAuthUser?.() || null,
        probeCurrentUser,
        authenticatedFetch,
        markLegacyWebsiteAuthenticated,
        markLegacyWebsiteSignedOut,
        signOut: signOutCurrentAuthority,
    });
}

const browserAuth = createFrontendAuthController();
globalThis.DreamWheelsAuth = Object.freeze({
    ...browserAuth,
    createEphemeralEmailLinkController,
});
