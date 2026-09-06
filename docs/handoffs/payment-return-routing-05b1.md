# 05B.1 Payment Return Routing Hardening

## Scope

Payment browser returns are now channel-aware and environment-neutral. New
top-ups persist:

- `client_channel`: `web` or `telegram`;
- `return_to`: a validated internal route.

The web allowlist is `/app`, `/app/new`, `/app/history`, and the existing
`/app/wallet` route used by the current payment UI. Telegram allows `/t` and
`/t/`, normalized to `/t/`. Only approved attribution query keys are retained
on web routes: `market` and the UTM keys.

`source_screen` remains analytics context. `delivery_channel` remains the
legacy/provider-neutral delivery field and is not used for browser routing.

## Legacy data decision

The staging audit found 44 existing payments. All had `delivery_channel =
website`, `source_screen = cabinet`, and a Telegram identity/user mapping.
This confirms the legacy Telegram-first flow and supports the deterministic
backfill:

```text
client_channel = telegram
return_to = /t/
```

Invalid stored routing data is validated again on browser return. An invalid
channel uses the global safe fallback `web` + `/app`; an invalid route falls
back to `/app` or `/t/` according to its stored valid channel. No raw route,
provider signature, token, receipt email, or user id is reflected in a
redirect or log.

## Browser-return authority

Both backend handlers accept GET and POST:

```text
GET/POST /payments/robokassa/success
GET/POST /payments/robokassa/fail
```

They resolve the payment using `InvId`, `Shp_payment_id`, and (when present)
`OutSum`, then build a same-origin `303` redirect from persisted routing
context. SuccessURL does not settle or grant credits. FailURL retains the
05B state machine: `pending -> failed`, while a later authoritative ResultURL
may still settle `failed -> paid`. ResultURL signature verification and credit
idempotency are unchanged.

Required staging merchant settings:

```text
Result URL:  https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/result
Success URL: https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/success
Fail URL:    https://dream-wheels-ai-robokassa-staging.onrender.com/payments/robokassa/fail
```

These merchant settings are external state and must be verified separately;
production must not be changed as part of this slice.

## Rollout gates

1. Apply `migrations/0033_payment_return_routing.sql` to staging only.
2. Verify row count, backfill, constraints, balances, and ledger invariants.
3. Deploy the exact feature SHA to Render staging and canonical Vercel staging.
4. Run automated tests and browser/API staging smoke for web and Telegram
   return paths, including malformed stored routes, already-paid FailURL, and
   late ResultURL.
5. Keep the PR Draft until external Robokassa settings and live staging
   browser returns are verified.
