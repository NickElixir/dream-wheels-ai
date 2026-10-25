# Result visual amendment — 08.10.2026

UI-022: owner requested a source-wheel reference in Result. Show vehicle/date, then «Колёсный диск», full uncropped image without an island (radius12, maximum240px desktop/144px mobile), existing known wheel metadata, then actions. Use full «Проверить совместимость» label. Secondary actions stack to avoid truncation in the narrow sidebar. Rating remains below comparison and reasons appear after negative sentiment.

Authenticated source-wheel delivery uses existing private download endpoint and Authorization fetch+blob, with isolated asset cache/loading/error state and retry. Missing wheel photos do not introduce broken image slots. Reference image loading must not change the main comparison aspect ratio.

Local desktop/mobile demo inspected in Chrome; 390px layout has no horizontal overflow. Demo fixtures do not prove a fresh real generation or authenticated staging history display. Owner acceptance pending. Sharing remains a future separate task in product-roadmap.md.

Design-code proposal (not global implementation): links within prose share the existing font, primary text color, persistent underline, and keyboard focus. Bullets belong to a document list, not link styling. Navigation and action buttons keep their own variants. Scope and global adoption await owner confirmation.

UI-023 — owner approved trial of variant1: two input groups above the wide comparison (vehicle/date left, compact wheel reference right), actions in a horizontal row below, rating at bottom. Mobile groups and actions stack vertically. No islands or separators. Supersedes UI-022 sidebar composition.

UI-024 — owner approved trial: wheel group first/left, vehicle and muted date second/right without Created heading. Download primary and compatibility secondary grouped left below comparison; repeat secondary right. Mobile stacks full-width actions, with separation before repeat.

Owner acceptance 08.10.2026: UI-024 Result composition accepted. Treat this version as the approved visual baseline; additional changes require a separately discussed amendment. Next screen: History. Local Chrome desktop/mobile inspected; 232 frontend tests passed. Staging visual rollout and fresh/authenticated generation verification remain outstanding.

Owner amendment 24.10.2026: move image-load recovery out of the general Result actions into the failed image area. Identify the original/result/wheel photo that failed and use the existing compact secondary «Повторить» / «Retry» button. Each retry targets that image only; it does not create a generation or spend a credit. Local controlled preview is prepared in `tests/browser-fixtures/result-image-recovery.html`; staging publication and real failure/recovery acceptance are separate steps.
