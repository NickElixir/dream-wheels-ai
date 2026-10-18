# UI audit and transfer — 18.10.2026

Base: origin/staging 5d90009b654fdf42cbe37d56dfbda197974f1dfd
Sources: result-ui 4856762 and scoped Home/Create changes from home-ui 95717d1
Backfill script and production data operations are excluded

## Reproduce the visual fixture

From the repository root run `python3 -m http.server 8783 --bind 127.0.0.1`
Open `http://127.0.0.1:8783/docs/evidence/ui-owner-audit-2026-10-18/preview.html?scenario=dashboard&lang=ru`
This fixture uses the integrated application views, copy and CSS order from index.html
It simulates data and actions; it does not prove API integration, authentication, payments or billing
The actual account settings panel is mounted by bootstrap in the application; preview settings use demonstration identities

Scenarios: dashboard, create, create-empty, history, result, loading, balance, support, photo-guide, documents, settings, compatible, conditions, incompatible, stale, failed, editor, editor-empty, recognition-loading, recognition-result, catalogue-loading
Use Chrome at 1440×1000, 1920×1080, 390×844, 360×800 with deviceScaleFactor 1; wait for fonts/images and disable incidental hover when comparing default states
Fixed fixture timestamp: 2026-10-18T09:00:00Z
Original audit screenshots and gallery are retained in the task workspace outputs/ui-audit-2026-10-18; they are not shipped as application assets

## Findings and fixes

| Finding | Resolution |
|---|---|
| Preview combined two worktrees | Scoped Home/Create changes integrated into this branch, accepted CSS linked in actual index |
| Home mobile account avatar hidden | UI-061 restores mobile account target; tested click to settings |
| Preview history route missed renders | Fixture route corrected |
| Saved wheel fixture and result table disagreed | Saved fixture specifications derived from check field_results |
| Actual settings used legacy shell and spacing | UI-063 reuses the existing panel in shared shell, restores it on unmount, removes duplicate heading and legacy inner padding |
| Older tests referenced removed presentation | Updated expectations for gallery badges/no retry, 3 payment rows, slash summaries, inline version chooser and copy alias; conflict, billing and focus assertions retained |

Visual audit covered ten screens at four widths, plus empty Create, fitment conditions/incompatible/stale/error/editor/version/loading states
No horizontal overflow or broken visible fixture images found in those captures
Integrated desktop Home screenshot matched the baseline exactly; Create layout matched, with small raster differences confined to its photo
Compared geometry, typography and colors of frame/headings/media/view roots for nine screens at 1440 and 390 px: all 18 comparisons matched the mixed-source baseline
Account shell harness verified that navigation preserves the same panel and delegated link click target, with one visible heading

Home/Create presentation is pinned by vnext/styles/approved-home-create.css, linked after shared styles in index.html; make future screen-specific changes there and update the register, rather than adding another later override
The entry-asset test explicitly checks that this stylesheet and account.css remain linked in the actual application

## Local verification

- Frontend auth/view suite: 236 passed
- CI JavaScript behavior suites: 269 passed
- Python: 762 passed, 22 skipped; skipped integration cases require their external test environment
- Ruff: passed; 154 files already formatted
- Auth bundles rebuilt without tracked bundle differences

## Gates still open

1. Repeat all ten screen/state comparisons on the real deployed staging application, not only the fixture
2. Verify login/link/merge/logout, file upload and reload recovery, recognition/catalogue/URL failures, cancellation and retries
3. Verify manual and parsed wheel entry preserve saved values, conflict resolution and front/rear axle separation; old check becomes stale after edits
4. Verify download, history pagination, payment return and credit changes in the approved test environment
5. Check keyboard focus, reduced motion and Telegram WebView safe areas/native actions
6. Independent review of the final PR; production promotion requires separate owner approval

No production deployment, database operation or live payment was performed
