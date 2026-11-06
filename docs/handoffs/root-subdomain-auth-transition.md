# Root subdomain routes and authenticated Create

Date: 2026-11-06. Local implementation only. Merge/deploy/DNS/provider changes: NO.

## Source and routes

Base staging d3b7afa761b74d85854479a5a55f7c16fd546d0f; main 4e1bdc9cb22880cde04999f07eec90c3b2d69ca3 has the same tree. Remote heads rechecked before completion.

RU entry: https://app.dream-wheels.ru/new. EN entry: https://app.dreamwheels.pro/new. Login links go to the application root. Generated application paths: /, /new, /history, /balance, /account, /help, /help/photos, /documents and existing /try-ons/{uuid} routes.

webapp/app-route.mjs owns canonical paths and explicit auth policy. Dashboard/Create/history/wallet/account/job/fitment require the existing verified auth session. Help and documents remain public. webapp/app.js uses that policy at initial entry, navigation and history restoration. Telegram navigation is excluded as before. Known legacy /app routes and /create normalize to the canonical root routes before the gate. Only existing allowlisted marketing query fields survive the application auth return; external targets are rejected. Arbitrary catalog parameters are intentionally not added before the separate Catalog handoff contract is implemented.

Legacy /app/render-detail and /app/fitment without a job UUID have no safe generated root target and retain their existing compatibility handling. Actual job pages use /try-ons/{uuid}. Do not infer a job from untrusted arbitrary query parameters.

Landing CTA helpers select the corresponding RU/EN application subdomain. landing/vercel.json prepares temporary fixed-destination redirects for old front-door /app links. Timeweb Landing legacy bridge maps known old routes to root application routes and retains its existing query/hash transport. Neither configuration has been deployed. Existing webapp/vercel.json already serves /new and root sections; Timeweb WebApp already copies the updated routing module and has the HTML fallback. Test both hosting environments after a separately approved release.

## Auth and registration

No new auth UI, Supabase SDK changes, schema or migration. Existing webapp/auth/supabase-client.js uses shouldCreateUser:true for email OTP. Existing app-auth.js probes /auth/me, then calls /auth/bootstrap before declaring protectedApiReady. src/auth_api.py bootstrap and src/users_service.py identity uniqueness/transaction lock remain the account provisioning mechanism. Existing-user and new-user behavior uses those paths; repeated provisioning is covered by existing identity tests. Successful code request alone is not registration. Phase 03 registration attribution is not implemented.

No production emails, sign-ins, users, render jobs or uploads were created for this verification. Supabase redirect/provider allowlists were not inspected remotely or changed; real provider callbacks and account lifecycle require isolated staging E2E before release.

## Payment compatibility

Payment backend and provider settings are untouched. The existing payment API only accepts legacy callback paths. The frontend therefore retains /app/wallet as the internal payment return contract, including allowed marketing query. The browser routes normalize a received callback to /balance. This narrow adapter prevents changing the payment contract merely because user-visible navigation moved to root paths. Existing wallet tests pass. Do not remove the compatibility aliases until a separate payment-contract migration is approved.

## Validation

- 301 Node tests: webapp/auth/*.test.js, tests/test_new_application_route.mjs and deploy/timeweb-static/build.test.mjs passed.
- 21 Landing tests passed via node --import tsx --test tests/*.test.ts (the tsx CLI IPC listener is restricted in this environment).
- Astro check: 38 files, no errors/warnings/hints. Landing static build passed (11 pages).
- Timeweb Landing artifact/legacy bridge: 3 tests passed.
- Auth API/identity/principal Python tests: 28 passed, 2 skipped. Skipped coverage is not claimed as validated.
- Additional local draft metadata and /new route tests passed; syntax and diff whitespace checks passed.

New root-auth-gate.test.js executes the actual initial route setup with mocked browser state: /new, /create, /app/new retain Create and allowed query, require auth and generate no job calls; root is protected, public legacy help canonicalizes and Telegram entry is untouched. Existing auth tests exercise bootstrap failures, session restoration/revocation and identity changes. No complete browser/provider E2E claim is made.

## Next release gates

Review local branch feature/root-subdomain-auth, then CI/PR approval separately. No merge/push/deploy was performed by this task. Test RU and EN on isolated hosting: cold /new, existing session, new email account, cancellation, expired session, reload, account switch, callback and old links. Confirm old/new routes serve HTML on refresh, routes never start generation automatically and existing manual photo drafts still restore. No payment transaction is needed or authorized by this task.

Catalog wheel/SKU transfer, pending handoff persistence and registration attribution remain separate Phase 02/03 work. Their SKU mapping awaits the owner's table; do not substitute the first SKU or change confirmed visual design.
