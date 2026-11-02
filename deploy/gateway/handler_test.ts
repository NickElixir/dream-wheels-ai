import { handle } from "./handler.ts";

const origin = "https://app.dream-wheels.ru";
const auth = { Authorization: "Bearer access-token" };
const assert: (condition: unknown, message: string) => void = (
  condition,
  message,
) => {
  if (!condition) throw new Error(message);
};

Deno.test("local health does not contact upstream", async () => {
  const response = await handle(
    new Request("http://localhost/health"),
    () => {
      throw new Error("Unexpected network call");
    },
    { environment: "production", build: "abc123" },
  );
  const body = await response.json();
  assert(
    response.status === 200 && body.ok &&
      body.service === "dream-wheels-gateway" &&
      body.environment === "production" && body.build === "abc123",
    "Health failed",
  );
  assert(response.headers.get("X-Request-Id") !== null, "Request id missing");
});

Deno.test("valid request ids are forwarded and unsafe values are replaced", async () => {
  const forwarded = await handle(
    new Request("https://gateway.test/health", {
      headers: { "X-Request-Id": "trace-123" },
    }),
  );
  assert(
    forwarded.headers.get("X-Request-Id") === "trace-123",
    "Valid id changed",
  );
  const sanitized = await handle(
    new Request("https://gateway.test/health?token=secret", {
      headers: { "X-Request-Id": "bad id" },
    }),
  );
  const id = sanitized.headers.get("X-Request-Id") || "";
  assert(/^[0-9a-f-]{36}$/i.test(id), "Unsafe id was not replaced");
});

Deno.test("upstream health uses fixed destination and does not forward credentials", async () => {
  const response = await handle(
    new Request("http://localhost/upstream-health?url=https://example.com", {
      headers: auth,
    }),
    (input, init) => {
      assert(
        input === "https://dream-wheels-ai-prod-vnext.onrender.com/health",
        "Unexpected destination",
      );
      assert(!init?.headers && init?.redirect === "error", "Unsafe forwarding");
      return Promise.resolve(new Response("ok"));
    },
  );
  assert(response.status === 200, "Upstream check failed");
});

Deno.test("network failures produce a bounded generic health response", async () => {
  const response = await handle(
    new Request("http://localhost/upstream-health"),
    () => {
      throw new Error("Sensitive internal detail");
    },
  );
  assert(
    response.status === 502 && !(await response.text()).includes("Sensitive"),
    "Failure leaked details",
  );
});

Deno.test("proxy preserves query, approved headers and streams multipart body", async () => {
  const body = new FormData();
  body.append("car_image", new Blob(["car-bytes"]), "car.png");
  const response = await handle(
    new Request(
      `https://gateway.test/api/backend/identity/assets?mode=fast&x=1`,
      {
        method: "POST",
        headers: {
          Origin: origin,
          ...auth,
          Cookie: "session=secret",
          "X-Ignore": "no",
        },
        body,
      },
    ),
    async (input, init) => {
      await Promise.resolve();
      assert(
        input ===
          "https://dream-wheels-ai-prod-vnext.onrender.com/identity/assets?mode=fast&x=1",
        "Query or destination changed",
      );
      const headers = new Headers(init?.headers);
      assert(
        headers.get("authorization") === auth.Authorization,
        "Bearer missing",
      );
      assert(
        headers.has("content-type") && !headers.has("cookie") &&
          !headers.has("x-ignore"),
        "Unsafe request headers",
      );
      assert(init?.redirect === "manual", "Redirect policy must be manual");
      return new Response('{"draft_id":"d1"}', {
        headers: {
          "Set-Cookie": "secret=1",
          "Cache-Control": "public",
          "Content-Type": "application/json",
        },
      });
    },
  );
  assert(response.status === 200, "Proxy failed");
  assert(
    response.headers.get("Access-Control-Allow-Origin") === origin,
    "CORS origin missing",
  );
  assert(
    response.headers.get("Cache-Control") === "no-store" &&
      !response.headers.has("Set-Cookie"),
    "Response leaked cookie/cache policy",
  );
});

Deno.test("preflight validates route, origin, method and requested headers without upstream call", async () => {
  const response = await handle(
    new Request("https://gateway.test/api/backend/jobs/from-assets", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
      },
    }),
    () => {
      throw new Error("Preflight must not call upstream");
    },
  );
  assert(
    response.status === 204 &&
      response.headers.get("Access-Control-Allow-Origin") === origin,
    "Preflight failed",
  );
  const rejected = await handle(
    new Request("https://gateway.test/api/backend/jobs/from-assets", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
      },
    }),
  );
  assert(rejected.status === 403, "Untrusted origin was allowed");
});

Deno.test("protected routes require bearer; removed Telegram auth routes stay unavailable", async () => {
  const denied = await handle(
    new Request(`https://gateway.test/api/backend/jobs?limit=10`, {
      headers: { Origin: origin },
    }),
  );
  assert(denied.status === 401, "Protected route did not require bearer");
  const removed = await handle(
    new Request(
      "https://gateway.test/api/backend/auth/telegram/nonce",
      { headers: { Origin: origin } },
    ),
  );
  assert(removed.status === 404, "Removed Telegram auth route passed through");
  const analytics = await handle(
    new Request(
      "https://gateway.test/api/backend/analytics/events",
      { method: "POST", headers: { Origin: origin } },
    ),
    () => Promise.resolve(new Response("ok")),
  );
  assert(analytics.status === 200, "Analytics route should remain public");
});

