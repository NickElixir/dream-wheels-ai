import { handle } from "./handler.ts";

if (import.meta.main) {
  Deno.serve({ hostname: "0.0.0.0", port: 8000 }, (request) => handle(request));
}
