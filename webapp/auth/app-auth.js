import {
    AUTH_SESSION_STATES,
    getAccessToken as getSupabaseAccessToken,
    getAuthSessionState as getSupabaseSessionState,
    initializeAuthSession,
    requestEmailOtp,
    signOut as signOutSupabase,
    subscribeToAuthChanges,
    verifyEmailOtp,
} from "./supabase-client.js";

const DEFAULT_STATE = Object.freeze({
    status: AUTH_SESSION_STATES.BOOTSTRAPPING,
    authority: null,
    authChannel: null,
    principalVerified: false,
    protectedApiReady: false,
    sessionPresent: false,
    errorCode: null,
});

const SUPABASE_AUTH_EVENTS = new Set([
    "INITIAL_SESSION",
    "SIGNED_IN",
    "SIGNED_OUT",
    "TOKEN_REFRESHED",
    "USER_UPDATED",
]);

const defaultSessionController = Object.freeze({
    initializeAuthSession,
    getAccessToken: getSupabaseAccessToken,
    getAuthSessionState: getSupabaseSessionState,
    signOut: signOutSupabase,
    subscribeToAuthChanges,
});

function configuredHostIsAllowed(hostname = "") {
    if (["localhost", "127.0.0.1"].includes(hostname)) return true;
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
} = {}) {
    let state = { ...DEFAULT_STATE };
    let initialized = false;
    let initializationPromise = null;
    let reconciliationPromise = null;
    let authUnsubscribe = null;
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
        return getState();
    }

    function setUnauthenticated(event = null) {
        setState({
            status: AUTH_SESSION_STATES.UNAUTHENTICATED,
            authority: null,
            authChannel: null,
            principalVerified: false,
            protectedApiReady: false,
            sessionPresent: false,
            errorCode: null,
        }, event);
    }

    function resolveTelegramAuthority() {
        if (isTelegramMiniApp()) {
            setState({
                status: AUTH_SESSION_STATES.AUTHENTICATED,
                authority: "telegram",
                authChannel: "mini_app",
                principalVerified: true,
                protectedApiReady: true,
                sessionPresent: false,
                errorCode: null,
            }, "TELEGRAM_MINI_APP");
            return true;
        }
        return false;
    }

    async function probeCurrentUser() {
        if (resolveTelegramAuthority()) return getState();
        const sessionState = normalizedSessionState(sessionController);
        if (!sessionState.sessionPresent) {
            if (hasLegacyWebsiteAuth()) {
                setState({
                    status: AUTH_SESSION_STATES.AUTHENTICATED,
                    authority: "telegram",
                    authChannel: "website_telegram",
                    principalVerified: true,
                    protectedApiReady: true,
                    sessionPresent: false,
                    errorCode: null,
                }, "LEGACY_WEBSITE_SESSION");
            } else {
                setUnauthenticated("NO_SESSION");
            }
            return getState();
        }

        setState({
            status: AUTH_SESSION_STATES.BOOTSTRAPPING,
            authority: "supabase",
            authChannel: "email_otp",
            principalVerified: false,
            protectedApiReady: false,
            sessionPresent: true,
            errorCode: null,
        }, "PROBING_PRINCIPAL");

        try {
            const accessToken = await sessionController.getAccessToken();
            if (!accessToken) {
                setState({
                    status: AUTH_SESSION_STATES.SESSION_EXPIRED,
                    authority: "supabase",
                    authChannel: "email_otp",
                    principalVerified: false,
                    protectedApiReady: false,
                    sessionPresent: true,
                    errorCode: "SESSION_EXPIRED",
                }, "ME_REJECTED");
                return getState();
            }
            const response = await fetchImpl("/api/backend/auth/me", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response?.status === 401) {
                setState({
                    status: AUTH_SESSION_STATES.SESSION_EXPIRED,
                    authority: "supabase",
                    authChannel: "email_otp",
                    principalVerified: false,
                    protectedApiReady: false,
                    sessionPresent: true,
                    errorCode: "SESSION_EXPIRED",
                }, "ME_REJECTED");
                return getState();
            }
            if (!response?.ok) throw new Error("principal_probe_failed");
            const payload = await response.json().catch(() => null);
            if (payload?.authenticated !== true || payload.authority !== "supabase") {
                setState({ status: AUTH_SESSION_STATES.SESSION_EXPIRED, errorCode: "BACKEND_REJECTED" }, "ME_REJECTED");
                return getState();
            }
            setState({
                status: AUTH_SESSION_STATES.AUTHENTICATED,
                authority: "supabase",
                authChannel: "email_otp",
                principalVerified: true,
                protectedApiReady: false,
                sessionPresent: true,
                errorCode: null,
            }, "PRINCIPAL_VERIFIED");
        } catch {
            setState({
                status: AUTH_SESSION_STATES.NETWORK_ERROR,
                authority: "supabase",
                authChannel: "email_otp",
                principalVerified: false,
                protectedApiReady: false,
                sessionPresent: true,
                errorCode: "NETWORK_ERROR",
            }, "ME_UNAVAILABLE");
        }
        return getState();
    }

    function reconcile() {
        if (reconciliationPromise) return reconciliationPromise;
        reconciliationPromise = probeCurrentUser().finally(() => {
            reconciliationPromise = null;
        });
        return reconciliationPromise;
    }

    function attachAuthListener() {
        if (authUnsubscribe || typeof sessionController.subscribeToAuthChanges !== "function") return;
        authUnsubscribe = sessionController.subscribeToAuthChanges((sessionState, event) => {
            if (!SUPABASE_AUTH_EVENTS.has(event) || isTelegramMiniApp()) return;
            if (event === "SIGNED_OUT") {
                setUnauthenticated(event);
                return;
            }
            if (sessionState?.sessionPresent) void reconcile();
            else if (!hasLegacyWebsiteAuth()) setUnauthenticated(event);
        });
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
        return otpRequest(email, captchaToken);
    }

    async function verifyEmailCode(email, otp) {
        if (!initialized) await initialize();
        const result = await otpVerify(email, otp);
        await reconcile();
        return result;
    }

    async function signOutCurrentAuthority() {
        if (state.authority === "supabase" || normalizedSessionState(sessionController).sessionPresent) {
            await sessionController.signOut();
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
        probeCurrentUser,
        signOut: signOutCurrentAuthority,
    });
}

const browserAuth = createFrontendAuthController();
globalThis.DreamWheelsAuth = browserAuth;