Deno.test("rejects admin, unknown, traversal, encoded separator and arbitrary paths", async () => {
  for (
    const path of [
      "/api/backend/admin/users",
      "/api/backend/unknown",
      "/api/backend/jobs/../admin",
      "/api/backend/jobs/%2e%2e/admin",
      "/api/backend/jobs%2f..%2fadmin",
      "/api/backend/jobs/%2561",
      "/api/backend/jobs/%252e%252e",
      "/api/backend//admin",
    ]
  ) {
    const response = await handle(
      new Request(`https://gateway.test${path}`, {
        headers: { Origin: origin, ...auth },
      }),
    );
    assert(response.status === 404, `Unsafe path accepted: ${path}`);
  }
  const arbitrary = await handle(
    new Request("https://gateway.test/api/backend/https://evil.example", {
      headers: { Origin: origin, ...auth },
    }),
  );
  assert(arbitrary.status === 404, "Arbitrary destination accepted");
});

Deno.test("rejects oversized declared and streamed bodies", async () => {
  const declared = await handle(
    new Request("https://gateway.test/api/backend/jobs/from-assets", {
      method: "POST",
      headers: {
        Origin: origin,
        ...auth,
        "Content-Length": String(26 * 1024 * 1024),
      },
    }),
  );
  assert(declared.status === 413, "Oversized Content-Length accepted");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(13 * 1024 * 1024));
      controller.enqueue(new Uint8Array(13 * 1024 * 1024));
      controller.close();
    },
  });
  const streamed = await handle(
    new Request("https://gateway.test/api/backend/jobs/from-assets", {
      method: "POST",
      headers: { Origin: origin, ...auth },
      body: stream,
      ...({ duplex: "half" } as Record<string, string>),
    }),
    async (_input, init) => {
      await new Response(init?.body).arrayBuffer();
      return new Response("unexpected");
    },
  );
  assert(streamed.status === 413, "Oversized streamed request accepted");
});

Deno.test("backend redirects are not followed and errors do not leak tokens", async () => {
  let redirectBodyCancelled = false;
  const response = await handle(
    new Request("https://gateway.test/api/backend/jobs", {
      headers: { Origin: origin, ...auth },
    }),
    () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            cancel() {
              redirectBodyCancelled = true;
            },
          }),
          {
            status: 302,
            headers: { Location: "https://evil.example/" },
          },
        ),
      ),
  );
  assert(
    response.status === 502 &&
      (await response.json()).error === "upstream_redirect_not_allowed" &&
      !response.headers.has("Location") && redirectBodyCancelled,
    "Redirect was followed or exposed",
  );
  const failed = await handle(
    new Request("https://gateway.test/api/backend/jobs", {
      headers: { Origin: origin, ...auth },
    }),
    () => {
      throw new Error("Bearer access-token internal secret");
    },
  );
  const text = await failed.text();
  assert(
    failed.status === 502 && !text.includes("access-token") &&
      !text.includes("internal secret"),
    "Proxy error leaked details",
  );
});

Deno.test("preserves upstream 401 and strips decoded-body and upstream CORS headers", async () => {
  const response = await handle(
    new Request("https://gateway.test/api/backend/jobs", {
      headers: { Origin: origin, ...auth },
    }),
    () =>
      Promise.resolve(
        new Response("unauthorized", {
          status: 401,
          headers: {
            "Content-Encoding": "gzip",
            "Content-Length": "999",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "text/plain",
            "Vary": "Accept-Encoding",
          },
        }),
      ),
  );
  assert(response.status === 401, "Backend 401 status changed");
  assert(
    !response.headers.has("Content-Encoding") &&
      !response.headers.has("Content-Length"),
    "Stale encoding metadata forwarded",
  );
  assert(
    !response.headers.has("Access-Control-Allow-Credentials"),
    "Upstream CORS header forwarded",
  );
  assert(
    response.headers.get("Access-Control-Allow-Origin") === origin,
    "Gateway CORS header missing",
  );
  assert(
    response.headers.get("Vary")?.includes("Origin") &&
      response.headers.get("Vary")?.includes("Accept-Encoding"),
    "Vary values were not merged",
  );
});

Deno.test("downstream cancellation cancels upstream and releases deadline", async () => {
  let upstreamCancelled = false;
  const state: { signal?: AbortSignal } = {};
  const response = await handle(
    new Request("https://gateway.test/api/backend/jobs", {
      headers: { Origin: origin, ...auth },
    }),
    (_input, init) => {
      state.signal = init?.signal ?? undefined;
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2, 3]));
            },
            cancel() {
              upstreamCancelled = true;
            },
          }),
        ),
      );
    },
  );
  await response.body?.cancel("consumer stopped");
  assert(upstreamCancelled, "Upstream body was not cancelled");
  assert(state.signal?.aborted, "Upstream request was not aborted");
});
