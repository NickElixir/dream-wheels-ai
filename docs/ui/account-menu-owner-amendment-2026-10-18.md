# UI-057 — блок аккаунта — 18.10.2026

Внизу меню одна кнопка: нейтральный аватар с буквами из Telegram-идентификатора или локальной части email, идентификатор с многоточием при нехватке ширины, количество рендеров без «Осталось», стрелка. Отдельное пользовательское поле имени не вводится. Используется существующая презентация авторизованного аккаунта; при двух привязанных способах входа предпочтителен Telegram username, иначе email. Баланс берётся из существующего dashboard snapshot; ноль отличается от загрузки и ошибки. Обновления аккаунта и баланса обновляют меню. Все части кнопки ведут в существующий settings. На мобильном та же цель через аватар в шапке. Гостевые кнопки входа сохранены.

Локальный home-preview использует обновлённую оболочку result-ui на всех экранах. Добавлен scenario=settings с существующим renderAccountSettings и явно демонстрационными Email/Telegram; привязка реальных учётных записей из demo не запускается. Реальная страница settings и процедуры авторизации остаются существующими.

Проверка: 236 frontend-тестов, включая initials/email, русские формы количества, ноль/загрузку/ошибку, переходы обеих кнопок настроек и скрытие при выходе. Chrome1440/390px: переход из меню, экран настроек и мобильный аватар, без горизонтального переполнения. UI пока ожидает приёмки; staging не обновлялся.

UI-058: Settings uses plain Email/Telegram rows, no card backgrounds/borders or heading divider. Content max700px, compact muted green linked chips matching fitment positive #a8d8bd. Intro shortened, duplicate shared-account note removed; actual operational notices remain. Unlinked rows preserve existing Connect buttons/handlers; linked rows remain non-interactive. Dedicated scoped account.css applies to legacy settings and demo. Demo imports the current account renderer to avoid divergent duplicate copy.

UI-059: remove account-menu arrow; preserve full click target, avatar, identifier and balance. Mobile/desktop browser inspection: no overflow at390px, no backgrounds/borders on provider rows, no duplicate shared-account note. Previous236 frontend tests passed; UI awaits acceptance.
