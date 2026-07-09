const tg = window.Telegram?.WebApp;
const HAS_TG = Boolean(tg && typeof tg.expand === "function" && tg.platform && tg.platform !== "unknown");

function tgSupports(version) {
    if (!HAS_TG) return false;
    if (typeof tg.isVersionAtLeast !== "function") return false;
    return tg.isVersionAtLeast(version);
}

const SUPPORTS_BACK_BUTTON = tgSupports("6.1");
const SUPPORTS_HAPTIC = tgSupports("6.1");
const SUPPORTS_DOWNLOAD_FILE = tgSupports("8.0") && typeof tg?.downloadFile === "function";

const PROD_API_BASE_URL = "https://dream-wheels-ai-tg.onrender.com";
const STAGING_API_BASE_URL = "https://dream-wheels-ai-robokassa-staging.onrender.com";
const LOCAL_API_BASE_URL = "http://127.0.0.1:10000";
const API_MODE_STORAGE_KEY = "dreamWheelsApiMode";
const DEV_TELEGRAM_USER_ID_STORAGE_KEY = "dreamWheelsDevTelegramUserId";
const WEBSITE_AUTH_STORAGE_KEY = "dreamWheelsWebsiteAuth";
const FITMENT_PREVIEW_STORAGE_KEY = "dreamWheelsFitmentPreviewState";
const TELEGRAM_LOGIN_SCRIPT_URL = "https://oauth.telegram.org/js/telegram-login.js?5";
const WEBSITE_PROXY_BASE_URL = "/api/backend";
const PRICING_VERSION = "credits-v1";
const WEBSITE_LOGIN_NONCE_MAX_AGE_MS = 60 * 1000;
const TOPUP_MIN_AMOUNT = 100;
const TOPUP_MAX_AMOUNT = 3000;
const PAYMENT_HISTORY_PAGE_SIZE = 10;
const TOPUP_PACKAGES = [
    { amount: 100, credits: 3, icon: "⚡" },
    { amount: 200, credits: 7, icon: "🏁" },
    { amount: 500, credits: 20, icon: "💎" },
    { amount: 1000, credits: 45, icon: "👑" },
];
const PAYMENT_PENDING_FRESH_MS = 60 * 1000;
const PAYMENT_PENDING_STALE_MS = 15 * 60 * 1000;
const PAYMENT_PENDING_AUTO_REFRESH_DELAY_MS = 10 * 1000;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 110000;
const DRAFT_DB_NAME = "dream-wheels-upload-draft";
const DRAFT_STORE_NAME = "files";
const HISTORY_ASSET_VIEWS = ["result", "original"];
const GUEST_FITMENT_DEMO_JOB_ID = "guest-demo-prius";
const FEEDBACK_REASONS = [
    { code: "wheel_differs", label: "Диск отличается" },
    { code: "car_changed", label: "Машина изменилась" },
    { code: "angle_or_scale", label: "Ракурс / масштаб" },
    { code: "image_quality", label: "Качество изображения" },
    { code: "other", label: "Другое" },
];
const GUEST_RENDER_DEMO_ASSET_URL = "/cover.jpg";

const I18N = {
    ru: {
        auth: {
            login: "Войти через Telegram",
            loggingIn: "Входим...",
            preparing: "Подготавливаем вход...",
            logout: "Выйти",
            failed: "Не удалось войти через Telegram",
        },
        menu: {
            dashboard: "Главная",
            create: "Примерить диски",
            wallet: "Баланс",
            renders: "Мои примерки",
            settings: "Настройки",
            support: "Поддержка",
            photoGuide: "Как подготовить фото",
            docs: "Документы",
        },
        caption: {
            dashboard: "Главная",
            create: "Создание",
            fitment: "Совместимость",
            wallet: "Баланс",
            renders: "История",
            settings: "Настройки",
            support: "Поддержка",
            photoGuide: "Фото",
            docs: "Документы",
        },
        create: {
            eyebrow: "Создание",
            title: "Загрузите фото машины и диска",
            lede: "Машина целиком сбоку, диск анфас. JPG или PNG, до 10 MB",
            carPhoto: "Фото машины",
            wheelPhoto: "Фото диска",
            choose: "Нажми, чтобы выбрать",
            replaceCar: "Заменить машину",
            replaceWheel: "Заменить диск",
            carPreviewAlt: "Превью машины",
            wheelPreviewAlt: "Превью диска",
            footerNotTelegram: "Не в Telegram",
            detectIdentity: "Определить данные",
            createRender: "Создать виртуальную примерку",
        },
        steps: {
            upload: "Загрузка",
            result: "Готово",
        },
        status: {
            creating: "Создаём задачу...",
            startingServer: "Запускаем сервер...",
            coldStart: "Первый запуск может занять до 40 секунд",
            uploading: "Загружаем файлы...",
            upTo90: "Это может занять до 90 секунд",
            generating: "Генерируем рендер...",
        },
        result: {
            imageAlt: "AI рендер",
            title: "Готово!",
            caption: "Ваш рендер с новыми дисками готов",
        },
        fitment: {
            eyebrow: "Проверка совместимости",
            title: "Базовые параметры автомобиля",
            subtitleFallback: "Предварительные данные помогут подготовить будущую техническую проверку совместимости",
            preliminary: "Предварительно",
            openFromResult: "Уточнить параметры",
            openFromHistory: "Проверить совместимость",
            back: "Вернуться к результату",
            loading: "Загружаем данные",
            saveSuccess: "Данные сохранены",
            stale: "Данные уже изменились в другом окне. Обновите экран и попробуйте ещё раз",
            readinessReady: "Данных достаточно для будущей проверки",
            readinessMissing: "Для будущей проверки не хватает данных",
            readinessUnconfirmed: "Часть полей ещё нужно подтвердить",
            aiSuggestion: "AI",
            aiPending: "AI-предположение, нужно подтвердить",
            userConfirmed: "Подтверждено пользователем",
            sourceAdded: "Ссылка добавлена",
            basicsLabel: "Базовые данные",
            basicsCopy: "Определено по фото · данные требуют подтверждения перед установкой",
            centerBore: "Центральное отверстие",
            diameter: "Заводской диаметр",
            width: "Ориентировочная ширина",
            widthShort: "Ширина",
            offset: "Ориентировочный ET",
            vehicleCard: "Автомобиль",
            vehicleCardMeta: "Определено по фото",
            rimCard: "Колесный диск",
            rimCardMeta: "Часть данных определена по фото",
            sourceCard: "Источник колесного диска",
            sourceCardMeta: "Бренд, артикул или ссылка на колесный диск",
            jumpVehicle: "Уточнить →",
            jumpRim: "Уточнить →",
            jumpSource: "Добавить →",
            notice: "Поля необязательны и не меняют уже созданную виртуальную примерку",
            vehicleSection: "Автомобиль",
            vehicleSectionTitle: "Уточнить известные данные",
            rimSection: "Колесный диск",
            rimSectionTitle: "Уточнить параметры",
            sourceSection: "Источник колесного диска",
            sourceSectionTitle: "Сохранить известный источник",
            make: "Марка",
            model: "Модель",
            year: "Год",
            body: "Кузов",
            generation: "Поколение",
            modification: "Модификация",
            market: "Рынок",
            rimBrand: "Бренд",
            rimModel: "Модель",
            sku: "Артикул",
            boltCount: "Болтов",
            productUrl: "Ссылка на колесный диск",
            save: "Сохранить данные",
            skip: "Не сейчас",
            unavailable: "Для этого результата уточнение параметров пока недоступно",
            previewBadge: "Demo preview",
            previewNote: "Изменения сохраняются только локально в этой сессии",
        },
        actions: {
            createRender: "Создать рендер",
            createAnother: "Сделать ещё один",
            download: "Скачать",
            downloadImage: "Скачать изображение",
            requestingDownload: "Запрашиваем скачивание...",
            downloadCanceled: "Скачивание отменено",
            downloadStarted: "Скачивание началось",
            downloadFailed: "Скачать не удалось",
            share: "Поделиться",
            preparing: "Готовим...",
            openingTelegram: "Открываем Telegram",
            sent: "Отправлено",
            linkCopied: "Ссылка скопирована",
            openingLink: "Открываем ссылку",
            canceled: "Отменено",
            failed: "Не удалось",
            openRender: "Открыть",
        },
        errors: {
            generic: "Что-то пошло не так",
            missingFiles: "Файлы не выбраны — вернитесь и загрузите оба фото",
            missingIdentity: "Сначала определите и подтвердите данные",
            missingRimConfirmation: "Подтвердите параметры диска или выберите «Не уверен»",
            identityAuthTitle: "Нужен вход в Telegram",
            identityAuthBody:
                "Этот шаг требует `init_data` или `telegram_user_id`. Откройте Mini App из Telegram или нажмите «Войти через Telegram» сверху, затем повторите проверку.",
            identityAuthAction: "Войти через Telegram",
            identityBackendTitle: "Staging backend не готов",
            identityBackendBody:
                "Этот preview смотрит на backend без Sprint 2 маршрутов. Нужен deploy backend-а на staging или правильный API host, затем можно повторить.",
            identityRetryAction: "Повторить",
            identityGenericTitle: "Не удалось определить данные",
            identityGenericBody: "Проверьте фото и повторите попытку.",
            generationFailed: "Ошибка генерации",
            timeout: "Превышено время ожидания (>110 с)",
            requestFailed: "Запрос не удался. Попробуйте ещё раз",
        },
        share: {
            text: "Мой рендер в Dream Wheels AI",
        },
        wallet: {
            eyebrow: "Кабинет",
            title: "Мой Dream Wheels AI",
            lede: "Здесь видны баланс, последний счет и быстрый платежный flow в три шага",
            gift: "Подарок",
            lastInvoiceLabel: "Последний счет",
            lastInvoiceTitle: "Статус виден сразу после оплаты",
            lastInvoiceEmpty: "Оплат еще не было. После первой покупки здесь появится последний счет",
            invoiceAmount: "Сумма",
            invoiceNumber: "Счет",
            invoiceEmail: "Email",
            invoiceCredits: "Начисление",
            invoiceState: "Состояние",
            wizardLabel: "Пополнение",
            wizardTitle: "Три шага оплаты",
            reset: "Сбросить",
            stepAmount: "Сумма",
            stepEmail: "Email",
            stepConfirm: "Подтверждение",
            stepChooseTitle: "Выберите пакет",
            stepChooseSub: "Пакетный режим активен по умолчанию",
            chooseAmount: "Выбор суммы",
            nextToEmail: "Продолжить",
            modePackage: "Пакет",
            modeCustom: "Своя сумма",
            customAmountLabel: "Своя сумма",
            emailLabel: "Email для чека",
            emailHint: "Используем его для чека и подтверждения оплаты",
            back: "Назад",
            nextToConfirm: "Продолжить",
            confirmAmount: "Сумма",
            confirmEmail: "Email",
            confirmCredits: "Начисление",
            confirmHint: "Проверьте пакет перед переходом в Robokassa",
            pay: "Оплатить",
            paymentNote: "Оплата откроется через Robokassa. Рендеры начисляются после подтверждения",
            paymentHistory: "История платежей",
            paymentHistoryHint: "Покупки и сроки действия рендеров",
            openHistory: "Открыть",
            closeHistory: "Скрыть",
            availableRenders: "Доступные рендеры",
            availableRendersHint: "Сначала списываются пакеты с ближайшей датой окончания",
            topUpHistory: "История пополнений",
            topUpHistoryHint: "Показываем 10 последних операций",
            previousPage: "Назад",
            nextPage: "Далее",
            pageRange: "{from}-{to} из {total}",
            emptyHistory: "Платежей пока нет",
            noPaymentsTitle: "Платежей пока нет",
            noPaymentsMeta: "Стартовый грант по /start на 30 дней появится в истории платежей",
            loading: "Загружаем кабинет...",
            refreshInvoice: "Обновить счет",
            refreshingInvoice: "Обновляем статус счета...",
            openingPayment: "Открываем Robokassa...",
            paymentSuccess: "Оплата подтверждена. Обновляем баланс",
            paymentFail: "Платеж не завершен",
            pendingFresh: "Счет создан. Если вы вернулись из Robokassa, обновите его через несколько секунд",
            pendingStale: "Счет все еще ждет подтверждения. Если оплата не прошла, он останется в ожидании, пока мы не получим финальный статус. Обновите счет позже",
            authRequired: "Откройте Mini App в Telegram или войдите через Telegram на сайте",
            fallbackDisabled: "Web fallback выключен на backend",
            starterGrantTitle: "Первый подарок",
            starterGrantMeta: "{credits} рендеров · начислено по /start",
            starterGrantBadge: "Подарок",
            summaryEmptyTitle: "Выберите пакет",
            summaryEmptyMeta: "Здесь появится выбранный пакет перед оплатой",
            summaryPackageTitle: "Выбранный пакет",
            summaryCustomTitle: "Своя сумма",
            pendingInvoice: "Счет #{invoiceId} · {amount}",
            paidInvoice: "Счет #{invoiceId} · {amount}",
            failedInvoice: "Счет #{invoiceId} · {amount}",
            packageMetaDays: "{credits} рендеров",
            packageSummary: "{amount} · {credits} рендеров",
        },
        renders: {
            eyebrow: "Готовые работы",
            title: "Мои виртуальные примерки",
            lede: "Результаты и текущие статусы из вашей истории",
            empty: "Готовых примерок пока нет. Создайте первую на главном экране",
            completed: "Готово",
            processing: "В обработке",
            failed: "Не удалось",
            open: "Открыть",
            hide: "Скрыть ▲",
            retry: "Повторить",
            createAnother: "Создать ещё вариант",
            download: "Скачать изображение",
        },
        settings: {
            eyebrow: "Параметры кабинета",
            title: "Настройки",
            lede: "Формальный экран для будущих параметров профиля и уведомлений",
            profileTitle: "Профиль Telegram",
            profileText: "Связан автоматически с Mini App",
            notificationsTitle: "Уведомления",
            notificationsText: "Будут добавлены позже",
            languageTitle: "Язык интерфейса",
            languageText: "Определяется по Telegram",
            linked: "Подключено",
            soon: "Скоро",
        },
        support: {
            eyebrow: "Связь",
            title: "Поддержка",
            lede: "Короткий и формальный экран контактов без лишнего текста",
            telegram: "Telegram",
            email: "Email",
            offer: "Оферта",
            refund: "Возврат",
            pdn: "ПДн",
            requisites: "Реквизиты",
        },
        docs: {
            eyebrow: "Документы",
            title: "Документы",
            lede: "Формальный список ссылок на юридические и справочные материалы",
            offer: "Оферта",
            privacy: "Политика конфиденциальности",
            payments: "Условия оплаты",
        },
        failed: "Сбой",
        starter: "Стартовый грант",
        pending: "В ожидании",
        paid: "Оплачено",
        created: "Создан",
        locale: "RU",
        credits: "рендеров",
    },
    en: {
        auth: {
            login: "Log in with Telegram",
            loggingIn: "Logging in...",
            preparing: "Preparing login...",
            logout: "Log out",
            failed: "Telegram login failed",
        },
        menu: {
            dashboard: "Home",
            create: "Create render",
            wallet: "Wallet",
            renders: "Render history",
            settings: "Settings",
            support: "Support",
            photoGuide: "Photo guide",
            docs: "Documents",
        },
        caption: {
            dashboard: "Home",
            create: "Render",
            fitment: "Fitment",
            wallet: "Cabinet",
            renders: "Renders",
            settings: "Settings",
            support: "Support",
            photoGuide: "Guide",
            docs: "Documents",
        },
        create: {
            eyebrow: "Main screen",
            title: "Upload your car and wheel photos",
            lede: "Full side view of the car, front view of the wheel. JPG or PNG, up to 10 MB",
            carPhoto: "Car photo",
            wheelPhoto: "Wheel photo",
            choose: "Tap to choose",
            replaceCar: "Replace car",
            replaceWheel: "Replace wheel",
            carPreviewAlt: "Car preview",
            wheelPreviewAlt: "Wheel preview",
            footerNotTelegram: "Not in Telegram",
            detectIdentity: "Detect details",
            createRender: "Create virtual render",
        },
        steps: {
            upload: "Upload",
            result: "Done",
        },
        status: {
            creating: "Creating job...",
            startingServer: "Starting server...",
            coldStart: "First launch can take up to 40 seconds",
            uploading: "Uploading files...",
            upTo90: "This can take up to 90 seconds",
            generating: "Generating render...",
        },
        result: {
            imageAlt: "AI render",
            title: "Done!",
            caption: "Your render with new wheels is ready",
        },
        fitment: {
            eyebrow: "Fitment preparation",
            title: "Basic vehicle parameters",
            subtitleFallback: "Preliminary data helps prepare a future technical compatibility check",
            preliminary: "Preliminary",
            openFromResult: "Refine details",
            openFromHistory: "Check compatibility",
            back: "Back to result",
            loading: "Loading details",
            saveSuccess: "Details saved",
            stale: "Details were changed in another window. Reload the screen and try again",
            readinessReady: "Enough data for a future check",
            readinessMissing: "More data is needed for a future check",
            readinessUnconfirmed: "Some fields still need confirmation",
            aiSuggestion: "AI",
            aiPending: "AI guess, confirmation needed",
            userConfirmed: "Confirmed by user",
            sourceAdded: "Link added",
            basicsLabel: "Basic data",
            basicsCopy: "Detected from the photo · confirm the data before installation",
            centerBore: "Center bore",
            diameter: "Factory diameter",
            width: "Approximate width",
            widthShort: "Width",
            offset: "Approximate ET",
            vehicleCard: "Vehicle",
            vehicleCardMeta: "Detected from the photo",
            rimCard: "Wheel",
            rimCardMeta: "Some data was detected from the photo",
            sourceCard: "Wheel source",
            sourceCardMeta: "Brand, SKU, or wheel link",
            jumpVehicle: "Refine →",
            jumpRim: "Refine →",
            jumpSource: "Add →",
            notice: "These fields are optional and do not change the existing virtual render",
            vehicleSection: "Vehicle",
            vehicleSectionTitle: "Refine known details",
            rimSection: "Wheel",
            rimSectionTitle: "Refine parameters",
            sourceSection: "Wheel source",
            sourceSectionTitle: "Save a known source",
            make: "Make",
            model: "Model",
            year: "Year",
            body: "Body",
            generation: "Generation",
            modification: "Trim",
            market: "Market",
            rimBrand: "Brand",
            rimModel: "Model",
            sku: "SKU",
            boltCount: "Bolt count",
            productUrl: "Wheel link",
            save: "Save details",
            skip: "Not now",
            unavailable: "Fitment preparation is not available for this result yet",
            previewBadge: "Demo preview",
            previewNote: "Changes are saved locally for this session only",
        },
        actions: {
            createRender: "Create render",
            createAnother: "Create another",
            download: "Download",
            downloadImage: "Download image",
            requestingDownload: "Requesting download...",
            downloadCanceled: "Download canceled",
            downloadStarted: "Download started",
            downloadFailed: "Download failed",
            share: "Share",
            preparing: "Preparing...",
            openingTelegram: "Opening Telegram",
            sent: "Sent",
            linkCopied: "Link copied",
            openingLink: "Opening link",
            canceled: "Canceled",
            failed: "Failed",
            openRender: "Open",
        },
        errors: {
            generic: "Something went wrong",
            missingFiles: "Files are missing. Go back and upload both photos",
            missingIdentity: "Detect and confirm details first",
            missingRimConfirmation: "Confirm wheel details or choose Not sure",
            identityAuthTitle: "Telegram login required",
            identityAuthBody:
                "This step requires `init_data` or `telegram_user_id`. Open the Mini App in Telegram or click \"Log in with Telegram\" above, then try again.",
            identityAuthAction: "Log in with Telegram",
            identityBackendTitle: "Staging backend is not ready",
            identityBackendBody:
                "This preview points to a backend without the Sprint 2 routes. The staging backend needs a deploy, or the API host must be switched, then try again.",
            identityRetryAction: "Retry",
            identityGenericTitle: "Could not detect the data",
            identityGenericBody: "Check the photos and try again.",
            generationFailed: "Generation failed",
            timeout: "Timed out after 110 seconds",
            requestFailed: "Request failed. Please try again",
        },
        share: {
            text: "My Dream Wheels AI render",
        },
        wallet: {
            eyebrow: "Cabinet",
            title: "My Dream Wheels AI",
            lede: "Balance, last invoice, and a three-step payment flow in one place",
            gift: "Gift",
            lastInvoiceLabel: "Last invoice",
            lastInvoiceTitle: "Status appears immediately after payment",
            lastInvoiceEmpty: "No payments yet. The first purchase will show up here as the last invoice",
            invoiceAmount: "Amount",
            invoiceNumber: "Invoice",
            invoiceEmail: "Email",
            invoiceCredits: "Renders",
            invoiceState: "Status",
            wizardLabel: "Top up",
            wizardTitle: "Three payment steps",
            reset: "Reset",
            stepAmount: "Amount",
            stepEmail: "Email",
            stepConfirm: "Confirm",
            stepChooseTitle: "Choose a package",
            stepChooseSub: "Package mode stays enabled by default",
            chooseAmount: "Amount selection",
            nextToEmail: "Continue",
            modePackage: "Package",
            modeCustom: "Custom",
            customAmountLabel: "Custom amount",
            emailLabel: "Receipt email",
            emailHint: "Used for the receipt and payment confirmation",
            back: "Back",
            nextToConfirm: "Continue",
            confirmAmount: "Amount",
            confirmEmail: "Email",
            confirmCredits: "Credits",
            confirmHint: "Review the package before opening Robokassa",
            pay: "Pay",
            paymentNote: "Robokassa opens on tap. Renders are applied after confirmation",
            paymentHistory: "Payment history",
            paymentHistoryHint: "Purchases and render expiry windows",
            openHistory: "Open",
            closeHistory: "Hide",
            availableRenders: "Available renders",
            availableRendersHint: "Packages expiring sooner are spent first",
            topUpHistory: "Top-up history",
            topUpHistoryHint: "Showing the latest 10 operations",
            previousPage: "Back",
            nextPage: "Next",
            pageRange: "{from}-{to} of {total}",
            emptyHistory: "No payments yet",
            noPaymentsTitle: "No payments yet",
            noPaymentsMeta: "Your 30-day /start starter grant will appear in payment history",
            loading: "Loading cabinet...",
            refreshInvoice: "Refresh invoice",
            refreshingInvoice: "Refreshing invoice status...",
            openingPayment: "Opening Robokassa...",
            paymentSuccess: "Payment confirmed. Refreshing balance",
            paymentFail: "Payment was not completed",
            pendingFresh: "Invoice created. If you returned from Robokassa, refresh it in a few seconds",
            pendingStale: "The invoice is still waiting for confirmation. If the payment did not go through, it may stay pending until a final status arrives. Refresh it later",
            authRequired: "Open the Mini App in Telegram or log in with Telegram on the website",
            fallbackDisabled: "Web fallback is disabled on the backend",
            starterGrantTitle: "Starter gift",
            starterGrantMeta: "{credits} renders · added on /start",
            starterGrantBadge: "Gift",
            summaryEmptyTitle: "Choose a package",
            summaryEmptyMeta: "The selected package will appear here before payment",
            summaryPackageTitle: "Selected package",
            summaryCustomTitle: "Custom amount",
            pendingInvoice: "Invoice #{invoiceId} · {amount}",
            paidInvoice: "Invoice #{invoiceId} · {amount}",
            failedInvoice: "Invoice #{invoiceId} · {amount}",
            packageMetaDays: "{credits} renders",
            packageSummary: "{amount} · {credits} renders",
        },
        renders: {
            eyebrow: "Finished work",
            title: "Render history",
            lede: "Recent renders saved on this device",
            empty: "No renders yet. Create your first one on the main screen",
            completed: "Done",
            failed: "Failed",
        },
        settings: {
            eyebrow: "Cabinet settings",
            title: "Settings",
            lede: "A formal screen for future profile and notification options",
            profileTitle: "Telegram profile",
            profileText: "Linked automatically through the Mini App",
            notificationsTitle: "Notifications",
            notificationsText: "Will be added later",
            languageTitle: "Interface language",
            languageText: "Detected from Telegram",
            linked: "Connected",
            soon: "Soon",
        },
        support: {
            eyebrow: "Contact",
            title: "Support",
            lede: "A short formal contact screen without extra content",
            telegram: "Telegram",
            email: "Email",
            offer: "Offer",
            refund: "Refund",
            pdn: "Privacy",
            requisites: "Details",
        },
        docs: {
            eyebrow: "Documents",
            title: "Documents",
            lede: "A formal list of legal and reference materials",
            offer: "Offer",
            privacy: "Privacy policy",
            payments: "Payment terms",
        },
        failed: "Failed",
        starter: "Starter grant",
        pending: "Pending",
        paid: "Paid",
        created: "Created",
        locale: "EN",
        credits: "renders",
    },
};

