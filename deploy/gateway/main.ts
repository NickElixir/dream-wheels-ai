import { handle } from "./handler.ts";

const environment = Deno.env.get("GATEWAY_ENVIRONMENT") ?? "test";
if (environment !== "production" && environment !== "test") {
  throw new Error("GATEWAY_ENVIRONMENT must be production or test");
}
const build = Deno.env.get("GATEWAY_BUILD_SHA") ?? "unknown";
if (build !== "unknown" && !/^[a-f0-9]{40}$/.test(build)) {
  throw new Error("GATEWAY_BUILD_SHA must be a full lowercase commit SHA");
}

if (environment === "production" && build === "unknown") {
  throw new Error("Production gateway requires GATEWAY_BUILD_SHA");
}

if (import.meta.main) {
  Deno.serve(
    { hostname: "0.0.0.0", port: 8000 },
    (request) => handle(request, fetch, { environment, build }),
  );
}
