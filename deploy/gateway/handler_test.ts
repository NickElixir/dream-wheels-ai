import { handle } from "./handler.ts";

Deno.test("local health does not contact upstream", async () => {
  const response = await handle(new Request("http://localhost/health"), () => {
    throw new Error("Unexpected network call");
  });
  if (response.status !== 200 || !(await response.json()).ok) {
    throw new Error("Health failed");
  }
});

Deno.test("upstream destination is fixed and credentials are not forwarded", async () => {
  const response = await handle(
    new Request("http://localhost/upstream-health?url=https://example.com", {
      headers: { Authorization: "Bearer test" },
    }),
    (input, init) => {
      if (input !== "https://dream-wheels-ai-prod-vnext.onrender.com/health") {
        throw new Error("Unexpected destination");
      }
      if (init?.headers || init?.redirect !== "error") {
        throw new Error("Unsafe forwarding");
      }
      return Promise.resolve(new Response("ok"));
    },
  );
  if (response.status !== 200) throw new Error("Upstream check failed");
});

Deno.test("network failures produce a bounded generic response", async () => {
  const response = await handle(
    new Request("http://localhost/upstream-health"),
    () => {
      throw new Error("Sensitive internal detail");
    },
  );
  if (
    response.status !== 502 || (await response.text()).includes("Sensitive")
  ) {
    throw new Error("Failure leaked details");
  }
});