function detectLocale() {
    const telegramLanguage = tg?.initDataUnsafe?.user?.language_code;
    const browserLanguage = navigator.language;
    const language = (telegramLanguage || browserLanguage || "en").toLowerCase();
    return language.startsWith("ru") ? "ru" : "en";
}

const locale = detectLocale();

function t(path) {
    return path.split(".").reduce((value, key) => value?.[key], I18N[locale]) ?? path;
}

function resolveApiBaseUrl() {
    const params = new URLSearchParams(window.location.search);
    const apiBase = params.get("apiBase");
    const apiMode = params.get("api");

    if (apiBase) {
        return apiBase.replace(/\/+$/, "");
    }
    if (apiMode) {
        localStorage.setItem(API_MODE_STORAGE_KEY, apiMode);
    }

    const storedMode = localStorage.getItem(API_MODE_STORAGE_KEY) || apiMode || "";
    if (storedMode === "local") return LOCAL_API_BASE_URL;
    if (storedMode === "staging") return STAGING_API_BASE_URL;
    if (storedMode === "prod") return PROD_API_BASE_URL;
    if (window.location.hostname.includes("staging")) return STAGING_API_BASE_URL;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return LOCAL_API_BASE_URL;
    }
    return PROD_API_BASE_URL;
}

function shouldUseBrowserApiProxy() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("apiBase")) return false;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return false;
    return host.endsWith(".vercel.app");
}

function appendSearchParams(url, params) {
    const query = params instanceof URLSearchParams ? params : new URLSearchParams(params || "");
    const serialized = query.toString();
    if (!serialized) return url;
    return `${url}${url.includes("?") ? "&" : "?"}${serialized}`;
}

function resolveDevTelegramUserId() {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("tgUser");
    if (value) {
        localStorage.setItem(DEV_TELEGRAM_USER_ID_STORAGE_KEY, value);
        return value;
    }
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        localStorage.removeItem(DEV_TELEGRAM_USER_ID_STORAGE_KEY);
        return "";
    }
    return localStorage.getItem(DEV_TELEGRAM_USER_ID_STORAGE_KEY) || "";
}

function resolveFitmentPreviewMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get("preview") === "fitment";
}

function loadWebsiteAuth() {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(WEBSITE_AUTH_STORAGE_KEY) || "null");
        if (!parsed?.accessToken || Number(parsed.expiresAt || 0) <= Date.now()) {
            sessionStorage.removeItem(WEBSITE_AUTH_STORAGE_KEY);
            return null;
        }
        return parsed;
    } catch {
        sessionStorage.removeItem(WEBSITE_AUTH_STORAGE_KEY);
        return null;
    }
}

const state = {
    apiBaseUrl: resolveApiBaseUrl(),
    devTelegramUserId: resolveDevTelegramUserId(),
    websiteAuth: loadWebsiteAuth(),
    fitmentPreviewForced: resolveFitmentPreviewMode(),
    websiteLoginPending: false,
    websiteLoginWarmupPending: false,
    websiteLoginLibraryPromise: null,
    websiteLoginNoncePromise: null,
    websiteLoginNonce: null,
    websiteLoginNonceFetchedAt: 0,
    view: "dashboard",
    menuOpen: false,
    moreOpen: false,
    paymentStep: 1,
    selectedAmount: 500,
    topUpMode: "package",
    email: "",
    balance: null,
    payments: [],
    starterGrant: null,
    walletHistoryOpen: true,
    walletHistoryPage: 0,
    walletBusy: false,
    walletLoading: false,
    walletLoadingMessage: "",
    walletMessage: "",
    walletMessageTone: "neutral",
    paymentReturnState: "",
    pendingRefreshTimer: null,
    createScreen: "upload",
    files: { car: null, wheel: null },
    previewUrls: { car: "", wheel: "" },
    identityDraftId: "",
    identityProposal: null,
    identityResolving: false,
    identityError: "",
    selectedVehicleIndex: 0,
    rimUserConfirmed: null,
    jobId: null,
    resultUrl: null,
    resultDownloadUrl: null,
    resultFileName: null,
    downloading: false,
    sharing: false,
    submitting: false,
    renderHistory: [],
    renderHistoryLoading: false,
    renderHistoryError: "",
    expandedJobId: "",
    fitmentJobId: "",
    fitmentOriginView: "dashboard",
    fitmentOriginJobId: "",
    fitmentOverview: null,
    fitmentLoading: false,
    fitmentSaving: false,
    fitmentError: "",
    fitmentMessage: "",
    fitmentMessageTone: "neutral",
    fitmentForm: createEmptyFitmentForm(),
    renderHistoryPollTimer: null,
    renderAssetViewByJob: {},
    renderAssetErrorsByJob: {},
    renderAssetBlobUrlsByJob: {},
    renderAssetBlobLoadingByJob: {},
    feedbackByJob: {},
    feedbackBusyByJob: {},
    feedbackErrorByJob: {},
    feedbackNoticeByJob: {},
};

const FITMENT_PREVIEW_REQUIRED_FIELDS = [
    "vehicle.make",
    "vehicle.model",
    "vehicle.year",
    "rim.bolt_count",
    "rim.pcd_mm",
    "rim.center_bore_mm",
    "rim.wheel_diameter_in",
    "rim.wheel_width_j",
    "rim.offset_et_mm",
];

const FITMENT_PREVIEW_FIELD_CONFIG = {
    vehicle: ["make", "model", "year", "body", "generation", "modification", "market"],
    rim: [
        "brand",
        "model",
        "sku",
        "product_url",
        "bolt_count",
        "pcd_mm",
        "wheel_diameter_in",
        "wheel_width_j",
        "center_bore_mm",
        "offset_et_mm",
    ],
};

function isGuestRenderJob(job) {
    return Boolean(job?.is_guest_demo);
}

function isDemoFitmentJobId(jobId) {
    return jobId === GUEST_FITMENT_DEMO_JOB_ID;
}

function shouldUseDemoFitment(jobId = state.fitmentJobId) {
    return isDemoFitmentJobId(jobId) && (state.fitmentPreviewForced || !hasFrontendAuth());
}

function fitmentPreviewProvenance({ source, confidence, isUserConfirmed = false }) {
    return {
        source,
        confidence,
        is_user_confirmed: isUserConfirmed,
    };
}

function demoVehicleTitle(vehicle) {
    const parts = [[vehicle?.make, vehicle?.model].filter(Boolean).join(" "), vehicle?.year, vehicle?.generation]
        .filter(Boolean);
    return parts.length ? parts.join(" · ") : fitmentEmptyValue();
}

function demoPcdDisplay(rim) {
    if (rim?.bolt_count && rim?.pcd_mm) return `${rim.bolt_count}×${rim.pcd_mm}`;
    return null;
}

function demoRimTitle(rim) {
    const base = [rim?.brand, rim?.model].filter(Boolean).join(" ");
    const details = [
        rim?.wheel_diameter_in ? `${rim.wheel_diameter_in}"` : "",
        rim?.wheel_width_j ? `${rim.wheel_width_j}J` : "",
        demoPcdDisplay(rim),
    ].filter(Boolean);
    if (base && details.length) return `${base} · ${details.join(" / ")}`;
    if (base) return base;
    if (details.length) return details.join(" / ");
    return fitmentEmptyValue();
}

function demoFitmentOverviewReadiness(overview) {
    const missing = [];
    const unconfirmed = [];
    for (const path of FITMENT_PREVIEW_REQUIRED_FIELDS) {
        const value = getDeepValue(overview, path);
        const empty = value === null || value === undefined || value === "";
        if (empty) {
            missing.push(path);
            continue;
        }
        const [scope, fieldName] = path.split(".");
        const provenanceKey = scope === "vehicle" ? "vehicle_provenance" : "rim_provenance";
        const meta = overview?.[provenanceKey]?.[fieldName];
        if (!meta?.is_user_confirmed) unconfirmed.push(path);
    }
    return {
        ready: missing.length === 0,
        missing_fields: missing,
        blocking_fields: [...missing],
        unconfirmed_fields: unconfirmed,
    };
}

function buildDefaultDemoFitmentOverview() {
    const completedAt = guestRenderHistory()[0]?.completed_at || "2026-07-05T03:11:00+03:00";
    const vehicle = {
        make: "Toyota",
        model: "Prius",
        year: 2016,
        body: "ZVW50",
        generation: "IV",
        modification: "1.8 Hybrid",
        market: "JP",
        is_user_confirmed: false,
    };
    vehicle.title = demoVehicleTitle(vehicle);

    const rim = {
        brand: "OZ",
        model: "Ultraleggera",
        sku: "OZ-ULTRA-17",
        product_url: "https://shop.example.test/oz-ultraleggera-17",
        bolt_count: 5,
        pcd_mm: 100,
        pcd_display: "5×100",
        center_bore_mm: null,
        wheel_diameter_in: 17,
        wheel_width_j: 7,
        offset_et_mm: null,
        has_product_url: true,
        title: "",
    };
    rim.title = demoRimTitle(rim);

    return {
        job_id: GUEST_FITMENT_DEMO_JOB_ID,
        status: "completed",
        result_url: GUEST_RENDER_DEMO_ASSET_URL,
        completed_at: completedAt,
        fitment_available: true,
        is_staggered: false,
        snapshot_locked: true,
        vehicle_revision: 1,
        rim_revision: 1,
        vehicle_candidates: {
            make: [
                { value: "Toyota", source: "vlm_visual", confidence: 0.98 },
                { value: "Lexus", source: "vlm_visual", confidence: 0.34 },
            ],
            model: [
                { value: "Prius", source: "vlm_visual", confidence: 0.94 },
                { value: "Prius Prime", source: "vlm_visual", confidence: 0.41 },
            ],
            year: [
                { value: 2016, source: "vlm_visual", confidence: 0.87 },
                { value: 2017, source: "vlm_visual", confidence: 0.45 },
            ],
        },
        rim_candidates: {
            pcd_mm: [{ value: 100, source: "ocr", confidence: 0.91 }],
            center_bore_mm: [{ value: 54.1, source: "ocr", confidence: 0.52 }],
            wheel_diameter_in: [{ value: 17, source: "ocr", confidence: 0.88 }],
            wheel_width_j: [{ value: 7, source: "ocr", confidence: 0.74 }],
            offset_et_mm: [{ value: 45, source: "ocr", confidence: 0.43 }],
            product_url: [
                {
                    value: "https://shop.example.test/oz-ultraleggera-17",
                    source: "provider_catalog",
                    confidence: 0.66,
                },
            ],
        },
        vehicle_provenance: {
            make: fitmentPreviewProvenance({ source: "vlm_visual", confidence: 0.98 }),
            model: fitmentPreviewProvenance({ source: "vlm_visual", confidence: 0.94 }),
            year: fitmentPreviewProvenance({ source: "vlm_visual", confidence: 0.87 }),
        },
        rim_provenance: {
            bolt_count: fitmentPreviewProvenance({ source: "vlm_visual", confidence: 0.89 }),
            pcd_mm: fitmentPreviewProvenance({ source: "vlm_visual", confidence: 0.91 }),
            wheel_diameter_in: fitmentPreviewProvenance({ source: "vlm_visual", confidence: 0.88 }),
            wheel_width_j: fitmentPreviewProvenance({ source: "vlm_visual", confidence: 0.74 }),
        },
        readiness: {
            ready: false,
            missing_fields: ["rim.center_bore_mm", "rim.offset_et_mm"],
            blocking_fields: ["rim.center_bore_mm", "rim.offset_et_mm"],
            unconfirmed_fields: [
                "vehicle.make",
                "vehicle.model",
                "vehicle.year",
                "rim.bolt_count",
                "rim.pcd_mm",
                "rim.wheel_diameter_in",
                "rim.wheel_width_j",
            ],
        },
        vehicle,
        rim,
    };
}

function loadDemoFitmentOverview() {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(FITMENT_PREVIEW_STORAGE_KEY) || "null");
        if (parsed?.job_id !== GUEST_FITMENT_DEMO_JOB_ID) return null;
        return parsed;
    } catch {
        sessionStorage.removeItem(FITMENT_PREVIEW_STORAGE_KEY);
        return null;
    }
}

function persistDemoFitmentOverview(overview) {
    sessionStorage.setItem(FITMENT_PREVIEW_STORAGE_KEY, JSON.stringify(overview));
}

function guestRenderAssetUrl(job, kind) {
    if (!isGuestRenderJob(job)) return "";
    return job?.demo_assets?.[kind] || "";
}

function guestRenderHistory() {
    const assetUrl = GUEST_RENDER_DEMO_ASSET_URL;
    return [{
        job_id: GUEST_FITMENT_DEMO_JOB_ID,
        status: "completed",
        created_at: "2026-07-05T03:04:00+03:00",
        completed_at: "2026-07-05T03:11:00+03:00",
        feedback: null,
        fitment_available: true,
        render_input_snapshot: {
            vehicle: {
                make: "Toyota",
                model: "Prius",
                year: 2016,
            },
            rim: {
                wheel_diameter_in: 17,
                wheel_width_j: 7,
                bolt_count: 5,
                pcd_mm: 100,
                pcd_display: "5×100",
            },
        },
        demo_assets: {
            original: assetUrl,
            result: assetUrl,
        },
        is_guest_demo: true,
    }];
}

function applyTranslations() {
    document.documentElement.lang = locale;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
        el.alt = t(el.dataset.i18nAlt);
    });
}

function initTelegram() {
    const localeLabel = document.querySelector("[data-locale-label]");
    if (localeLabel) localeLabel.textContent = t("locale");

    if (!HAS_TG) {
        updateCreateFooter();
        updateAccountBlock();
        return;
    }

    tg.ready();
    tg.expand();
    updateCreateFooter();
    updateAccountBlock();
}

function updateCreateFooter() {
    const userInfo = document.querySelector("[data-user-info]");
    if (!userInfo) return;
    const user = tg?.initDataUnsafe?.user;
    if (!user) {
        const websiteUsername = state.websiteAuth?.username;
        userInfo.textContent = websiteUsername
            ? `Telegram · @${websiteUsername}`
            : t("create.footerNotTelegram");
        return;
    }
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || `id ${user.id}`;
    userInfo.textContent = `Telegram · ${name}`;
}

