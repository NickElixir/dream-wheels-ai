# Account-owned local Create drafts

## Scope and ownership

Create stores one atomic local record per verified canonical backend account. The record contains car/wheel original bytes, the saved wheel product URL and catalog selection (one SKU). It does not upload photos, create a render or change payment behavior.

`GET /auth/me` adds `account_id: string`, derived exclusively from `AuthPrincipal.user_id` after the existing principal resolver succeeds. Supabase, Telegram website and signed Telegram Mini App identities use the same canonical `users.id` after account linking. No SQL migration is needed. The existing auth controller ignores the additive field; the new draft resolver requires it. Email, display name, `initDataUnsafe`, JWT/session tokens and provider UUIDs are not persisted draft owners.

- `src/auth_api.py`: additive authenticated response field.
- `webapp/vnext/account-drafts.mjs`: IndexedDB transactions and legacy import.
- `webapp/app.js`: owner resolution, lifecycle cancellation, photo/URL/catalog integration and cross-tab invalidation.
- `webapp/vnext/views/create.js`, `bootstrap.js`, `copy.mjs`, `styles/approved-home-create.css`: RU/EN recovery status and explicit legacy choice.

## IndexedDB v2

The existing `dream-wheels-upload-draft` database is upgraded to version 2. The old `files` store is retained. New `account-drafts` records are keyed by `account:<canonical ID>`. `legacy-draft-claims` holds a single import claim.

Normal recovery reads only the authenticated account record; it checks old-photo key availability without returning old photo bytes or metadata. URL and SKU are read alongside both photos in the same transaction. Replacing a wheel clears/replaces its URL and SKU atomically while preserving the car. Repeating a job replaces both sources atomically. Transaction failures preserve the previous saved record.

Logout, session expiry, account changes and account merge clear in-memory photos, URL, SKU, consent and previews, revoke object URLs and cancel pending draft/catalog/repeat operations. Saved account records remain. An epoch, credential marker and AbortSignal reject late reads, writes, file conversions and owner probes. A new session does not join an old bootstrap promise. The owner probe has a 12-second deadline even if token retrieval or a mocked fetch ignores cancellation. Missing/invalid account IDs fail closed with a retry action.

BroadcastChannel and a localStorage notification invalidate other tabs without broadcasting account IDs, credentials or photos. Supabase auth-storage changes also invalidate local draft state. A receiving tab verifies its own current session before restoring anything; the notification cannot assign an owner. Auth controller verification events and explicit Retry resume recovery. A v1 tab holding an IndexedDB connection blocks upgrade: the UI asks to close older tabs and retry. Connections opened by v2 close on versionchange.

## Old unowned drafts

After verified login, an account with no saved photos may see:

> Найден старый черновик в этом браузере
>
> Черновик не привязан к аккаунту. Восстанавливайте его, только если это ваши фотографии.
>
> Восстановить / Не сейчас

No old image, filename, URL or SKU is shown before confirmation. Restore copies both photos and metadata and commits the single-owner claim in one transaction. A storage/quota/cancellation failure rolls back both the copy and claim. Concurrent tabs cannot import it for different accounts. Existing personal photos are never overwritten by this operation. Source v1 records are retained; the claim suppresses further imports. “Не сейчас” dismisses only for that account during the current page lifetime; it neither claims nor deletes the old draft.

This is an explicit device-user assertion, not proof of historical ownership. Local account partitioning prevents accidental UI recovery across accounts; it is not encryption or an access boundary against same-origin script/XSS, developer tools or another person controlling the browser profile. Data is local to an origin, not synchronized between RU/EN domains. Account merges do not silently merge historical local namespaces. Old handoffs bound to a provider-derived owner cannot be silently reassigned to the canonical owner; reselect the wheel from Catalog if necessary.

## Verification and release order

Automated coverage includes real IndexedDB API semantics via pinned `fake-indexeddb`, v1 upgrade/blocked upgrade, A/logout/B/A, atomic rollback, cross-tab claim races, quota failure, owner probe timeout, delayed owner/photo/URL results, bootstrap replacement, keyboard focus through legacy loading/hydration, RU/EN rendering and disabled editing when ownership cannot be confirmed. Browser fixture `tests/browser-fixtures/catalog-handoff.html` uses a separate QA database, controlled canonical IDs and blocks all API writes. It is not a real provider/hosting test.

Release requires independent review of this change, then isolated staging acceptance. Deploy the backward-compatible backend response first and verify canonical IDs across the supported sign-in methods; then deploy both frontends at the reviewed SHA. An old backend deliberately cannot enable this new Create implementation. This is **not a frontend-only release**. No backend deploy, production mutation, merge or live photo upload/render is authorized by these local checks. `app-test.dream-wheels.ru` shares production API/data and must not be treated as an isolated backend.

Staging checklist: real login/registration, reload, expiry/retry, A/logout/B/A, linked website/Telegram identity, second-tab logout/account switch, old browser-profile upgrade and explicit import/decline, storage refusal, catalog image replacement preserving the car, manual and history drafts, no automatic upload/render. Android and real Telegram WebView remain device acceptance. Rollback does not delete v2 data: old v1 clients cannot open the upgraded DB; restore a compatible v2 client rather than deleting the database.

## Follow-up: stale Retry and account merge callbacks

The review at `c3f09ad` found two orchestration races despite the store's owner checks: an old Retry could start a new handoff for B before B hydration, and an old merge response could invalidate B's current input. Retry now captures its operation, credential and owner-resolution epoch before awaiting, then checks the resulting draft scope after hydration and handoff. Draft invalidation cancels the Retry identity.

Merge has a distinct initiating-session/operation identity: auth changes, logout/expiry, session clear and cross-tab boundaries cancel it. Its own successful canonical-owner reset does not cancel that same session's operation. Response, owner resolution, hydration, account refresh, error handling and cleanup all check the initiating operation. The account refresh invoked by merge checks that predicate before applying payload/error/loading state. A newer merge cannot be completed or unblocked by an older response.

`webapp/auth/account-draft-callback-races.test.js` runs the full production runtime with controlled transports and presentation sinks, actual auth callback/bootstrap/bridge, the real CatalogHandoffController and AccountDraftStore over fake-indexeddb. It covers both Retry completion orders, late merge success/failure/network failure/error decoding, a newer merge, canonical-owner change, and account changes during owner probe, photo hydration and account refresh. Six targeted regressions fail against `c3f09ad`. The controlled browser fixture also exercises the real renderer, native IndexedDB and typed unsaved input for both reported races; no live merge/upload/render is performed. Independent follow-up review and isolated staging acceptance remain required.
