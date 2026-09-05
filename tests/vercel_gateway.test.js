const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");
const { test } = require("node:test");

const gateway = require("../webapp/api/backend-gateway");
const proxy = require("../webapp/lib/backend-proxy");

function responseRecorder() {
    const response = new PassThrough();
    const headers = new Map();
    let statusCode = null;
    const chunks = [];

    response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    response.status = (value) => {
        statusCode = value;
        return response;
    };
    response.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    response.json = (value) => {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(value));
    };
    response.send = (value) => response.end(value);
    response.snapshot = () => ({
        body: Buffer.concat(chunks).toString("utf8"),
        headers,
        statusCode,
    });
    return response;
}

test("normalizes the wildcard path and rejects malformed control values", () => {
    assert.equal(
        gateway.backendPathFromRequest({
            query: { __backend_path: "jobs/123/assets/car_original/download" },
        }),
        "/jobs/123/assets/car_original/download",
    );
    assert.equal(
        gateway.backendPathFromRequest({
            query: { __backend_path: ["jobs/123/fitment/catalogue/regions"] },
        }),
        "/jobs/123/fitment/catalogue/regions",
    );
    assert.equal(gateway.backendPathFromRequest({ query: { __backend_path: "" } }), "/");
    assert.equal(gateway.backendPathFromRequest({ query: {} }), null);
    assert.equal(gateway.backendPathFromRequest({ query: { __backend_path: "jobs/123?x=1" } }), null);
    assert.equal(gateway.backendPathFromRequest({ query: { __backend_path: "\\\\evil.example" } }), null);
});

test("forwards deep paths, query, method, headers, body, and response bytes", async () => {
    const previousFetch = global.fetch;
    const previousBackendUrl = process.env.BACKEND_URL;
    const fetchCalls = [];
    global.fetch = async (url, options) => {
        fetchCalls.push({ url: String(url), options });
        return new Response("asset-bytes", {
            status: 206,
            headers: {
                "Content-Type": "image/jpeg",
                "Content-Disposition": "inline; filename=car.jpg",
                Vary: "Accept-Language",
            },
        });
    };

    try {
        process.env.BACKEND_URL = "https://backend.test";
        const response = responseRecorder();
        const request = {
            method: "PATCH",
            url: "/api/backend-gateway?__backend_path=jobs%2F123%2Fassets%2Fcar_original%2Fdownload&tag=a%2Fb&tag=second&empty=",
            query: {
                __backend_path: "jobs/123/assets/car_original/download",
                tag: ["a/b", "second"],
                empty: "",
            },
            headers: {
                authorization: "Bearer test-token",
                cookie: "session=test",
                "content-type": "application/json",
                connection: "keep-alive",
            },
            async *[Symbol.asyncIterator]() {
                yield Buffer.from('{"ok":true}');
            },
        };

        await gateway(request, response);

        assert.equal(fetchCalls.length, 1);
        assert.equal(
            fetchCalls[0].url,
            "https://backend.test/jobs/123/assets/car_original/download?tag=a%2Fb&tag=second&empty=",
        );
        assert.equal(fetchCalls[0].options.method, "PATCH");
        assert.equal(fetchCalls[0].options.headers.get("authorization"), "Bearer test-token");
        assert.equal(fetchCalls[0].options.headers.get("cookie"), "session=test");
        assert.equal(fetchCalls[0].options.headers.get("content-type"), "application/json");
        assert.equal(fetchCalls[0].options.headers.has("connection"), false);
        assert.equal(fetchCalls[0].options.redirect, "manual");
        assert.equal(Buffer.from(fetchCalls[0].options.body).toString("utf8"), '{"ok":true}');

        const snapshot = response.snapshot();
        assert.equal(snapshot.statusCode, 206);
        assert.equal(snapshot.headers.get("content-type"), "image/jpeg");
        assert.equal(snapshot.headers.get("content-disposition"), "inline; filename=car.jpg");
        assert.equal(snapshot.headers.get("cache-control"), "no-store, max-age=0");
        assert.equal(snapshot.headers.get("vary"), "Authorization, Cookie, Accept-Language");
        assert.equal(snapshot.body, "asset-bytes");
    } finally {
        if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = previousBackendUrl;
        global.fetch = previousFetch;
    }
});

test("forwards OAuth redirects without following them", async () => {
    const previousFetch = global.fetch;
    const previousBackendUrl = process.env.BACKEND_URL;
    const fetchCalls = [];
    global.fetch = async (url, options) => {
        fetchCalls.push({ url: String(url), options });
        return new Response(null, {
            status: 302,
            headers: { Location: "https://provider.example/oauth/authorize?client_id=dw" },
        });
    };

    try {
        process.env.BACKEND_URL = "https://backend.test";
        const response = responseRecorder();
        const request = {
            method: "GET",
            url: "/api/backend-gateway?__backend_path=auth/provider/start",
            query: { __backend_path: "auth/provider/start" },
            headers: {},
        };

        await gateway(request, response);

        assert.equal(fetchCalls.length, 1);
        assert.equal(fetchCalls[0].options.redirect, "manual");
        const snapshot = response.snapshot();
        assert.equal(snapshot.statusCode, 302);
        assert.equal(
            snapshot.headers.get("location"),
            "https://provider.example/oauth/authorize?client_id=dw",
        );
    } finally {
        if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = previousBackendUrl;
        global.fetch = previousFetch;
    }
});

