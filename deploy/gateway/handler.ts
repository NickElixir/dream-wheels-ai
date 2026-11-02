const UPSTREAM_ORIGIN = "https://dream-wheels-ai-prod-vnext.onrender.com";
const UPSTREAM_HEALTH = `${UPSTREAM_ORIGIN}/health`;
const MAX_REQUEST_BYTES = 25 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 60_000;
const ALLOWED_ORIGINS = new Set([
  "https://app.dream-wheels.ru",
  "https://app-test.dream-wheels.ru",
  "https://nickelixir-dream-wheels-ai-dfa9.twc1.net",
  "https://gateway-test.dreamwheels.deno.net",
]);
const CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const CORS_HEADERS =
  "authorization, content-type, accept, x-request-id, x-idempotency-key, x-vehicle-recognition-request-id, x-vehicle-recognition-recovery";
const FORWARDED_REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "x-request-id",
  "x-idempotency-key",
  "x-vehicle-recognition-request-id",
  "x-vehicle-recognition-recovery",
];
const HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "set-cookie",
]);
const STRIPPED_RESPONSE_HEADERS = new Set([
  "cache-control",
  "content-encoding",
  "content-length",
]);

type RouteRule = {
  pattern: RegExp;
  methods: ReadonlySet<string>;
  auth?: boolean;
};
const methods = (...values: string[]) => new Set(values);
const ROUTES: RouteRule[] = [
  { pattern: /^\/auth\/me$/, methods: methods("GET") },
  { pattern: /^\/auth\/bootstrap$/, methods: methods("POST") },
  { pattern: /^\/analytics\/events$/, methods: methods("POST"), auth: false },
  { pattern: /^\/jobs$/, methods: methods("GET", "POST") },
  { pattern: /^\/jobs\/from-assets$/, methods: methods("POST") },
  { pattern: /^\/jobs\/[^/]+$/, methods: methods("GET") },
  {
    pattern:
      /^\/jobs\/[^/]+\/(?:status|fitment\/history|fitment\/catalogue\/(?:regions|makes|models|years)|fitment\/vehicle-catalogue\/(?:makes|models|years|markets))$/,
    methods: methods("GET"),
  },
  { pattern: /^\/jobs\/[^/]+\/fitment$/, methods: methods("GET", "PATCH") },
  {
    pattern:
      /^\/jobs\/[^/]+\/fitment\/(?:rim-source\/resolve|vehicle-variants(?:\/(?:reselect|replace|apply))?)$/,
    methods: methods("POST"),
  },
  {
    pattern:
      /^\/jobs\/[^/]+\/assets\/(?:car_original|car_display|rim_original|result)\/(?:signed-url|download)$/,
    methods: methods("GET"),
  },
  {
    pattern: /^\/jobs\/[^/]+\/(?:download|feedback)$/,
    methods: methods("GET", "PUT", "POST", "DELETE"),
  },
  { pattern: /^\/jobs\/[^/]+\/publications$/, methods: methods("POST") },
  { pattern: /^\/identity\/(?:assets|resolve)$/, methods: methods("POST") },
  {
    pattern: /^\/identity\/drafts\/[^/]+\/assets\/[^/]+$/,
    methods: methods("GET"),
  },
  {
    pattern: /^\/identity\/fitment\/[^/]+\/vehicle-proposal$/,
    methods: methods("POST"),
  },
  { pattern: /^\/fitment\/checks$/, methods: methods("GET", "POST") },
  { pattern: /^\/fitment\/checks\/[^/]+$/, methods: methods("GET") },
  { pattern: /^\/payments\/cabinet$/, methods: methods("GET") },
  { pattern: /^\/payments\/topups$/, methods: methods("POST") },
  { pattern: /^\/payments\/[^/]+\/status$/, methods: methods("GET") },
];

function jsonError(
  status: number,
  error: string,
  extra: HeadersInit = {},
): Response {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ error }), { status, headers });
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", CORS_METHODS);
    headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
    headers.set("Access-Control-Max-Age", "600");
    headers.set("Access-Control-Expose-Headers", "X-Request-Id");
  }
  return headers;
}

