# Release 1 — production cutover checklist after VNext migration

**Date:** 2026-09-29  
**Status:** PRE-PRODUCTION PLAN — execution pending

## Context

The VNext presentation migration is complete on staging.

Before the first production release, the remaining work is intentionally ordered to minimize scope and avoid mixing a large UI redesign with functional/release-risk work.

## Approved sequence

```text
1. Visual System 2.0 Phase 1
   typography / colors / surface hierarchy only
        ↓
2. FITMENT-POST-PR6-01
   restore the working Fitment progression
        ↓
3. Release Candidate regression
        ↓
4. Production readiness
        ↓
5. Production deploy + smoke
        ↓
6. Resume large UX/UI redesign
```

---

## Gate 1 — VNext Visual System 2.0 Phase 1

Authority:

`docs/ui/vnext-visual-system-2.0-phase1.md`

Goal:

Improve readability and hierarchy without introducing the new B3 desktop composition yet.

Pass criteria:

- approved typography/color/surface changes only;
- no product-flow changes;
- responsive QA;
- independent UI review;
- staging smoke.

---

## Gate 2 — Fitment progression repair

Tracked issue:

`FITMENT-POST-PR6-01`

Authority:

`docs/ui/fitment-flow-contract-v2.md`

Required staging progression:

```text
vehicle/base data
→ exact modification selection/confirmation
→ wheel parameters
→ check-ready
→ technical check
→ result
```

The task should compare with the formerly working staging/legacy behavior and reuse the current runtime/API rather than create a parallel Fitment implementation.

---

## Gate 3 — Release Candidate regression

Run an authenticated real-browser pass across the Release 1 core flow:

```text
Auth
→ Dashboard
→ Create
→ Vehicle recognition/confirmation
→ Wheel input/source
→ Render
→ Processing
→ Result
→ History
→ Fitment
→ Balance
→ Payment return
→ logout/login/session restore
```

Include desktop and mobile, plus Telegram/Web behavior where the runtime differs.

No feature expansion during this gate.

---

## Gate 4 — Production readiness

### WebApp / runtime

Resolve release-blocking errors found during real authenticated WebApp use before public production.

Verify at minimum:

- route/auth bootstrap;
- session restore;
- protected asset routing;
- render upload and generation;
- history/result access;
- Fitment entry/return;
- Balance/cabinet loading;
- payment return routing;
- logout/login.

### Domains / auth / gateway

Verify the approved Release 1 routing architecture against production configuration.

Do not assume staging env values are safe for production.

Check:

- production domains;
- auth redirect URLs;
- Supabase auth;
- SMTP/OTP;
- frontend → backend gateway;
- legal/support routes;
- Turnstile production host/configuration;
- rollback path.

### Payments — critical

The current staging Robokassa path is test/demo infrastructure.

Production must not inherit demo/test payment behavior.

Before public release:

1. configure the intended **production Robokassa** credentials/mode for production;
2. verify ResultURL / SuccessURL / FailURL / return routing for the production domains;
3. keep server-side payment status and credit granting authoritative;
4. verify a real production payment on the smallest safe package;
5. verify ledger/payment history/balance;
6. verify refunds/cancellation policy paths where applicable;
7. keep the staging and production payment environments clearly separated.

### Staging demo-payment cost risk

Staging demo payments can change application credits while generated images may still consume real paid generation resources.

Therefore, before broad/public use, staging must not provide an unlimited free route to cost-bearing generation through demo top-ups.

Resolve this explicitly by the release gate.

Approved requirement:

```text
demo/test payment
must not become a public mechanism
for obtaining credits that spend real production generation cost
```

Implementation choice is a separate release decision and may include:

- disabling staging top-up actions outside controlled testing;
- access-gating staging payment/testing;
- isolating staging credits from cost-bearing generation;
- using a non-cost-bearing/sandbox generation path where available.

Do not invent the choice inside an unrelated UI task.

Payment invariants:

```text
PENDING_PAYMENT != FAILED_PAYMENT
payment=success != authoritative paid status
client does not calculate authoritative balance
client does not grant credits
```

---

## Gate 5 — Production deploy

Production write/deploy requires explicit approval at execution time.

After deploy, verify deployed SHA and run a short production smoke:

- auth;
- Dashboard;
- Create;
- one safe render;
- Result/History;
- Fitment entry;
- Balance;
- production payment on smallest safe package;
- return to Wallet;
- authoritative balance/history update;
- application console/network health.

Use rollback if a release-critical flow fails.

---

## After production

Resume the larger visual work recorded in:

`docs/ui/vnext-visual-system-2.0-post-production-plan.md`

including:

- B3 garage desktop visual rail;
- Geely Monjaro Dashboard hero direction;
- rear-quarter / taillight Fitment environment;
- tile/layout refinement;
- modification vehicle thumbnails;
- wordmark exploration;
- broader page composition work.

Do not lose those ideas, but do not make them a prerequisite for restoring core product operation and reaching production.
