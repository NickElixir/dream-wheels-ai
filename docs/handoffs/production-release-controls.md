# Production release controls

## Scope

Code-only preparation; no live environment variables, merchant settings, deployments,
credits or data are changed by this PR. Base: release candidate #287. Changes
must also be backported to staging after review, so future merges do not revert
production controls.

## Browser auth configuration

Approved application hostname: `app.dreamwheels.pro`; the apex stays with the
marketing landing. DNS is authoritative at REG.RU. Vercel currently recommends
the CNAME `app` -> `43d023301dfd8b35.vercel-dns-017.com.` for this project;
recheck the project recommendation before editing DNS. Host allowlisting alone
does not configure Supabase redirects, Turnstile or Telegram login domains.

`webapp/scripts/build-public-config.mjs` runs as the Vercel webapp buildCommand.
It overwrites the local staging-only harness config in the deployment artifact
using public env values. SUPABASE_URL must match EXPECTED_SUPABASE_URL pinned by
workflow for the selected project. A server/service-role key is never exported;
legacy JWT browser keys must have role=anon and the expected project ref.

Provide SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or supported anon/public alias) and
TURNSTILE_SITE_KEY in the target Vercel project. Production requires an explicit
public Turnstile key; the existing staging key is retained only for the known
staging project. Configure allowed domains/CAPTCHA in the actual production auth
providers and test OTP and session restore. Opaque publishable keys cannot be
cryptographically checked for project membership by this build script: verify the
actual production auth flow before opening traffic.

Both existing production Vercel domains are allowed by the main auth flow. Unknown
hosts remain disallowed. The generated script is an artifact; do not commit a
production key into the local staging harness file.

## Freeze all writers

APP_MAINTENANCE=true is authoritative: API returns 503 + Retry-After for user,
financial and callback routes; only GET/HEAD /health, /health/full and /health/release
are available. OPTIONS may be handled by CORS, but the actual request is still gated.
Payment callbacks must not receive a false success acknowledgement while blocked.
Confirm provider retry/maintenance arrangements before a real cutover.

During maintenance, worker and pending-payment timer never start, even if their
individual flags are true. start.sh runs API only and never starts the Telegram
bot. BOT_ENABLED=false independently permits an API-only launch; it does not stop
worker/timer unless their flags or APP_MAINTENANCE do so.

Set the maintenance profile before deploying this build. Render rolling deploy
can leave the previous instance running temporarily; wait for old processes to
terminate and verify no reserved jobs/queue activity before SQL. Configuration
changes are not retroactive to a running process without restart/deploy.

Render is currently Free, so built-in maintenance mode is unavailable. These
code controls avoid requiring a paid Render plan solely for the cutover.

## Release workflow

Push staging retains automatic staging deployment. Push main no longer publishes
frontends. Production requires workflow_dispatch(target=production, ref=<current
main SHA>) launched from main. CI runs before the shared backend gate.

The gate refuses a non-current-main checkout or a backend whose /health/release
commit differs. It also requires maintenance=true and worker/bot/payment timer
flags false, plus the approved live payment profile (payments_test_mode=false). Frontend and optional admin then check out exactly that verified SHA.
Admin publication is opt-in (deploy_admin=true), rather than inferred from a
push-only before SHA. Manual preview remains separate and targets staging config.

Before using this procedure, disable Render autoDeploy and verify Vercel-native
Git deploy is disabled. These cloud settings are not changed by this PR. Use an
intentional backend deploy of the reviewed main SHA in maintenance, confirm live
commit + health, then run the production frontend workflow. BACKEND_URL must
point to production; it is a non-secret public origin, so use a readable Config
value if needed for the workflow's existing local precheck. Never expose actual
secrets just to satisfy an inventory check.

After publication, check the alias/version and gateway /health/release against
the same SHA. Only reopen writers after SQL reconciliation and agreed smoke.
The maintenance gate closes authenticated APIs as well; protected-API smoke and
real OTP/payment tests cannot be claimed while it remains closed.

## Rollback profiles

1. Failure before migration commit: transactional rollback; keep maintenance on.
2. Failure after commit but before opening writers: preserve the backup and keep
   this compatible backend frozen. Prefer fix-forward; a full pre-cutover restore
   and old app rollback requires the separately approved data-restore procedure.
3. Failure after reopening: re-enter maintenance, stop writers, keep permanent-
   package accounting. Old production backend c5a8524 is incompatible and must
   not be selected as a simple code rollback. Restoring the whole DB may lose new
   invoices/jobs and is a separate decision.

This PR makes a frozen compatible runtime available; it is not evidence that an
old production binary has become compatible, or that a full Supabase platform
restore has been tested. Previous frontend rollback is likewise conditional on
its compatibility with the new backend, not an automatic reaction to any failure.

## Robokassa live cutover

Read-only inspection confirmed production MerchantLogin and both live passwords
are present, with live/test pairs distinct. Values were not printed. Current
ROBOKASSA_IS_TEST is still true; merchant dashboard state has not been verified.

Before switching:

- Check activation and exact production ResultURL/SuccessURL/FailURL in the
  merchant account, signing algorithm and receipt configuration.
- Keep staging on test credentials/test mode. Do not reuse staging secrets.
- Keep PAYMENTS_ENABLED=false during the release freeze. Once the approved
  merchant settings and maintenance backend are ready, set
  ROBOKASSA_IS_TEST=false with the correct live secret pair for production only.
- Three old production pending invoices in the last snapshot were created while
  the service was in test mode. Do not convert them to paid or grant credits;
  reconcile their state separately. Do not accept a test signature as a live callback.
- Reopen payments only after the agreed checks. A real pilot payment requires
  an explicit amount limit and the user's payment action. No invoice/provider
  call, real payment or production toggle is executed by this PR.
- Only a verified authoritative ResultURL grants credits; SuccessURL is not proof
  of payment. Verify idempotent callbacks and exactly-once credit application.

References: https://docs.robokassa.ru/ru/testing-mode and
https://docs.robokassa.ru/ru/quick-start.
