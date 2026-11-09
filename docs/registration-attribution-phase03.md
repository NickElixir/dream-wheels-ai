# Phase 03 registration attribution

The latest explicit RU/EN Landing or Catalog touch applies for 24 hours in
the same browser profile and WebApp origin. A direct visit preserves it.
A later touch replaces all UTM fields, including when its URL contains none.
Only the five standard UTM fields are stored. Source and UTM are browser
signals for reporting and carry no authentication authority.

The email flow sends the context on its first authenticated /auth/me call,
which can create the canonical user before /auth/bootstrap. Website
Telegram sends it when verifying the provider token. Existing identities and
legacy Telegram accounts return without inserting an attribution row.
Account creation and the optional attribution insert share one transaction.
The primary key prevents multiple rows for one account.

## Release and acceptance

Apply migration 0044 on the isolated staging database before enabling the
new WebApp. Verify the email and website Telegram flows on staging with
fresh identities and an existing account. Confirm direct reopen, catalog
restore, expired context, repeated login and identity linking. RU Timeweb
test currently shares the production backend. Use an isolated WebApp
preview to test RU locale until the production database and API are ready.

Production order is migration, compatible backend, Deno gateways, WebApps,
then Landing. RU browser preflight must allow X-Registration-Touch before
the Landing starts emitting the registration parameters. Existing clients
send neither parameter. Check that authenticated /auth/me and Catalog still
work after rollout. Verify one control registration and one repeat sign-in
before closing the release.

Aggregate report from a trusted database session:

```sql
SELECT source, locale, utm->>'utm_campaign' AS campaign, count(*) AS registrations
FROM registration_attribution
GROUP BY 1, 2, 3
ORDER BY registrations DESC;
```
