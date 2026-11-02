"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { once } = require("node:events");
const proxyBackendRequest = require("../../webapp/lib/backend-proxy.js");
const {
    EXPECTED_BACKEND_ORIGIN,
    MAX_BODY_BYTES,
    assertBackendUrl,
    createAppServer,
    readLimitedBody,
    resolveStaticFile,
    withFetchTimeout,
} = require("./server.js");

async function serve(options = {}) {
    const server = createAppServer({ buildSha: "test-sha", ...options });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    return {
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    };
}

function requestHttp(url, { method = "GET", headers = {}, body = null } = {}) {
    return new Promise((resolve, reject) => {
        const request = http.request(url, { method, headers }, (response) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
        });
        request.on("error", reject);
        if (body) request.write(body);
        request.end();
    });
}

test("only the approved production backend origin passes configuration validation", () => {
    assert.equal(assertBackendUrl(EXPECTED_BACKEND_ORIGIN), EXPECTED_BACKEND_ORIGIN);
    for (const origin of ["http://dream-wheels-ai-prod-vnext.onrender.com", "https://evil.example", `${EXPECTED_BACKEND_ORIGIN}/api`, `${EXPECTED_BACKEND_ORIGIN}?next=evil`]) {
        assert.throws(() => assertBackendUrl(origin));
    }
});

test("health and version endpoints are noindex and report the configured build", async (t) => {
    const app = await serve();
    t.after(app.close);
    const health = await fetch(`${app.baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.deepEqual(await health.json(), { status: "ok" });
    const version = await fetch(`${app.baseUrl}/version.json`);
    assert.equal(version.headers.get("cache-control"), "no-store, max-age=0");
    assert.deepEqual(await version.json(), { build: "test-sha", built_at: null });
});

test("configured SPA routes resolve to the frontend while unknown routes stay 404", async (t) => {
    const app = await serve();
    t.after(app.close);
    for (const route of ["/", "/app", "/app/history", "/t/", "/create", "/history", "/balance", "/account", "/help/photos", "/documents", "/try-ons/example"]) {
        const response = await fetch(`${app.baseUrl}${route}`);
        assert.equal(response.status, 200, route);
        assert.match(response.headers.get("content-type"), /text\/html/u);
    }
    assert.equal((await fetch(`${app.baseUrl}/not-a-route`)).status, 404);
    assert.equal((await fetch(`${app.baseUrl}/style.css`, { method: "POST" })).status, 405);
});

test("frontend HTML is noindex and substitutes the immutable build ID", async (t) => {
    const app = await serve({ buildSha: "a".repeat(40) });
    t.after(app.close);
    const response = await fetch(`${app.baseUrl}/app`);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    const html = await response.text();
    assert.ok(html.includes(`v=${"a".repeat(40)}`));
    assert.equal(html.includes("__BUILD_ID__"), false);
});

test("backend gateway preserves query and authorization and returns binary bytes", async (t) => {
    const oldFetch = globalThis.fetch;
    const oldBackend = process.env.BACKEND_URL;
    process.env.BACKEND_URL = EXPECTED_BACKEND_ORIGIN;
    const bytes = Buffer.from([0, 1, 127, 128, 255]);
    let seen;
    globalThis.fetch = async (target, init) => {
        seen = { target: String(target), authorization: new Headers(init.headers).get("authorization"), method: init.method };
        return new Response(bytes, { status: 200, headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private" } });
    };
    const app = await serve({ backendProxy: proxyBackendRequest });
    t.after(async () => {
        await app.close();
        globalThis.fetch = oldFetch;
        if (oldBackend === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = oldBackend;
    });

    const response = await requestHttp(`${app.baseUrl}/api/backend/jobs?marker=kept&other=2`, {
        headers: { Authorization: "Bearer test-session" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers["content-type"], "application/octet-stream");
    assert.equal(response.headers["cache-control"], "no-store, max-age=0");
    assert.deepEqual(response.body, bytes);
    assert.deepEqual(seen, {
        target: `${EXPECTED_BACKEND_ORIGIN}/jobs?marker=kept&other=2`,
        authorization: "Bearer test-session",
        method: "GET",
    });
});

test("gateway forwards request bodies and only serves its reserved API prefix", async (t) => {
    const oldFetch = globalThis.fetch;
    const oldBackend = process.env.BACKEND_URL;
    process.env.BACKEND_URL = EXPECTED_BACKEND_ORIGIN;
    let seenBody;
    globalThis.fetch = async (_target, init) => {
        seenBody = Buffer.from(init.body);
        return Response.json({ accepted: true }, { status: 201 });
    };
    const app = await serve({ backendProxy: proxyBackendRequest });
    t.after(async () => {
        await app.close();
        globalThis.fetch = oldFetch;
        if (oldBackend === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = oldBackend;
    });

    const response = await requestHttp(`${app.baseUrl}/api/backend/jobs?create=1`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "wheel" }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(seenBody, Buffer.from(JSON.stringify({ prompt: "wheel" })));
    const putResponse = await requestHttp(`${app.baseUrl}/api/backend/account/name`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "test" }),
    });
    assert.equal(putResponse.status, 201);
    assert.equal((await requestHttp(`${app.baseUrl}/api/backend-gateway.js`)).status, 404);
});

test("server never exposes implementation, build, package, test, hidden, or env paths", async (t) => {
    const app = await serve();
    t.after(app.close);
    for (const route of [
        "/api/backend-gateway.js", "/lib/backend-proxy.js", "/scripts/build-public-config.mjs",
        "/webapp/vercel.json", "/auth/app-auth.js", "/auth/package.json", "/auth/public-config.test.js",
        "/vnext/package.json", "/.env", "/.git/config", "/README.md",
    ]) {
        assert.notEqual((await requestHttp(`${app.baseUrl}${route}`)).status, 200, route);
    }
});

test("path validation rejects traversal and symlinks outside the public tree", async (t) => {
    const app = await serve();
    t.after(app.close);
    assert.equal((await fetch(`${app.baseUrl}/%2e%2e/.env`)).status, 400);
    assert.equal((await fetch(`${app.baseUrl}/assets%2f..%2f.env`)).status, 400);

    const root = await fs.mkdtemp(path.join(os.tmpdir(), "dw-timeweb-static-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    await fs.mkdir(path.join(root, "assets"));
    const privateFile = path.join(root, "private.txt");
    await fs.writeFile(privateFile, "private");
    await fs.symlink(privateFile, path.join(root, "assets", "linked.txt"));
    assert.equal(resolveStaticFile("/assets/linked.txt", root), null);
});

test("request body size is bounded", async () => {
    let resumed = false;
    const oversized = { headers: { "content-length": String(MAX_BODY_BYTES + 1) }, resume() { resumed = true; } };
    assert.equal(await readLimitedBody(oversized), null);
    assert.equal(resumed, true);

    let chunksRead = 0;
    const chunked = {
        headers: { "content-length": "0" },
        async *[Symbol.asyncIterator]() {
            chunksRead += 1;
            yield Buffer.from("123");
            chunksRead += 1;
            yield Buffer.from("45");
            chunksRead += 1;
            yield Buffer.from("6");
        },
    };
    assert.equal(await readLimitedBody(chunked, 4), null);
    assert.equal(chunksRead, 3);
});

test("backend fetch timeout wrapper installs an abort signal", async () => {
    let options;
    const timedFetch = withFetchTimeout(async (_input, init) => { options = init; return "ok"; }, 1000);
    assert.equal(await timedFetch("https://backend.example"), "ok");
    assert.ok(options.signal instanceof AbortSignal);
});
