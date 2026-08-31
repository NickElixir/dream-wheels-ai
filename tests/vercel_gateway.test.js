const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");
const { test } = require("node:test");

const gateway = require("../webapp/api/backend-gateway");

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
        assert.equal(fetchCalls[0].options.headers.get("content-type"), "application/json");
        assert.equal(fetchCalls[0].options.headers.has("connection"), false);
        assert.equal(Buffer.from(fetchCalls[0].options.body).toString("utf8"), '{"ok":true}');

        const snapshot = response.snapshot();
        assert.equal(snapshot.statusCode, 206);
        assert.equal(snapshot.headers.get("content-type"), "image/jpeg");
        assert.equal(snapshot.headers.get("content-disposition"), "inline; filename=car.jpg");
        assert.equal(snapshot.body, "asset-bytes");
    } finally {
        if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
        else process.env.BACKEND_URL = previousBackendUrl;
        global.fetch = previousFetch;
    }
});
