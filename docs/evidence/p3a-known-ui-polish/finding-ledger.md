# P3-A finding ledger — before implementation

Base: staging 874d8ba3d37742a89af7f8b844a412269233065a.
Sources are historical candidates, checked against current production views/styles and deterministic fixture; no new full UI audit.

| Finding | Source | Current baseline | Decision |
| --- | --- | --- | --- |
| Compact mobile History | docs/ui/vnext-full-screen-qa-audit.md QA-003 | Current render.css uses 88px preview and two-column rows at 390px; no full-width media cards | OBSOLETE |
| Mobile action hit areas | Same audit QA-004; P3-A §20 existing ≥44px contract | Result Download measures 42px, Good result / Needs improvement 40px at 390px; Create photo actions 44px, History action 46px | FIX P3-A — only Result Download and feedback min-height |
| Processing reduced motion | Same audit QA-008 | foundation.css disables spinner animation under reduced motion | OBSOLETE |
| Result image-first hierarchy | Same audit QA-009 | Viewer precedes metadata/actions in production markup; mobile keeps this order | OBSOLETE |
| Global/contextual Fitment navigation model | Same audit QA-005 | Changing navigation would change IA; current functional navigation retained | DEFER POST-RELEASE |

Reviewed 5; fixed 1; obsolete 3; deferred 1; owner decision required 0.
Scope fixed before CSS edit: render.css only; no new element/action/interaction, no screen order, JS, copy, Fitment, backend or database change.
