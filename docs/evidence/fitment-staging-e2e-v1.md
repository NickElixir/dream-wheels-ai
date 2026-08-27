# Fitment staging E2E v1 — evidence record

## Run identity

| Field | Value |
| --- | --- |
| Date | 2026-08-27 |
| Environment | Staging only |
| Frontend staging project | `dream-wheels-ai-webapp-staging` |
| Frontend deployment eligible for this run | Not deployed from the Slice 7 worktree; the latest discovered staging production deployment is protected |
| Backend deployment/version | Not verified |
| Worker deployment/version | Not verified |
| Authenticated method | Not executed — no approved staging Telegram session was available in this task |
| Migrations | Not verified on staging |
| Redis / Wheel Size configuration | Not inspected; no secrets requested or recorded |

The staging project was discoverable. Its latest listed production deployment
was `dream-wheels-ai-webapp-staging-34xg0qf63.vercel.app` (created before this
worktree), and browser access was stopped by Vercel Deployment Protection. It
is therefore not evidence for this implementation. No production deployment,
migration, credential change or provider outage was attempted.

## Local implementation evidence

| Check | Result |
| --- | --- |
| Slice 7 semantic-draft/static tests | Passed |
| Fitment API cross-flow regression | Passed |
| JavaScript syntax check | Passed |
| Full regression / formatting / lint | Pending final run after browser QA |

## Required staging scenario matrix

| Scenario | Expected | Observed | Status |
| --- | --- | --- | --- |
| Deployment and migrations through `0027` | Identifiers and applied migrations recorded | No eligible deployment | NOT_EXECUTED |
| Redis worker lifecycle | `queued → processing → terminal` through worker | No eligible deployment | NOT_EXECUTED |
| Live Wheel Size catalogue / exact modification | Provider-backed cascade and exact mapping | No authenticated session | NOT_EXECUTED |
| Exact compatible | `completed / compatible / current` | No authenticated session | NOT_EXECUTED |
| Larger DIA | `compatible_with_conditions` with centering-ring condition | No authenticated session | NOT_EXECUTED |
| PCD mismatch | `incompatible` with field conflict | No authenticated session | NOT_EXECUTED |
| Missing ET | valid partial → `unknown` | No authenticated session | NOT_EXECUTED |
| ET outside reference | `unknown / et_outside_reference_range` | No authenticated session | NOT_EXECUTED |
| Provider outage | operational `failed`, never `unknown` | No safe staging injection verified | NOT_EXECUTED |
| Multiple / single modification | explicit multiple; auto-confirm single | No authenticated session | NOT_EXECUTED |
| Parser success / manual fallback | safe suggestions or manual fallback | No stable authenticated fixture | NOT_EXECUTED |
| Stale Vehicle / RimSpec | historical `is_current=false` | No authenticated session | NOT_EXECUTED |
| Staggered axes | front/rear preserved; rear edit stales old check | No authenticated session | NOT_EXECUTED |
| Fitment → Rendering → Fitment | same semantic state; no implicit action | Browser staging run pending deployment | NOT_EXECUTED |
| Dream Wheels 401 restoration | compatible draft restored; no replay | Safe expiry mechanism unavailable | NOT_EXECUTED |
| 401 during check polling | polling stops; no second POST | Safe expiry mechanism unavailable | NOT_EXECUTED |
| Mobile 390 × 844 | happy-path interaction, no overflow | Browser staging run pending deployment | NOT_EXECUTED |

## Release decision

`FITMENT_BETA_READY = NO`

Blocker: the Slice 7 worktree has not been deployed; the discovered staging
frontend is Vercel-protected in the browser; backend/worker deployment,
migrations, Redis verification, live Wheel Size evidence and controlled
session-restoration evidence are not yet available. This document must be updated only from a deployed staging run with
sanitized observations; it must never include Telegram `initData`, cookies,
access tokens, Wheel Size credentials or raw provider payloads.
