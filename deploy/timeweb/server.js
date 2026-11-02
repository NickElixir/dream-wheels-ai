"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const proxyBackendRequest = require("../../webapp/lib/backend-proxy.js");

const WEBAPP_ROOT = path.resolve(__dirname, "../../webapp");
const EXPECTED_BACKEND_ORIGIN = "https://dream-wheels-ai-prod-vnext.onrender.com";
const DEFAULT_PORT = 3000;
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const DEFAULT_BACKEND_TIMEOUT_MS = 90_000;
const STATIC_ROOT_FILES = new Set([
    "app-route.mjs", "app.js", "cover.jpg", "favicon.ico", "favicon.svg",
    "index.html", "startup.js", "style.css",
]);
const STATIC_DIRECTORY_ROOTS = new Set(["assets", "vnext"]);
const STATIC_AUTH_FILES = new Set(["app-auth.bundle.js", "harness-config.js"]);
const SPA_PATHS = [
    /^\/$/u,
    /^\/app(?:\/.*)?$/u,
    /^\/t\/?$/u,
    /^\/(?:create|history|balance|account|help|help\/photos|documents)$/u,
    /^\/try-ons(?:\/.*)?$/u,
];
const MIME_TYPES = new Map([
    [".css", "text/css; charset=utf-8"],
    [".gif", "image/gif"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".jpeg", "image/jpeg"],
    [".jpg", "image/jpeg"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".webp", "image/webp"],
    [".woff2", "font/woff2"],
]);
const ALLOWED_PROXY_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

function assertBackendUrl(value = process.env.BACKEND_URL || EXPECTED_BACKEND_ORIGIN) {
    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error("BACKEND_URL must be the approved production backend origin");
    }
    if (parsed.origin !== EXPECTED_BACKEND_ORIGIN || parsed.href !== `${EXPECTED_BACKEND_ORIGIN}/`) {
        throw new Error("BACKEND_URL must be the approved production backend origin");
    }
    return parsed.origin;
}

function positiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function withFetchTimeout(fetchImpl, timeoutMs) {
    return (input, init = {}) => fetchImpl(input, {
        ...init,
        signal: init.signal || AbortSignal.timeout(timeoutMs),
    });
}

function installFetchTimeout(timeoutMs) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = withFetchTimeout(originalFetch, timeoutMs);
    return () => { globalThis.fetch = originalFetch; };
}

function sendJson(res, status, value) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.end(JSON.stringify(value));
}

function setCommonHeaders(res) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://*.telegram.org https://web.telegram.org https://t.me");
}

function safeRequestPath(reqUrl) {
    const rawPath = String(reqUrl || "/").split("?", 1)[0];
    if (!rawPath.startsWith("/") || rawPath.includes("\\") || /%(?:2f|5c)/iu.test(rawPath)) return null;
    let decoded;
    try {
        decoded = decodeURIComponent(rawPath);
    } catch {
        return null;
    }
    if (decoded.includes("\\") || decoded.includes("\0")) return null;
    const segments = decoded.split("/");
    if (segments.some((segment) => segment === "." || segment === ".." || segment.startsWith("."))) return null;
    return decoded;
}

function isStaticPathAllowed(requestPath) {
    if (requestPath === "/version.json") return true;
    const relative = requestPath.replace(/^\//u, "");
    if (STATIC_ROOT_FILES.has(relative)) return true;
    const segments = relative.split("/");
    if (segments.length < 2) return false;
    if (segments.some((segment) => ["api", "lib", "scripts", "node_modules", "tests", "test", "__tests__"].includes(segment))) return false;
    const filename = segments.at(-1);
    if (/^(?:package(?:-lock)?\.json|README\.md|vercel\.json|\.gitignore|\.env(?:\..*)?|.*\.(?:test|spec)\.[^.]+)$/iu.test(filename)) return false;
    if (STATIC_DIRECTORY_ROOTS.has(segments[0])) return true;
    return segments.length === 2 && segments[0] === "auth" && STATIC_AUTH_FILES.has(segments[1]);
}

function resolveStaticFile(requestPath, webappRoot = WEBAPP_ROOT) {
    if (!isStaticPathAllowed(requestPath)) return null;
    const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\//u, "");
    const resolvedRoot = path.resolve(webappRoot);
    const resolvedPath = path.resolve(resolvedRoot, relativePath);
    const relative = path.relative(resolvedRoot, resolvedPath);
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;

    let current = resolvedRoot;
    for (const segment of relative.split(path.sep)) {
        current = path.join(current, segment);
        try {
            if (fs.lstatSync(current).isSymbolicLink()) return null;
        } catch {
            return null;
        }
    }
    try {
        const realRoot = fs.realpathSync(resolvedRoot);
        const realPath = fs.realpathSync(resolvedPath);
        const realRelative = path.relative(realRoot, realPath);
        if (realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) return null;
        if (!fs.statSync(realPath).isFile()) return null;
        return realPath;
    } catch {
        return null;
    }
}

async function readLimitedBody(req, maxBytes = MAX_BODY_BYTES) {
    const contentLength = Number(req.headers["content-length"] || 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        req.resume();
        return null;
    }
    const chunks = [];
    let total = 0;
    let tooLarge = false;
    for await (const chunk of req) {
        total += chunk.length;
        if (total > maxBytes) {
            tooLarge = true;
            chunks.length = 0;
            continue;
        }
        if (!tooLarge) chunks.push(chunk);
    }
    return tooLarge ? null : Buffer.concat(chunks);
}

function createResponseAdapter(res) {
    return {
        get headersSent() { return res.headersSent; },
        status(statusCode) {
            res.statusCode = statusCode;
            return this;
        },
        setHeader(name, value) {
            if (!res.headersSent) res.setHeader(name, value);
        },
        json(value) {
            if (res.writableEnded) return this;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(value));
            return this;
        },
        send(value) {
            if (!res.writableEnded) res.end(value);
            return this;
        },
        destroy(error) { res.destroy(error); },
    };
}