function safeBackendPath(pathname: string): string | null {
  // Encoded separators, dot segments, backslashes, and malformed escapes are rejected
  // before decoding so alternate URL parsers cannot reinterpret the route.
  if (/%/i.test(pathname) || /\\/.test(pathname)) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (
    decoded.includes("\\") ||
    decoded.split("/").some((part) => part === "." || part === "..")
  ) return null;
  if (!decoded.startsWith("/api/backend/")) return null;
  if (
    decoded.split("/").slice(1).some((part) => !/^[A-Za-z0-9_-]*$/.test(part))
  ) {
    return null;
  }
  return decoded.slice("/api/backend".length);
}

function matchRoute(path: string, method: string): RouteRule | null {
  return ROUTES.find((route) =>
    route.pattern.test(path) && route.methods.has(method)
  ) ?? null;
}

function forwardHeaders(request: Request, requestId: string): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    if (name === "x-request-id") {
      headers.set(name, requestId);
      continue;
    }
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

function boundedBody(
  body: ReadableStream<Uint8Array>,
  controller: AbortController,
): ReadableStream<Uint8Array> {
  let total = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, streamController) {
        total += chunk.byteLength;
        if (total > MAX_REQUEST_BYTES) {
          controller.abort("request_too_large");
          streamController.error(new RangeError("request_too_large"));
          return;
        }
        streamController.enqueue(chunk);
      },
    }),
  );
}

function responseWithDeadline(
  response: Response,
  controller: AbortController,
  timer: ReturnType<typeof setTimeout>,
  headers: Headers,
): Response {
  const connectionTokens = (response.headers.get("Connection") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  for (const [name, value] of response.headers) {
    const lower = name.toLowerCase();
    if (
      !HOP_HEADERS.has(lower) && !connectionTokens.includes(lower) &&
      !STRIPPED_RESPONSE_HEADERS.has(lower) &&
      !lower.startsWith("access-control-") &&
      lower !== "vary"
    ) {
      headers.set(name, value);
    }
  }
  const vary = new Set([
    ...((headers.get("Vary") || "").split(",").map((value) => value.trim())
      .filter(Boolean)),
    ...((response.headers.get("Vary") || "").split(",").map((value) =>
      value.trim()
    ).filter(Boolean)),
  ]);
  if (vary.size) headers.set("Vary", [...vary].join(", "));
  headers.set("Cache-Control", "no-store");
  if (!response.body) {
    clearTimeout(timer);
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(streamController) {
      try {
        const result = await reader.read();
        if (result.done) {
          clearTimeout(timer);
          streamController.close();
        } else {
          streamController.enqueue(result.value);
        }
      } catch {
        clearTimeout(timer);
        controller.abort("upstream_stream_error");
        streamController.error(new Error("upstream_unavailable"));
      }
    },
    async cancel(reason) {
      clearTimeout(timer);
      controller.abort("downstream_cancelled");
      try {
        await reader.cancel(reason);
      } catch {
        // The upstream stream may already be closed.
      }
    },
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handle(
  request: Request,
  fetcher: typeof fetch = fetch,
  metadata: { environment?: string; build?: string } = {},
): Promise<Response> {
  const started = performance.now();
  const suppliedRequestId = request.headers.get("X-Request-Id") || "";
  const requestId = /^[A-Za-z0-9._:-]{1,64}$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
  let routeTemplate = "unmatched";
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname === "/health") routeTemplate = "/health";
  else if (requestUrl.pathname === "/upstream-health") {
    routeTemplate = "/upstream-health";
  } else {
    const candidate = safeBackendPath(requestUrl.pathname);
    if (candidate) {
      const matched = ROUTES.find((route) => route.pattern.test(candidate));
      if (matched) {
        routeTemplate = matched.pattern.source.replaceAll("\\/", "/");
      }
    }
  }
  const method = /^[A-Z]{1,16}$/.test(request.method)
    ? request.method
    : "OTHER";
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin);

  let response: Response;
  if (url.pathname === "/health" || url.pathname === "/upstream-health") {
    if (request.method !== "GET") {
      response = new Response("Method not allowed", {
        status: 405,
        headers: { ...Object.fromEntries(cors), Allow: "GET" },
      });
    } else if (url.pathname === "/health") {
      response = Response.json({
        ok: true,
        service: "dream-wheels-gateway",
        environment: metadata.environment ?? "test",
        build: metadata.build ?? "unknown",
      }, {
        headers: cors,
      });
    } else {
      const started = performance.now();
      try {
        const upstreamResponse = await fetcher(UPSTREAM_HEALTH, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          redirect: "error",
        });
        await upstreamResponse.body?.cancel();
        response = Response.json({
          ok: upstreamResponse.ok,
          upstreamStatus: upstreamResponse.status,
          elapsedMs: Math.round(performance.now() - started),
        }, { status: upstreamResponse.ok ? 200 : 502, headers: cors });
      } catch {
        response = Response.json({
          ok: false,
          error: "upstream_unavailable",
          elapsedMs: Math.round(performance.now() - started),
        }, { status: 502, headers: cors });
      }
    }
  } else {
    response = await proxyRequest(request, fetcher, url, cors, requestId);
  }

  response.headers.set("X-Request-Id", requestId);
  console.log(JSON.stringify({
    requestId,
    method,
    routeTemplate,
    status: response.status,
    durationMs: Math.round(performance.now() - started),
  }));
  return response;
}

