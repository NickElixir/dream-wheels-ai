const HOP_BY_HOP_HEADERS = new Set([
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
]);

// Node's fetch transparently decodes compressed upstream responses. Forwarding
// the original content-encoding would make browsers try to decode the already
// decoded body a second time.
const RESPONSE_HEADERS_TO_SKIP = new Set([...HOP_BY_HOP_HEADERS, "content-encoding"]);

function backendBaseUrl() {
    const value = (process.env.BACKEND_URL || "").trim();
    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return null;
    }
    if (!value || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
        return null;
    }
    return parsed;
}

function forwardHeaders(headers) {
    const result = new Headers();
    for (const [name, value] of Object.entries(headers)) {
        if (value && !HOP_BY_HOP_HEADERS.has(name.toLowerCase())) result.set(name, value);
    }
    return result;
}

async function readBody(req) {
    if (["GET", "HEAD"].includes(req.method || "GET")) return undefined;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
}

function requestSearch(requestUrl, keysToStrip) {
    for (const key of keysToStrip) requestUrl.searchParams.delete(key);
    return requestUrl.search;
}

async function sendResponseBody(response, res) {
    // Vercel's Node response adapter owns completion signaling. Buffering and
    // sending the complete byte sequence keeps the adapter's established
    // semantics for binary asset responses and avoids returning before the
    // platform has flushed the body.
    res.send(Buffer.from(await response.arrayBuffer()));
}

async function proxyBackendRequest(req, res, { backendPath, stripQueryKeys = [] } = {}) {
    const backendUrl = backendBaseUrl();
    if (!backendUrl) {
        res.status(503).json({ detail: "Backend proxy is not configured" });
        return;
    }

    const requestUrl = new URL(req.url || "/", "https://webapp.invalid");
    const path = backendPath ?? requestUrl.pathname.replace(/^\/api\/backend(?:\/|$)/, "");
    const target = new URL(path, `${backendUrl.toString().replace(/\/$/, "")}/`);
    target.search = requestSearch(requestUrl, stripQueryKeys);

    try {
        const response = await fetch(target, {
            method: req.method,
            headers: forwardHeaders(req.headers),
            body: await readBody(req),
        });
        res.status(response.status);
        // Fitment GET responses are user-scoped and revision-sensitive. Do
        // not allow a Vercel/browser cache to replay an older overview after
        // a vehicle or RimSpec mutation has completed.
        res.setHeader("Cache-Control", "no-store, max-age=0");
        res.setHeader("Vary", "Authorization");
        for (const [name, value] of response.headers) {
            if (!RESPONSE_HEADERS_TO_SKIP.has(name.toLowerCase()) && !["cache-control", "vary"].includes(name.toLowerCase())) {
                res.setHeader(name, value);
            }
        }
        await sendResponseBody(response, res);
    } catch (error) {
        if (res.headersSent && typeof res.destroy === "function") {
            res.destroy(error);
            return;
        }
        res.status(502).json({ detail: "Backend is unavailable" });
    }
}

module.exports = proxyBackendRequest;
module.exports.proxyBackendRequest = proxyBackendRequest;
module.exports.sendResponseBody = sendResponseBody;