test("preserves encoded and repeated OAuth callback query parameters", async () => {
    const previousFetch = global.fetch;
    const previousBackendUrl = process.env.BACKEND_URL;
    const fetchCalls = [];
    global.fetch = async (url, options) => {
        fetchCalls.push({ url: String(url), options });
        return new Response("ok", { status: 200 });
    };

    try {
        process.env.BACKEND_URL = "https://backend.test";
        const response = responseRecorder();
        const request = {
            method: "GET",
            url: "/api/backend-gateway?__backend_path=auth/provider/callback&code=a%2Fb&state=x&state=y&error=access_denied&error_description=not%20approved",
            query: {
                __backend_path: "auth/provider/callback",
                code: "a/b",
                state: ["x", "y"],
                error: "access_denied",
                error_description: "not approved",
            },
            headers: {},
        };

        await gateway(request, response);

        assert.equal(
            fetchCalls[0].url,
            "https://backend.test/auth/provider/callback?code=a%2Fb&state=x&state=y&error=access_denied&error_description=not+approved",
        );
    } finally {
        if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = previousBackendUrl;
        global.fetch = previousFetch;
    }
});

test("forwards one and multiple Set-Cookie headers independently", async () => {
    const previousFetch = global.fetch;
    const previousBackendUrl = process.env.BACKEND_URL;
    global.fetch = async () =>
        new Response("signed-in", {
            status: 302,
            headers: [
                ["Location", "/"],
                ["Set-Cookie", "__Host-dw_session=session-value; Path=/; Secure; HttpOnly; SameSite=Lax"],
                ["Set-Cookie", "dw_csrf=csrf-value; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; Secure; SameSite=Lax"],
            ],
        });

    try {
        process.env.BACKEND_URL = "https://backend.test";
        const response = responseRecorder();
        const request = {
            method: "GET",
            url: "/api/backend-gateway?__backend_path=auth/provider/callback",
            query: { __backend_path: "auth/provider/callback" },
            headers: {},
        };

        await gateway(request, response);

        const snapshot = response.snapshot();
        assert.deepEqual(snapshot.headers.get("set-cookie"), [
            "__Host-dw_session=session-value; Path=/; Secure; HttpOnly; SameSite=Lax",
            "dw_csrf=csrf-value; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; Secure; SameSite=Lax",
        ]);
        assert.equal(snapshot.headers.get("cache-control"), "no-store, max-age=0");
    } finally {
        if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = previousBackendUrl;
        global.fetch = previousFetch;
    }
});

test("forwards a single Set-Cookie header as a one-item array", async () => {
    const previousFetch = global.fetch;
    const previousBackendUrl = process.env.BACKEND_URL;
    global.fetch = async () =>
        new Response("signed-in", {
            status: 200,
            headers: [["Set-Cookie", "__Host-dw_session=session-value; Path=/; Secure; HttpOnly"]],
        });

    try {
        process.env.BACKEND_URL = "https://backend.test";
        const response = responseRecorder();
        const request = {
            method: "GET",
            url: "/api/backend-gateway?__backend_path=auth/provider/session",
            query: { __backend_path: "auth/provider/session" },
            headers: {},
        };

        await gateway(request, response);

        assert.deepEqual(response.snapshot().headers.get("set-cookie"), [
            "__Host-dw_session=session-value; Path=/; Secure; HttpOnly",
        ]);
    } finally {
        if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = previousBackendUrl;
        global.fetch = previousFetch;
    }
});

test("does not let a backend path replace the configured backend host", async () => {
    const previousFetch = global.fetch;
    const previousBackendUrl = process.env.BACKEND_URL;
    let fetchCalled = false;
    global.fetch = async () => {
        fetchCalled = true;
        throw new Error("fetch must not be called");
    };

    try {
        process.env.BACKEND_URL = "https://backend.test";
        const response = responseRecorder();
        const request = {
            method: "GET",
            url: "/api/backend-gateway?__backend_path=ignored",
            headers: {},
        };

        await proxy.proxyBackendRequest(request, response, { backendPath: "/\\evil.example" });

        assert.equal(fetchCalled, false);
        assert.equal(response.snapshot().statusCode, 400);
    } finally {
        if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = previousBackendUrl;
        global.fetch = previousFetch;
    }
});
