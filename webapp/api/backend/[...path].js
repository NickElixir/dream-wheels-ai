const DEFAULT_BACKEND_ORIGIN = "https://dream-wheels-ai-robokassa-staging.onrender.com";

function normalizeBackendOrigin() {
    return (process.env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/+$/, "");
}

function resolveUpstreamUrl(req) {
    const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
    const pathname = pathParts.join("/");
    const queryIndex = req.url.indexOf("?");
    const search = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    return `${normalizeBackendOrigin()}/${pathname}${search}`;
}

function buildUpstreamHeaders(req) {
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
        if (value == null) continue;
        const lower = name.toLowerCase();
        if (["authorization", "content-type", "x-internal-token"].includes(lower)) {
            headers[name] = Array.isArray(value) ? value.join(", ") : value;
        }
    }
    return headers;
}

function buildUpstreamBody(req) {
    if (req.method === "GET" || req.method === "HEAD") return undefined;
    if (req.body == null) return undefined;
    if (Buffer.isBuffer(req.body) || typeof req.body === "string") return req.body;
    return JSON.stringify(req.body);
}

export default async function handler(req, res) {
    const upstreamUrl = resolveUpstreamUrl(req);
    try {
        const upstreamResponse = await fetch(upstreamUrl, {
            method: req.method,
            headers: buildUpstreamHeaders(req),
            body: buildUpstreamBody(req),
        });

        res.status(upstreamResponse.status);
        ["content-type", "content-disposition", "cache-control", "location"].forEach((headerName) => {
            const headerValue = upstreamResponse.headers.get(headerName);
            if (headerValue) res.setHeader(headerName, headerValue);
        });

        const bytes = Buffer.from(await upstreamResponse.arrayBuffer());
        res.send(bytes);
    } catch (error) {
        res.status(502).json({
            detail: "Backend proxy request failed",
            error: error instanceof Error ? error.message : "Unknown proxy error",
        });
    }
}
