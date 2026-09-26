# PR #201 — final Create review

Base: `e0910861c6df1453469d7d2fed480a480a2c9769` (origin/staging, fetched before review).
Reviewed original HEAD: `87458bad1db8b92262232955fa9eae7a907588e3`.
Branch: `feature/vnext-create-ui`. Target: `staging`.

## Findings corrected in the follow-up

1. Wheel source editing after identity success referenced an out-of-scope callback. Pass the existing Create callbacks into the wheel summary.
2. Create refresh nested another Create section and discarded unsaved input/focus. Replace the existing section once; retain local input values, text selection and focus during asynchronous updates. Keystrokes update local controls without remounting.
3. Manual corrections had no explicit save/return-to-summary flow. Save validated values through the existing manual vehicle state; leave the original recognition proposal intact. Cancel restores the previous selection mode. Confirmed candidates return to summary.
4. Legacy upload/result visibility could change beneath the VNext screen during generation. Suppress legacy direct children while Create is mounted and restore the current legacy screen on unmount.
5. A failed repeat render could inherit an older result URL and enable Fitment for its new failed job. Associate Create with a job only after that job completes.
6. Align the success summary with the frozen vehicle/source/parameter rows and the desktop 2:1 preview pair. Preserve available zero ET, wrap long filenames, and keep focus/touch targets visible.
7. Preserve the existing authentication error action separately from full identity retry.

## Contract review

| Gate | Evidence |
| --- | --- |
| Presentation bridge / architecture | Existing legacy state and callbacks; no new router, API client or domain model |
| Frozen composition | Fixed contain stages, vehicle-dominant pair, flat summary and existing CTA hierarchy |
| Full identity | Behavioral test executes existing request construction with car_image, wheel_image, optional rim_product_url and credentials; no draft_id in this request |
| Confirmation / correction | Recognition initially unconfirmed; candidate selection and explicit correction are tested; original recognition remains unchanged |
| Identity retry | Failure releases loading; retry succeeds through the same full request |
| File replacement | Both directions replace only the selected source, revoke only its object URL and invalidate stale identity; neither starts render nor Fitment |
| Create Image | Delegates to submitJob and existing /jobs/from-assets; Fitment verdict and execution failure do not gate it |
| Compatibility | Existing openFitmentView handoff; stale/failed job contexts cannot enable it |
| PR3B boundary | Optional URL remains a full-flow source hint; wheel-only requests and parser/variant states are absent |

## Browser evidence

Local isolated presentation fixture using the real Create view, shell, styles and repository images. This fixture made no backend/auth/provider requests and was removed after review. Captures were emitted during browser verification.

| Viewport | Measured results |
| --- | --- |
| 1440 × 1000 | document scrollWidth 1440; preview widths 715/358, both heights 420; no duplicate IDs |
| 390 × 844 | document scrollWidth 390; both stages 358 × 253.5; both CTA widths 358 and right edges 374 |

Browser scenarios: long filename, long vehicle name, long source URL, source edit/save, async refresh with unsaved source/focus retained, manual correction/save and return to summary. IBM Plex Sans verified; one Create section after repeated refresh; no console errors. Existing VNext mobile navigation remained visible.

## Verification

- Webapp suite: 88 passed (original 80 retained).
- Ruff lint/format and Python compile: passed.
- Pytest: 565 passed, 5 skipped; existing httpx deprecation warnings.
- Gateway, catalogue, Fitment navigation and webapp boot: 52 passed.
- Auth build: passed; tracked bundles unchanged.

Remote CI readiness must be checked on the final pushed follow-up HEAD. Authenticated staging browser QA remains post-merge. Backend, database, production deployment and PR3B are outside this review; none were changed. This review does not merge PR #201.
