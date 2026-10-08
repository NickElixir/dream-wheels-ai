# History gallery — 08.10.2026

UI-025 — owner approved all proposed changes for local trial: continuous gallery, 3 columns desktop (>1100px), 2 tablet (701–1100px), 1 mobile (<=700px). Remove row islands, date grouping and horizontal screen/date dividers. Photo and title share an actual job link and arrow; persistent keyboard focus and white hover outline on photo only. Preserve modified-click/new-tab browser behavior.

Each card uses confirmed vehicle make/model or temporary short technical job ID (first six characters). Hide wheel metadata/specs. Absolute date/month and time per card, year for earlier years; no relative Today/Yesterday labels. Stable per-account sequential try-on numbering remains a separate server/data/API task: no client-side position numbering.

UI-026 — owner approved status trial: ready results have no badge; queued «В очереди», running «Создаём примерку», failed «Не удалось создать» with separate existing retry action and billing explanation when supplied. All cards open the relevant result/progress/failure detail. Empty/error/loading and unavailable-photo states remain supported. More button centered under gallery. Existing visible-count state and merged navigation scroll restoration retained.

Chrome local fixtures: 1280px=3, 900px=2, 390px=1 column; no horizontal overflow; card click opens result. Demo data is not live staging history. Frontend tests pass. Visual acceptance and deployment pending.