function getDisplayName() {
    const user = tg?.initDataUnsafe?.user;
    if (user) {
        return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || `id ${user.id}`;
    }
    if (state.websiteAuth?.username) return `@${state.websiteAuth.username}`;
    return "Dream Wheels";
}

function getInitials(name) {
    const normalized = (name || "Dream Wheels").replace("@", "").trim();
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (!parts.length) return "DW";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function updateAccountBlock() {
    const displayName = getDisplayName();
    const name = document.querySelector("[data-account-name]");
    const avatar = document.querySelector("[data-account-avatar]");
    const subtitle = document.querySelector("[data-account-subtitle]");
    if (name) name.textContent = displayName;
    if (avatar) avatar.textContent = getInitials(displayName);
    if (subtitle) subtitle.textContent = HAS_TG ? "Telegram Mini App" : "Website login";
}

function getWebsiteAuthToken() {
    if (HAS_TG || !state.websiteAuth) return "";
    if (Number(state.websiteAuth.expiresAt || 0) <= Date.now()) {
        state.websiteAuth = null;
        sessionStorage.removeItem(WEBSITE_AUTH_STORAGE_KEY);
        updateWebsiteAuthUi();
        return "";
    }
    return state.websiteAuth.accessToken || "";
}

function withAuthHeaders(headers = {}) {
    const accessToken = getWebsiteAuthToken();
    return accessToken ? { ...headers, Authorization: `Bearer ${accessToken}` } : headers;
}

function isWebsiteAuthMode() {
    return Boolean(getWebsiteAuthToken());
}

function updateWebsiteAuthUi() {
    const button = document.querySelector("[data-website-auth-button]");
    if (!button) return;
    button.hidden = HAS_TG;
    if (HAS_TG) return;

    if (state.websiteLoginWarmupPending && !state.websiteAuth) {
        button.disabled = false;
        button.textContent = t("auth.preparing");
        updateCreateFooter();
        updateAccountBlock();
        return;
    }

    const username = state.websiteAuth?.username;
    button.textContent = state.websiteAuth
        ? `${t("auth.logout")}${username ? ` @${username}` : ""}`
        : t("auth.login");
    updateCreateFooter();
    updateAccountBlock();
}

function apiUrl(path, { includeIdentity = false, params = null } = {}) {
    const baseUrl = shouldUseBrowserApiProxy() ? WEBSITE_PROXY_BASE_URL : state.apiBaseUrl;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    let url = `${baseUrl}${normalizedPath}`;
    if (includeIdentity) {
        url = appendSearchParams(url, getIdentitySearchParams());
    }
    if (params) {
        url = appendSearchParams(url, params);
    }
    return url;
}

function loadTelegramLoginLibrary() {
    if (window.Telegram?.Login) return Promise.resolve(window.Telegram.Login);
    if (state.websiteLoginLibraryPromise) return state.websiteLoginLibraryPromise;

    function resolveLoginLibrary(resolve, reject) {
        if (window.Telegram?.Login) resolve(window.Telegram.Login);
        else reject(new Error("Telegram Login library is unavailable"));
    }

    state.websiteLoginLibraryPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector("script[data-telegram-login-library]");
        if (existingScript) {
            existingScript.addEventListener("load", () => resolveLoginLibrary(resolve, reject), {
                once: true,
            });
            existingScript.addEventListener("error", reject, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = TELEGRAM_LOGIN_SCRIPT_URL;
        script.async = true;
        script.dataset.telegramLoginLibrary = "true";
        script.addEventListener("load", () => resolveLoginLibrary(resolve, reject), { once: true });
        script.addEventListener("error", reject, { once: true });
        document.head.append(script);
    }).catch((error) => {
        state.websiteLoginLibraryPromise = null;
        throw error;
    });
    return state.websiteLoginLibraryPromise;
}

function hasFreshWebsiteLoginNonce() {
    return Boolean(
        state.websiteLoginNonce &&
        Date.now() - state.websiteLoginNonceFetchedAt < WEBSITE_LOGIN_NONCE_MAX_AGE_MS
    );
}

async function fetchWebsiteLoginNonce({ force = false } = {}) {
    if (!force && hasFreshWebsiteLoginNonce()) return state.websiteLoginNonce;
    if (!force && state.websiteLoginNoncePromise) return state.websiteLoginNoncePromise;

    state.websiteLoginNoncePromise = fetch(apiUrl("/auth/telegram/nonce"))
        .then(async (response) => {
            if (!response.ok) throw new Error(await parseApiError(response));
            const payload = await response.json();
            state.websiteLoginNonce = payload;
            state.websiteLoginNonceFetchedAt = Date.now();
            return payload;
        })
        .finally(() => {
            state.websiteLoginNoncePromise = null;
        });
    return state.websiteLoginNoncePromise;
}

function invalidateWebsiteLoginNonce() {
    state.websiteLoginNonce = null;
    state.websiteLoginNonceFetchedAt = 0;
}

function warmWebsiteLoginResources() {
    if (HAS_TG || state.websiteAuth) return;
    if (state.websiteLoginWarmupPending) return;
    state.websiteLoginWarmupPending = true;
    updateWebsiteAuthUi();
    const warmup = Promise.allSettled([loadTelegramLoginLibrary(), fetchWebsiteLoginNonce()]);
    void warmup.finally(() => {
        state.websiteLoginWarmupPending = false;
        updateWebsiteAuthUi();
    });
}

warmWebsiteLoginResources();

async function loginWithTelegram() {
    if (state.websiteLoginPending) return;
    const button = document.querySelector("[data-website-auth-button]");
    state.websiteLoginPending = true;
    if (button) {
        button.disabled = true;
        button.textContent = t("auth.loggingIn");
    }

    try {
        const [{ client_id: clientId, nonce, nonce_token: nonceToken }, telegramLogin] =
            await Promise.all([fetchWebsiteLoginNonce(), loadTelegramLoginLibrary()]);
        const numericClientId = Number(clientId);
        if (!Number.isSafeInteger(numericClientId)) throw new Error("Invalid Telegram client_id");

        const loginResult = await new Promise((resolve, reject) => {
            telegramLogin.auth(
                { client_id: numericClientId, lang: locale, nonce },
                (result) => {
                    if (result?.id_token) resolve(result);
                    else reject(new Error(result?.error || t("auth.failed")));
                }
            );
        });

        const verifyResponse = await fetch(apiUrl("/auth/telegram/verify-id-token"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: loginResult.id_token, nonce_token: nonceToken }),
        });
        if (!verifyResponse.ok) throw new Error(await parseApiError(verifyResponse));
        const verified = await verifyResponse.json();
        state.websiteAuth = {
            accessToken: verified.access_token,
            expiresAt: Date.now() + Number(verified.expires_in || 0) * 1000,
            telegramUserId: verified.telegram_user_id,
            username: verified.username || "",
        };
        sessionStorage.setItem(WEBSITE_AUTH_STORAGE_KEY, JSON.stringify(state.websiteAuth));
        updateWebsiteAuthUi();
        await loadCabinet();
    } catch (error) {
        console.error("[DW] Telegram website login failed", error);
        setWalletMessage(error?.message || t("auth.failed"), "error");
    } finally {
        state.websiteLoginPending = false;
        invalidateWebsiteLoginNonce();
        warmWebsiteLoginResources();
        if (button) button.disabled = false;
        updateWebsiteAuthUi();
    }
}

function logoutWebsiteAuth() {
    state.websiteAuth = null;
    sessionStorage.removeItem(WEBSITE_AUTH_STORAGE_KEY);
    state.balance = null;
    state.payments = [];
    state.starterGrant = null;
    updateWebsiteAuthUi();
    setWalletMessage(t("wallet.authRequired"), "warning");
    renderWallet();
}

function haptic(type) {
    if (!SUPPORTS_HAPTIC) return;
    const h = tg.HapticFeedback;
    if (!h) return;
    if (type === "success") h.notificationOccurred("success");
    else if (type === "error") h.notificationOccurred("error");
    else if (type === "warning") h.notificationOccurred("warning");
    else h.impactOccurred("light");
}

function formatRub(value) {
    return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(Number(value || 0)) + " ₽";
}

function formatTemplate(template, params) {
    return t(template).replace(/\{(\w+)\}/g, (_, key) => String(params?.[key] ?? ""));
}

function normalizeTopUpAmount(amount) {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount)) return TOPUP_MIN_AMOUNT;
    return Math.min(TOPUP_MAX_AMOUNT, Math.max(TOPUP_MIN_AMOUNT, Math.round(parsedAmount)));
}

function getTopUpPackage(amount) {
    const normalized = normalizeTopUpAmount(amount);
    return TOPUP_PACKAGES.find((item) => item.amount === normalized) || null;
}

function creditsForAmount(amount) {
    const normalized = normalizeTopUpAmount(amount);
    const topUpPackage = getTopUpPackage(normalized);
    if (topUpPackage) return topUpPackage.credits;
    if (normalized >= 1000) return Math.max(1, Math.floor(normalized / (1000 / 45)));
    if (normalized >= 500) return Math.max(1, Math.floor(normalized / 25));
    if (normalized >= 200) return Math.max(1, Math.floor(normalized / (200 / 7)));
    if (normalized >= 100) return Math.max(1, Math.floor(normalized / (100 / 3)));
    return 1;
}

function topUpMeta(credits) {
    return formatTemplate("wallet.packageMetaDays", { credits });
}

function localizeErrorMessage(message) {
    if (locale === "en" && /[А-Яа-яЁё]/.test(message || "")) {
        return t("errors.requestFailed");
    }
    return message || t("errors.generic");
}

function classifyIdentityError(message) {
    const rawMessage = message || "";
    const normalized = rawMessage.toLowerCase();

    if (normalized.includes("init_data") || normalized.includes("telegram_user_id")) {
        return {
            title: t("errors.identityAuthTitle"),
            body: t("errors.identityAuthBody"),
            primaryActionLabel: t("errors.identityAuthAction"),
            showPrimaryAction: true,
            retryLabel: t("errors.identityRetryAction"),
        };
    }

    if (normalized.includes("not found") || normalized.includes("404") || normalized.includes("method not allowed") || normalized.includes("405")) {
        return {
            title: t("errors.identityBackendTitle"),
            body: formatTemplate("errors.identityBackendBody", { apiBase: state.apiBaseUrl }),
            primaryActionLabel: "",
            showPrimaryAction: false,
            retryLabel: t("errors.identityRetryAction"),
        };
    }

    return {
        title: t("errors.identityGenericTitle"),
        body: t("errors.identityGenericBody"),
        primaryActionLabel: "",
        showPrimaryAction: false,
        retryLabel: t("errors.identityRetryAction"),
    };
}

function getIdentityPayload({ includeTelegramUserId = false } = {}) {
    if (isWebsiteAuthMode()) return {};
    if (HAS_TG && tg?.initData) {
        const payload = { init_data: tg.initData };
        if (includeTelegramUserId && tg.initDataUnsafe?.user?.id != null) {
            payload.telegram_user_id = Number(tg.initDataUnsafe.user.id);
        }
        return payload;
    }
    if (state.devTelegramUserId) {
        return { telegram_user_id: Number(state.devTelegramUserId) };
    }
    return {};
}

function getIdentitySearchParams() {
    const params = new URLSearchParams();
    const identity = getIdentityPayload();
    if (identity.init_data) params.set("init_data", identity.init_data);
    if (identity.telegram_user_id) params.set("telegram_user_id", String(identity.telegram_user_id));
    return params;
}

function withIdentityQuery(url) {
    return appendSearchParams(url, getIdentitySearchParams());
}

function fitmentAvailable(job) {
    return Boolean(job?.fitment_available);
}

function createEmptyFitmentForm() {
    return {
        vehicle: {
            make: "",
            model: "",
            year: "",
            body: "",
            generation: "",
            modification: "",
            market: "",
        },
        rim: {
            brand: "",
            model: "",
            sku: "",
            product_url: "",
            bolt_count: "",
            pcd_mm: "",
            wheel_diameter_in: "",
            wheel_width_j: "",
            center_bore_mm: "",
            offset_et_mm: "",
        },
    };
}

function fitmentEmptyValue() {
    return locale === "ru" ? "Не указано" : "Not specified";
}

function setDeepValue(target, path, value) {
    const parts = path.split(".");
    let current = target;
    for (const part of parts.slice(0, -1)) {
        if (!current[part] || typeof current[part] !== "object") current[part] = {};
        current = current[part];
    }
    current[parts.at(-1)] = value;
}

function getDeepValue(target, path) {
    return path.split(".").reduce((current, part) => current?.[part], target);
}

function fitmentFieldLabel(path) {
    const labels = {
        "vehicle.make": locale === "ru" ? "марка" : "make",
        "vehicle.model": locale === "ru" ? "модель" : "model",
        "vehicle.year": locale === "ru" ? "год" : "year",
        "rim.bolt_count": locale === "ru" ? "болтов" : "bolt count",
        "rim.pcd_mm": "PCD",
        "rim.center_bore_mm": locale === "ru" ? "центральное отверстие" : "center bore",
        "rim.wheel_diameter_in": locale === "ru" ? "диаметр" : "diameter",
        "rim.wheel_width_j": locale === "ru" ? "ширина" : "width",
        "rim.offset_et_mm": "ET",
    };
    return labels[path] || path;
}

function fitmentCandidatesFor(path) {
    const [scope, fieldName] = path.split(".");
    const key = scope === "vehicle" ? "vehicle_candidates" : "rim_candidates";
    const candidates = state.fitmentOverview?.[key]?.[fieldName];
    return Array.isArray(candidates) ? candidates : [];
}

function fitmentVehicleMeta(overview) {
    return overview?.vehicle?.is_user_confirmed ? t("fitment.userConfirmed") : t("fitment.aiPending");
}

function fitmentRimMeta(overview) {
    const unconfirmed = overview?.readiness?.unconfirmed_fields || [];
    return unconfirmed.some((field) => field.startsWith("rim."))
        ? t("fitment.aiPending")
        : t("fitment.userConfirmed");
}

function fitmentSourceValue(overview) {
    const parts = [overview?.rim?.brand, overview?.rim?.sku];
    if (overview?.rim?.has_product_url) parts.push(t("fitment.sourceAdded"));
    return parts.filter(Boolean).join(" · ") || fitmentEmptyValue();
}

function fitmentCandidateLabel(candidate) {
    const value = candidate?.value;
    const confidence = Number(candidate?.confidence);
    const confidenceLabel = Number.isFinite(confidence)
        ? `${Math.round(confidence * 100)}%`
        : "";
    return [t("fitment.aiSuggestion"), value, confidenceLabel].filter(Boolean).join(" · ");
}

function renderFitmentCandidates() {
    document.querySelectorAll(".fitment-candidate-row").forEach((row) => row.remove());
    document.querySelectorAll("[data-fitment-input]").forEach((input) => {
        const path = input.dataset.fitmentInput;
        const candidates = fitmentCandidatesFor(path);
        if (!candidates.length) return;
        const row = document.createElement("div");
        row.className = "fitment-candidate-row";
        for (const candidate of candidates.slice(0, 3)) {
            if (candidate?.value === null || candidate?.value === undefined || candidate?.value === "") continue;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "fitment-candidate";
            button.dataset.fitmentCandidate = path;
            button.dataset.fitmentCandidateValue = String(candidate.value);
            button.textContent = fitmentCandidateLabel(candidate);
            row.append(button);
        }
        if (row.children.length) input.closest(".fitment-field")?.append(row);
    });
}

function fitmentFormFromOverview(overview) {
    return {
        vehicle: {
            make: overview?.vehicle?.make || "",
            model: overview?.vehicle?.model || "",
            year: overview?.vehicle?.year ?? "",
            body: overview?.vehicle?.body || "",
            generation: overview?.vehicle?.generation || "",
            modification: overview?.vehicle?.modification || "",
            market: overview?.vehicle?.market || "",
        },
        rim: {
            brand: overview?.rim?.brand || "",
            model: overview?.rim?.model || "",
            sku: overview?.rim?.sku || "",
            product_url: overview?.rim?.product_url || "",
            bolt_count: overview?.rim?.bolt_count ?? "",
            pcd_mm: overview?.rim?.pcd_mm ?? "",
            wheel_diameter_in: overview?.rim?.wheel_diameter_in ?? "",
            wheel_width_j: overview?.rim?.wheel_width_j ?? "",
            center_bore_mm: overview?.rim?.center_bore_mm ?? "",
            offset_et_mm: overview?.rim?.offset_et_mm ?? "",
        },
    };
}

function syncFitmentFormInputs() {
    document.querySelectorAll("[data-fitment-input]").forEach((input) => {
        const value = getDeepValue(state.fitmentForm, input.dataset.fitmentInput);
        input.value = value ?? "";
    });
}

function normalizeFitmentText(value) {
    const normalized = String(value || "").trim();
    return normalized || null;
}

function normalizeFitmentNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatFitmentNumber(value, suffix = "") {
    if (value === null || value === undefined || value === "") return fitmentEmptyValue();
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fitmentEmptyValue();
    const formatted = Number.isInteger(numeric) ? numeric.toFixed(0) : String(numeric);
    return suffix ? `${formatted} ${suffix}` : formatted;
}

function fitmentSubtitle(overview) {
    const title = overview?.vehicle?.title || fitmentEmptyValue();
    if (locale === "ru") {
        return `Предварительные данные для ${title} помогут подготовить будущую техническую проверку совместимости`;
    }
    return `Preliminary data for ${title} helps prepare a future technical compatibility check`;
}

function fitmentPayload() {
    return {
        expected_vehicle_revision: state.fitmentOverview?.vehicle_revision,
        expected_rim_revision: state.fitmentOverview?.rim_revision,
        vehicle: {
            make: normalizeFitmentText(state.fitmentForm.vehicle.make),
            model: normalizeFitmentText(state.fitmentForm.vehicle.model),
            year: normalizeFitmentNumber(state.fitmentForm.vehicle.year),
            body: normalizeFitmentText(state.fitmentForm.vehicle.body),
            generation: normalizeFitmentText(state.fitmentForm.vehicle.generation),
            modification: normalizeFitmentText(state.fitmentForm.vehicle.modification),
            market: normalizeFitmentText(state.fitmentForm.vehicle.market),
        },
        rim: {
            brand: normalizeFitmentText(state.fitmentForm.rim.brand),
            model: normalizeFitmentText(state.fitmentForm.rim.model),
            sku: normalizeFitmentText(state.fitmentForm.rim.sku),
            product_url: normalizeFitmentText(state.fitmentForm.rim.product_url),
            bolt_count: normalizeFitmentNumber(state.fitmentForm.rim.bolt_count),
            pcd_mm: normalizeFitmentNumber(state.fitmentForm.rim.pcd_mm),
            wheel_diameter_in: normalizeFitmentNumber(state.fitmentForm.rim.wheel_diameter_in),
            wheel_width_j: normalizeFitmentNumber(state.fitmentForm.rim.wheel_width_j),
            center_bore_mm: normalizeFitmentNumber(state.fitmentForm.rim.center_bore_mm),
            offset_et_mm: normalizeFitmentNumber(state.fitmentForm.rim.offset_et_mm),
        },
    };
}

function fitmentValuesEqual(current, incoming) {
    if (current === null || current === undefined || current === "") {
        return incoming === null || incoming === undefined || incoming === "";
    }
    if (incoming === null || incoming === undefined || incoming === "") {
        return current === null || current === undefined || current === "";
    }
    if (typeof current === "number" || typeof incoming === "number") {
        const left = Number(current);
        const right = Number(incoming);
        return Number.isFinite(left) && Number.isFinite(right) ? left === right : current === incoming;
    }
    return current === incoming;
}