async function serveStatic(req, res, requestPath, webappRoot, buildSha) {
    if (requestPath === "/healthz") {
        sendJson(res, 200, { status: "ok" });
        return;
    }
    if (requestPath === "/version.json") {
        sendJson(res, 200, { build: buildSha, built_at: null });
        return;
    }

    const filePath = resolveStaticFile(requestPath, webappRoot);
    if (filePath) {
        let body = await fs.promises.readFile(filePath);
        if (path.basename(filePath) === "index.html") {
            body = Buffer.from(body.toString("utf8").replaceAll("__BUILD_ID__", buildSha));
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream");
        res.setHeader("Cache-Control", filePath.endsWith("index.html") ? "no-store, max-age=0" : "public, max-age=3600");
        if (requestPath === "/auth/harness-config.js") res.setHeader("Cache-Control", "no-store, max-age=0");
        res.setHeader("Content-Length", body.length);
        if (req.method === "HEAD") res.end();
        else res.end(body);
        return;
    }

    if (SPA_PATHS.some((pattern) => pattern.test(requestPath))) {
        await serveStatic(req, res, "/index.html", webappRoot, buildSha);
        return;
    }
    sendJson(res, 404, { detail: "Not found" });
}

function createAppServer({ webappRoot = WEBAPP_ROOT, buildSha = process.env.APP_BUILD_SHA || "unknown", backendProxy = proxyBackendRequest } = {}) {
    return http.createServer(async (req, res) => {
        setCommonHeaders(res);
        const requestPath = safeRequestPath(req.url);
        if (!requestPath) {
            sendJson(res, 400, { detail: "Invalid path" });
            return;
        }

        if (requestPath === "/healthz" || requestPath === "/version.json" || !requestPath.startsWith("/api/backend/")) {
            if (!["GET", "HEAD"].includes(req.method || "GET")) {
                sendJson(res, 405, { detail: "Method not allowed" });
                return;
            }
            await serveStatic(req, res, requestPath, webappRoot, buildSha);
            return;
        }

        if (!ALLOWED_PROXY_METHODS.has(req.method || "GET")) {
            sendJson(res, 405, { detail: "Method not allowed" });
            return;
        }
        const body = ["GET", "HEAD"].includes(req.method || "GET") ? Buffer.alloc(0) : await readLimitedBody(req);
        if (body === null) {
            sendJson(res, 413, { detail: "Request body is too large" });
            return;
        }
        const adaptedRequest = {
            method: req.method,
            headers: req.headers,
            url: req.url,
            async *[Symbol.asyncIterator]() { if (body.length) yield body; },
        };
        const adaptedResponse = createResponseAdapter(res);
        try {
            await backendProxy(adaptedRequest, adaptedResponse);
        } catch {
            if (!res.headersSent && !res.writableEnded) sendJson(res, 502, { detail: "Backend is unavailable" });
            else if (!res.writableEnded) res.destroy();
        }
    });
}

function buildPublicConfig(webappRoot = WEBAPP_ROOT, env = process.env) {
    const build = spawnSync(process.execPath, [path.join(webappRoot, "scripts/build-public-config.mjs")], {
        cwd: webappRoot,
        env,
        stdio: "inherit",
    });
    if (build.error) throw build.error;
    if (build.status !== 0) throw new Error("Public frontend configuration could not be generated");
}

function start() {
    const backendUrl = assertBackendUrl();
    const buildSha = process.env.APP_BUILD_SHA || "";
    if (!/^[a-f0-9]{40}$/iu.test(buildSha)) throw new Error("APP_BUILD_SHA must be a full commit SHA");
    process.env.BACKEND_URL = backendUrl;
    const timeoutMs = positiveInteger(process.env.BACKEND_TIMEOUT_MS, DEFAULT_BACKEND_TIMEOUT_MS);
    installFetchTimeout(timeoutMs);
    buildPublicConfig();
    const port = positiveInteger(process.env.PORT, DEFAULT_PORT);
    const server = createAppServer({ buildSha });
    server.headersTimeout = 15_000;
    server.requestTimeout = 120_000;
    server.keepAliveTimeout = 5_000;
    server.listen(port, "0.0.0.0", () => process.stdout.write(`Dream Wheels frontend listening on ${port}\n`));
    return server;
}

if (require.main === module) {
    try {
        start();
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = {
    EXPECTED_BACKEND_ORIGIN,
    MAX_BODY_BYTES,
    assertBackendUrl,
    buildPublicConfig,
    createAppServer,
    installFetchTimeout,
    isStaticPathAllowed,
    readLimitedBody,
    resolveStaticFile,
    safeRequestPath,
    withFetchTimeout,
};
