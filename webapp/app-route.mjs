const APP_ROUTE_VIEWS = Object.freeze({
    "/app": "dashboard",
    "/app/new": "create",
    "/app/history": "renders",
    "/app/wallet": "wallet",
    "/app/settings": "settings",
    "/app/support": "support",
    "/app/photo-guide": "photo-guide",
    "/app/docs": "docs",
    "/app/render-detail": "render-detail",
    "/app/fitment": "fitment",
});

export const APP_ROUTE_QUERY_KEYS = Object.freeze([
    "market",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
]);

function normalizedPathname(pathname) {
    if (typeof pathname !== "string") return "";
    const normalized = pathname.replace(/\/{2,}/gu, "/").replace(/\/$/u, "");
    return normalized || "/";
}

function locationFrom(input, origin) {
    if (input instanceof URL) return input;
    if (typeof input === "string") {
        try {
            return new URL(input, origin);
        } catch {
            return null;
        }
    }
    if (input && typeof input.pathname === "string") {
        try {
            return new URL(`${input.pathname}${input.search || ""}${input.hash || ""}`, origin);
        } catch {
            return null;
        }
    }
    return null;
}

function safeApplicationUrl(input, currentOrigin = globalThis.location?.origin || input?.origin || "") {
    const url = locationFrom(input, currentOrigin);
    if (!url || !currentOrigin || url.origin !== currentOrigin) return null;
    return url;
}

export function applicationRouteView(input = globalThis.location, currentOrigin) {
    const url = safeApplicationUrl(input, currentOrigin);
    if (!url) return null;
    return APP_ROUTE_VIEWS[normalizedPathname(url.pathname)] || null;
}

export function isApplicationRoute(input = globalThis.location, currentOrigin) {
    const url = safeApplicationUrl(input, currentOrigin);
    if (!url) return false;
    const pathname = normalizedPathname(url.pathname);
    return pathname === "/app" || pathname.startsWith("/app/");
}

export function safeApplicationReturnPath(input = globalThis.location, currentOrigin) {
    const url = safeApplicationUrl(input, currentOrigin);
    const path = normalizedPathname(url?.pathname || "");
    if (!url || !APP_ROUTE_VIEWS[path]) return null;
    const query = new URLSearchParams();
    APP_ROUTE_QUERY_KEYS.forEach((key) => {
        const value = url.searchParams.get(key);
        if (value !== null && value !== "") query.set(key, value);
    });
    const search = query.toString();
    return `${path}${search ? `?${search}` : ""}`;
}

export function applicationRouteContext(input = globalThis.location, currentOrigin) {
    const url = safeApplicationUrl(input, currentOrigin);
    const path = normalizedPathname(url?.pathname || "");
    const returnPath = safeApplicationReturnPath(input, currentOrigin);
    if (!url || !returnPath) return null;
    return {
        path,
        view: APP_ROUTE_VIEWS[path],
        returnPath,
        market: url.searchParams.get("market") || null,
        query: new URLSearchParams(returnPath.split("?")[1] || ""),
    };
}
