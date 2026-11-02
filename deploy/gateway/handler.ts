const upstream = "https://dream-wheels-ai-prod-vnext.onrender.com/health";

export async function handle(
  request: Request,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...headers, Allow: "GET" },
    });
  }
  const path = new URL(request.url).pathname;
  if (path === "/health") {
    return Response.json({ ok: true, service: "deno-test" }, { headers });
  }
  if (path !== "/upstream-health") {
    return new Response("Not found", { status: 404, headers });
  }
  const started = performance.now();
  try {
    const response = await fetcher(upstream, {
      signal: AbortSignal.timeout(60_000),
      redirect: "error",
    });
    await response.body?.cancel();
    return Response.json({
      ok: response.ok,
      upstreamStatus: response.status,
      elapsedMs: Math.round(performance.now() - started),
    }, { status: response.ok ? 200 : 502, headers });
  } catch {
    return Response.json({
      ok: false,
      error: "upstream_unavailable",
      elapsedMs: Math.round(performance.now() - started),
    }, { status: 502, headers });
  }
}
