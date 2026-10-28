const AUTH_EVENT_NAMES = new Set([
    "auth_started",
    "otp_requested",
    "otp_verified",
    "auth_completed",
    "session_restored",
    "session_refresh_failed",
    "auth_failed",
    "auth_signed_out",
]);

const AUTH_ERROR_CODES = new Set([
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

const AUTH_EVENT_SOURCES = new Set(["persistent_storage"]);
const ANALYTICS_VISITOR_STORAGE_KEY = "dreamWheelsAnalyticsVisitor";
const ANALYTICS_ATTRIBUTION_STORAGE_KEY = "dreamWheelsAnalyticsAttribution";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const DEFAULT_ANALYTICS_ENDPOINT = "/api/backend/analytics/events";

function authConfig() {
    return globalThis.__DREAM_WHEELS_AUTH_CONFIG__ || {};
}

function trustedSite() {
    return authConfig().site === "global" ? "global" : "ru";
}

function randomUuid() {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
        const random = Math.random() * 16 | 0;
        const value = character === "x" ? random : (random & 0x3 | 0x8);
        return value.toString(16);
    });
}

function analyticsVisitorId() {
    try {
        const current = globalThis.localStorage?.getItem(ANALYTICS_VISITOR_STORAGE_KEY);
        if (current) return current;
        const visitorId = randomUuid();
        globalThis.localStorage?.setItem(ANALYTICS_VISITOR_STORAGE_KEY, visitorId);
        return visitorId;
    } catch {
        return randomUuid();
    }
}

function currentAttribution() {
    const now = new Date().toISOString();
    const currentUrl = typeof globalThis.location?.href === "string" ? globalThis.location.href : "about:blank";
    const searchParams = typeof globalThis.location?.search === "string"
        ? new URLSearchParams(globalThis.location.search)
        : new URLSearchParams();
    const incoming = Object.fromEntries(UTM_KEYS.map((key) => [key, searchParams.get(key) || null]));
    const hasIncomingUtm = UTM_KEYS.some((key) => incoming[key]);
    let saved = null;
    try {
        saved = JSON.parse(globalThis.localStorage?.getItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY) || "null");
    } catch {
        saved = null;
    }
    const referrer = typeof globalThis.document?.referrer === "string" ? globalThis.document.referrer : null;
    const landing = {
        ...incoming,
        landing_url: currentUrl,
        referrer,
        first_seen_at: now,
        last_seen_at: now,
    };
    const attribution = saved
        ? {
            ...saved,
            ...(hasIncomingUtm ? incoming : {}),
            landing_url: saved.landing_url || landing.landing_url,
            referrer: saved.referrer || landing.referrer,
            first_seen_at: saved.first_seen_at || now,
            last_seen_at: now,
        }
        : landing;
    try {
        globalThis.localStorage?.setItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    } catch {
        // Analytics remains best-effort when browser storage is unavailable.
    }
    return attribution;
}

function safeProperties(details = {}) {
    const properties = {
        provider: "email",
        authority: "supabase",
        flow: "otp",
        site: trustedSite(),
        outcome: details.outcome === "failed" ? "failed" : "success",
    };
    if (AUTH_ERROR_CODES.has(details.error_code)) properties.error_code = details.error_code;
    if (AUTH_EVENT_SOURCES.has(details.source)) properties.source = details.source;
    return properties;
}

function analyticsEndpoint() {
    const configured = authConfig().analyticsEndpoint;
    if (typeof configured === "string" && (configured.startsWith("/") || /^https:\/\//i.test(configured))) {
        return configured;
    }
    return DEFAULT_ANALYTICS_ENDPOINT;
}

export function trackAuthEvent(eventName, details = {}) {
    if (!AUTH_EVENT_NAMES.has(eventName) || typeof globalThis.fetch !== "function") {
        return Promise.resolve(false);
    }
    const body = JSON.stringify({
        visitor_id: analyticsVisitorId(),
        event_name: eventName,
        attribution: currentAttribution(),
        properties: safeProperties(details),
    });
    return globalThis.fetch(analyticsEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
    }).then((response) => Boolean(response?.ok)).catch(() => false);
}

export const AUTH_TELEMETRY_EVENT_NAMES = Object.freeze([...AUTH_EVENT_NAMES]);