function fitmentPreviewMetaFor(path, source) {
    const [scope, fieldName] = path.split(".");
    const provenanceKey = scope === "vehicle" ? "vehicle_provenance" : "rim_provenance";
    const currentMeta = state.fitmentOverview?.[provenanceKey]?.[fieldName] || {};
    return {
        source,
        confidence: Number(currentMeta.confidence || 1),
        is_user_confirmed: true,
    };
}

function applyDemoFitmentSave(payload) {
    const nextOverview = JSON.parse(
        JSON.stringify(state.fitmentOverview || buildDefaultDemoFitmentOverview())
    );
    let vehicleChanged = false;
    let rimChanged = false;
    let vehicleConfirmed = false;
    let rimConfirmed = false;

    for (const scope of Object.keys(FITMENT_PREVIEW_FIELD_CONFIG)) {
        const fields = FITMENT_PREVIEW_FIELD_CONFIG[scope];
        const provenanceKey = scope === "vehicle" ? "vehicle_provenance" : "rim_provenance";
        for (const fieldName of fields) {
            const path = `${scope}.${fieldName}`;
            const incomingValue = payload?.[scope]?.[fieldName] ?? null;
            const currentValue = nextOverview?.[scope]?.[fieldName] ?? null;
            if (!fitmentValuesEqual(currentValue, incomingValue)) {
                nextOverview[scope][fieldName] = incomingValue;
                nextOverview[provenanceKey][fieldName] = fitmentPreviewMetaFor(path, "user_edited");
                if (scope === "vehicle") vehicleChanged = true;
                else rimChanged = true;
                continue;
            }
            if (
                incomingValue !== null &&
                incomingValue !== "" &&
                !nextOverview?.[provenanceKey]?.[fieldName]?.is_user_confirmed
            ) {
                nextOverview[provenanceKey][fieldName] = fitmentPreviewMetaFor(path, "user_confirmed");
                if (scope === "vehicle") vehicleConfirmed = true;
                else rimConfirmed = true;
            }
        }
    }

    if (vehicleChanged || vehicleConfirmed) nextOverview.vehicle_revision += 1;
    if (rimChanged || rimConfirmed) nextOverview.rim_revision += 1;

    nextOverview.vehicle.is_user_confirmed = ["make", "model", "year"].every(
        (fieldName) => nextOverview.vehicle_provenance?.[fieldName]?.is_user_confirmed
    );
    nextOverview.vehicle.title = demoVehicleTitle(nextOverview.vehicle);
    nextOverview.rim.pcd_display = demoPcdDisplay(nextOverview.rim);
    nextOverview.rim.has_product_url = Boolean(nextOverview.rim.product_url);
    nextOverview.rim.title = demoRimTitle(nextOverview.rim);
    nextOverview.snapshot_locked = true;
    nextOverview.readiness = demoFitmentOverviewReadiness(nextOverview);

    return nextOverview;
}

function renderFitment() {
    const loading = document.querySelector("[data-fitment-loading]");
    const error = document.querySelector("[data-fitment-error]");
    const errorText = document.querySelector("[data-fitment-error-text]");
    const message = document.querySelector("[data-fitment-message]");
    const messageText = document.querySelector("[data-fitment-message-text]");
    const shell = document.querySelector("[data-fitment-shell]");
    const subtitle = document.querySelector("[data-fitment-subtitle]");
    const previewBadge = document.querySelector("[data-fitment-preview-badge]");
    const previewNote = document.querySelector("[data-fitment-preview-note]");
    const readiness = document.querySelector("[data-fitment-readiness]");
    const readinessTitle = document.querySelector("[data-fitment-readiness-title]");
    const readinessFields = document.querySelector("[data-fitment-readiness-fields]");
    const saveButton = document.querySelector("[data-fitment-save]");
    const skipButton = document.querySelector("[data-fitment-skip]");

    if (loading) loading.dataset.visible = String(state.fitmentLoading);
    if (error) error.dataset.visible = String(Boolean(state.fitmentError));
    if (errorText) errorText.textContent = localizeErrorMessage(state.fitmentError);
    if (message) {
        message.dataset.visible = String(Boolean(state.fitmentMessage));
        message.className = `wallet-status-island tone-${state.fitmentMessageTone || "neutral"}`;
    }
    if (messageText) messageText.textContent = state.fitmentMessage || "";
    if (saveButton) saveButton.disabled = state.fitmentLoading || state.fitmentSaving;
    if (skipButton) skipButton.disabled = state.fitmentLoading || state.fitmentSaving;

    const overview = state.fitmentOverview;
    const demoMode = shouldUseDemoFitment(state.fitmentJobId);
    if (previewBadge) previewBadge.hidden = !demoMode;
    if (previewNote) previewNote.hidden = !demoMode;
    if (!overview) {
        if (shell) shell.hidden = true;
        return;
    }

    if (shell) shell.hidden = false;
    if (subtitle) subtitle.textContent = fitmentSubtitle(overview);
    if (readiness) readiness.dataset.ready = String(Boolean(overview.readiness?.ready));
    if (readinessTitle) {
        readinessTitle.textContent = overview.readiness?.ready
            ? t("fitment.readinessReady")
            : t("fitment.readinessMissing");
    }
    if (readinessFields) {
        const missing = overview.readiness?.missing_fields || [];
        const unconfirmed = overview.readiness?.unconfirmed_fields || [];
        if (missing.length) {
            readinessFields.textContent = missing.map(fitmentFieldLabel).join(" · ");
        } else if (unconfirmed.length) {
            readinessFields.textContent = `${t("fitment.readinessUnconfirmed")}: ${unconfirmed
                .map(fitmentFieldLabel)
                .join(" · ")}`;
        } else {
            readinessFields.textContent =
                locale === "ru"
                    ? "Можно будет запускать отдельную проверку позже"
                    : "A separate check can be started later";
        }
    }
    document.querySelector("[data-fitment-vehicle-title]")?.replaceChildren(
        document.createTextNode(overview.vehicle?.title || fitmentEmptyValue())
    );
    document.querySelector("[data-fitment-card-vehicle-title]")?.replaceChildren(
        document.createTextNode(overview.vehicle?.title || fitmentEmptyValue())
    );
    document.querySelector("[data-fitment-card-vehicle-meta]")?.replaceChildren(
        document.createTextNode(fitmentVehicleMeta(overview))
    );
    document.querySelector("[data-fitment-card-rim-title]")?.replaceChildren(
        document.createTextNode(overview.rim?.title || fitmentEmptyValue())
    );
    document.querySelector("[data-fitment-card-rim-meta]")?.replaceChildren(
        document.createTextNode(fitmentRimMeta(overview))
    );
    document.querySelector("[data-fitment-card-source-title]")?.replaceChildren(
        document.createTextNode(fitmentSourceValue(overview))
    );
    document.querySelector("[data-fitment-basic-pcd]")?.replaceChildren(
        document.createTextNode(overview.rim?.pcd_display || fitmentEmptyValue())
    );
    document.querySelector("[data-fitment-basic-center-bore]")?.replaceChildren(
        document.createTextNode(formatFitmentNumber(overview.rim?.center_bore_mm, "мм"))
    );
    document.querySelector("[data-fitment-basic-diameter]")?.replaceChildren(
        document.createTextNode(
            overview.rim?.wheel_diameter_in !== null && overview.rim?.wheel_diameter_in !== undefined
                ? `R${formatFitmentNumber(overview.rim?.wheel_diameter_in)}`
                : fitmentEmptyValue()
        )
    );
    document.querySelector("[data-fitment-basic-width]")?.replaceChildren(
        document.createTextNode(
            overview.rim?.wheel_width_j !== null && overview.rim?.wheel_width_j !== undefined
                ? `${formatFitmentNumber(overview.rim?.wheel_width_j)}J`
                : fitmentEmptyValue()
        )
    );
    document.querySelector("[data-fitment-basic-offset]")?.replaceChildren(
        document.createTextNode(formatFitmentNumber(overview.rim?.offset_et_mm, "мм"))
    );
    syncFitmentFormInputs();
    renderFitmentCandidates();
}

async function loadFitmentOverview(jobId) {
    if (!jobId) return;
    state.fitmentLoading = true;
    state.fitmentError = "";
    state.fitmentMessage = "";
    renderFitment();
    try {
        if (shouldUseDemoFitment(jobId)) {
            const overview = loadDemoFitmentOverview() || buildDefaultDemoFitmentOverview();
            persistDemoFitmentOverview(overview);
            state.fitmentOverview = overview;
            state.fitmentForm = fitmentFormFromOverview(overview);
            return;
        }
        const response = await fetch(withIdentityQuery(`${state.apiBaseUrl}/jobs/${jobId}/fitment`), {
            headers: withAuthHeaders(),
        });
        if (!response.ok) throw new Error(await parseApiError(response));
        const overview = await response.json();
        state.fitmentOverview = overview;
        state.fitmentForm = fitmentFormFromOverview(overview);
    } catch (error) {
        state.fitmentOverview = null;
        state.fitmentForm = createEmptyFitmentForm();
        state.fitmentError = error?.message || t("errors.requestFailed");
    } finally {
        state.fitmentLoading = false;
        renderFitment();
    }
}

function openFitmentView(jobId, { originView = state.view } = {}) {
    if (!jobId) return;
    state.fitmentJobId = jobId;
    state.fitmentOriginView = originView;
    state.fitmentOriginJobId = jobId;
    state.fitmentOverview = null;
    state.fitmentForm = createEmptyFitmentForm();
    state.fitmentError = "";
    state.fitmentMessage = "";
    setView("fitment");
    void loadFitmentOverview(jobId);
}

function closeFitmentView() {
    const originView = state.fitmentOriginView || "dashboard";
    const originJobId = state.fitmentOriginJobId;
    if (originView === "create") {
        showCreateScreen("result");
    }
    if (originView === "renders" && originJobId) {
        state.expandedJobId = originJobId;
    }
    setView(originView);
}

async function saveFitment(event) {
    event?.preventDefault?.();
    if (!state.fitmentJobId || state.fitmentSaving) return;
    state.fitmentSaving = true;
    state.fitmentError = "";
    state.fitmentMessage = "";
    renderFitment();
    try {
        if (shouldUseDemoFitment(state.fitmentJobId)) {
            const overview = applyDemoFitmentSave(fitmentPayload());
            persistDemoFitmentOverview(overview);
            state.fitmentOverview = overview;
            state.fitmentForm = fitmentFormFromOverview(overview);
            state.fitmentMessage = t("fitment.saveSuccess");
            state.fitmentMessageTone = "success";
            return;
        }
        const response = await fetch(
            withIdentityQuery(`${state.apiBaseUrl}/jobs/${state.fitmentJobId}/fitment`),
            {
                method: "PATCH",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(fitmentPayload()),
            }
        );
        if (!response.ok) {
            const detail = await parseApiError(response);
            throw new Error(response.status === 409 ? t("fitment.stale") : detail);
        }
        const overview = await response.json();
        state.fitmentOverview = overview;
        state.fitmentForm = fitmentFormFromOverview(overview);
        state.fitmentMessage = t("fitment.saveSuccess");
        state.fitmentMessageTone = "success";
        void loadRenderHistory({ silent: true });
    } catch (error) {
        state.fitmentError = error?.message || t("errors.requestFailed");
    } finally {
        state.fitmentSaving = false;
        renderFitment();
    }
}