async function proxyRequest(
  request: Request,
  fetcher: typeof fetch,
  url: URL,
  cors: Headers,
  requestId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const path = safeBackendPath(url.pathname);
  if (!path) return jsonError(404, "not_found", cors);
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonError(403, "origin_not_allowed", cors);
  }

  if (request.method === "OPTIONS") {
    if (!origin) return jsonError(400, "origin_required", cors);
    const requestedMethod =
      request.headers.get("Access-Control-Request-Method") || "";
    const route = matchRoute(path, requestedMethod);
    if (!route || !ALLOWED_ORIGINS.has(origin)) {
      return jsonError(403, "route_not_allowed", cors);
    }
    const requestedHeaders =
      (request.headers.get("Access-Control-Request-Headers") || "").split(",")
        .map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (
      requestedHeaders.some((header) =>
        !FORWARDED_REQUEST_HEADERS.includes(header)
      )
    ) return jsonError(403, "header_not_allowed", cors);
    return new Response(null, { status: 204, headers: cors });
  }

  const route = matchRoute(path, request.method);
  if (!route) return jsonError(404, "route_not_allowed", cors);
  if (
    route.auth !== false &&
    !/^Bearer\s+\S+$/i.test(request.headers.get("Authorization") || "")
  ) {
    return jsonError(401, "authorization_required", cors);
  }
  const declaredLength = request.headers.get("Content-Length");
  if (
    declaredLength &&
    (!/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_REQUEST_BYTES)
  ) {
    return jsonError(413, "request_too_large", cors);
  }

  const upstreamUrl = new URL(`${UPSTREAM_ORIGIN}${path}`);
  upstreamUrl.search = url.search;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort("upstream_timeout"),
    REQUEST_TIMEOUT_MS,
  );
  try {
    const headers = forwardHeaders(request, requestId);
    let body: ReadableStream<Uint8Array> | null = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = request.body ? boundedBody(request.body, controller) : null;
    }
    const upstreamResponse = await fetcher(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
      redirect: "manual",
      ...(body ? { duplex: "half" } as RequestInit : {}),
    });
    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      clearTimeout(timer);
      await upstreamResponse.body?.cancel();
      return jsonError(502, "upstream_redirect_not_allowed", cors);
    }
    return responseWithDeadline(upstreamResponse, controller, timer, cors);
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof RangeError && error.message === "request_too_large") {
      return jsonError(413, "request_too_large", cors);
    }
    if (controller.signal.reason === "request_too_large") {
      return jsonError(413, "request_too_large", cors);
    }
    if (controller.signal.aborted) {
      return jsonError(504, "upstream_timeout", cors);
    }
    return jsonError(502, "upstream_unavailable", cors);
  }
}
