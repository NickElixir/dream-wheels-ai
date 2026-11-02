# Diagnostic API gateway

Temporary Deno Deploy connectivity probe. This is not a production proxy. No
credentials, database access, frontend changes, or DNS changes are required.

## Local checks

Requires Deno 2.9+. From this directory:

```sh
deno task check
deno task start
```

- `/health`: local JSON response; never contacts Render.
- `/upstream-health`: GET to the fixed production Render `/health`, with a
  60-second timeout. Returns status and duration, never the upstream body.
- Other methods return 405; unknown paths return 404.
- Browser credentials and arbitrary destination URLs are never forwarded.
- Responses use `Cache-Control: no-store`.

## Deno Deploy console

Use `deploy/gateway` as App Directory, No Preset, Dynamic App, `main.ts`
entrypoint. Leave install/build/pre-deploy commands, arguments, working
directory and environment variables empty. Choose Managed / Free Regions. The
directory must exist in the branch used by the GitHub integration first; a
pushed feature branch does not make it appear in main. Do not merge merely to
make the console directory picker accept it: local CLI upload is available.

## CLI deployment (separate explicit step)

Run from this directory after authenticating to the correct Deno organization:

```sh
deno deploy create --org dreamwheels --app gateway-test --source local --runtime-mode dynamic --entrypoint main.ts
```

On Deno 2.9.6, `deno deploy create --help` can fail with duplicate `--help`. The
directly invoked official CLI was checked successfully:

```sh
deno run -A jsr:@deno/deploy@0.0.9908 create --help
```

The equivalent fallback creation command is:

```sh
deno run -A jsr:@deno/deploy@0.0.9908 create --org dreamwheels --app gateway-test --source local --runtime-mode dynamic --entrypoint main.ts
```

The CLI executes with full permissions: run it only from this isolated
directory. Do not upload the repository root or include `.env` files. Do not
re-run creation blindly if it times out; check the organization apps first.
Select Free, never upgrade to Pro for this diagnostic. Secrets must not be
pasted into chat or committed. No cloud app has been created by this change.

## Acceptance

Open both paths on Android mobile data and MacBook home internet without VPN.
Record success/status/duration, including after Render has been idle. A local
`/health` success alone does not prove Render connectivity. Do not switch
production DNS or authenticated frontend traffic until both legs have passed.
Paid image generation is outside this test.

## Service lifetime

Deno announced on October 9, 2026 that Deploy would continue for six months
before shutting down. This experiment is temporary, not a long-term dependency.

- https://deno.com/blog/cloudflare
- https://docs.deno.com/deploy/getting_started/
- https://docs.deno.com/runtime/reference/cli/deploy/