async function fetchRenderHistory({ limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    const response = await fetch(apiUrl("/jobs", { includeIdentity: true, params }), {
        headers: withAuthHeaders(),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    return response.json();
}

async function parseApiError(response) {
    let detail = response.statusText || t("failed");
    try {
        const body = await response.json();
        detail = body?.detail || detail;
    } catch {
        // ignore
    }
    if (Array.isArray(detail)) {
        return detail
            .map((item) => item?.msg || item?.message || item?.type || JSON.stringify(item))
            .filter(Boolean)
            .join("; ");
    }
    if (detail && typeof detail === "object") {
        return detail.message || detail.msg || JSON.stringify(detail);
    }
    return String(detail || t("failed"));
}

function updateTopbarCaption() {
    const caption = document.querySelector("[data-topbar-caption]");
    const captionKey = state.view === "photo-guide" ? "photoGuide" : state.view;
    if (caption) caption.textContent = t(`caption.${captionKey}`);
}

function setMenuOpen(open) {
    state.menuOpen = open;
    const layer = document.querySelector("[data-menu-layer]");
    const toggle = document.querySelector("[data-menu-toggle]");
    if (layer) layer.hidden = !open;
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function setMoreOpen(open) {
    state.moreOpen = open;
    const sheet = document.querySelector("[data-more-sheet]");
    const backdrop = document.querySelector("[data-more-backdrop]");
    const toggle = document.querySelector("[data-more-toggle]");
    if (sheet) sheet.hidden = !open;
    if (backdrop) backdrop.hidden = !open;
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function setView(view) {
    state.view = view;
    if (view !== "renders") clearRenderHistoryPolling();
    document.querySelectorAll("[data-view]").forEach((el) => {
        el.hidden = el.dataset.view !== view;
    });
    document.querySelectorAll("[data-nav]").forEach((btn) => {
        const active = btn.dataset.nav === view;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-current", active ? "page" : "false");
    });
    updateTopbarCaption();
    setMenuOpen(false);
    setMoreOpen(false);
    refreshButtonsForCurrentView();
    if (view === "dashboard") {
        void loadDashboardData({ silent: true });
    } else if (view === "wallet") {
        void loadCabinet({ silent: true });
    } else if (view === "renders") {
        void loadRenderHistory({ silent: true });
    } else if (view === "fitment") {
        renderFitment();
    }
}

function setPaymentStep(step) {
    state.paymentStep = Math.max(1, Math.min(3, step));
    document.querySelectorAll("[data-step]").forEach((el) => {
        el.hidden = Number(el.dataset.step) !== state.paymentStep;
    });
    document.querySelectorAll("[data-step-tab]").forEach((tab) => {
        tab.classList.toggle("active", Number(tab.dataset.stepTab) === state.paymentStep);
    });
    renderConfirmation();
}

function setSelectedAmount(amount) {
    state.selectedAmount = normalizeTopUpAmount(amount);
    document.querySelectorAll("[data-topup-amount]").forEach((btn) => {
        btn.dataset.selected = String(Number(btn.dataset.topupAmount) === state.selectedAmount);
    });
    renderConfirmation();
}

function setWalletBusy(busy) {
    state.walletBusy = busy;
    document.querySelector("[data-pay-button]")?.toggleAttribute("disabled", busy);
    document.querySelector("[data-reset-wizard]")?.toggleAttribute("disabled", busy);
    document.querySelector("[data-refresh-invoice]")?.toggleAttribute("disabled", busy);
    document.querySelector("[data-topup-email]")?.toggleAttribute("disabled", busy);
    document.querySelectorAll("[data-topup-amount]").forEach((button) => {
        button.toggleAttribute("disabled", busy);
    });
}

function syncWalletStatusIsland(selector, textSelector, message, tone = "neutral", visible = false) {
    const island = document.querySelector(selector);
    if (!island) return;
    island.dataset.visible = String(Boolean(visible && message));
    island.className = `wallet-status-island ${tone ? `tone-${tone}` : ""}`.trim();
    island.setAttribute("aria-hidden", String(!(visible && message)));
    const text = document.querySelector(textSelector);
    if (text) text.textContent = visible && message ? message : "";
}

function renderWalletStatus() {
    syncWalletStatusIsland("[data-wallet-loading]", "[data-wallet-loading-text]", state.walletLoadingMessage, "loading", state.walletLoading);
    syncWalletStatusIsland("[data-wallet-feedback]", "[data-wallet-feedback-text]", state.walletMessage, state.walletMessageTone, Boolean(state.walletMessage));
}

function syncPaymentHistoryDetailsAction() {
    const details = document.querySelector("[data-wallet-history-details]");
    const action = document.querySelector("[data-wallet-history-toggle]");
    if (!details || !action) return;
    state.walletHistoryOpen = details.open;
    action.textContent = details.open ? t("wallet.closeHistory") : t("wallet.openHistory");
}

function setWalletLoading(visible, message = t("wallet.loading")) {
    state.walletLoading = visible;
    state.walletLoadingMessage = visible ? message : "";
    renderWalletStatus();
}

function setWalletMessage(message, tone = "neutral") {
    state.walletMessage = message;
    state.walletMessageTone = tone;
    renderWalletStatus();
}

function getLastInvoice() {
    return state.payments[0] || null;
}

function getHistoryItems() {
    return state.payments;
}

function getVisibleHistoryItems() {
    const items = getHistoryItems();
    const totalPages = Math.max(1, Math.ceil(items.length / PAYMENT_HISTORY_PAGE_SIZE));
    state.walletHistoryPage = Math.min(Math.max(state.walletHistoryPage, 0), totalPages - 1);
    const startIndex = state.walletHistoryPage * PAYMENT_HISTORY_PAGE_SIZE;
    return {
        items,
        visibleItems: items.slice(startIndex, startIndex + PAYMENT_HISTORY_PAGE_SIZE),
        totalPages,
        from: items.length ? startIndex + 1 : 0,
        to: Math.min(startIndex + PAYMENT_HISTORY_PAGE_SIZE, items.length),
    };
}

function formatPaymentStatus(status) {
    if (status === "paid") return t("paid");
    if (status === "pending") return t("pending");
    if (status === "failed" || status === "cancelled" || status === "expired") return t("failed");
    return t("created");
}

function statusTone(status) {
    if (status === "paid") return "success";
    if (status === "failed" || status === "cancelled" || status === "expired") return "warning";
    return "neutral";
}

function clearPendingRefreshTimer() {
    if (!state.pendingRefreshTimer) return;
    clearTimeout(state.pendingRefreshTimer);
    state.pendingRefreshTimer = null;
}

function getInvoiceAgeMs(invoice) {
    if (!invoice?.createdAtMs || !Number.isFinite(invoice.createdAtMs)) return null;
    return Math.max(0, Date.now() - invoice.createdAtMs);
}

function getPendingWalletMessage(invoice) {
    if (!invoice || invoice.status !== "pending") return "";
    const ageMs = getInvoiceAgeMs(invoice);
    if (ageMs !== null && ageMs >= PAYMENT_PENDING_STALE_MS) {
        return t("wallet.pendingStale");
    }
    return t("wallet.pendingFresh");
}

function schedulePendingInvoiceRefresh() {
    clearPendingRefreshTimer();
    const invoice = getLastInvoice();
    const ageMs = getInvoiceAgeMs(invoice);
    if (!invoice || invoice.status !== "pending") return;
    if (ageMs !== null && ageMs > PAYMENT_PENDING_FRESH_MS) return;
    state.pendingRefreshTimer = window.setTimeout(() => {
        state.pendingRefreshTimer = null;
        if (state.view === "wallet" && !document.hidden) {
            void loadCabinet({ silent: true });
        }
    }, PAYMENT_PENDING_AUTO_REFRESH_DELAY_MS);
}

function renderWallet() {
    const balanceValue = document.querySelector("[data-balance-value]");
    const balanceNote = document.querySelector("[data-balance-note]");
    const lastInvoice = getLastInvoice();
    const emptyBlock = document.querySelector("[data-last-invoice-empty]");
    const cardBlock = document.querySelector("[data-last-invoice-card]");
    const cardDetails = document.querySelector("[data-last-invoice-details]");
    const history = document.querySelector("[data-payment-history-list]");
    const expiryList = document.querySelector("[data-wallet-expiry-list]");
    const expiryNote = document.querySelector("[data-wallet-expiry-note]");
    const historyHint = document.querySelector("[data-wallet-history-hint]");
    const historyPager = document.querySelector("[data-wallet-history-pager]");
    const historyPageLabel = document.querySelector("[data-wallet-history-page-label]");
    const historyPrev = document.querySelector("[data-wallet-history-prev]");
    const historyNext = document.querySelector("[data-wallet-history-next]");
    const statusPill = document.querySelector("[data-last-invoice-status]");
    const headingStatus = document.querySelector("[data-payment-status]");
    const refreshButton = document.querySelector("[data-refresh-invoice]");

    if (balanceValue) balanceValue.textContent = String(state.balance ?? "0");
    if (balanceNote) {
        balanceNote.hidden = true;
        balanceNote.textContent = "";
    }

    if (!lastInvoice) {
        if (emptyBlock) emptyBlock.hidden = false;
        if (cardBlock) cardBlock.hidden = true;
        if (cardDetails) cardDetails.hidden = true;
        if (headingStatus) {
            headingStatus.textContent = state.balance === null ? t("wallet.loading") : t("wallet.noPaymentsTitle");
            headingStatus.className = "status-pill neutral";
        }
        if (refreshButton) refreshButton.hidden = true;
    } else {
        if (emptyBlock) emptyBlock.hidden = true;
        if (cardBlock) cardBlock.hidden = false;
        if (cardDetails) cardDetails.hidden = false;
        if (cardBlock) cardBlock.dataset.status = lastInvoice.status;
        if (headingStatus) {
            headingStatus.textContent = formatPaymentStatus(lastInvoice.status);
            headingStatus.className = `status-pill ${statusTone(lastInvoice.status)}`;
        }
        if (statusPill) {
            statusPill.textContent = formatPaymentStatus(lastInvoice.status);
            statusPill.className = `status-pill ${statusTone(lastInvoice.status)}`;
        }
        document.querySelector("[data-last-invoice-amount]")?.replaceChildren(document.createTextNode(formatRub(lastInvoice.amount)));
        document.querySelector("[data-last-invoice-amount-copy]")?.replaceChildren(document.createTextNode(formatRub(lastInvoice.amount)));
        document.querySelector("[data-last-invoice-email]")?.replaceChildren(document.createTextNode(lastInvoice.email || "—"));
        document.querySelector("[data-last-invoice-credits]")?.replaceChildren(document.createTextNode(`${lastInvoice.credits} ${t("credits")}`));
        document.querySelector("[data-last-invoice-state]")?.replaceChildren(document.createTextNode(formatPaymentStatus(lastInvoice.status)));
        document.querySelector("[data-last-invoice-number]")?.replaceChildren(
            document.createTextNode(
                formatTemplate(
                    lastInvoice.status === "paid"
                        ? "wallet.paidInvoice"
                        : lastInvoice.status === "failed" || lastInvoice.status === "cancelled" || lastInvoice.status === "expired"
                          ? "wallet.failedInvoice"
                          : "wallet.pendingInvoice",
                    {
                        invoiceId: String(lastInvoice.invoiceId).padStart(6, "0"),
                        amount: formatRub(lastInvoice.amount),
                    }
                )
            )
        );
        document.querySelector("[data-last-invoice-number-copy]")?.replaceChildren(document.createTextNode(`#${String(lastInvoice.invoiceId).padStart(6, "0")}`));
        document.querySelector("[data-last-invoice-meta]")?.replaceChildren(document.createTextNode(lastInvoice.createdAt));
        if (refreshButton) refreshButton.hidden = lastInvoice.status !== "pending";
    }

    if (!history) return;
    const expiryItems = buildRenderExpiryCohorts();
    if (expiryList) {
        expiryList.innerHTML = expiryItems.length
            ? renderExpiryRows(expiryItems)
            : `<div class="history-empty"><span class="history-empty-icon" aria-hidden="true">⏳</span><span>${locale === "ru" ? "Активных пакетов пока нет" : "No active render packages yet"}</span></div>`;
    }
    if (expiryNote) {
        const firstCohort = expiryItems[0] || null;
        expiryNote.hidden = !firstCohort;
        expiryNote.textContent = firstCohort
            ? (
                locale === "ru"
                    ? `Сначала будут использованы ${firstCohort.credits} рендеров со сроком ${expiryLabel(firstCohort.expiresAt)}.`
                    : `${firstCohort.credits} renders expiring ${expiryLabel(firstCohort.expiresAt)} will be used first.`
            )
            : "";
    }

    const historyState = getVisibleHistoryItems();
    if (historyHint) historyHint.textContent = t("wallet.topUpHistoryHint");
    if (!historyState.items.length) {
        history.innerHTML = `<div class="history-empty"><span class="history-empty-icon" aria-hidden="true">🧾</span><span>${t("wallet.emptyHistory")}</span></div>`;
    } else {
        history.innerHTML = historyState.visibleItems
            .map((item) => {
                return `
                    <div class="history-item payment-history-item">
                        <div>
                            <strong>${formatRub(item.amount)} · ${item.credits} ${t("credits")}</strong>
                            <div class="meta">Robokassa · ${item.createdAt}</div>
                        </div>
                        <span class="status-pill ${statusTone(item.status)}">${formatPaymentStatus(item.status)}</span>
                    </div>
                `;
            })
            .join("");
    }
    if (historyPager && historyPageLabel && historyPrev && historyNext) {
        const hasMultiplePages = historyState.totalPages > 1;
        historyPager.hidden = !hasMultiplePages;
        historyPageLabel.textContent = formatTemplate("wallet.pageRange", {
            from: historyState.from,
            to: historyState.to,
            total: historyState.items.length,
        });
        historyPrev.disabled = state.walletHistoryPage === 0;
        historyNext.disabled = state.walletHistoryPage >= historyState.totalPages - 1;
    }

    document.querySelectorAll("[data-topup-amount]").forEach((button) => {
        const amount = normalizeTopUpAmount(button.dataset.topupAmount);
        const credits = Number(button.dataset.topupCredits || creditsForAmount(amount));
        const name = button.querySelector(".package-name");
        const meta = button.querySelector("[data-topup-meta]");
        if (name) name.textContent = formatRub(amount);
        if (meta) meta.textContent = topUpMeta(credits);
        button.dataset.selected = String(amount === state.selectedAmount);
    });

    renderWalletStatus();
    syncPaymentHistoryDetailsAction();
}

function renderConfirmation() {
    const credits = creditsForAmount(state.selectedAmount);
    document.querySelector("[data-topup-summary-title]")?.replaceChildren(
        document.createTextNode(getTopUpPackage(state.selectedAmount) ? t("wallet.summaryPackageTitle") : t("wallet.summaryCustomTitle"))
    );
    document.querySelector("[data-topup-summary-meta]")?.replaceChildren(
        document.createTextNode(
            formatTemplate("wallet.packageSummary", {
                amount: formatRub(state.selectedAmount),
                credits,
            })
        )
    );
}

function syncEmailInput() {
    const emailInput = document.querySelector("[data-topup-email]");
    if (emailInput && emailInput.value !== state.email) {
        emailInput.value = state.email;
    }
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function hasFrontendAuth() {
    return Boolean(getIdentitySearchParams().toString() || getWebsiteAuthToken());
}

function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
    if (sameDay && locale === "ru") return `Сегодня, ${time}`;
    return date.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function humanRenderTitle(job) {
    const vehicle = job?.render_input_snapshot?.vehicle || job?.vehicle || job?.vehicle_identity || job?.metadata?.vehicle;
    const makeModel = [vehicle?.make, vehicle?.model].filter(Boolean).join(" ");
    return makeModel || (locale === "ru" ? "Виртуальная примерка" : "Virtual render");
}

function rimSummaryForJob(job) {
    const rim = job?.render_input_snapshot?.rim;
    if (!rim) return "";
    if (rim.pcd_display) {
        return `${rim.wheel_diameter_in}" / ${rim.wheel_width_j}J / ${rim.pcd_display}`;
    }
    if (rim.wheel_diameter_in && rim.wheel_width_j && rim.bolt_count && rim.pcd_mm) {
        return `${rim.wheel_diameter_in}" / ${rim.wheel_width_j}J / ${rim.bolt_count}×${rim.pcd_mm}`;
    }
    return "";
}

function paymentDateForDisplay(payment) {
    return payment?.paidAtIso || payment?.createdAtIso || "";
}

function addDays(isoString, days) {
    const source = new Date(isoString);
    if (Number.isNaN(source.getTime())) return "";
    source.setDate(source.getDate() + days);
    return source.toISOString();
}

function formatShortDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    if (locale === "ru") {
        return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    }
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function expiryLabel(value) {
    const formatted = formatShortDate(value);
    if (!formatted) return "";
    return locale === "ru" ? `до ${formatted}` : `until ${formatted}`;
}

function buildRenderExpiryCohorts() {
    const cohorts = [];
    if (state.starterGrant?.credits > 0) {
        cohorts.push({
            key: "starter_grant",
            credits: state.starterGrant.credits,
            expiresAt: state.starterGrant.expiresAtIso || addDays(state.starterGrant.createdAtIso, 30),
            meta: locale === "ru"
                ? `Стартовый пакет · начислено ${formatShortDate(state.starterGrant.createdAtIso)}`
                : `Starter grant · added ${formatShortDate(state.starterGrant.createdAtIso)}`,
        });
    }
    state.payments
        .filter((payment) => payment.status === "paid" && Number(payment.credits || 0) > 0)
        .forEach((payment) => {
            const paidAt = paymentDateForDisplay(payment);
            cohorts.push({
                key: `payment_${payment.invoiceId}`,
                credits: Number(payment.credits || 0),
                expiresAt: addDays(paidAt, 30),
                meta: locale === "ru"
                    ? `Пакет ${formatRub(payment.amount)} · оплачен ${formatShortDate(paidAt)}`
                    : `Package ${formatRub(payment.amount)} · paid ${formatShortDate(paidAt)}`,
            });
        });
    return cohorts
        .filter((item) => item.credits > 0 && item.expiresAt)
        .sort((left, right) => Date.parse(left.expiresAt) - Date.parse(right.expiresAt));
}

function renderExpiryRows(items) {
    return items.map((item) => `
        <div class="wallet-expiry-row">
            <div>
                <strong>${escapeHtml(`${item.credits} ${t("credits")}`)}</strong>
                <div class="meta">${escapeHtml(item.meta)}</div>
            </div>
            <div class="wallet-expiry-date">${escapeHtml(expiryLabel(item.expiresAt))}</div>
        </div>
    `).join("");
}

function resultUrlForJob(job) {
    const guestUrl = guestRenderAssetUrl(job, "result");
    if (guestUrl) return guestUrl;
    return job?.assets?.result?.url || job?.result_url || "";
}

function canUseIdentityAssetUrls() {
    return Boolean(getIdentitySearchParams().toString());
}

function hasAssetSource(job, kind) {
    if (!job) return false;
    if (isGuestRenderJob(job)) return Boolean(guestRenderAssetUrl(job, kind));
    if (kind === "original") return Boolean(job?.assets?.car_original);
    if (kind === "result") return Boolean(resultUrlForJob(job) || job?.assets?.result);
    return false;
}

function assetDownloadUrlForJob(job, kind) {
    const guestUrl = guestRenderAssetUrl(job, kind);
    if (guestUrl) return guestUrl;
    const assetKey = kind === "original" ? "car_original" : kind;
    if (!job?.assets?.[assetKey]) return "";
    const downloadUrl = job.assets[assetKey].download_url;
    if (!downloadUrl) return "";
    return downloadUrl.startsWith("/")
        ? apiUrl(downloadUrl, { includeIdentity: true })
        : withIdentityQuery(downloadUrl);
}

function proxiedAssetUrl(asset) {
    const assetPath = asset?.download_url;
    if (!assetPath) return "";
    if (assetPath.startsWith("/")) return apiUrl(assetPath, { includeIdentity: true });
    if (!canUseIdentityAssetUrls()) return "";
    return withIdentityQuery(assetPath);
}

function assetErrorKey(kind) {
    return kind === "original" ? "car_original" : "result";
}

function hasAssetLoadError(job, kind) {
    return Boolean(state.renderAssetErrorsByJob[job?.job_id]?.[assetErrorKey(kind)]);
}

function assetBlobUrlForJob(job, kind) {
    return state.renderAssetBlobUrlsByJob[job?.job_id]?.[kind] || "";
}

function isAssetBlobLoading(job, kind) {
    return Boolean(state.renderAssetBlobLoadingByJob[job?.job_id]?.[kind]);
}

function markAssetBlobLoading(jobId, kind, value) {
    state.renderAssetBlobLoadingByJob[jobId] = {
        ...(state.renderAssetBlobLoadingByJob[jobId] || {}),
        [kind]: value,
    };
}

async function ensureAssetBlobUrl(job, kind) {
    if (!job?.job_id || kind !== "original") return "";
    const existingBlobUrl = assetBlobUrlForJob(job, kind);
    if (existingBlobUrl) return existingBlobUrl;
    if (!getWebsiteAuthToken()) return "";
    if (isAssetBlobLoading(job, kind)) return "";

    const sourceUrl = assetDownloadUrlForJob(job, kind);
    if (!sourceUrl) return "";

    markAssetBlobLoading(job.job_id, kind, true);
    renderRenders();
    renderDashboard();

    try {
        const response = await fetch(sourceUrl, { headers: withAuthHeaders() });
        if (!response.ok) throw new Error(await parseApiError(response));
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const previousUrl = state.renderAssetBlobUrlsByJob[job.job_id]?.[kind] || "";
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        state.renderAssetBlobUrlsByJob[job.job_id] = {
            ...(state.renderAssetBlobUrlsByJob[job.job_id] || {}),
            [kind]: objectUrl,
        };
    } catch (error) {
        state.renderAssetErrorsByJob[job.job_id] = {
            ...(state.renderAssetErrorsByJob[job.job_id] || {}),
            [assetErrorKey(kind)]: true,
        };
        console.error("[DW] Failed to load history asset blob", {
            job_id: job.job_id,
            kind,
            error,
        });
    } finally {
        markAssetBlobLoading(job.job_id, kind, false);
        renderRenders();
        renderDashboard();
    }

    return assetBlobUrlForJob(job, kind);
}

function assetUrlForJob(job, kind) {
    if (!job) return "";
    const guestUrl = guestRenderAssetUrl(job, kind);
    if (guestUrl) return guestUrl;
    if (kind === "original") {
        return assetBlobUrlForJob(job, kind) || proxiedAssetUrl(job.assets?.car_original);
    }
    return resultUrlForJob(job) || proxiedAssetUrl(job.assets?.result);
}

function isAssetAvailable(job, kind) {
    return Boolean(assetUrlForJob(job, kind)) && !hasAssetLoadError(job, kind);
}

function defaultAssetViewForJob(job) {
    const savedView = state.renderAssetViewByJob[job?.job_id];
    if (HISTORY_ASSET_VIEWS.includes(savedView) && hasAssetSource(job, savedView)) {
        return savedView;
    }
    if (hasAssetSource(job, "result")) return "result";
    if (hasAssetSource(job, "original")) return "original";
    return savedView || "result";
}

function downloadUrlForJob(job) {
    const guestUrl = guestRenderAssetUrl(job, "result");
    if (guestUrl) return guestUrl;
    if (getWebsiteAuthToken()) return assetDownloadUrlForJob(job, "result") || resultUrlForJob(job);
    const assetPath = job?.assets?.result?.download_url;
    if (assetPath?.startsWith("/")) {
        return apiUrl(assetPath, { includeIdentity: true });
    }
    if (assetPath) return withIdentityQuery(assetPath);
    return resultUrlForJob(job);
}

function statusLabel(status) {
    if (status === "completed") return t("renders.completed");
    if (status === "failed") return t("renders.failed");
    return t("renders.processing");
}

function statusClass(status) {
    if (status === "completed") return "success";
    if (status === "failed") return "warning";
    return "neutral";
}

function normalizeFeedbackRecord(feedback) {
    if (!feedback || typeof feedback !== "object") return null;
    if (feedback.sentiment !== "liked" && feedback.sentiment !== "disliked") return null;
    return {
        sentiment: feedback.sentiment,
        reason: typeof feedback.reason === "string" ? feedback.reason : null,
        created_at: typeof feedback.created_at === "string" ? feedback.created_at : null,
        updated_at: typeof feedback.updated_at === "string" ? feedback.updated_at : null,
    };
}

function feedbackRecordForJob(job) {
    if (!job?.job_id) return null;
    if (Object.prototype.hasOwnProperty.call(state.feedbackByJob, job.job_id)) {
        return state.feedbackByJob[job.job_id];
    }
    return normalizeFeedbackRecord(job.feedback);
}

function feedbackSentimentForJob(job) {
    return feedbackRecordForJob(job)?.sentiment || "";
}

function feedbackReasonForJob(job) {
    return feedbackRecordForJob(job)?.reason || "";
}

function setFeedbackRecord(jobId, feedback) {
    const normalized = normalizeFeedbackRecord(feedback);
    state.feedbackByJob[jobId] = normalized;
    state.renderHistory = state.renderHistory.map((job) => (
        job.job_id === jobId ? { ...job, feedback: normalized } : job
    ));
}

function mergeHistoryFeedbackState(jobs) {
    jobs.forEach((job) => {
        if (!job?.job_id) return;
        state.feedbackByJob[job.job_id] = normalizeFeedbackRecord(job.feedback);
    });
}

function feedbackLikeAckText() {
    return locale === "ru" ? "Спасибо за оценку" : "Thanks for the rating";
}

function feedbackReasonAckText() {
    return locale === "ru" ? "✓ Спасибо, мы учтём эту оценку" : "✓ Thanks, we'll use this feedback";
}

function setFeedbackNotice(jobId, message = "") {
    state.feedbackNoticeByJob[jobId] = message;
}

function guestFeedbackRecord({ sentiment, reason = null }, previousFeedback = null) {
    const timestamp = new Date().toISOString();
    return {
        sentiment,
        reason,
        created_at: previousFeedback?.created_at || timestamp,
        updated_at: timestamp,
    };
}

function renderAssetMissingState(text = "Изображение временно недоступно") {
    return `
        <div class="render-asset-error" role="status">
            <strong>${escapeHtml(text)}</strong>
            <span>Доступные действия ниже сохранены</span>
        </div>
    `;
}

function renderHistoryViewer(job) {
    const activeView = defaultAssetViewForJob(job);
    const originalAvailable = hasAssetSource(job, "original");
    const resultAvailable = hasAssetSource(job, "result");
    const activeUrl = assetUrlForJob(job, activeView);
    const activeAvailable = isAssetAvailable(job, activeView);
    const originalBlobLoading = isAssetBlobLoading(job, "original");
    const missingLabels = [
        originalAvailable ? "" : "оригинал",
        resultAvailable ? "" : "результат",
    ].filter(Boolean);

    if (activeView === "original" && !activeUrl && !originalBlobLoading && getWebsiteAuthToken()) {
        void ensureAssetBlobUrl(job, "original");
    }

    return `
        <div class="render-viewer">
            <div class="render-segmented" role="tablist" aria-label="Сравнение изображений">
                <button type="button" data-history-view="${escapeHtml(job.job_id)}" data-asset-view="original" class="${activeView === "original" ? "active" : ""}" aria-selected="${activeView === "original"}" ${originalAvailable ? "" : "disabled"}>Оригинал</button>
                <button type="button" data-history-view="${escapeHtml(job.job_id)}" data-asset-view="result" class="${activeView === "result" ? "active" : ""}" aria-selected="${activeView === "result"}" ${resultAvailable ? "" : "disabled"}>Результат</button>
            </div>
            <div class="render-asset-frame" data-asset-frame>
                ${activeAvailable && activeUrl ? `
                    <img src="${escapeHtml(activeUrl)}" alt="${escapeHtml(activeView === "original" ? "Исходное фото" : "Результат")}" class="render-full-image" data-asset-image data-job-id="${escapeHtml(job.job_id)}" data-asset-kind="${escapeHtml(assetErrorKey(activeView))}">
                ` : originalBlobLoading ? renderAssetMissingState("Загружаем оригинал...") : renderAssetMissingState()}
            </div>
            ${missingLabels.length ? `
                <div class="render-asset-notice" role="status">
                    Недоступно: ${escapeHtml(missingLabels.join(", "))}
                </div>
            ` : ""}
        </div>
    `;
}

function renderFeedbackBlock(job) {
    const jobId = job.job_id;
    const selected = feedbackSentimentForJob(job);
    const busy = Boolean(state.feedbackBusyByJob[jobId]);
    const error = state.feedbackErrorByJob[jobId] || "";
    const selectedReason = feedbackReasonForJob(job);
    const reasonsVisible = selected === "disliked";
    const guestDemo = isGuestRenderJob(job);
    const notice = state.feedbackNoticeByJob[jobId] || "";

    return `
        <section class="render-feedback" aria-live="polite">
            <h3>Оценка результата</h3>
            <p>${guestDemo ? "Гостевой пример: фидбек остаётся локально" : "Помогите улучшить следующие примерки"}</p>
            <div class="render-feedback-actions">
                <button type="button" class="render-feedback-button like ${selected === "liked" ? "selected" : ""}" data-history-feedback="${escapeHtml(jobId)}" data-feedback-sentiment="liked" ${busy ? "disabled" : ""}>👍 Понравилось</button>
                <button type="button" class="render-feedback-button dislike ${selected === "disliked" ? "selected" : ""}" data-history-feedback="${escapeHtml(jobId)}" data-feedback-sentiment="disliked" ${busy ? "disabled" : ""}>👎 Не похоже</button>
            </div>
            <div class="render-feedback-reasons ${reasonsVisible ? "visible" : ""}">
                <div class="reason-title">Что улучшить</div>
                <div class="render-reason-grid">
                    ${FEEDBACK_REASONS.map((reason) => `
                        <button type="button" class="render-reason ${selectedReason === reason.code ? "selected" : ""}" data-history-feedback-reason="${escapeHtml(jobId)}" data-feedback-reason="${escapeHtml(reason.code)}" ${busy ? "disabled" : ""}>${escapeHtml(reason.label)}</button>
                    `).join("")}
                </div>
            </div>
            <div class="render-feedback-note" ${notice ? "" : "hidden"}>
                ${escapeHtml(notice)}
            </div>
            <div class="render-feedback-error" ${error ? "" : "hidden"}>
                ${escapeHtml(localizeErrorMessage(error))}
            </div>
        </section>
    `;
}

function setAssetLoadError(jobId, kind, hasError) {
    if (!jobId || !kind) return;
    const previous = Boolean(state.renderAssetErrorsByJob[jobId]?.[kind]);
    if (previous === hasError) return;
    state.renderAssetErrorsByJob[jobId] = {
        ...(state.renderAssetErrorsByJob[jobId] || {}),
        [kind]: hasError,
    };
    if (state.expandedJobId === jobId || state.view === "renders") {
        renderRenders();
        renderDashboard();
    }
}

async function submitHistoryFeedback(jobId, sentiment, reason = undefined) {
    if (!jobId || state.feedbackBusyByJob[jobId]) return;
    const job = state.renderHistory.find((item) => item.job_id === jobId);
    if (!job) return;

    const currentFeedback = feedbackRecordForJob(job);
    const deleting = reason === undefined && currentFeedback?.sentiment === sentiment;
    if (isGuestRenderJob(job)) {
        if (deleting) {
            setFeedbackRecord(jobId, null);
            setFeedbackNotice(jobId, "");
        } else {
            const nextFeedback = guestFeedbackRecord(
                { sentiment, reason: sentiment === "disliked" ? reason || null : null },
                currentFeedback,
            );
            setFeedbackRecord(jobId, nextFeedback);
            setFeedbackNotice(
                jobId,
                nextFeedback.sentiment === "liked"
                    ? feedbackLikeAckText()
                    : nextFeedback.reason
                      ? feedbackReasonAckText()
                      : "",
            );
        }
        haptic(deleting ? "light" : "success");
        renderRenders();
        renderDashboard();
        return;
    }
    const identity = getIdentityPayload({ includeTelegramUserId: true });
    state.feedbackBusyByJob[jobId] = true;
    state.feedbackErrorByJob[jobId] = "";
    if (reason === undefined && sentiment !== "liked") {
        setFeedbackNotice(jobId, "");
    }
    renderRenders();

    try {
        const response = await fetch(apiUrl(`/jobs/${jobId}/feedback`), {
            method: deleting ? "DELETE" : "PUT",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(
                deleting
                    ? identity
                    : {
                        sentiment,
                        ...(reason !== undefined ? { reason } : {}),
                        ...identity,
                    }
            ),
        });
        if (!response.ok) throw new Error(await parseApiError(response));
        if (deleting) {
            setFeedbackRecord(jobId, null);
            setFeedbackNotice(jobId, "");
        } else {
            const data = await response.json();
            setFeedbackRecord(jobId, data.feedback || null);
            const savedFeedback = normalizeFeedbackRecord(data.feedback);
            setFeedbackNotice(
                jobId,
                savedFeedback?.sentiment === "liked"
                    ? feedbackLikeAckText()
                    : savedFeedback?.reason
                      ? feedbackReasonAckText()
                      : "",
            );
        }
        haptic(deleting ? "light" : "success");
    } catch (error) {
        state.feedbackErrorByJob[jobId] = error?.message || t("errors.requestFailed");
        haptic("warning");
    } finally {
        state.feedbackBusyByJob[jobId] = false;
        renderRenders();
        renderDashboard();
    }
}

function renderHistoryCard(job) {
    const title = humanRenderTitle(job);
    const rimSummary = rimSummaryForJob(job);
    const status = job.status || "processing";
    const guestDemo = isGuestRenderJob(job);
    const resultUrl = assetUrlForJob(job, "result");
    const createdAt = formatDateTime(job.created_at);
    const expanded = state.expandedJobId === job.job_id;
    const canOpen = status === "completed";
    const hasResult = hasAssetSource(job, "result");
    const hasOriginal = hasAssetSource(job, "original");
    const canOpenFitment = canOpen && fitmentAvailable(job);
    const summaryText = status === "failed"
        ? "Не удалось создать результат"
        : status === "completed"
          ? (hasResult || hasOriginal ? createdAt : "Изображения временно недоступны")
          : "Создаём результат";
    const subtitle = rimSummary || summaryText;
    const metaText = status === "completed" ? createdAt : "";
    const action = status === "failed"
        ? `<button type="button" class="ghost-button compact-button" data-nav="create">${t("renders.retry")}</button>`
        : canOpen
          ? `
                <div class="render-card-buttons">
                    <button type="button" class="ghost-button compact-button" data-toggle-render="${escapeHtml(job.job_id)}">${expanded ? t("renders.hide") : t("renders.open")}</button>
                    ${canOpenFitment ? `<button type="button" class="ghost-button compact-button" data-open-fitment="${escapeHtml(job.job_id)}" data-origin-view="renders">${t("fitment.openFromHistory")}</button>` : ""}
                </div>
            `
          : "";
    const downloadUrl = hasResult ? downloadUrlForJob(job) : "";
    return `
        <article class="render-card cabinet-render-card ${expanded ? "is-open" : ""}">
            <div class="render-summary">
                <div class="render-thumb-wrap">
                    ${hasResult && resultUrl ? `<img src="${escapeHtml(resultUrl)}" alt="" class="render-thumb-image" data-asset-image data-job-id="${escapeHtml(job.job_id)}" data-asset-kind="result">` : `<div class="render-thumb"></div>`}
                </div>
                <div class="render-body">
                    <div class="render-title">${escapeHtml(title)}</div>
                    <div class="render-subtitle ${rimSummary ? "render-rim-specs" : ""}">${escapeHtml(subtitle)}</div>
                    ${metaText ? `<div class="render-meta">${escapeHtml(metaText)}</div>` : ""}
                    ${guestDemo ? `<div class="render-demo-note">Гостевой пример для отладки без входа</div>` : ""}
                    <div class="status-pill ${statusClass(status)}">${statusLabel(status)}</div>
                </div>
                <div class="render-card-action">${action}</div>
            </div>
            <div class="render-disclosure" data-visible="${expanded && canOpen ? "true" : "false"}">
                ${canOpen ? `
                    <div class="render-detail-grid">
                        ${renderHistoryViewer(job)}
                        <div class="render-side">
                            <div class="render-expanded-actions">
                                ${downloadUrl ? `<a class="ghost-button compact-button" href="${escapeHtml(downloadUrl)}" download>${t("renders.download")}</a>` : ""}
                                ${canOpenFitment ? `<button type="button" class="ghost-button compact-button" data-open-fitment="${escapeHtml(job.job_id)}" data-origin-view="renders">${t("fitment.openFromHistory")}</button>` : ""}
                                <button type="button" class="ghost-button compact-button" data-nav="create">${t("renders.createAnother")}</button>
                            </div>
                            ${renderFeedbackBlock(job)}
                        </div>
                    </div>
                ` : ""}
            </div>
        </article>
    `;
}

function renderRenders() {
    const container = document.querySelector("[data-render-history]");
    if (!container) return;
    if (state.renderHistoryLoading) {
        container.innerHTML = `<div class="history-card render-empty"><strong>Загружаем историю...</strong></div>`;
        return;
    }
    if (state.renderHistoryError) {
        container.innerHTML = `<div class="history-card render-empty"><strong>${escapeHtml(localizeErrorMessage(state.renderHistoryError))}</strong></div>`;
        return;
    }
    if (!state.renderHistory.length) {
        container.innerHTML = `
            <div class="history-card render-empty">
                <div>
                    <strong>${t("renders.empty")}</strong>
                    <div class="meta">Создайте первую виртуальную примерку</div>
                </div>
            </div>
        `;
        return;
    }
    container.innerHTML = state.renderHistory.map(renderHistoryCard).join("");
    scheduleRenderHistoryPolling();
}

function clearRenderHistoryPolling() {
    if (!state.renderHistoryPollTimer) return;
    clearTimeout(state.renderHistoryPollTimer);
    state.renderHistoryPollTimer = null;
}

function hasProcessingHistoryJobs() {
    return state.renderHistory.some((job) => {
        const status = job?.status || "processing";
        return status !== "completed" && status !== "failed";
    });
}

function scheduleRenderHistoryPolling() {
    clearRenderHistoryPolling();
    if (state.view !== "renders" || document.hidden || !hasProcessingHistoryJobs()) return;
    state.renderHistoryPollTimer = setTimeout(() => {
        void refreshProcessingHistoryJobs();
    }, POLL_INTERVAL_MS);
}

function mergeStatusIntoHistory(jobId, statusData) {
    state.renderHistory = state.renderHistory.map((job) => {
        if (job.job_id !== jobId) return job;
        return {
            ...job,
            status: statusData.status || job.status,
            completed_at: statusData.completed_at || job.completed_at,
            result_url: statusData.result_url || statusData.output_image_url || job.result_url,
            error_code: statusData.error_code ?? job.error_code,
            error_message: statusData.error_message || statusData.error || job.error_message,
            feedback: statusData.feedback ?? job.feedback,
            assets: statusData.assets || job.assets,
        };
    });
    if (statusData.feedback !== undefined) {
        state.feedbackByJob[jobId] = normalizeFeedbackRecord(statusData.feedback);
    }
}

async function fetchJobStatusForHistory(jobId) {
    const response = await fetch(apiUrl(`/jobs/${jobId}`, { includeIdentity: true }), {
        headers: withAuthHeaders(),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    return response.json();
}

async function refreshProcessingHistoryJobs() {
    if (state.view !== "renders" || !hasFrontendAuth()) {
        clearRenderHistoryPolling();
        return;
    }
    const processingJobs = state.renderHistory.filter((job) => {
        const status = job?.status || "processing";
        return status !== "completed" && status !== "failed";
    });
    if (!processingJobs.length) {
        clearRenderHistoryPolling();
        return;
    }
    const updates = await Promise.allSettled(
        processingJobs.map((job) => fetchJobStatusForHistory(job.job_id))
    );
    updates.forEach((update, index) => {
        if (update.status !== "fulfilled") return;
        mergeStatusIntoHistory(processingJobs[index].job_id, update.value);
    });
    renderRenders();
    renderDashboard();
}

function renderDashboard() {
    const balance = document.querySelector("[data-dashboard-balance]");
    const latestTitle = document.querySelector("[data-latest-title]");
    const latestStatus = document.querySelector("[data-latest-status]");
    const latestContent = document.querySelector("[data-latest-content]");
    const loading = document.querySelector("[data-dashboard-loading]");
    const auth = document.querySelector("[data-dashboard-auth]");
    const error = document.querySelector("[data-dashboard-error]");
    const errorText = document.querySelector("[data-dashboard-error-text]");
    const dashboardExpiryCard = document.querySelector("[data-dashboard-expiry]");
    const dashboardExpiryList = document.querySelector("[data-dashboard-expiry-list]");
    const dashboardExpiryNote = document.querySelector("[data-dashboard-expiry-note]");
    const expiryCohorts = buildRenderExpiryCohorts();

    if (balance) balance.textContent = state.balance === null ? "—" : String(state.balance);
    if (loading) loading.dataset.visible = String(state.walletLoading || state.renderHistoryLoading);
    if (auth) auth.dataset.visible = String(!hasFrontendAuth());
    if (error) error.dataset.visible = String(Boolean(state.walletMessageTone === "error" || state.renderHistoryError));
    if (errorText) errorText.textContent = localizeErrorMessage(state.renderHistoryError || state.walletMessage || "Данные временно недоступны");
    if (dashboardExpiryCard) dashboardExpiryCard.hidden = !expiryCohorts.length;
    if (dashboardExpiryList) {
        dashboardExpiryList.innerHTML = expiryCohorts.slice(0, 2).map((item) => `
            <div class="dashboard-expiry-line">
                <div>
                    <strong>${escapeHtml(`${item.credits} ${t("credits")}`)}</strong>
                    <span>${escapeHtml(item.meta)}</span>
                </div>
                <div class="dashboard-expiry-date">${escapeHtml(expiryLabel(item.expiresAt))}</div>
            </div>
        `).join("");
    }
    if (dashboardExpiryNote) {
        dashboardExpiryNote.hidden = !expiryCohorts.length;
        dashboardExpiryNote.textContent = expiryCohorts.length
            ? (
                locale === "ru"
                    ? "Сначала используются рендеры с ближайшей датой окончания."
                    : "Renders with the nearest expiration date are used first."
            )
            : "";
    }

    if (!latestTitle || !latestStatus || !latestContent) return;
    const latest = state.renderHistory[0] || null;
    if (!latest) {
        latestTitle.textContent = "Ваша первая примерка";
        latestStatus.textContent = "Нет истории";
        latestStatus.className = "status-pill neutral";
        latestContent.innerHTML = `
            <div class="first-render-empty">
                <p>Посмотрите, как новые диски изменят автомобиль</p>
                <p>Загрузите фото автомобиля и диска — готовый результат появится здесь</p>
                <button type="button" class="ghost-button compact-button" data-nav="create">Создать первую примерку →</button>
            </div>
        `;
        return;
    }

    const title = humanRenderTitle(latest);
    const rimSummary = rimSummaryForJob(latest);
    latestTitle.textContent = latest.status === "completed" ? title : (
        latest.status === "failed" ? "Не удалось создать результат" : "Создаём виртуальную примерку"
    );
    latestStatus.textContent = statusLabel(latest.status);
    latestStatus.className = `status-pill ${statusClass(latest.status)}`;

    const resultUrl = assetUrlForJob(latest, "result");
    if (latest.status === "completed" && isAssetAvailable(latest, "result") && resultUrl) {
        latestContent.innerHTML = `
            ${rimSummary ? `<div class="latest-render-copy"><div class="latest-render-specs">${escapeHtml(rimSummary)}</div></div>` : ""}
            <img src="${escapeHtml(resultUrl)}" alt="${escapeHtml(title)}" class="latest-result-image" data-asset-image data-job-id="${escapeHtml(latest.job_id)}" data-asset-kind="result">
            <div class="latest-meta">${escapeHtml(formatDateTime(latest.completed_at || latest.created_at))}</div>
            <div class="render-card-buttons">
                <button type="button" class="ghost-button compact-button" data-nav="renders" data-expand-latest="${escapeHtml(latest.job_id)}">Открыть результат</button>
                ${fitmentAvailable(latest) ? `<button type="button" class="ghost-button compact-button" data-open-fitment="${escapeHtml(latest.job_id)}" data-origin-view="dashboard">${t("fitment.openFromHistory")}</button>` : ""}
            </div>
        `;
        return;
    }
    if (latest.status === "completed") {
        latestContent.innerHTML = `
            <p class="latest-meta">Изображение результата временно недоступно</p>
            <button type="button" class="ghost-button compact-button" data-nav="renders" data-expand-latest="${escapeHtml(latest.job_id)}">Открыть детали</button>
        `;
        return;
    }
    if (latest.status === "failed") {
        latestContent.innerHTML = `
            <p class="latest-meta">Попробуйте создать виртуальную примерку ещё раз</p>
            <button type="button" class="ghost-button compact-button" data-nav="create">Попробовать ещё раз</button>
        `;
        return;
    }
    latestContent.innerHTML = `<p class="latest-meta">Готовый результат появится здесь автоматически</p>`;
}

async function loadRenderHistory({ silent = false } = {}) {
    if (!hasFrontendAuth()) {
        state.renderHistoryLoading = false;
        state.renderHistory = guestRenderHistory();
        state.renderHistoryError = "";
        state.expandedJobId = state.renderHistory[0]?.job_id || "";
        mergeHistoryFeedbackState(state.renderHistory);
        renderRenders();
        renderDashboard();
        return;
    }
    state.renderHistoryLoading = !silent;
    state.renderHistoryError = "";
    renderRenders();
    renderDashboard();
    try {
        const history = await fetchRenderHistory({ limit: 20, offset: 0 });
        state.renderHistory = Array.isArray(history.jobs) ? history.jobs : [];
        mergeHistoryFeedbackState(state.renderHistory);
        if (!state.renderHistory.some((job) => job.job_id === state.expandedJobId)) {
            state.expandedJobId = "";
        }
    } catch (error) {
        state.renderHistoryError = error?.message || t("errors.requestFailed");
    } finally {
        state.renderHistoryLoading = false;
        renderRenders();
        renderDashboard();
        scheduleRenderHistoryPolling();
    }
}

async function loadDashboardData({ silent = false } = {}) {
    await Promise.allSettled([
        loadCabinet({ silent: true }),
        loadRenderHistory({ silent }),
    ]);
    renderDashboard();
}

async function loadCabinet({ silent = false } = {}) {
    const identity = getIdentitySearchParams();
    if (!identity.toString() && !getWebsiteAuthToken()) {
        setWalletMessage(t("wallet.authRequired"), "warning");
        renderWallet();
        renderDashboard();
        return;
    }

    clearPendingRefreshTimer();
    setWalletBusy(true);
    if (!silent) {
        setWalletLoading(true);
    } else {
        setWalletLoading(false);
    }
    try {
        const response = await fetch(apiUrl("/payments/cabinet", { includeIdentity: true }), {
            headers: withAuthHeaders(),
        });
        if (!response.ok) {
            const detail = await parseApiError(response);
            if (response.status === 403) {
                setWalletMessage(t("wallet.fallbackDisabled"), "error");
            } else {
                setWalletMessage(detail, "error");
            }
            renderWallet();
            renderDashboard();
            return;
        }
        const cabinet = await response.json();
        state.balance = cabinet.balance ?? 0;
        state.payments = (cabinet.payments || []).map((payment) => ({
            invoiceId: payment.invoice_id,
            amount: payment.amount,
            email: payment.receipt_email || payment.email || "",
            credits: payment.credits_granted || 0,
            createdAtIso: payment.created_at,
            createdAtMs: Date.parse(payment.created_at),
            createdAt: new Date(payment.created_at).toLocaleString(locale === "ru" ? "ru-RU" : "en-US"),
            paidAtIso: payment.paid_at || "",
            status: payment.status,
        }));
        state.walletHistoryPage = 0;
        state.starterGrant = cabinet.starter_grant
            ? {
                credits: Number(cabinet.starter_grant.credits || 0),
                createdAtIso: cabinet.starter_grant.created_at,
                createdAtMs: Date.parse(cabinet.starter_grant.created_at),
                createdAt: new Date(cabinet.starter_grant.created_at).toLocaleString(locale === "ru" ? "ru-RU" : "en-US"),
                expiresAtIso: cabinet.starter_grant.expires_at || "",
            }
            : null;
        const rememberedEmail = state.payments.find((payment) => payment.email)?.email || "";
        if (rememberedEmail && !state.email) {
            state.email = rememberedEmail;
            syncEmailInput();
            renderConfirmation();
        }
        const pendingMessage = getPendingWalletMessage(getLastInvoice());
        if (state.paymentReturnState === "success") {
            setWalletMessage(t("wallet.paymentSuccess"), "success");
        } else if (state.paymentReturnState === "fail") {
            setWalletMessage(t("wallet.paymentFail"), "warning");
        } else if (pendingMessage) {
            setWalletMessage(pendingMessage, "warning");
        } else {
            setWalletMessage("");
        }
        state.paymentReturnState = "";
        renderWallet();
        schedulePendingInvoiceRefresh();
        renderDashboard();
    } catch (error) {
        setWalletMessage(error?.message || t("failed"), "error");
        renderWallet();
        renderDashboard();
    } finally {
        setWalletBusy(false);
        setWalletLoading(false);
        renderDashboard();
    }
}

function openExternal(url) {
    if (HAS_TG && typeof tg?.openLink === "function") {
        tg.openLink(url);
        return;
    }
    window.open(url, "_blank", "noopener");
}

function openPaymentUrl(url) {
    if (HAS_TG && typeof tg?.openLink === "function") {
        tg.openLink(url);
        return;
    }
    window.location.href = url;
}

async function createPayment() {
    const identity = getIdentityPayload();
    if (!identity.init_data && !identity.telegram_user_id && !getWebsiteAuthToken()) {
        setWalletMessage(t("wallet.authRequired"), "warning");
        return;
    }

    setWalletBusy(true);
    setWalletMessage(t("wallet.openingPayment"));
    try {
        const response = await fetch(apiUrl("/payments/topups"), {
            method: "POST",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
                amount_rub: normalizeTopUpAmount(state.selectedAmount).toFixed(2),
                email: state.email || null,
                pricing_version: PRICING_VERSION,
                source_screen: "cabinet",
                ...identity,
            }),
        });
        if (!response.ok) {
            const detail = await parseApiError(response);
            if (response.status === 403) {
                setWalletMessage(t("wallet.fallbackDisabled"), "error");
            } else {
                setWalletMessage(detail, "error");
            }
            return;
        }
        const payment = await response.json();
        await loadCabinet();
        openPaymentUrl(payment.payment_url);
    } catch (error) {
        setWalletMessage(error?.message || t("failed"), "error");
    } finally {
        setWalletBusy(false);
    }
}

function handlePaymentReturn() {
    const paymentState = new URLSearchParams(window.location.search).get("payment");
    state.paymentReturnState = paymentState || "";
    if (paymentState === "success") {
        setWalletMessage(t("wallet.paymentSuccess"), "success");
        setView("wallet");
    } else if (paymentState === "fail") {
        setWalletMessage(t("wallet.paymentFail"), "warning");
        setView("wallet");
    }
}

function openDraftDb() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            resolve(null);
            return;
        }
        const request = indexedDB.open(DRAFT_DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
                db.createObjectStore(DRAFT_STORE_NAME, { keyPath: "kind" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveDraftFile(kind, file, bytes) {
    const db = await openDraftDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, "readwrite");
        tx.objectStore(DRAFT_STORE_NAME).put({
            kind,
            name: file.name,
            size: file.size,
            type: file.type,
            bytes,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function loadDraftFile(kind) {
    const db = await openDraftDb();
    if (!db) return null;
    const entry = await new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, "readonly");
        const request = tx.objectStore(DRAFT_STORE_NAME).get(kind);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    if (!entry?.bytes) return null;
    return {
        blob: new Blob([entry.bytes], { type: entry.type }),
        name: entry.name,
        size: entry.size,
        type: entry.type,
    };
}

async function deleteDraftFile(kind) {
    const db = await openDraftDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, "readwrite");
        tx.objectStore(DRAFT_STORE_NAME).delete(kind);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function hydrateFilesFromDraft() {
    for (const kind of ["car", "wheel"]) {
        if (state.files[kind]?.blob) continue;
        try {
            const draft = await loadDraftFile(kind);
            if (draft) {
                state.files[kind] = draft;
                renderPreviewFromFile(kind, draft);
            }
        } catch {
            // ignore
        }
    }
}

function revokePreviewUrl(kind) {
    if (state.previewUrls[kind]) {
        URL.revokeObjectURL(state.previewUrls[kind]);
        state.previewUrls[kind] = "";
    }
}

function renderPreviewFromFile(kind, fileLike) {
    revokePreviewUrl(kind);
    const img = document.querySelector(`[data-preview-img="${kind}"]`);
    const preview = document.querySelector(`[data-preview="${kind}"]`);
    const zone = document.querySelector(`[data-upload-zone="${kind}"]`);
    if (!img || !preview || !zone || !fileLike?.blob) return;
    const objectUrl = URL.createObjectURL(fileLike.blob);
    state.previewUrls[kind] = objectUrl;
    img.src = objectUrl;
    preview.hidden = false;
    zone.hidden = true;
}

function resetIdentityState() {
    state.identityDraftId = "";
    state.identityProposal = null;
    state.identityResolving = false;
    state.identityError = "";
    state.selectedVehicleIndex = 0;
    state.rimUserConfirmed = null;
    renderIdentityFlow();
}

function identityVehicles() {
    const vehicle = state.identityProposal?.vehicle;
    if (!vehicle?.primary) return [];
    const alternatives = Array.isArray(vehicle.alternatives) ? vehicle.alternatives.slice(0, 2) : [];
    return [vehicle.primary, ...alternatives];
}

function selectedVehicleCandidate() {
    const vehicles = identityVehicles();
    return vehicles[state.selectedVehicleIndex] || vehicles[0] || null;
}

function formatVehicle(candidate) {
    if (!candidate) return "—";
    const year = candidate.year ?? (
        candidate.year_start && candidate.year_end ? `${candidate.year_start}-${candidate.year_end}` : ""
    );
    return `${candidate.make} ${candidate.model}${year ? ` · ${year}` : ""}`;
}

function formatPcd(rim) {
    if (!rim) return "—";
    const pcd = Number(rim.pcd_mm);
    return `${rim.bolt_count}×${Number.isInteger(pcd) ? pcd.toFixed(0) : pcd}`;
}

function formatIdentityNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return Number.isInteger(numeric) ? numeric.toFixed(0) : String(numeric);
}

function formatRim(rim) {
    if (!rim) return "—";
    return `${formatIdentityNumber(rim.wheel_diameter_in)}" · ${formatIdentityNumber(rim.wheel_width_j)}J · ${formatPcd(rim)}`;
}

function confidenceLabel(confidence) {
    const value = Number(confidence || 0);
    if (value >= 0.85) return "уверенность высокая";
    if (value >= 0.65) return "уверенность средняя";
    return "уверенность низкая";
}

function renderIdentityFlow() {
    const ready = Boolean(state.files.car?.blob && state.files.wheel?.blob);
    const action = document.querySelector("[data-identity-action]");
    if (action) action.hidden = !ready || Boolean(state.identityProposal) || state.identityResolving;

    const flow = document.querySelector("[data-identity-flow]");
    const loading = document.querySelector("[data-identity-loading]");
    const error = document.querySelector("[data-identity-error]");
    const errorTitle = document.querySelector("[data-identity-error-title]");
    const errorText = document.querySelector("[data-identity-error-text]");
    const errorAction = document.querySelector("[data-identity-error-action]");
    const errorRetry = document.querySelector("[data-identity-error-retry]");
    const confirmations = document.querySelector("[data-identity-confirmations]");
    const review = document.querySelector("[data-identity-review]");
    const hasFlow = state.identityResolving || state.identityError || state.identityProposal;
    if (flow) flow.hidden = !hasFlow;
    if (loading) loading.dataset.visible = String(state.identityResolving);
    if (error) error.dataset.visible = String(Boolean(state.identityError));
    const identityErrorView = state.identityError ? classifyIdentityError(state.identityError) : null;
    if (errorTitle && identityErrorView) errorTitle.textContent = identityErrorView.title;
    if (errorText && identityErrorView) errorText.textContent = identityErrorView.body;
    if (errorAction) {
        errorAction.hidden = !identityErrorView?.showPrimaryAction;
        if (identityErrorView?.showPrimaryAction) {
            errorAction.textContent = identityErrorView.primaryActionLabel;
        }
    }
    if (errorRetry && identityErrorView) {
        errorRetry.textContent = identityErrorView.retryLabel;
    }

    const hasProposal = Boolean(state.identityProposal && !state.identityResolving);
    if (confirmations) confirmations.hidden = !hasProposal;
    if (review) review.hidden = !hasProposal;
    if (!hasProposal) {
        refreshButtonsForCurrentView();
        return;
    }

    const vehicles = identityVehicles();
    const selectedVehicle = selectedVehicleCandidate();
    const rim = state.identityProposal.rim;
    const vehicleOptions = document.querySelector("[data-vehicle-options]");
    if (vehicleOptions) {
        vehicleOptions.innerHTML = vehicles
            .slice(0, 3)
            .map((candidate, index) => {
                const selected = index === state.selectedVehicleIndex;
                const actionText = selected ? "✓ Верно" : "Выбрать";
                return `
                    <button type="button" class="identity-choice" data-vehicle-choice="${index}" data-selected="${selected}">
                        <span>${escapeHtml(formatVehicle(candidate))}</span>
                        <small>${escapeHtml(actionText)}</small>
                    </button>
                `;
            })
            .join("");
    }

    const vehicleConfidence = document.querySelector("[data-vehicle-confidence]");
    if (vehicleConfidence) vehicleConfidence.textContent = confidenceLabel(selectedVehicle?.confidence);
    const rimConfidence = document.querySelector("[data-rim-confidence]");
    if (rimConfidence) rimConfidence.textContent = confidenceLabel(rim?.confidence);
    document.querySelector("[data-rim-diameter]")?.replaceChildren(
        document.createTextNode(`${formatIdentityNumber(rim?.wheel_diameter_in)}"`)
    );
    document.querySelector("[data-rim-width]")?.replaceChildren(
        document.createTextNode(`${formatIdentityNumber(rim?.wheel_width_j)}J`)
    );
    document.querySelector("[data-rim-pcd]")?.replaceChildren(document.createTextNode(formatPcd(rim)));
    document.querySelector("[data-review-vehicle]")?.replaceChildren(
        document.createTextNode(formatVehicle(selectedVehicle))
    );
    document.querySelector("[data-review-rim]")?.replaceChildren(document.createTextNode(formatRim(rim)));
    document.querySelector("[data-rim-uncertain-note]")?.toggleAttribute(
        "hidden",
        state.rimUserConfirmed !== false
    );
    document.querySelectorAll("[data-rim-confirm]").forEach((button) => {
        button.dataset.selected = String(
            state.rimUserConfirmed !== null &&
            (button.dataset.rimConfirm === "true") === state.rimUserConfirmed
        );
    });
    const createRenderButton = document.querySelector("[data-create-render]");
    if (createRenderButton) createRenderButton.disabled = state.rimUserConfirmed === null;
    refreshButtonsForCurrentView();
}

function showCreateScreen(name) {
    state.createScreen = name;
    document.querySelectorAll("[data-create-screen]").forEach((el) => {
        el.hidden = el.dataset.createScreen !== name;
    });
    document.querySelector("[data-step-indicator]")?.replaceChildren(document.createTextNode(name === "result" ? t("steps.result") : t("steps.upload")));
    refreshButtonsForCurrentView();
}

let mainButtonHandler = null;
let fallbackButton = null;
let backButtonHandler = null;

function ensureFallbackButton() {
    if (fallbackButton) return fallbackButton;
    fallbackButton = document.createElement("button");
    fallbackButton.type = "button";
    fallbackButton.className = "fallback-button";
    fallbackButton.hidden = true;
    fallbackButton.addEventListener("click", () => {
        if (mainButtonHandler) mainButtonHandler();
    });
    document.body.appendChild(fallbackButton);
    return fallbackButton;
}

function setMainButton({ text, enabled = true, onClick = null }) {
    mainButtonHandler = onClick;
    if (HAS_TG && tg.MainButton) {
        tg.MainButton.setText(text);
        if (enabled) tg.MainButton.enable();
        else tg.MainButton.disable();
        tg.MainButton.offClick();
        if (onClick) tg.MainButton.onClick(onClick);
        tg.MainButton.show();
        return;
    }
    const btn = ensureFallbackButton();
    btn.textContent = text;
    btn.disabled = !enabled;
    btn.hidden = !onClick;
}

function hideMainButton() {
    mainButtonHandler = null;
    if (HAS_TG && tg.MainButton) {
        tg.MainButton.offClick();
        tg.MainButton.hide();
    } else if (fallbackButton) {
        fallbackButton.hidden = true;
    }
}

function setBackButton(onClick) {
    backButtonHandler = onClick;
    if (!SUPPORTS_BACK_BUTTON) return;
    tg.BackButton.offClick();
    if (onClick) {
        tg.BackButton.onClick(onClick);
        tg.BackButton.show();
    } else {
        tg.BackButton.hide();
    }
}

function refreshButtonsForCurrentView() {
    if (state.view === "fitment") {
        hideMainButton();
        setBackButton(() => closeFitmentView());
        return;
    }

    if (state.view !== "create") {
        hideMainButton();
        setBackButton(null);
        return;
    }

    if (state.createScreen === "upload") {
        const ready = Boolean(state.files.car?.blob && state.files.wheel?.blob);
        const hasProposal = Boolean(state.identityProposal);
        const needsRimChoice = hasProposal && state.rimUserConfirmed === null;
        const disabled = !ready || state.submitting || state.identityResolving || needsRimChoice;
        setBackButton(null);
        setMainButton({
            text: hasProposal ? t("create.createRender") : t("create.detectIdentity"),
            enabled: !disabled,
            onClick: !disabled ? (hasProposal ? submitJob : resolveIdentity) : null,
        });
        return;
    }

    if (state.submitting) {
        setBackButton(null);
        hideMainButton();
        return;
    }

    setBackButton(() => resetFlow());
    setMainButton({
        text: t("actions.createAnother"),
        enabled: true,
        onClick: resetFlow,
    });
}

function resetFlow() {
    state.downloading = false;
    state.sharing = false;
    state.submitting = false;
    state.files = { car: null, wheel: null };
    resetIdentityState();
    revokePreviewUrl("car");
    revokePreviewUrl("wheel");
    void deleteDraftFile("car");
    void deleteDraftFile("wheel");
    state.jobId = null;
    state.resultUrl = null;
    state.resultDownloadUrl = null;
    state.resultFileName = null;
    document.querySelectorAll("input[data-input]").forEach((input) => {
        input.value = "";
    });
    ["car", "wheel"].forEach((kind) => {
        document.querySelector(`[data-preview="${kind}"]`)?.toggleAttribute("hidden", true);
        document.querySelector(`[data-upload-zone="${kind}"]`)?.toggleAttribute("hidden", false);
    });
    const resultImg = document.querySelector("[data-result-img]");
    if (resultImg) {
        resultImg.hidden = true;
        resultImg.removeAttribute("src");
    }
    document.querySelector("[data-download-result]")?.toggleAttribute("hidden", true);
    document.querySelector("[data-share-result]")?.toggleAttribute("hidden", true);
    document.querySelector("[data-open-fitment-result]")?.toggleAttribute("hidden", true);
    setDownloadButtonState();
    setShareButtonState();
    showCreateScreen("upload");
    setView("create");
}

function setDownloadButtonState({ disabled = false, text = t("actions.downloadImage") } = {}) {
    const button = document.querySelector("[data-download-result]");
    if (!button) return;
    button.disabled = disabled;
    button.textContent = text;
}

function setShareButtonState({ disabled = false, text = t("actions.share") } = {}) {
    const button = document.querySelector("[data-share-result]");
    if (!button) return;
    button.disabled = disabled;
    button.textContent = text;
}

function requestTelegramDownload(url, fileName) {
    return new Promise((resolve, reject) => {
        try {
            tg.downloadFile({ url, file_name: fileName }, (accepted) => resolve(Boolean(accepted)));
        } catch (error) {
            reject(error);
        }
    });
}

async function downloadResult() {
    if (!state.resultDownloadUrl || state.downloading) return;
    state.downloading = true;
    setDownloadButtonState({ disabled: true, text: t("actions.requestingDownload") });
    try {
        if (isWebsiteAuthMode()) {
            const response = await fetch(state.resultDownloadUrl, { headers: withAuthHeaders() });
            if (!response.ok) throw new Error(await parseApiError(response));
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = state.resultFileName || "dream-wheels-result.jpg";
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
            setDownloadButtonState({ text: t("actions.downloadStarted") });
            haptic("success");
        } else if (SUPPORTS_DOWNLOAD_FILE) {
            const accepted = await requestTelegramDownload(
                state.resultDownloadUrl,
                state.resultFileName || "dream-wheels-result.jpg"
            );
            if (!accepted) {
                setDownloadButtonState({ text: t("actions.downloadCanceled") });
                haptic("warning");
            } else {
                setDownloadButtonState({ text: t("actions.downloadStarted") });
                haptic("success");
            }
        } else {
            const link = document.createElement("a");
            link.href = state.resultDownloadUrl;
            link.download = state.resultFileName || "dream-wheels-result.jpg";
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();
            setDownloadButtonState({ text: t("actions.downloadStarted") });
            haptic("success");
        }
    } catch (error) {
        console.error("[DW] download failed", error);
        setDownloadButtonState({ disabled: false, text: t("actions.downloadFailed") });
        haptic("warning");
        state.downloading = false;
        return;
    }
    setTimeout(() => {
        state.downloading = false;
        setDownloadButtonState();
    }, 1400);
}

function buildTelegramShareUrl() {
    const text = `${t("share.text")}\n${state.resultUrl}`;
    return `https://t.me/share/url?url=${encodeURIComponent(state.resultUrl)}&text=${encodeURIComponent(text)}`;
}

async function copyResultUrl() {
    if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(state.resultUrl);
}

async function shareResult() {
    if (!state.resultUrl || state.sharing) return;
    state.sharing = true;
    setShareButtonState({ disabled: true, text: t("actions.preparing") });
    try {
        const shareData = {
            title: "Dream Wheels AI",
            text: `${t("share.text")}\n${state.resultUrl}`,
            url: state.resultUrl,
        };
        if (HAS_TG && typeof tg.openTelegramLink === "function") {
            tg.openTelegramLink(buildTelegramShareUrl());
            setShareButtonState({ text: t("actions.openingTelegram") });
            haptic("success");
        } else if (HAS_TG && typeof tg.openLink === "function") {
            tg.openLink(buildTelegramShareUrl());
            setShareButtonState({ text: t("actions.openingTelegram") });
            haptic("success");
        } else if (navigator.share) {
            await navigator.share(shareData);
            setShareButtonState({ text: t("actions.sent") });
            haptic("success");
        } else {
            try {
                await copyResultUrl();
                setShareButtonState({ text: t("actions.linkCopied") });
            } catch {
                window.open(buildTelegramShareUrl(), "_blank", "noopener");
                setShareButtonState({ text: t("actions.openingLink") });
            }
            haptic("success");
        }
    } catch (error) {
        if (error?.name === "AbortError") {
            setShareButtonState({ text: t("actions.canceled") });
        } else {
            console.error("[DW] share failed", error);
            setShareButtonState({ disabled: false, text: t("actions.failed") });
        }
        haptic("warning");
    }
    setTimeout(() => {
        state.sharing = false;
        setShareButtonState();
    }, 1600);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeIdempotencyKey() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `dw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function resolveIdentity() {
    if (state.identityResolving || state.submitting) return;
    if (!state.files.car?.blob || !state.files.wheel?.blob) {
        await hydrateFilesFromDraft();
    }
    if (!state.files.car?.blob || !state.files.wheel?.blob) {
        state.identityError = t("errors.missingFiles");
        renderIdentityFlow();
        haptic("error");
        return;
    }

    state.identityResolving = true;
    state.identityError = "";
    state.identityProposal = null;
    state.identityDraftId = "";
    renderIdentityFlow();
    haptic("light");

    const formData = new FormData();
    formData.append("car_image", state.files.car.blob, state.files.car.name);
    formData.append("wheel_image", state.files.wheel.blob, state.files.wheel.name);
    const identity = getIdentityPayload({ includeTelegramUserId: true });
    if (identity.init_data) formData.append("init_data", identity.init_data);
    if (identity.telegram_user_id != null) {
        formData.append("telegram_user_id", String(identity.telegram_user_id));
    }

    try {
        const resp = await fetch(`${state.apiBaseUrl}/identity/resolve`, {
            method: "POST",
            headers: withAuthHeaders(),
            body: formData,
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            const detail = Array.isArray(data.detail)
                ? data.detail.map((entry) => entry.msg).join("; ")
                : (data.detail || `HTTP ${resp.status}`);
            throw new Error(detail);
        }
        state.identityDraftId = data.draft_id || "";
        state.identityProposal = {
            vehicle: data.vehicle,
            rim: data.rim,
            pcdDisplay: data.pcd_display,
            resolver: data.resolver,
        };
        state.selectedVehicleIndex = 0;
        state.rimUserConfirmed = null;
        haptic("success");
    } catch (error) {
        console.error("[DW] identity resolve failed", error);
        state.identityError = error?.message || t("errors.requestFailed");
        haptic("error");
    } finally {
        state.identityResolving = false;
        renderIdentityFlow();
    }
}

async function submitJob() {
    if (state.submitting) return;
    state.submitting = true;
    showCreateScreen("result");
    haptic("light");

    const statusBlock = document.querySelector("[data-status]");
    const resultBlock = document.querySelector("[data-result]");
    const errorBlock = document.querySelector("[data-error]");
    const statusText = document.querySelector("[data-status-text]");
    const statusSub = document.querySelector("[data-status-sub]");
    const statusDebug = document.querySelector("[data-status-debug]");
    const resultImg = document.querySelector("[data-result-img]");
    const errorText = document.querySelector("[data-error-text]");
    const debugLines = [];

    function pushDebug(label, extra = null) {
        const line = extra ? `${label}: ${extra}` : label;
        debugLines.push(line);
        console.log("[DW]", line);
        if (statusDebug) {
            statusDebug.hidden = false;
            statusDebug.textContent = debugLines.join("\n");
        }
    }

    function showError(message) {
        state.submitting = false;
        if (statusBlock) statusBlock.hidden = true;
        if (resultBlock) resultBlock.hidden = true;
        if (errorBlock) errorBlock.hidden = false;
        if (errorText) errorText.textContent = localizeErrorMessage(message);
        refreshButtonsForCurrentView();
        pushDebug("showError", message);
        haptic("error");
        if (state.jobId) void loadRenderHistory({ silent: true });
    }

    if (statusBlock) statusBlock.hidden = false;
    if (resultBlock) resultBlock.hidden = true;
    if (errorBlock) errorBlock.hidden = true;
    if (statusText) statusText.textContent = t("status.startingServer");
    if (statusSub) statusSub.textContent = t("status.coldStart");
    if (statusDebug) {
        statusDebug.hidden = true;
        statusDebug.textContent = "";
    }

    pushDebug("submit:start");
    pushDebug("api:base", state.apiBaseUrl);

    try {
        pushDebug("health:request");
        await fetch(apiUrl("/health"), { method: "GET" });
        pushDebug("health:ok");
    } catch {
        pushDebug("health:fail");
    }

    if (statusText) statusText.textContent = t("status.creating");
    if (statusSub) statusSub.textContent = t("status.upTo90");

    const selectedVehicle = selectedVehicleCandidate();
    const rim = state.identityProposal?.rim;
    if (!state.identityDraftId || !selectedVehicle || !rim) {
        showError(t("errors.missingIdentity"));
        return;
    }
    if (state.rimUserConfirmed === null) {
        showError(t("errors.missingRimConfirmation"));
        return;
    }

    const identity = getIdentityPayload({ includeTelegramUserId: true });
    const idempotencyKey = makeIdempotencyKey();
    const payload = {
        draft_id: state.identityDraftId,
        idempotency_key: idempotencyKey,
        vehicle: selectedVehicle,
        rim,
        rim_user_confirmed: Boolean(state.rimUserConfirmed),
    };
    if (identity.init_data) payload.init_data = identity.init_data;
    if (identity.telegram_user_id != null) payload.telegram_user_id = identity.telegram_user_id;
    pushDebug("create:key", idempotencyKey);

    try {
        pushDebug("create:request");
        const resp = await fetch(apiUrl("/jobs/from-assets"), {
            method: "POST",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
        });
        pushDebug("create:response", `status=${resp.status}`);
        const data = await resp.json().catch(() => ({}));
        pushDebug("create:body", JSON.stringify(data));
        if (!resp.ok) {
            const detail = Array.isArray(data.detail)
                ? data.detail.map((entry) => entry.msg).join("; ")
                : (data.detail || `HTTP ${resp.status}`);
            throw new Error(detail);
        }
        state.jobId = data.job_id;
        pushDebug("create:job", state.jobId);
    } catch (error) {
        showError(error.message);
        return;
    }

    if (statusText) statusText.textContent = t("status.generating");
    pushDebug("poll:start");

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        let statusData;
        try {
            pushDebug("poll:request", state.jobId);
            const response = await fetch(
                apiUrl(`/jobs/${state.jobId}/status`, { includeIdentity: true }),
                { headers: withAuthHeaders() }
            );
            statusData = await response.json();
            pushDebug("poll:response", JSON.stringify(statusData));
        } catch {
            pushDebug("poll:network-fail");
            continue;
        }

        if (statusData.status === "completed") {
            state.submitting = false;
            state.resultUrl = statusData.result_url || "";
            state.resultDownloadUrl = apiUrl(`/jobs/${state.jobId}/download`, {
                includeIdentity: true,
            });
            state.resultFileName = `dream-wheels-${state.jobId}.jpg`;
            if (statusBlock) statusBlock.hidden = true;
            if (resultBlock) resultBlock.hidden = false;
            if (resultImg && statusData.result_url) {
                resultImg.src = statusData.result_url;
                resultImg.hidden = false;
            }
            document.querySelector("[data-download-result]")?.toggleAttribute("hidden", !state.resultDownloadUrl);
            document.querySelector("[data-share-result]")?.toggleAttribute("hidden", !state.resultUrl);
            document.querySelector("[data-open-fitment-result]")?.toggleAttribute(
                "hidden",
                !fitmentAvailable(statusData)
            );
            setDownloadButtonState();
            setShareButtonState();
            refreshButtonsForCurrentView();
            void loadRenderHistory({ silent: true });
            pushDebug("poll:completed");
            haptic("success");
            return;
        }

        if (statusData.status === "failed") {
            showError(statusData.error || t("errors.generationFailed"));
            return;
        }
    }

    pushDebug("poll:timeout");
    showError(t("errors.timeout"));
}

function handleFileSelected(kind, file) {
    file.arrayBuffer().then((buffer) => {
        resetIdentityState();
        state.files[kind] = {
            blob: new Blob([buffer], { type: file.type }),
            name: file.name,
            size: file.size,
            type: file.type,
        };
        void saveDraftFile(kind, file, buffer);
        renderPreviewFromFile(kind, state.files[kind]);
        renderIdentityFlow();
        refreshButtonsForCurrentView();
    });
    haptic("light");
}

function bindEvents() {
    document.querySelector("[data-menu-toggle]")?.addEventListener("click", () => {
        setMenuOpen(!state.menuOpen);
    });
    document.querySelector("[data-more-toggle]")?.addEventListener("click", () => {
        setMoreOpen(!state.moreOpen);
    });
    document.querySelector("[data-more-close]")?.addEventListener("click", () => setMoreOpen(false));
    document.querySelector("[data-more-backdrop]")?.addEventListener("click", () => setMoreOpen(false));

    const websiteAuthButton = document.querySelector("[data-website-auth-button]");
    websiteAuthButton?.addEventListener("click", () => {
        if (state.websiteAuth) logoutWebsiteAuth();
        else void loginWithTelegram();
    });
    ["pointerdown", "mouseenter", "focus"].forEach((eventName) => {
        websiteAuthButton?.addEventListener(eventName, warmWebsiteLoginResources, { passive: true });
    });

    document.querySelector("[data-identity-error-action]")?.addEventListener("click", () => {
        document.querySelector("[data-website-auth-button]")?.click();
    });
    document.querySelector("[data-identity-error-retry]")?.addEventListener("click", () => {
        void resolveIdentity();
    });

    document.querySelectorAll("[data-nav]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            setView(button.dataset.nav);
        });
    });

    document.querySelectorAll("[data-topup-amount]").forEach((button) => {
        button.addEventListener("click", () => setSelectedAmount(Number(button.dataset.topupAmount)));
    });

    document.querySelector("[data-topup-email]")?.addEventListener("input", (event) => {
        state.email = event.target.value.trim();
        renderConfirmation();
    });

    document.querySelector("[data-pay-button]")?.addEventListener("click", createPayment);
    document.querySelector("[data-detect-identity]")?.addEventListener("click", resolveIdentity);
    document.querySelector("[data-create-render]")?.addEventListener("click", submitJob);
    document.querySelector("[data-refresh-invoice]")?.addEventListener("click", () => {
        setWalletMessage(t("wallet.refreshingInvoice"), "neutral");
        void loadCabinet();
    });
    document.querySelector("[data-wallet-history-details]")?.addEventListener("toggle", (event) => {
        const details = event.currentTarget;
        if (!(details instanceof HTMLDetailsElement)) return;
        state.walletHistoryOpen = details.open;
        syncPaymentHistoryDetailsAction();
    });
    document.querySelector("[data-wallet-history-prev]")?.addEventListener("click", () => {
        state.walletHistoryPage = Math.max(0, state.walletHistoryPage - 1);
        renderWallet();
    });
    document.querySelector("[data-wallet-history-next]")?.addEventListener("click", () => {
        state.walletHistoryPage += 1;
        renderWallet();
    });
    document.querySelector("[data-reset-wizard]")?.addEventListener("click", () => {
        state.paymentStep = 1;
        state.selectedAmount = 500;
        state.email = "";
        const input = document.querySelector("[data-topup-email]");
        if (input) input.value = "";
        setSelectedAmount(state.selectedAmount);
        renderConfirmation();
        setWalletMessage("");
        setWalletLoading(false);
    });

    document.querySelectorAll("input[data-input]").forEach((input) => {
        const kind = input.dataset.input;
        input.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            handleFileSelected(kind, file);
        });
    });

    document.querySelectorAll("[data-clear]").forEach((button) => {
        button.addEventListener("click", () => {
            const kind = button.dataset.clear;
            state.files[kind] = null;
            resetIdentityState();
            revokePreviewUrl(kind);
            void deleteDraftFile(kind);
            const input = document.querySelector(`input[data-input="${kind}"]`);
            if (input) input.value = "";
            document.querySelector(`[data-preview="${kind}"]`)?.toggleAttribute("hidden", true);
            document.querySelector(`[data-upload-zone="${kind}"]`)?.toggleAttribute("hidden", false);
            renderIdentityFlow();
            refreshButtonsForCurrentView();
        });
    });

    document.querySelector("[data-download-result]")?.addEventListener("click", downloadResult);
    document.querySelector("[data-share-result]")?.addEventListener("click", shareResult);
    document.querySelector("[data-open-fitment-result]")?.addEventListener("click", () => {
        if (!state.jobId) return;
        void openFitmentView(state.jobId, { originView: "create" });
    });
    document.querySelector("[data-fitment-back]")?.addEventListener("click", closeFitmentView);
    document.querySelector("[data-fitment-skip]")?.addEventListener("click", closeFitmentView);
    document.querySelector("[data-fitment-form]")?.addEventListener("submit", (event) => {
        void saveFitment(event);
    });
    document.querySelectorAll("[data-fitment-input]").forEach((input) => {
        input.addEventListener("input", (event) => {
            setDeepValue(state.fitmentForm, input.dataset.fitmentInput, event.target.value);
        });
    });
    document.querySelectorAll("[data-fitment-jump]").forEach((button) => {
        button.addEventListener("click", () => {
            const section = document.querySelector(
                `[data-fitment-section="${button.dataset.fitmentJump}"]`
            );
            section?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    document.addEventListener("click", (event) => {
        const navButton = event.target.closest("[data-nav]");
        if (navButton) {
            const expandLatestJobId = navButton.dataset.expandLatest;
            if (expandLatestJobId) state.expandedJobId = expandLatestJobId;
            setView(navButton.dataset.nav);
            return;
        }

        const toggleRenderButton = event.target.closest("[data-toggle-render]");
        if (toggleRenderButton) {
            const jobId = toggleRenderButton.dataset.toggleRender;
            state.expandedJobId = state.expandedJobId === jobId ? "" : jobId;
            renderRenders();
            renderDashboard();
            return;
        }

        const fitmentButton = event.target.closest("[data-open-fitment]");
        if (fitmentButton) {
            void openFitmentView(fitmentButton.dataset.openFitment, {
                originView: fitmentButton.dataset.originView || state.view,
            });
            return;
        }

        const fitmentCandidate = event.target.closest("[data-fitment-candidate]");
        if (fitmentCandidate) {
            const path = fitmentCandidate.dataset.fitmentCandidate;
            const value = fitmentCandidate.dataset.fitmentCandidateValue || "";
            setDeepValue(state.fitmentForm, path, value);
            const input = document.querySelector(`[data-fitment-input="${path}"]`);
            if (input) input.value = value;
            return;
        }

        const historyViewButton = event.target.closest("[data-history-view]");
        if (historyViewButton) {
            if (historyViewButton.disabled) return;
            const jobId = historyViewButton.dataset.historyView;
            const assetView = historyViewButton.dataset.assetView;
            if (HISTORY_ASSET_VIEWS.includes(assetView)) {
                state.renderAssetViewByJob[jobId] = assetView;
                renderRenders();
            }
            return;
        }

        const feedbackButton = event.target.closest("[data-history-feedback]");
        if (feedbackButton) {
            void submitHistoryFeedback(
                feedbackButton.dataset.historyFeedback,
                feedbackButton.dataset.feedbackSentiment
            );
            return;
        }

        const feedbackReasonButton = event.target.closest("[data-history-feedback-reason]");
        if (feedbackReasonButton) {
            const jobId = feedbackReasonButton.dataset.historyFeedbackReason;
            if (state.feedbackBusyByJob[jobId]) return;
            state.feedbackErrorByJob[jobId] = "";
            void submitHistoryFeedback(
                jobId,
                "disliked",
                feedbackReasonButton.dataset.feedbackReason || undefined
            );
            return;
        }

        const vehicleChoice = event.target.closest("[data-vehicle-choice]");
        if (vehicleChoice) {
            state.selectedVehicleIndex = Number(vehicleChoice.dataset.vehicleChoice || 0);
            renderIdentityFlow();
            haptic("light");
            return;
        }

        const rimConfirm = event.target.closest("[data-rim-confirm]");
        if (rimConfirm) {
            state.rimUserConfirmed = rimConfirm.dataset.rimConfirm === "true";
            renderIdentityFlow();
            haptic(state.rimUserConfirmed ? "success" : "warning");
            return;
        }

        const layer = document.querySelector("[data-menu-layer]");
        const toggle = document.querySelector("[data-menu-toggle]");
        if (!state.menuOpen || !layer || !toggle) return;
        if (layer.contains(event.target) || toggle.contains(event.target)) return;
        setMenuOpen(false);
    });

    document.addEventListener("error", (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || !image.matches("[data-asset-image]")) return;
        setAssetLoadError(image.dataset.jobId, image.dataset.assetKind, true);
    }, true);

    document.addEventListener("load", (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || !image.matches("[data-asset-image]")) return;
        setAssetLoadError(image.dataset.jobId, image.dataset.assetKind, false);
    }, true);
}

document.addEventListener("DOMContentLoaded", async () => {
    applyTranslations();
    initTelegram();
    updateWebsiteAuthUi();
    bindEvents();
    warmWebsiteLoginResources();
    handlePaymentReturn();

    syncEmailInput();

    setSelectedAmount(state.selectedAmount);
    renderWallet();
    renderRenders();
    renderDashboard();
    updateTopbarCaption();
    setMenuOpen(false);
    setMoreOpen(false);
    showCreateScreen("upload");

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && state.view === "wallet") {
            void loadCabinet({ silent: true });
        }
        if (!document.hidden && state.view === "renders") {
            scheduleRenderHistoryPolling();
        }
        if (document.hidden) {
            clearRenderHistoryPolling();
        }
    });

    await hydrateFilesFromDraft();
    renderIdentityFlow();
    refreshButtonsForCurrentView();
    await loadDashboardData();

    if (state.fitmentPreviewForced && !new URLSearchParams(window.location.search).get("payment")) {
        void openFitmentView(GUEST_FITMENT_DEMO_JOB_ID, { originView: "dashboard" });
    } else if (!new URLSearchParams(window.location.search).get("payment")) {
        setView("dashboard");
    }
});
