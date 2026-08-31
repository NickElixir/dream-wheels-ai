const { proxyBackendRequest } = require("../lib/backend-proxy");

const BACKEND_PATH_QUERY_KEY = "__backend_path";

function firstQueryValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

function backendPathFromRequest(req) {
    const rawPath = firstQueryValue(req.query?.[BACKEND_PATH_QUERY_KEY]);
    if (typeof rawPath !== "string") return null;
    if (!rawPath) return "/";

    // The path is transported through a query parameter by the internal
    // rewrite. Keep it path-only so it cannot turn the fixed BACKEND_URL into
    // an attacker-controlled absolute URL.
    const path = `/${rawPath.replace(/^\/+/, "")}`;
    if (path.includes("?") || path.includes("#")) return null;
    return path;
}

module.exports = async (req, res) => {
    const backendPath = backendPathFromRequest(req);
    if (!backendPath) {
        res.status(400).json({ detail: "A valid backend path is required" });
        return;
    }

    await proxyBackendRequest(req, res, {
        backendPath,
        stripQueryKeys: [BACKEND_PATH_QUERY_KEY],
    });
};

module.exports.backendPathFromRequest = backendPathFromRequest;
