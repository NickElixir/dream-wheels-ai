# Create photo presentation — owner amendment 07.10.2026

UI-009: remove horizontal dividers below Create header and before consent; keep spacing and existing consent/actions.
UI-010: loaded car/wheel previews have no background island or border, owner clarified: common stage height clamp(300px,34vw,420px) at widths above 700px, full image with contain and transparent space; at widths up to 700px natural photo proportions, no crop or height cap. Source images and upload behavior unchanged.
UI-011: empty upload targets retain a dashed functional boundary, transparent background, equal height 180px desktop / 160px mobile. This is an upload affordance, not a persistent photo island; applies irrespective of auth.

Local implementation: scoped Create CSS only. Main screen owner accepted as current visual baseline; stable account numbering UI-007 remains open.
Validation: 225 existing frontend tests PASS. Chrome desktop/mobile demo: car 1800×1012 renders 627.73×352.92 / 358×201.27; wheel 1200×1200 renders 313.87×313.87 / 358×358. Empty targets 180px with transparent backgrounds. Replacement callback exercised in local demo. Live auth/upload/provider flow not claimed. Owner visual acceptance pending; staging unchanged.

Owner approved trial of common desktop height / natural mobile proportions. Earlier natural-height desktop variant superseded.

UI-012: apply existing media radius to actual loaded photo boundaries; desktop images size intrinsically within the common-height stage (max width/height), preserving aspect ratio. Mobile natural proportions unchanged.
UI-013: Add/Replace photo use existing secondary button primitive, matching product-link action; placement and callbacks unchanged. Owner approved 07.10.2026.

UI-014 — owner approved: remove redundant loaded-photo captions for car/wheel; keep empty-state captions and errors/loading behavior. Loaded photos align to top of existing common-height desktop stages. Initial product-link placement below the wheel column superseded by UI-017. Mobile natural proportions unchanged.

UI-015: Create wheel heading uses «Колёсный диск» with Ё; local copy key, other screens unchanged. Owner approved 07.10.2026; other screens unchanged.


UI-016 — owner approved: compact Add/Replace photo secondary buttons: 13px label, 10px horizontal padding, 36px desktop height and 44px mobile touch target. Upload/replacement callbacks unchanged.

UI-017 — owner approved: always show the wheel product URL form below both photos, aligned to the page left edge, max width 760px on desktop and available width on mobile. Label «Ссылка на колёсный диск»; optional hint «Необязательно. Сохраним ссылку для последующей проверки совместимости». Keep Save and inline saved confirmation; remove Add/Close link toggle and Cancel. No vehicle URL input added. Existing URL saving callback retained.

Validation for UI-015–017: 225 frontend tests PASS; Chrome desktop and 390px mobile preview checked, no horizontal overflow, mobile photo actions 44px. Local demo URL save shows «Ссылка сохранена». Preview uses demo data and does not confirm real backend persistence. Staging unchanged.

UI-017 copy amendment: owner requested label «Ссылка на колёсный диск (необязательно)» and hint «Сохраним ссылку для Проверки совместимости». Applied verbatim; optional qualifier moved to label.

UI-018 — owner approved: URL hint «Для будущей проверки совместимости с автомобилем.»; checkbox «У меня есть право использовать эти фото. Я соглашаюсь на их обработку для создания примерки.»; document links on their own line. Legal pages retrieved directly 07.10.2026: privacy section 3 covers image use rights and provider processing; consent includes broader account/payment/log data. This copy edit does not change the documents or consent behavior.

UI-018 copy/layout amendment 08.10.2026 — owner requested each legal link on its own line, no middle-dot separator; remove final period from wheel compatibility hint. Applied to Create only.

UI-019 — owner requested visible legal link items: two bullet list items, persistent underline and existing primary text color; same app font. Scoped to Create consent documents.

Owner acceptance 08.10.2026: current Create presentation accepted after UI-019 legal link styling. Treat this screen as the approved visual baseline; further visual changes require a separately discussed amendment. Next screen: Result. Staging deployment and real upload/save verification remain separate from local visual acceptance.

UI-020 — owner requested no blank space inside the loaded-photo interaction frame. Move focus and hover outline from common-height stage to actual image boundaries. Preserve common desktop stage height and uncropped images; empty upload focus unchanged.

UI-021 — owner requested removal of actual blank space below loaded photos, not only outline correction. Supersedes shared fixed desktop stage height: stages now fit natural photo height with existing clamp(300px,34vw,420px) maximum image height. Keep photos uncropped, top-aligned and rounded. URL form follows tallest actual photo with normal section spacing. Mobile and empty upload targets unchanged.
