const APP_ROUTE_VIEWS = Object.freeze({
    "/": "dashboard", "/create": "create", "/history": "renders",
    "/balance": "wallet", "/account": "settings", "/help": "support",
    "/help/photos": "photo-guide", "/documents": "docs",
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

const APP_TOP_LEVEL_PATHS = Object.freeze({
    dashboard: "/app",
    renders: "/app/history",
    wallet: "/app/wallet",
    settings: "/app/settings",
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
    return routeMatch(normalizedPathname(url.pathname))?.view || null;
}

export function isApplicationRoute(input = globalThis.location, currentOrigin) {
    const url = safeApplicationUrl(input, currentOrigin);
    if (!url) return false;
    const pathname = normalizedPathname(url.pathname);
    return pathname === "/app" || pathname.startsWith("/app/") || pathname !== "/" && Boolean(routeMatch(pathname));
}

export function safeApplicationReturnPath(input = globalThis.location, currentOrigin) {
    const url = safeApplicationUrl(input, currentOrigin);
    const path = normalizedPathname(url?.pathname || "");
    if (!url || !routeMatch(path)) return null;
    const query = new URLSearchParams();
    APP_ROUTE_QUERY_KEYS.forEach((key) => {
        const value = url.searchParams.get(key);
        if (value !== null && value !== "") query.set(key, value);
    });
    const search = query.toString();
    return `${path}${search ? `?${search}` : ""}`;
}

export function applicationTopLevelReturnPath(view, input = globalThis.location, currentOrigin) {
    const path = APP_TOP_LEVEL_PATHS[view];
    const url = safeApplicationUrl(input, currentOrigin);
    if (!path || !url) return null;
    return safeApplicationReturnPath(new URL(`${path}${url.search}`, url.origin), url.origin);
}

export function applicationRouteContext(input = globalThis.location, currentOrigin) {
    const url = safeApplicationUrl(input, currentOrigin);
    const path = normalizedPathname(url?.pathname || "");
    const returnPath = safeApplicationReturnPath(input, currentOrigin);
    if (!url || !returnPath) return null;
    return {
        path,
        ...routeMatch(path),
        returnPath,
        market: url.searchParams.get("market") || null,
        query: new URLSearchParams(returnPath.split("?")[1] || ""),
    };
}

const WEB_PATHS = Object.freeze({dashboard:"/",create:"/create",renders:"/history",wallet:"/balance",settings:"/account",support:"/help","photo-guide":"/help/photos",docs:"/documents"});
function routeMatch(path) {
    if (APP_ROUTE_VIEWS[path]) return {view:APP_ROUTE_VIEWS[path]};
    const match = path.match(/^\/try-ons\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/compatibility)?$/i);
    return match ? {view:match[2] ? "fitment" : "render-detail",jobId:match[1]} : null;
}
export function webRoutePath(view, jobId, input = globalThis.location) {
    let path = WEB_PATHS[view];
    if (["render-detail","fitment"].includes(view)) {
        path = `/try-ons/${jobId}${view === "fitment" ? "/compatibility" : ""}`;
        if (!routeMatch(path)) return null;
    }
    if (!path) return null;
    const url = locationFrom(input, input?.origin || globalThis.location?.origin);
    return url ? safeApplicationReturnPath(new URL(path + url.search, url.origin), url.origin) : null;
}
