# Web navigation routes — owner agreement, 08.10.2026

| Screen | URL |
|---|---|
| Home | `/` |
| Create | `/create` |
| History | `/history` |
| Result / processing / failure of one job | `/try-ons/{uuid}` |
| Compatibility of one job | `/try-ons/{uuid}/compatibility` |
| Balance | `/balance` |
| Account | `/account` |
| Help / existing support screen | `/help` |
| Photo guide | `/help/photos` |
| Documents | `/documents` |

Existing `/app/...` entry links remain recognized. Browser navigation uses the clean addresses; Telegram's persisted top-level navigation is unchanged. Public Create/help/documents stay accessible without login. History, account, balance and individual jobs require a verified session; backend ownership checks remain authoritative. URLs are private cabinet navigation, not public share links. Restoring a UUID loads the job through the existing authenticated job endpoint. Missing/foreign jobs retain existing unavailable/error handling.

Normal navigation pushes history once per distinct destination. Back/Forward restore the view without another push, and restore saved scroll position. No filter state is introduced (current History has no filter control). Existing upload drafts are not reset. Newly started current jobs use their stable UUID URL as processing transitions to completed or failed. Existing payment query handling takes precedence over normal route restoration.

Vercel rewrites explicit screen paths to index.html; backend API rewrites retain priority. HTML routes receive no-store headers. No authorization, database schema, public share publishing or Result visual changes in this PR.

Validation: 230 frontend tests passed. Chrome local: direct photo-guide, Documents navigation, Back to photo-guide, private History login gate, Back from gate to public guide. Live authenticated UUID/compatibility restoration and real Telegram/payment integrations need staging acceptance after deployment; no new render or payment was performed for validation.

Reloaded processing detail polls only the selected job and stops at a terminal status. Python checks: Ruff check/format passed; pytest 762 passed, 22 skipped.
