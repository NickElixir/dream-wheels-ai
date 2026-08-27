const tg = window.Telegram?.WebApp;
const HAS_TG = Boolean(tg && typeof tg.expand === "function" && tg.platform && tg.platform !== "unknown");
const APP_BUILD_ID = document.documentElement.dataset.appBuild || "unknown";

function tgSupports(version) {
    if (!HAS_TG) return false;
    if (typeof tg.isVersionAtLeast !== "function") return false;
    return tg.isVersionAtLeast(version);
}

const SUPPORTS_BACK_BUTTON = tgSupports("6.1");
const SUPPORTS_HAPTIC = tgSupports("6.1");
const SUPPORTS_DOWNLOAD_FILE = tgSupports("8.0") && typeof tg?.downloadFile === "function";

const LOCAL_API_BASE_URL = "http://127.0.0.1:10000";
const API_MODE_STORAGE_KEY = "dreamWheelsApiMode";
const DEV_TELEGRAM_USER_ID_STORAGE_KEY = "dreamWheelsDevTelegramUserId";
const WEBSITE_AUTH_STORAGE_KEY = "dreamWheelsWebsiteAuth";
const FITMENT_PREVIEW_STORAGE_KEY = "dreamWheelsFitmentPreviewState";
const FITMENT_TRANSIENT_DRAFT_STORAGE_PREFIX = "dreamWheelsFitmentTransientDraft:";
const FITMENT_TRANSIENT_DRAFT_VERSION = 1;
const FITMENT_TRANSIENT_DRAFT_TTL_MS = 30 * 60 * 1000;
const FITMENT_REGIONS = [
    ["russia", "Россия+"], ["eudm", "Европа"], ["usdm", "США+"],
    ["jdm", "Япония"], ["chdm", "Китай"], ["cdm", "Канада"],
    ["mxndm", "Мексика"], ["ladm", "Центральная и Южная Америка"],
    ["skdm", "Южная Корея"], ["sam", "Юго-Восточная Азия"],
    ["medm", "Ближний Восток"], ["nadm", "Северная Африка"],
    ["sadm", "Южная Африка"], ["audm", "Океания"],
];
const FITMENT_DIAMETER_PRESETS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const FITMENT_WIDTH_PRESETS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12];
const FITMENT_DIA_PRESETS = [54, 54.1, 56.6, 57.1, 58.5, 58.6, 60.1, 62.5, 62.6, 63.3, 63.35, 63.4, 64.1, 65.1, 66.1, 66.45, 66.5, 66.6, 67.1, 71.6, 72.6, 74.1, 75.1, 77.8, 84.1, 95.1, 98, 98.1, 98.5, 100.1, 106.1, 108.4, 108.5, 110, 110.1, 130];
const FITMENT_PCD_PRESETS = [[4, 98], [4, 100], [4, 108], [5, 98], [5, 100], [5, 108], [5, 110], [5, 112], [5, 114.3], [5, 115], [5, 120], [5, 127], [5, 130], [5, 135], [5, 139.7], [6, 114.3], [6, 130]];
const TELEGRAM_LOGIN_SCRIPT_URL = "https://oauth.telegram.org/js/telegram-login.js?5";
const WEBSITE_LOGIN_NONCE_RETRY_DELAYS_MS = [0, 350, 1000];
const WEBSITE_PROXY_BASE_URL = "/api/backend";
const PRICING_VERSION = "credits-v1";
const PHOTO_CONSENT_VERSION = "2026-06-08";
const PHOTO_CONSENT_STORAGE_KEY = "dreamWheelsPhotoConsentVersion";
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
const RIM_SOURCE_RESOLVE_TIMEOUT_MS = 20 * 1000;
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
const ANALYTICS_VISITOR_STORAGE_KEY = "dreamWheelsAnalyticsVisitor";
const ANALYTICS_ATTRIBUTION_STORAGE_KEY = "dreamWheelsAnalyticsAttribution";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

function analyticsVisitorId() {
    let visitorId = localStorage.getItem(ANALYTICS_VISITOR_STORAGE_KEY);
    if (!visitorId) {
        visitorId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(ANALYTICS_VISITOR_STORAGE_KEY, visitorId);
    }
    return visitorId;
}

function currentAttribution() {
    const now = new Date().toISOString();
    const url = new URL(window.location.href);
    const incoming = Object.fromEntries(UTM_KEYS.map((key) => [key, url.searchParams.get(key) || null]));
    const hasIncomingUtm = UTM_KEYS.some((key) => incoming[key]);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY) || "null"); } catch { /* replace corrupt state */ }
    const landing = { ...incoming, landing_url: url.href, referrer: document.referrer || null, first_seen_at: now, last_seen_at: now };
    const attribution = saved ? { ...saved, ...(hasIncomingUtm ? incoming : {}), landing_url: saved.landing_url || landing.landing_url, referrer: saved.referrer || landing.referrer, first_seen_at: saved.first_seen_at || now, last_seen_at: now } : landing;
    localStorage.setItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    return attribution;
}

function deepLinkStartParam() {
    return tg?.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get("tgWebAppStartParam") || null;
}

function trackEvent(eventName, properties = {}) {
    const identity = typeof getIdentityPayload === "function" ? getIdentityPayload({ includeTelegramUserId: true }) : {};
    const body = JSON.stringify({ visitor_id: analyticsVisitorId(), event_name: eventName, attribution: currentAttribution(), properties: { ...properties, ...(deepLinkStartParam() ? { deep_link_start_param: deepLinkStartParam() } : {}) }, ...identity });
    // Analytics must never block a render, payment, or authentication flow.
    return fetch(apiUrl("/analytics/events"), { method: "POST", headers: withAuthHeaders({ "Content-Type": "application/json" }), body, keepalive: true }).catch(() => undefined);
}

async function checkCurrentBuild() {
    try {
        const response = await fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const deployed = await response.json();
        if (deployed?.build && deployed.build !== APP_BUILD_ID) window.location.reload();
    } catch {
        // A version check must never interrupt the current user flow.
    }
}

const I18N = {
    ru: {
        auth: {
            login: "Войти через Telegram",
            loginShort: "Войти",
            loggingIn: "Входим...",
            preparing: "Подготавливаем вход...",
            logout: "Выйти",
            failed: "Не удалось войти через Telegram",
        },
        menu: {
            dashboard: "Главная",
            create: "Примерить диски",
            wallet: "Баланс",
            renders: "История рендеров",
            settings: "Настройки",
            support: "Поддержка",
            photoGuide: "Как подготовить фото",
            docs: "Документы",
        },
        dashboard: {
            lastRender: "Открыть последний результат",
            startRender: "Создать виртуальную примерку",
            createRender: "Создать виртуальную примерку",
            titleLine1: "Примерьте",
            titleLine2: "новые диски",
            titleLine3: "на своём автомобиле",
            lede: "Загрузите два фото – результат будет готов за 1–2 минуты",
            expiryTitle: "Срок действия",
            expiryPriority: "Сначала спишутся рендеры с ближайшим сроком действия",
        },
        caption: {
            dashboard: "Главная",
            create: "Создать виртуальную примерку",
            fitment: "Совместимость",
            wallet: "Баланс",
            renders: "История рендеров",
            settings: "Настройки",
            support: "Поддержка",
            photoGuide: "Как подготовить фото",
            docs: "Документы",
        },
        create: {
            eyebrow: "Виртуальная примерка",
            title: "Создать виртуальную примерку",
            uploadFormat: "Поддерживаемые форматы JPG, PNG и WebP до 10 МБ",
            detectingVehicle: "Определяем автомобиль",
            detectingVehicleHint: "Подбираем марку, модель и год по фотографии",
            productLink: "Ссылка на товар",
            productLinkOptional: "(необязательно)",
            productLinkWarning: "По ссылке попробуем определить параметры диска",
            carPhoto: "Фото автомобиля",
            carAdded: "Фото автомобиля добавлено",
            wheelPhoto: "Фото колесного диска",
            choose: "Нажмите, чтобы выбрать",
            replaceCar: "Заменить фото автомобиля",
            replaceWheel: "Заменить фото колесного диска",
            wheelAdded: "Фото колесного диска добавлено",
            wheelAddedHint: "Фото добавлено",
            productSourceMissing: "Ссылка на товар не добавлена",
            carPreviewAlt: "Превью машины",
            wheelPreviewAlt: "Превью диска",
            footerNotTelegram: "Не в Telegram",
            detectIdentity: "Определить автомобиль",
            createRender: "Создать виртуальную примерку",
        },
        warnings: {
            beta: "Dream Wheels находится в бета-режиме. Некоторые функции проходят финальное тестирование, а результат ИИ может содержать визуальные неточности.",
            parser: "Параметры определены автоматически. Проверьте найденные значения перед технической оценкой.",
            fitment: "Предварительная проверка совместимости. Результат основан на доступных технических параметрах. Перед покупкой рекомендуем подтвердить совместимость у продавца или установочного центра.",
            missingData: "Недостаточно данных для надёжной проверки совместимости. Проверьте отсутствующие параметры диска вручную.",
            generationUnavailable: "Генерация временно недоступна. Рендер не будет списан.",
        },
        photoGuide: {
            eyebrow: "Помощь",
            title: "Как подготовить фото",
            carSection: "Фото автомобиля",
            carTitle: "Покажите автомобиль целиком",
            carBadLabel: "Лучше переснять",
            carBadCaption: "Ракурс три четверти и крупный план",
            carGoodLabel: "Подходит",
            carGoodCaption: "Сбоку, в дневном свете",
            carCheck1: "Автомобиль виден целиком",
            carCheck2: "Снимите сбоку или под небольшим углом",
            carCheck3: "Все колёса попали в кадр",
            carCheck4: "Выбирайте дневной свет",
            carWarning: "Избегайте ночных кадров, сильных бликов, обрезанных колёс и посторонних объектов",
            wheelSection: "Фото колесного диска",
            wheelTitle: "Сфотографируйте диск лицевой стороной к камере",
            wheelGoodCaption: "Один диск анфас, весь рисунок в фокусе",
            wheelSetCaption: "Комплект дисков, без рук и упаковки",
            wheelCheck1: "Диск снят прямо спереди",
            wheelCheck2: "Видна вся окружность",
            wheelCheck3: "Рисунок спиц находится в фокусе",
            wheelCheck4: "Снимайте без упаковки и рук в кадре",
            wheelWarning: "Не используйте фото под углом, с сильными отражениями или частично закрытым диском",
            readyLabel: "Перед загрузкой",
            format: "Поддерживаемые форматы JPG, PNG и WebP до 10 МБ",
            readyLink: "Ссылка на товар необязательна",
            readyAction: "Начать примерку",
            carBadAlt: "Автомобиль Mercedes снят под углом, такое фото лучше переснять",
            carGoodAlt: "Автомобиль снят сбоку, оба колеса видны",
            wheelProductAlt: "Автомобильный диск снят прямо спереди на светлом фоне",
            wheelRealAlt: "Комплект автомобильных дисков снят сверху без упаковки",
        },
        consent: {
            title: "Использование фотографий",
            description: "Для создания примерки фотографии автомобиля и диска будут обработаны Dream Wheels AI и сервисом AI-генерации",
            confirmation: "Я подтверждаю, что имею право использовать выбранные фотографии и соглашаюсь с их обработкой для создания AI-примерки",
            privacy: "Политика обработки данных",
            document: "Согласие",
            cancel: "Отменить и выбрать другие фотографии",
            compact: "Продолжая, вы подтверждаете право использовать выбранные фотографии",
            processingTerms: "Условия обработки данных",
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
            generating: "Создаём примерку...",
        },
        result: {
            imageAlt: "Результат примерки",
            title: "Готово!",
            caption: "Результат примерки готов",
        },
        fitment: {
            eyebrow: "Проверка совместимости",
            title: "Проверьте, подойдут ли диски",
            subtitleFallback: "Три понятных шага: подтвердите автомобиль, проверьте параметры диска и получите предварительный вывод",
            preliminary: "Предварительно",
            openFromResult: "Проверить совместимость",
            openFromHistory: "Проверить совместимость",
            back: "Вернуться к примерке",
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
            basicsCopy: "Определено по фото — данные требуют подтверждения перед установкой",
            centerBore: "Диаметр ступичного отверстия",
            diameter: "Диаметр диска, дюймы",
            width: "Ориентировочная ширина",
            widthShort: "Ширина",
            offset: "Вылет (ET), мм",
            vehicleCard: "Автомобиль",
            vehicleCardMeta: "Определено по фото",
            rimCard: "Колесный диск",
            rimCardMeta: "Часть данных определена по фото",
            sourceCard: "Источник колесного диска",
            sourceCardMeta: "Бренд, артикул или ссылка на колесный диск",
            summaryLabel: "Сводка",
            summaryShow: "Показать сводку",
            summaryHide: "Свернуть сводку",
            jumpVehicle: "Уточнить →",
            jumpRim: "Уточнить →",
            jumpSource: "Добавить →",
            sourceClose: "Скрыть",
            sourceResolve: "Добавить источник",
            findVariants: "Подобрать версию автомобиля",
            verdictTitle: "Предварительная техническая проверка",
            check: "Проверить совместимость",
            checking: "Проверяем параметры…",
            verdictDisclaimer: "Предварительная оценка не является гарантией установки.",
            notice: "Поля необязательны и не меняют уже созданную виртуальную примерку",
            compatibilityNotChecked: "Проверка совместимости еще не проведена",
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
            boltCount: "Крепёжных отверстий",
            productUrl: "Ссылка на колесный диск",
            save: "Сохранить данные",
            skip: "Не сейчас",
            unavailable: "Для этого результата уточнение параметров пока недоступно",
            previewBadge: "Demo",
            previewNote: "Изменения сохраняются только локально в этой сессии",
            demoLiveActionsUnavailable: "В демо доступно только ручное уточнение. Создайте примерку, чтобы подобрать версию автомобиля, извлечь параметры по ссылке и запустить техническую проверку.",
        },
        actions: {
            createRender: "Создать виртуальную примерку",
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
            identityAuthTitle: "Нужно войти в аккаунт",
            identityAuthBody:
                "Мы не смогли подтвердить вход. Войдите через Telegram и повторите распознавание автомобиля.",
            identityAuthAction: "Войти через Telegram",
            identityBackendTitle: "Распознавание временно недоступно",
            identityBackendBody:
                "Сервис пока не может обработать фотографии. Попробуйте ещё раз через несколько минут.",
            identityRetryAction: "Проверить ещё раз",
            identityGenericTitle: "Не удалось определить данные",
            identityGenericBody: "Проверьте фото и повторите попытку.",
            identityConnectionTitle: "Сервис распознавания недоступен",
            identityConnectionBody: "Не удалось связаться с сервером. Проверьте подключение и повторите попытку.",
            generationFailed: "Ошибка генерации",
            timeout: "Превышено время ожидания (>110 с)",
            requestFailed: "Запрос не удался. Попробуйте ещё раз",
        },
        share: {
            text: "Моя примерка в Dream Wheels AI",
        },
        wallet: {
            eyebrow: "Кабинет",
            title: "Баланс",
            lede: "1 рендер — 1 генерация виртуальной примерки",
            gift: "Подарок",
            lastInvoiceLabel: "Последняя оплата",
            lastInvoiceTitle: "Платежей пока нет",
            lastInvoiceEmpty: "Оплат ещё не было. После первой покупки здесь появится её статус",
            invoiceAmount: "Сумма",
            invoiceNumber: "Номер оплаты",
            invoiceEmail: "Email",
            invoiceCredits: "Получено",
            invoiceState: "Состояние",
            wizardLabel: "Пополнение",
            reset: "Сбросить",
            stepAmount: "Сумма",
            stepEmail: "Email",
            stepConfirm: "Подтверждение",
            stepChooseTitle: "Выберите пакет",
            stepChooseSub: "",
            chooseAmount: "Выбор суммы",
            nextToEmail: "Продолжить",
            modePackage: "Пакет",
            modeCustom: "Своя сумма",
            customAmountLabel: "Своя сумма",
            emailLabel: "Email для чека",
            emailHint: "",
            back: "Назад",
            nextToConfirm: "Продолжить",
            confirmAmount: "Сумма",
            confirmEmail: "Email",
            confirmCredits: "Будет получено",
            confirmHint: "",
            pay: "Оплатить через Робокассу",
            payWithAmount: "Оплатить",
            emailPrivacyPrefix: "Email используется для отправки чека и обработки платежа.",
            privacyDetails: "Подробнее — в Политике обработки персональных данных",
            securePaymentTitle: "",
            securePaymentText: "",
            acceptancePrefix: "Нажимая «Оплатить», вы принимаете",
            acceptanceAnd: "и",
            offerLink: "Публичную оферту",
            refundLink: "Условия возврата",
            paymentHistory: "История платежей",
            paymentHistoryHint: "",
            openHistory: "Открыть",
            closeHistory: "Скрыть",
            availableRenders: "Доступные рендеры",
            availableRendersHint: "Сначала списываются пакеты с ближайшей датой окончания",
            topUpHistory: "История пополнений",
            topUpHistoryHint: "",
            previousPage: "Назад",
            nextPage: "Далее",
            pageRange: "{from}-{to} из {total}",
            emptyHistory: "Платежей пока нет",
            noPaymentsTitle: "Платежей пока нет",
            noPaymentsMeta: "Стартовые рендеры по команде /start действуют 30 дней и появятся в истории пополнений",
            loading: "Загружаем кабинет...",
            refreshInvoice: "Обновить статус",
            refreshingInvoice: "Обновляем статус оплаты...",
            openingPayment: "Открываем Robokassa...",
            paymentSuccess: "Оплата подтверждена. Обновляем баланс",
            paymentFail: "Платеж не завершен",
            pendingFresh: "Оплата создана. Если вы вернулись из Robokassa, обновите статус через несколько секунд",
            pendingStale: "Подтверждение оплаты ещё не получено. Обновите статус позже",
            authRequired: "Откройте Mini App в Telegram или войдите через Telegram на сайте",
            fallbackDisabled: "Вход с сайта временно недоступен",
            starterGrantTitle: "Первый подарок",
            starterGrantMeta: "{credits} — получено по команде /start",
            starterGrantBadge: "Подарок",
            summaryEmptyTitle: "Выберите пакет",
            summaryEmptyMeta: "Здесь появится выбранный пакет перед оплатой",
            summaryPackageTitle: "Выбранный пакет",
            summaryCustomTitle: "Своя сумма",
            pendingInvoice: "Оплата #{invoiceId} — {amount}",
            paidInvoice: "Оплата #{invoiceId} — {amount}",
            failedInvoice: "Оплата #{invoiceId} — {amount}",
            packageMetaDays: "{creditsLabel}",
            packageSummary: "{amount} / {creditsLabel} / 30 дней",
        },
        renders: {
            eyebrow: "Готовые работы",
            title: "История рендеров",
            lede: "Результаты и текущие статусы из вашей истории",
            empty: "Готовых рендеров пока нет. Создайте первую виртуальную примерку на главном экране",
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
            eyebrow: "Помощь",
            title: "Поддержка",
            lede: "Поможем с оплатой, возвратом или созданием примерки. Обычно отвечаем в течение 24 часов.",
            telegram: "Telegram",
            email: "Email",
            helpSection: "Инструкции",
            feedbackSection: "Связаться с нами",
            photoGuideTitle: "Как подготовить фото",
            photoGuideDescription: "Инструкция по подготовке фотографий перед загрузкой",
            refundSection: "Возврат средств",
            refundTitle: "Условия возврата",
            refundDescription: "Когда доступен возврат и как отправить обращение",
            refundSla: "Обращения по возвратам рассматриваем в течение 24 часов",
        },
        docs: {
            eyebrow: "Юридическая информация",
            title: "Документы",
            lede: "Здесь собраны условия использования сервиса, оплаты, возврата и обработки данных.",
            offer: "Публичная оферта",
            offerDescription: "Условия оказания и оплаты услуги",
            refund: "Условия возврата",
            refundDescription: "Возврат оплаты и кредитов",
            privacy: "Политика обработки данных",
            privacyDescription: "Какие данные мы используем и храним",
            consent: "Согласие на обработку данных",
            consentDescription: "Состав данных, цели и отзыв согласия",
            seller: "Реквизиты и контакты",
            sellerDescription: "Информация об исполнителе",
            edition: "Документы действуют для Dream Wheels AI. Редакция от 8 июня 2026 года.",
        },
        failed: "Сбой",
        starter: "Стартовые рендеры",
        pending: "В ожидании",
        paid: "Оплачено",
        created: "Создан",
        locale: "RU",
        credits: "рендеров",
    },
    en: {
        auth: {
            login: "Log in with Telegram",
            loginShort: "Log in",
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
        dashboard: {
            lastRender: "Open latest result",
            startRender: "Create a try-on",
            createRender: "Create a try-on",
            titleLine1: "Try on",
            titleLine2: "new wheels",
            titleLine3: "on your vehicle",
            lede: "Upload two photos – your result will be ready in 1–2 minutes",
            expiryTitle: "Expiry dates",
            expiryPriority: "Renders with the nearest expiry date are used first",
        },
        caption: {
            dashboard: "Home",
            create: "Create a try-on",
            fitment: "Fitment",
            wallet: "Balance",
            renders: "My try-ons",
            settings: "Settings",
            support: "Support",
            photoGuide: "How to prepare a photo",
            docs: "Documents",
        },
        create: {
            eyebrow: "Create a try-on",
            title: "Create a try-on",
            uploadFormat: "Supported formats JPG, PNG and WebP up to 10 MB",
            detectingVehicle: "Identifying the vehicle",
            detectingVehicleHint: "Matching the make, model, and year from the photo",
            productLink: "Product link",
            productLinkOptional: "(optional)",
            productLinkWarning: "We will try to identify wheel parameters from the link",
            carPhoto: "Vehicle photo",
            carAdded: "Vehicle photo added",
            wheelPhoto: "Wheel photo",
            choose: "Tap to choose",
            replaceCar: "Replace vehicle photo",
            replaceWheel: "Replace wheel photo",
            wheelAdded: "Wheel photo added",
            wheelAddedHint: "Photo added",
            productSourceMissing: "Product link not added",
            carPreviewAlt: "Car preview",
            wheelPreviewAlt: "Wheel preview",
            footerNotTelegram: "Not in Telegram",
            detectIdentity: "Identify the vehicle",
            createRender: "Create virtual render",
        },
        warnings: {
            beta: "Dream Wheels is in beta. Some features are in final testing, and AI results may contain visual inaccuracies.",
            parser: "Parameters were detected automatically. Review the values before the technical assessment.",
            fitment: "This is a preliminary compatibility check. It is based on the available technical parameters. Before buying, confirm compatibility with the seller or an installation centre.",
            missingData: "There is not enough data for a reliable compatibility check. Review the missing wheel parameters manually.",
            generationUnavailable: "Generation is temporarily unavailable. A render will not be charged.",
        },
        photoGuide: {
            eyebrow: "Help",
            title: "How to prepare photos",
            carSection: "Car photo",
            carTitle: "Show the whole vehicle",
            carBadLabel: "Better retake",
            carBadCaption: "Three-quarter angle and close-up",
            carGoodLabel: "Works well",
            carGoodCaption: "Side view in daylight",
            carCheck1: "The whole car is visible",
            carCheck2: "Shoot from the side or a slight angle",
            carCheck3: "All wheels are in the frame",
            carCheck4: "Choose daylight",
            carWarning: "Avoid night shots, strong glare, cropped wheels, and distracting objects",
            wheelSection: "Wheel photo",
            wheelTitle: "Photograph the wheel face-on",
            wheelGoodCaption: "One wheel facing the camera, spokes in focus",
            wheelSetCaption: "A set of wheels without hands or packaging",
            wheelCheck1: "Shoot the wheel straight on",
            wheelCheck2: "The full circle is visible",
            wheelCheck3: "The spoke pattern is in focus",
            wheelCheck4: "Shoot without packaging or hands in the frame",
            wheelWarning: "Avoid angled photos, strong reflections, or a partially covered wheel",
            readyLabel: "Before upload",
            format: "Supported formats JPG, PNG and WebP up to 10 MB",
            readyLink: "A product link is optional",
            readyAction: "Start a try-on",
            carBadAlt: "Mercedes photographed at an angle, better to retake",
            carGoodAlt: "Car photographed from the side with both wheels visible",
            wheelProductAlt: "Wheel photographed straight on against a light background",
            wheelRealAlt: "A set of wheels photographed from above without packaging",
        },
        consent: {
            title: "Photo use",
            description: "To create a try-on, your vehicle and wheel photos will be processed by Dream Wheels AI and an AI generation provider",
            confirmation: "I confirm that I have the right to use the selected photos and consent to their processing to create an AI try-on",
            privacy: "Data processing policy",
            document: "Consent",
            cancel: "Cancel and choose different photos",
            compact: "By continuing, you confirm your right to use the selected photos",
            processingTerms: "Data processing terms",
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
            openFromResult: "Check compatibility",
            openFromHistory: "Check compatibility",
            back: "Back to render",
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
            basicsCopy: "Detected from the photo — confirm the data before installation",
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
            summaryLabel: "Summary",
            summaryShow: "Show summary",
            summaryHide: "Collapse summary",
            jumpVehicle: "Refine →",
            jumpRim: "Refine →",
            jumpSource: "Add →",
            sourceClose: "Hide",
            sourceResolve: "Add source",
            findVariants: "Find vehicle version",
            verdictTitle: "Preliminary technical check",
            check: "Check compatibility",
            checking: "Checking parameters…",
            verdictDisclaimer: "A preliminary assessment is not an installation guarantee.",
            notice: "These fields are optional and do not change the existing virtual render",
            compatibilityNotChecked: "The compatibility check has not been run yet",
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
            previewBadge: "Demo",
            previewNote: "Changes are saved locally for this session only",
            demoLiveActionsUnavailable: "Demo supports manual edits only. Create a render to find a vehicle version, extract wheel parameters from a link, or run a technical check.",
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
                "We could not confirm your session. Log in with Telegram and try vehicle recognition again.",
            identityAuthAction: "Log in with Telegram",
            identityBackendTitle: "Recognition is temporarily unavailable",
            identityBackendBody:
                "The service cannot process the photos right now. Try again in a few minutes.",
            identityRetryAction: "Retry",
            identityGenericTitle: "Could not recognize the vehicle",
            identityGenericBody: "Check the photos and try again.",
            identityConnectionTitle: "Recognition service is unavailable",
            identityConnectionBody: "Could not reach the server. Check your connection and try again.",
            generationFailed: "Generation failed",
            timeout: "Timed out after 110 seconds",
            requestFailed: "Request failed. Please try again",
        },
        share: {
            text: "My Dream Wheels AI render",
        },
        wallet: {
            eyebrow: "Cabinet",
            title: "Wallet",
            lede: "Balance, last invoice, and a three-step payment flow in one place",
            gift: "Gift",
            lastInvoiceLabel: "Last invoice",
            lastInvoiceTitle: "No payments yet",
            lastInvoiceEmpty: "No payments yet. The first purchase will show up here as the last invoice",
            invoiceAmount: "Amount",
            invoiceNumber: "Invoice",
            invoiceEmail: "Email",
            invoiceCredits: "Renders",
            invoiceState: "Status",
            wizardLabel: "Top up",
            reset: "Reset",
            stepAmount: "Amount",
            stepEmail: "Email",
            stepConfirm: "Confirm",
            stepChooseTitle: "Choose a package",
            stepChooseSub: "",
            chooseAmount: "Amount selection",
            nextToEmail: "Continue",
            modePackage: "Package",
            modeCustom: "Custom",
            customAmountLabel: "Custom amount",
            emailLabel: "Receipt email",
            emailHint: "",
            back: "Back",
            nextToConfirm: "Continue",
            confirmAmount: "Amount",
            confirmEmail: "Email",
            confirmCredits: "Credits",
            confirmHint: "",
            pay: "Pay via Robokassa",
            payWithAmount: "Pay",
            emailPrivacyPrefix: "Email is used to send the receipt and process the payment.",
            privacyDetails: "Learn more in the Personal Data Processing Policy",
            securePaymentTitle: "",
            securePaymentText: "",
            acceptancePrefix: "By selecting “Pay”, you accept the",
            acceptanceAnd: "and",
            offerLink: "Public Offer",
            refundLink: "Refund Terms",
            paymentHistory: "Payment history",
            paymentHistoryHint: "",
            openHistory: "Open",
            closeHistory: "Hide",
            availableRenders: "Available renders",
            availableRendersHint: "Packages expiring sooner are spent first",
            topUpHistory: "Top-up history",
            topUpHistoryHint: "",
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
            starterGrantMeta: "{credits} renders — added on /start",
            starterGrantBadge: "Gift",
            summaryEmptyTitle: "Choose a package",
            summaryEmptyMeta: "The selected package will appear here before payment",
            summaryPackageTitle: "Selected package",
            summaryCustomTitle: "Custom amount",
            pendingInvoice: "Invoice #{invoiceId} — {amount}",
            paidInvoice: "Invoice #{invoiceId} — {amount}",
            failedInvoice: "Invoice #{invoiceId} — {amount}",
            packageMetaDays: "{creditsLabel}",
            packageSummary: "{amount} / {creditsLabel} / 30 days",
        },
        renders: {
            eyebrow: "Finished work",
            title: "My try-ons",
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
            eyebrow: "Help",
            title: "Support",
            lede: "We can help with payments, refunds, or creating a try-on. We usually respond within 24 hours.",
            telegram: "Telegram",
            email: "Email",
            helpSection: "Guides",
            feedbackSection: "Contact us",
            photoGuideTitle: "How to prepare photos",
            photoGuideDescription: "Instructions for preparing photos before upload",
            refundSection: "Refunds",
            refundTitle: "Refund terms",
            refundDescription: "When a refund is available and how to request one",
            refundSla: "Refund requests are reviewed within 24 hours",
        },
        docs: {
            eyebrow: "Legal information",
            title: "Documents",
            lede: "Terms for using the service, payments, refunds, and data processing.",
            offer: "Public offer",
            offerDescription: "Service and payment terms",
            refund: "Refund terms",
            refundDescription: "Payment and credit refunds",
            privacy: "Data processing policy",
            privacyDescription: "What data we use and store",
            consent: "Data processing consent",
            consentDescription: "Data categories, purposes, and consent withdrawal",
            seller: "Details and contacts",
            sellerDescription: "Information about the provider",
            edition: "These documents apply to Dream Wheels AI. Edition dated June 8, 2026.",
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
    const value = path.split(".").reduce((current, key) => current?.[key], I18N[locale]) ?? path;
    return typeof value === "string" ? value.replace(/[.!?…:;,]+$/u, "") : value;
}

function resolveApiBaseUrl() {
    if (!isLocalBrowser()) return WEBSITE_PROXY_BASE_URL;

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
    return storedMode === "local" ? LOCAL_API_BASE_URL : LOCAL_API_BASE_URL;
}

function isLocalBrowser() {
    return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function shouldUseBrowserApiProxy() {
    return !isLocalBrowser();
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

function loadPhotoConsent() {
    try {
        return localStorage.getItem(PHOTO_CONSENT_STORAGE_KEY) === PHOTO_CONSENT_VERSION;
    } catch (_) {
        return false;
    }
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
    websiteLoginError: "",
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
    creditPackages: [],
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
    photoConsentAccepted: loadPhotoConsent(),
    files: { car: null, wheel: null },
    previewUrls: { car: "", wheel: "" },
    identityDraftId: "",
    identityProposal: null,
    identityResolving: false,
    identityError: "",
    selectedVehicleIndex: 0,
    manualVehicle: { make: "", model: "", year: "", year_start: "", year_end: "" },
    rimProductUrl: "",
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
    renderDetailJobId: "",
    renderDetailLoading: false,
    renderDetailError: "",
    renderHistoryVisibleCount: 6,
    fitmentJobId: "",
    fitmentOriginView: "dashboard",
    fitmentOriginJobId: "",
    fitmentOverview: null,
    fitmentActiveStep: 0,
    fitmentLoading: false,
    fitmentSaving: false,
    fitmentError: "",
    fitmentMessage: "",
    fitmentMessageTone: "neutral",
    fitmentForm: createEmptyFitmentForm(),
    fitmentOverviewCollapsed: false,
    fitmentSourceOpen: false,
    fitmentSourceResolving: false,
    fitmentSourceStatus: "",
    fitmentSourceStatusTone: "neutral",
    fitmentSourceAppliedFields: [],
    fitmentSourceDetected: false,
    fitmentSourceVariants: [],
    fitmentSourceConflicts: [],
    fitmentSourceIdentity: { sourceFingerprint: null, selectedVariantSku: null, variantState: "not_applicable" },
    fitmentRimManualFields: [],
    fitmentSourceAutoResolvedForJob: "",
    fitmentSourceController: null,
    fitmentVehicleVariants: [],
    fitmentVehicleVariantsLoading: false,
    fitmentVehicleVariantApplying: false,
    fitmentLookup: { status: "idle", outcome: "" },
    fitmentCheck: null,
    fitmentChecking: false,
    fitmentAuthRequired: false,
    fitmentFormState: { status: "clean", validation: "valid", baseline: null },
    fitmentCatalogue: {
        regions: { status: "idle", items: [] },
        makes: { status: "idle", items: [] },
        models: { status: "idle", items: [] },
        years: { status: "idle", items: [] },
    },
    fitmentCatalogueRequestToken: 0,
    fitmentCatalogueControllers: {},
    fitmentCheckPollTimer: null,
    fitmentCheckPollToken: 0,
    fitmentRestoreConflict: null,
    fitmentContextByJob: {},
    fitmentContextLoadingByJob: {},
    renderHistoryPollTimer: null,
    renderAssetViewByJob: {},
    renderAssetErrorsByJob: {},
    renderAssetBlobUrlsByJob: {},
    renderAssetBlobLoadingByJob: {},
    feedbackByJob: {},
    feedbackReasonPickerByJob: {},
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
    return [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || fitmentEmptyValue();
}

function demoPcdDisplay(rim) {
    if (rim?.bolt_count && rim?.pcd_mm) return `${rim.bolt_count}×${formatIdentityNumber(rim.pcd_mm)}`;
    return null;
}

function fitmentVehicleSpecs(vehicle) {
    return [vehicle?.year, vehicle?.generation].filter(Boolean).join(" / ");
}

function demoRimTitle(rim) {
    const base = [rim?.brand, rim?.model].filter(Boolean).join(" ");
    return base || fitmentEmptyValue();
}

function fitmentRimSpecs(rim) {
    return [
        rim?.wheel_diameter_in ? `${formatIdentityNumber(rim.wheel_diameter_in)}"` : "",
        rim?.wheel_width_j ? `${formatIdentityNumber(rim.wheel_width_j)}J` : "",
        demoPcdDisplay(rim),
    ].filter(Boolean).join(" / ");
}

function fitmentPcdOptionValue(boltCount, pcdMm) {
    const bolt = Number(boltCount);
    const pcd = normalizeFitmentNumber(pcdMm);
    if (!Number.isFinite(bolt) || !Number.isFinite(pcd)) return "";
    return `${bolt}x${String(pcd)}`;
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

function fitmentTransientDraftKey(jobId = state.fitmentJobId) {
    return jobId ? `${FITMENT_TRANSIENT_DRAFT_STORAGE_PREFIX}${jobId}` : "";
}

function fitmentRevisionBaseline(overview = state.fitmentOverview) {
    return {
        jobId: state.fitmentJobId || overview?.job_id || "",
        vehicleIdentityId: overview?.vehicle_identity_id || null,
        vehicleRevision: overview?.vehicle_revision ?? null,
        modificationState: overview?.modification_state || "none",
        rimSetupId: overview?.rim_setup_id || null,
        rimSetupRevision: overview?.rim_setup_revision ?? null,
        setupMode: overview?.setup_mode || "uniform",
        frontSourceFingerprint: overview?.front_rim?.source_fingerprint || null,
        frontSelectedVariantSku: overview?.front_rim?.selected_variant_sku || null,
        rearSourceFingerprint: overview?.rear_rim?.source_fingerprint || null,
        rearSelectedVariantSku: overview?.rear_rim?.selected_variant_sku || null,
    };
}

function fitmentDraftMatchesOverview(draft, overview = state.fitmentOverview) {
    if (!draft?.baseline || !overview) return false;
    return JSON.stringify(draft.baseline) === JSON.stringify(fitmentRevisionBaseline(overview));
}

function fitmentSafeConflictDraft(form) {
    const safe = cloneFitmentForm(form);
    // A stale provider mapping or resolver SKU must never be revived from storage.
    safe.vehicle.modification = "";
    safe.rim.sku = "";
    return safe;
}

function fitmentDraftPayload(reason) {
    const now = Date.now();
    return {
        version: FITMENT_TRANSIENT_DRAFT_VERSION,
        reason,
        jobId: state.fitmentJobId,
        createdAt: now,
        expiresAt: now + FITMENT_TRANSIENT_DRAFT_TTL_MS,
        baseline: fitmentRevisionBaseline(),
        form: cloneFitmentForm(state.fitmentForm),
        formState: {
            status: fitmentFormIsDirty() ? "dirty" : "clean",
            validation: state.fitmentFormState.validation,
        },
        activeStep: state.fitmentActiveStep,
        origin: {
            view: state.fitmentOriginView,
            jobId: state.fitmentOriginJobId,
        },
        source: {
            open: state.fitmentSourceOpen,
            identity: { ...state.fitmentSourceIdentity },
            detected: state.fitmentSourceDetected,
            appliedFields: [...state.fitmentSourceAppliedFields],
            manualFields: [...state.fitmentRimManualFields],
            conflicts: (state.fitmentSourceConflicts || []).map(({ field, current, suggested }) => ({ field, current, suggested })),
        },
    };
}

function persistFitmentTransientDraft(reason = "navigation") {
    const key = fitmentTransientDraftKey();
    if (!key || !state.fitmentOverview) return;
    try {
        sessionStorage.setItem(key, JSON.stringify(fitmentDraftPayload(reason)));
    } catch {
        // Leaving Fitment remains safe when browser session storage is unavailable.
    }
}

function readFitmentTransientDraft({ reason } = {}) {
    const key = fitmentTransientDraftKey();
    if (!key) return null;
    try {
        const draft = JSON.parse(sessionStorage.getItem(key) || "null");
        const valid = draft?.version === FITMENT_TRANSIENT_DRAFT_VERSION
            && draft?.jobId === state.fitmentJobId
            && draft?.form?.vehicle
            && draft?.form?.rim
            && Number.isFinite(draft?.expiresAt)
            && draft.expiresAt > Date.now();
        if (!valid || (reason && draft.reason !== reason)) {
            if (!valid) sessionStorage.removeItem(key);
            return null;
        }
        return draft;
    } catch {
        sessionStorage.removeItem(key);
        return null;
    }
}

function discardFitmentTransientDraft() {
    const key = fitmentTransientDraftKey();
    if (key) sessionStorage.removeItem(key);
}

function restoreFitmentTransientDraft({ reason, overview = state.fitmentOverview } = {}) {
    const draft = readFitmentTransientDraft({ reason });
    if (!draft) return "none";
    discardFitmentTransientDraft();
    if (!fitmentDraftMatchesOverview(draft, overview)) {
        state.fitmentRestoreConflict = {
            form: fitmentSafeConflictDraft(draft.form),
            activeStep: draft.activeStep,
        };
        return "conflict";
    }
    state.fitmentForm = cloneFitmentForm(draft.form);
    state.fitmentActiveStep = Number.isInteger(draft.activeStep) ? draft.activeStep : state.fitmentActiveStep;
    state.fitmentFormState = {
        status: draft.formState?.status === "dirty" ? "dirty" : "clean",
        validation: draft.formState?.validation === "invalid" ? "invalid" : "valid",
        baseline: cloneFitmentForm(state.fitmentFormState.baseline || fitmentFormFromOverview(overview)),
    };
    state.fitmentOriginView = draft.origin?.view || state.fitmentOriginView;
    state.fitmentOriginJobId = draft.origin?.jobId || state.fitmentOriginJobId;
    state.fitmentSourceOpen = Boolean(draft.source?.open);
    state.fitmentSourceIdentity = { ...state.fitmentSourceIdentity, ...(draft.source?.identity || {}) };
    state.fitmentSourceDetected = Boolean(draft.source?.detected);
    state.fitmentSourceAppliedFields = Array.isArray(draft.source?.appliedFields) ? draft.source.appliedFields : [];
    state.fitmentRimManualFields = Array.isArray(draft.source?.manualFields) ? draft.source.manualFields : [];
    state.fitmentSourceConflicts = Array.isArray(draft.source?.conflicts) ? draft.source.conflicts : [];
    return "restored";
}

function applyFitmentRestoreConflict() {
    if (!state.fitmentRestoreConflict) return;
    state.fitmentForm = cloneFitmentForm(state.fitmentRestoreConflict.form);
    state.fitmentActiveStep = Number.isInteger(state.fitmentRestoreConflict.activeStep)
        ? state.fitmentRestoreConflict.activeStep
        : state.fitmentActiveStep;
    state.fitmentFormState.status = "dirty";
    state.fitmentFormState.validation = "valid";
    state.fitmentRestoreConflict = null;
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

function enforceUiCopyRule(root = document.getElementById("app")) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);
    textNodes.forEach((textNode) => {
        const parent = textNode.parentElement;
        if (!parent || /^(SCRIPT|STYLE|PRE|CODE|TEXTAREA|OPTION)$/u.test(parent.tagName)) return;
        const normalized = textNode.nodeValue.replace(/[.!?…:;,]+(\s*)$/u, "$1");
        if (normalized !== textNode.nodeValue) textNode.nodeValue = normalized;
    });
}

function observeUiCopyRule() {
    const root = document.getElementById("app");
    if (!root) return;
    enforceUiCopyRule(root);
    const observer = new MutationObserver(() => enforceUiCopyRule(root));
    observer.observe(root, { childList: true, characterData: true, subtree: true });
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
            ? `Telegram – @${websiteUsername}`
            : t("create.footerNotTelegram");
        return;
    }
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || `id ${user.id}`;
    userInfo.textContent = `Telegram – ${name}`;
}

function getDisplayName() {
    const user = tg?.initDataUnsafe?.user;
    if (user) {
        return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || `id ${user.id}`;
    }
    if (state.websiteAuth?.username) return `@${state.websiteAuth.username}`;
    return "Dream Wheels";
}

function getAccountLabel() {
    const user = tg?.initDataUnsafe?.user;
    const username = user?.username || state.websiteAuth?.username || "";
    if (username) return `@${String(username).replace(/^@/, "")}`;
    return getDisplayName();
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
    if (subtitle) subtitle.textContent = HAS_TG ? "Открыто в Telegram" : "Вход через Telegram";
}

function getWebsiteAuthToken() {
    if (HAS_TG || !state.websiteAuth) return "";
    if (Number(state.websiteAuth.expiresAt || 0) <= Date.now()) {
        clearWebsiteAuthSession();
        return "";
    }
    return state.websiteAuth.accessToken || "";
}

function clearWebsiteAuthSession({ refreshUi = true } = {}) {
    state.websiteAuth = null;
    sessionStorage.removeItem(WEBSITE_AUTH_STORAGE_KEY);
    if (refreshUi) updateWebsiteAuthUi();
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
    const dashboardLogin = document.querySelector("[data-dashboard-auth-login]");
    const dashboardLoginLabel = document.querySelector("[data-dashboard-auth-login-label]");
    const dashboardAuthError = document.querySelector("[data-dashboard-auth-error]");
    const websiteAuthLabel = document.querySelector("[data-website-auth-label]");
    if (button) button.hidden = HAS_TG;
    if (dashboardLogin) {
        dashboardLogin.disabled = state.websiteLoginPending || state.websiteLoginWarmupPending;
        const label = state.websiteLoginPending
            ? t("auth.loggingIn")
            : state.websiteLoginWarmupPending
                ? t("auth.preparing")
                : t("auth.loginShort");
        if (dashboardLoginLabel) dashboardLoginLabel.textContent = label;
    }
    if (dashboardAuthError) {
        dashboardAuthError.hidden = !state.websiteLoginError;
        dashboardAuthError.textContent = state.websiteLoginError;
    }
    if (!button || HAS_TG) return;

    const label = state.websiteLoginPending
        ? t("auth.loggingIn")
        : state.websiteAuth
            ? t("auth.logout")
            : t("auth.loginShort");
    button.disabled = state.websiteLoginPending;
    if (websiteAuthLabel) websiteAuthLabel.textContent = label;
    button.setAttribute("aria-label", label);
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

    state.websiteLoginNoncePromise = (async () => {
        let lastError;
        for (const delayMs of WEBSITE_LOGIN_NONCE_RETRY_DELAYS_MS) {
            if (delayMs) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
            try {
                const response = await fetch(apiUrl("/auth/telegram/nonce"), {
                    headers: { Accept: "application/json" },
                });
                if (!response.ok) throw new Error(await parseApiError(response));
                const payload = await response.json();
                state.websiteLoginNonce = payload;
                state.websiteLoginNonceFetchedAt = Date.now();
                return payload;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error("Telegram login nonce is unavailable");
    })()
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
    state.websiteLoginPending = true;
    state.websiteLoginError = "";
    updateWebsiteAuthUi();

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
        void trackEvent("auth_completed", { auth_channel: "website" });
        state.renderHistory = [];
        state.renderHistoryError = "";
        state.renderHistoryLoading = true;
        updateWebsiteAuthUi();
        renderDashboard();
        renderRenders();
        await Promise.all([loadCabinet(), loadRenderHistory()]);
        if (state.identityError && state.files.car?.blob && state.files.wheel?.blob) {
            await resolveIdentity();
        }
        return true;
    } catch (error) {
        console.error("[DW] Telegram website login failed", error);
        const message = error instanceof TypeError || /fetch|network|connection/i.test(String(error?.message || ""))
            ? "Не удалось связаться с сервисом входа. Проверьте подключение и попробуйте ещё раз."
            : "Не удалось войти через Telegram. Попробуйте ещё раз.";
        state.websiteLoginError = message;
        setWalletMessage(message, "error");
        return false;
    } finally {
        state.websiteLoginPending = false;
        invalidateWebsiteLoginNonce();
        warmWebsiteLoginResources();
        updateWebsiteAuthUi();
    }
}

function showFitmentAuthRequired() {
    clearFitmentRuntimeRequests();
    persistFitmentTransientDraft("reauth");
    state.fitmentAuthRequired = true;
    state.fitmentError = "";
    state.fitmentMessage = "";
    if (state.view === "fitment") renderFitment();
}

async function resumeFitmentAfterLogin() {
    const signedIn = await loginWithTelegram();
    if (!signedIn) return;
    state.fitmentAuthRequired = false;
    const restoration = await loadFitmentOverview(state.fitmentJobId, {
        restoreReason: "reauth",
        suppressAutomaticResolver: true,
    });
    if (restoration === "restored") {
        state.fitmentMessage = locale === "ru" ? "Данные восстановлены" : "Details restored";
        state.fitmentMessageTone = "success";
    } else if (restoration === "conflict") {
        state.fitmentMessage = locale === "ru"
            ? "Данные на сервере изменились. Черновик не применён автоматически."
            : "Server details changed. The draft was not applied automatically.";
        state.fitmentMessageTone = "warning";
    }
    renderFitment();
}

function logoutWebsiteAuth() {
    clearWebsiteAuthSession({ refreshUi: false });
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

function formatRenderCount(value) {
    const count = Number(value || 0);
    if (locale !== "ru") return `${count} ${count === 1 ? "render" : "renders"}`;
    const mod10 = count % 10;
    const mod100 = count % 100;
    const noun = mod10 === 1 && mod100 !== 11
        ? "рендер"
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? "рендера"
          : "рендеров";
    return `${count} ${noun}`;
}

function topUpMeta(credits) {
    return formatTemplate("wallet.packageMetaDays", { creditsLabel: formatRenderCount(credits) });
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

    if (normalized.includes("identity_auth_required") || normalized.includes("init_data") || normalized.includes("telegram_user_id")) {
        return {
            title: t("errors.identityAuthTitle"),
            body: t("errors.identityAuthBody"),
            primaryActionLabel: t("errors.identityAuthAction"),
            showPrimaryAction: true,
            retryLabel: t("errors.identityRetryAction"),
            badgeLabel: locale === "ru" ? "Нужен вход" : "Sign in",
        };
    }

    if (normalized.includes("not found") || normalized.includes("404") || normalized.includes("method not allowed") || normalized.includes("405")) {
        return {
            title: t("errors.identityBackendTitle"),
            body: formatTemplate("errors.identityBackendBody", { apiBase: state.apiBaseUrl }),
            primaryActionLabel: "",
            showPrimaryAction: false,
            retryLabel: t("errors.identityRetryAction"),
            badgeLabel: locale === "ru" ? "Недоступно" : "Unavailable",
        };
    }

    if (normalized.includes("failed to fetch") || normalized.includes("connection refused") || normalized.includes("networkerror")) {
        return {
            title: t("errors.identityConnectionTitle"),
            body: t("errors.identityConnectionBody"),
            primaryActionLabel: "",
            showPrimaryAction: false,
            retryLabel: t("errors.identityRetryAction"),
            badgeLabel: locale === "ru" ? "Нет связи" : "Offline",
        };
    }

    return {
        title: t("errors.identityGenericTitle"),
        body: t("errors.identityGenericBody"),
        primaryActionLabel: "",
        showPrimaryAction: false,
        retryLabel: t("errors.identityRetryAction"),
        badgeLabel: locale === "ru" ? "Не удалось" : "Failed",
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

function cloneFitmentForm(form) {
    return JSON.parse(JSON.stringify(form || createEmptyFitmentForm()));
}

function fitmentFormIsDirty() {
    return JSON.stringify(state.fitmentForm) !== JSON.stringify(state.fitmentFormState.baseline);
}

function markFitmentDirty() {
    state.fitmentFormState.status = fitmentFormIsDirty() ? "dirty" : "clean";
}

function fitmentNumberString(value) {
    if (value === null || value === undefined || value === "") return "";
    return String(value).replace(",", ".");
}

function formatFitmentInputNumber(value) {
    const raw = fitmentNumberString(value);
    return raw ? raw.replace(".", locale === "ru" ? "," : ".") : "";
}

function fitmentCatalogueItems(kind) {
    return state.fitmentCatalogue?.[kind]?.items || [];
}

function fitmentOptionLabel(item) {
    return typeof item === "string" || typeof item === "number" ? String(item) : (item?.label || item?.value || "");
}

function fitmentOptionValue(item) {
    return typeof item === "string" || typeof item === "number" ? String(item) : String(item?.value ?? "");
}

function createEmptyFitmentForm() {
    return {
        setup_mode: "uniform",
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
        rear_rim: {
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
        "rim.bolt_count": locale === "ru" ? "крепёжных отверстий" : "bolt count",
        "rim.pcd_mm": locale === "ru" ? "разболтовка (PCD)" : "PCD",
        "rim.center_bore_mm": locale === "ru" ? "диаметр ступичного отверстия" : "center bore",
        "rim.wheel_diameter_in": locale === "ru" ? "диаметр диска" : "diameter",
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
    return parts.filter(Boolean).join(" — ") || fitmentEmptyValue();
}

function fitmentSourceBrand(overview) {
    if (overview?.rim?.brand) return overview.rim.brand;
    const productUrl = overview?.rim?.product_url;
    if (!productUrl) return fitmentEmptyValue();
    try {
        return new URL(productUrl).hostname.replace(/^www\./i, "");
    } catch {
        return t("fitment.sourceAdded");
    }
}

function fitmentSourceSku(overview) {
    return overview?.rim?.sku || "";
}

function setFitmentOverviewCollapsed(collapsed) {
    state.fitmentOverviewCollapsed = collapsed;
    const overviewGrid = document.querySelector("[data-fitment-overview-grid]");
    const toggle = document.querySelector("[data-fitment-overview-toggle]");
    if (overviewGrid) overviewGrid.dataset.collapsed = String(collapsed);
    if (toggle) {
        toggle.hidden = !state.fitmentOverview;
        toggle.textContent = collapsed
            ? t("fitment.summaryShow")
            : t("fitment.summaryHide");
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-controls", "fitment-overview-grid");
    }
}

function fitmentCandidateLabel(candidate) {
    const value = candidate?.value;
    const confidence = Number(candidate?.confidence);
    const confidenceLabel = Number.isFinite(confidence)
        ? (locale === "ru"
            ? `уверенность распознавания ${Math.round(confidence * 100)}%`
            : `recognition confidence ${Math.round(confidence * 100)}%`)
        : "";
    return [value, confidenceLabel].filter(Boolean).join(" – ");
}

function renderFitmentCandidates() {
    document.querySelectorAll(".fitment-candidate-row").forEach((row) => row.remove());
    document.querySelectorAll(".fitment-field.has-candidates").forEach((field) => {
        field.classList.remove("has-candidates");
    });
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
        if (row.children.length) {
            input.closest(".fitment-field")?.classList.add("has-candidates");
            input.closest(".fitment-field")?.append(row);
        }
    });
}

function fitmentFormFromOverview(overview) {
    return {
        setup_mode: overview?.setup_mode || "uniform",
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
        rear_rim: {
            bolt_count: overview?.rear_rim?.rim?.bolt_count ?? "",
            pcd_mm: overview?.rear_rim?.rim?.pcd_mm ?? "",
            wheel_diameter_in: overview?.rear_rim?.rim?.wheel_diameter_in ?? "",
            wheel_width_j: overview?.rear_rim?.rim?.wheel_width_j ?? "",
            center_bore_mm: overview?.rear_rim?.rim?.center_bore_mm ?? "",
            offset_et_mm: overview?.rear_rim?.rim?.offset_et_mm ?? "",
        },
    };
}

function fitmentSourceIdentityFromOverview(overview) {
    const rim = overview?.front_rim || {};
    return {
        sourceFingerprint: rim.source_fingerprint || null,
        selectedVariantSku: rim.selected_variant_sku || null,
        variantState: rim.variant_state || "not_applicable",
    };
}

function fitmentSaveLabel() {
    if (state.fitmentActiveStep === 1) {
        return locale === "ru" ? "Продолжить" : "Continue";
    }
    if (fitmentNextAction(state.fitmentOverview) === "select_vehicle_variant") {
        return locale === "ru" ? "Сохранить и выбрать комплектацию" : "Save and choose vehicle version";
    }
    if (fitmentNextAction(state.fitmentOverview) === "complete_rim_specs") {
        return locale === "ru" ? "Сохранить параметры" : "Save details";
    }
    return locale === "ru" ? "Сохранить и получить вывод" : "Save and get result";
}

function refreshFitmentSaveLabel() {
    const saveButton = document.querySelector("[data-fitment-save]");
    if (!saveButton || state.fitmentLoading || state.fitmentSaving) return;
    saveButton.textContent = fitmentSaveLabel();
}

function validateFitmentForm() {
    const requiredVehicle = ["make", "model", "year", "market"];
    const missing = requiredVehicle
        .filter((field) => state.fitmentForm.vehicle[field] === "" || state.fitmentForm.vehicle[field] === null || state.fitmentForm.vehicle[field] === undefined)
        .map((field) => `vehicle.${field}`);
    state.fitmentFormState.validation = missing.length ? "invalid" : "valid";
    return missing;
}

function fitmentNextAction(overview = state.fitmentOverview) {
    return overview?.next_action?.kind || "complete_vehicle_details";
}

// This is the only boundary between persisted Fitment domain state and the
// frozen UI. The form/request flags below are deliberately transient; every
// readiness, confirmation, verdict and currentness decision stays server-owned.
function fitmentUiState(overview = state.fitmentOverview, check = state.fitmentCheck) {
    const front = overview?.front_rim || null;
    const rear = overview?.setup_mode === "staggered" ? overview?.rear_rim || null : null;
    const executionStatus = check?.execution_status || "idle";
    return {
        server: overview || null,
        nextAction: fitmentNextAction(overview),
        vehicle: {
            state: overview?.vehicle_state || "empty",
            fieldStates: overview?.vehicle_field_states || {},
            modificationState: overview?.modification_state || "none",
            selectionSource: overview?.selection_source || null,
        },
        rim: {
            setupMode: overview?.setup_mode || "uniform",
            setupState: overview?.rim_setup_state || "empty",
            front,
            rear,
            fieldStates: front?.field_states || overview?.rim_field_states || {},
        },
        check: {
            item: check || null,
            executionStatus,
            pending: executionStatus === "queued" || executionStatus === "processing",
            isCurrent: check ? check.is_current !== false : true,
            stale: Boolean(check && check.is_current === false),
        },
        form: { ...state.fitmentFormState, dirty: fitmentFormIsDirty() },
        request: {
            catalogue: state.fitmentCatalogue,
            lookup: state.fitmentLookup,
            resolver: state.fitmentSourceResolving ? "resolving" : state.fitmentSourceStatusTone === "error" ? "failed" : state.fitmentSourceDetected ? "resolved" : "idle",
            submitting: state.fitmentChecking,
        },
    };
}

function fitmentNeedsVehicleVariant(overview = state.fitmentOverview) {
    return fitmentNextAction(overview) === "select_vehicle_variant";
}

function fitmentSourceProgressTitle() {
    if (state.fitmentSourceResolving) {
        return locale === "ru" ? "Извлекаем параметры из источника" : "Extracting parameters from the source";
    }
    return locale === "ru" ? "Параметры из источника" : "Parameters from the source";
}

function fitmentSourceProgressFields() {
    return state.fitmentSourceAppliedFields
        .map((fieldName) => fitmentFieldLabel(`rim.${fieldName}`))
        .filter(Boolean)
        .join(", ");
}

function scrollFitmentTo(selector) {
    window.requestAnimationFrame(() => {
        document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

function fitmentNextStep(overview) {
    const action = fitmentNextAction(overview);
    if (action === "select_vehicle_variant") {
        return {
            selector: "[data-fitment-variants-load]",
            message: locale === "ru"
                ? "Данные сохранены. Следующий шаг — выберите точную комплектацию автомобиля."
                : "Details saved. Next, select the exact vehicle version.",
        };
    }
    if (action === "complete_vehicle_details") {
        return {
            selector: '[data-fitment-section="vehicle"]',
            message: locale === "ru"
                ? "Данные сохранены. Заполните данные автомобиля, затем продолжите проверку."
                : "Details saved. Complete the vehicle details, then continue the check.",
        };
    }
    if (action === "complete_rim_specs") {
        return {
            selector: "[data-fitment-section=\"rim\"]",
            message: locale === "ru"
                ? "Данные сохранены. Заполните недостающие параметры диска, затем продолжите проверку."
                : "Details saved. Complete the missing wheel parameters, then continue the check.",
        };
    }
    return {
        selector: "[data-fitment-verdict-card]",
        message: locale === "ru"
            ? "Данные сохранены. Теперь можно проверить совместимость."
            : "Details saved. You can now check compatibility.",
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
    const parsed = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function formatFitmentNumber(value, suffix = "") {
    if (value === null || value === undefined || value === "") return fitmentEmptyValue();
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fitmentEmptyValue();
    const formatted = Number.isInteger(numeric) ? String(numeric) : String(numeric);
    const localized = locale === "ru" ? formatted.replace(".", ",") : formatted;
    return suffix ? `${localized} ${suffix}` : localized;
}

function fitmentSubtitle(overview) {
    if (state.fitmentActiveStep === 1) {
        return locale === "ru"
            ? "Подтвердите автомобиль и выберите комплектацию"
            : "Confirm the vehicle and select its exact version";
    }
    if (state.fitmentActiveStep === 2) {
        return locale === "ru"
            ? "Проверьте параметры диска перед предварительной оценкой"
            : "Review the wheel details before the preliminary result";
    }
    return locale === "ru"
        ? "Посмотрите предварительный вывод и условия установки"
        : "Review the preliminary result and installation conditions";
}

function fitmentVerdictMessage(item) {
    const details = item?.details || item?.detail || {};
    const code = item?.code || item?.reason_code || "";
    const ru = locale === "ru";
    if (code === "vehicle_variant_required") {
        return ru ? "Выберите точную комплектацию автомобиля по каталогу Wheel‑Size." : "Select the exact vehicle version from Wheel‑Size.";
    }
    if (code === "vehicle_reference_offset_missing") {
        return ru ? "Не удалось подтвердить ET автомобиля по данным Wheel‑Size." : "The vehicle ET could not be confirmed by Wheel‑Size.";
    }
    if (code === "rim_offset_missing") {
        return ru ? "Укажите ET колесного диска для технической проверки." : "Enter the wheel ET for the technical check.";
    }
    if (code === "hub_rings_required") {
        const hub = formatFitmentNumber(details.hub_bore_mm, "мм");
        const rim = formatFitmentNumber(details.rim_bore_mm, "мм");
        return ru ? `Для установки потребуется центровочное кольцо ${hub} → ${rim}.` : `A hub-centric ring ${hub} → ${rim} is required.`;
    }
    if (code === "load_rating_unknown") {
        return ru ? "Рейтинг нагрузки диска не подтверждён — это не влияет на предварительный verdict." : "The wheel load rating is not confirmed; it does not affect this preliminary verdict.";
    }
    if (code === "fastener_unknown") {
        return ru ? "Тип крепежа не подтверждён — проверьте его перед установкой." : "Fastener type is not confirmed; check it before installation.";
    }
    if (code === "pcd_unknown") return ru ? "Не удалось подтвердить PCD." : "PCD could not be confirmed.";
    if (code === "center_bore_unknown") return ru ? "Не удалось подтвердить центральное отверстие." : "Center bore could not be confirmed.";
    if (code === "size_unknown" || code === "size_not_in_reference" || code === "allowed_set_empty") return ru ? "Не удалось подтвердить допустимый размер диска." : "The approved wheel size could not be confirmed.";
    if (["provider_unavailable", "network_error", "proxy_error", "provider_timeout"].includes(code)) return ru ? "Не удалось связаться с сервисом технической проверки совместимости. Повторите позже." : "The technical compatibility service could not be reached. Try again later.";
    if (["throttled", "quota_exceeded"].includes(code)) return ru ? "Сервис технической проверки временно ограничил запросы. Попробуйте позже." : "The technical compatibility service is rate-limited. Try again later.";
    if (code === "provider_authentication_failed") return ru ? "Сервис технической проверки временно недоступен." : "The technical compatibility service is temporarily unavailable.";
    if (code === "malformed_response" || code === "internal_execution_error") return ru ? "Не удалось завершить техническую проверку. Повторите позже." : "The technical check could not be completed. Try again later.";
    if (code === "vehicle_not_resolved") return ru ? "Автомобиль не удалось сопоставить с каталогом Wheel‑Size." : "The vehicle could not be matched to Wheel‑Size.";
    if (code === "pcd_mismatch" || code === "bolt_count_mismatch") return ru ? "PCD или количество крепёжных отверстий не совпадает." : "PCD or bolt count does not match.";
    if (code === "center_bore_too_small") return ru ? "Центральное отверстие диска меньше ступицы автомобиля." : "The wheel center bore is smaller than the vehicle hub.";
    if (code === "offset_deviation_check_required" || code === "offset_out_of_range" || code === "et_outside_reference_range") {
        const range = `ET${formatFitmentNumber(details.reference_et_min_mm).replace(/\s/g, "")}–${formatFitmentNumber(details.reference_et_max_mm).replace(/\s/g, "")}`;
        const rim = `ET${formatFitmentNumber(details.rim_et_mm).replace(/\s/g, "")}`;
        return ru
            ? `ET диска ${rim}; расчётный диапазон автомобиля ${range}. Перед установкой проверьте внутренний и наружный зазор.`
            : `Wheel ${rim}; vehicle reference range ${range}. Check inner and outer clearances before installation.`;
    }
    return ru ? "Требуется дополнительная техническая проверка." : "Additional technical review is required.";
}

function fitmentFieldStateLabel(fieldState) {
    const labels = {
        missing: locale === "ru" ? "Не заполнено" : "Missing",
        suggested: locale === "ru" ? "Определено автоматически" : "Suggested automatically",
        entered: locale === "ru" ? "Введено вручную" : "Entered manually",
        confirmed: locale === "ru" ? "Подтверждено пользователем" : "Confirmed by user",
    };
    return labels[fieldState] || "";
}

function fitmentRimStateLabel(rimState) {
    const labels = {
        empty: locale === "ru" ? "Параметры диска не указаны" : "Wheel details are not entered",
        partial: locale === "ru" ? "Требует уточнения" : "Needs clarification",
        complete_unconfirmed: locale === "ru" ? "Требует подтверждения" : "Needs confirmation",
        confirmed_ready: locale === "ru" ? "Подтверждено пользователем" : "Confirmed by user",
    };
    return labels[rimState] || "";
}

function fitmentModificationStateLabel(ui) {
    if (ui.vehicle.modificationState === "confirmed" && ui.vehicle.selectionSource === "wheel_size_single") {
        return locale === "ru" ? "Выбрано автоматически" : "Selected automatically";
    }
    if (ui.vehicle.modificationState === "confirmed") {
        return locale === "ru" ? "Комплектация подтверждена" : "Vehicle version confirmed";
    }
    if (ui.vehicle.modificationState === "suggested") {
        return locale === "ru" ? "Выберите комплектацию" : "Choose a vehicle version";
    }
    return locale === "ru" ? "Комплектация ещё не выбрана" : "Vehicle version is not selected";
}

function fitmentRetryMessage(check) {
    if (check?.retry_mode !== "retry_later") return "";
    if (!check.retry_at) return locale === "ru" ? "Попробуйте позже" : "Try again later";
    const retryAt = Date.parse(check.retry_at);
    if (!Number.isFinite(retryAt)) return locale === "ru" ? "Попробуйте позже" : "Try again later";
    const minutes = Math.max(1, Math.ceil((retryAt - Date.now()) / 60000));
    if (minutes >= 60) {
        const hours = Math.ceil(minutes / 60);
        return locale === "ru" ? `Лимит запросов обновится примерно через ${hours} ч` : `The request limit resets in about ${hours}h`;
    }
    return locale === "ru" ? `Лимит запросов обновится примерно через ${minutes} мин` : `The request limit resets in about ${minutes} min`;
}

function renderFitmentFieldStates(ui) {
    document.querySelectorAll("[data-fitment-field-state]").forEach((node) => node.remove());
    for (const [name, details] of Object.entries(ui.rim.fieldStates)) {
        const input = document.querySelector(`[data-fitment-input="rim.${name}"]`);
        const field = input?.closest(".fitment-field");
        if (!field || !details?.state) continue;
        field.dataset.state = details.state;
        const status = document.createElement("small");
        status.className = "fitment-field-state";
        status.dataset.fitmentFieldState = details.state;
        status.textContent = fitmentFieldStateLabel(details.state);
        field.append(status);
    }
}

function renderFitmentVerdictGroup(sectionTarget, listTarget, items, kind) {
    const section = document.querySelector(sectionTarget);
    const list = document.querySelector(listTarget);
    if (!section || !list) return;
    section.hidden = !items.length;
    section.dataset.kind = kind;
    list.replaceChildren();
    for (const item of items) {
        const line = document.createElement("div");
        line.textContent = fitmentVerdictMessage(item);
        list.append(line);
    }
}

function fitmentPayload() {
    return {
        expected_vehicle_revision: state.fitmentOverview?.vehicle_revision,
        expected_rim_revision: state.fitmentOverview?.rim_revision,
        setup_mode: state.fitmentForm.setup_mode,
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
            source_fingerprint: state.fitmentSourceIdentity.sourceFingerprint,
            selected_variant_sku: state.fitmentSourceIdentity.selectedVariantSku,
            variant_state: state.fitmentSourceIdentity.variantState,
        },
        ...(state.fitmentForm.setup_mode === "staggered" ? {
            front_rim: {
                bolt_count: normalizeFitmentNumber(state.fitmentForm.rim.bolt_count),
                pcd_mm: normalizeFitmentNumber(state.fitmentForm.rim.pcd_mm),
                wheel_diameter_in: normalizeFitmentNumber(state.fitmentForm.rim.wheel_diameter_in),
                wheel_width_j: normalizeFitmentNumber(state.fitmentForm.rim.wheel_width_j),
                center_bore_mm: normalizeFitmentNumber(state.fitmentForm.rim.center_bore_mm),
                offset_et_mm: normalizeFitmentNumber(state.fitmentForm.rim.offset_et_mm),
                source_fingerprint: state.fitmentSourceIdentity.sourceFingerprint,
                selected_variant_sku: state.fitmentSourceIdentity.selectedVariantSku,
                variant_state: state.fitmentSourceIdentity.variantState,
            },
            rear_rim: {
                bolt_count: normalizeFitmentNumber(state.fitmentForm.rear_rim.bolt_count),
                pcd_mm: normalizeFitmentNumber(state.fitmentForm.rear_rim.pcd_mm),
                wheel_diameter_in: normalizeFitmentNumber(state.fitmentForm.rear_rim.wheel_diameter_in),
                wheel_width_j: normalizeFitmentNumber(state.fitmentForm.rear_rim.wheel_width_j),
                center_bore_mm: normalizeFitmentNumber(state.fitmentForm.rear_rim.center_bore_mm),
                offset_et_mm: normalizeFitmentNumber(state.fitmentForm.rear_rim.offset_et_mm),
            },
        } : {}),
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

function renderFitmentControls() {
    const overview = state.fitmentOverview || {};
    const form = state.fitmentForm;
    const setOptions = (select, items, placeholder, currentValue) => {
        if (!select) return;
        const current = currentValue === null || currentValue === undefined ? "" : String(currentValue);
        const options = [`<option value="">${placeholder}</option>`];
        const seen = new Set();
        for (const item of items) {
            const value = fitmentOptionValue(item);
            if (!value || seen.has(value)) continue;
            seen.add(value);
            options.push(`<option value="${value.replaceAll('"', '&quot;')}">${fitmentOptionLabel(item).replaceAll('<', '&lt;')}</option>`);
        }
        if (current && !seen.has(current)) options.push(`<option value="${current.replaceAll('"', '&quot;')}">${current.replaceAll('<', '&lt;')}</option>`);
        select.innerHTML = options.join("");
        select.value = current;
    };
    const regions = shouldUseDemoFitment(state.fitmentJobId)
        ? FITMENT_REGIONS.map(([value, label]) => ({ value, label }))
        : fitmentCatalogueItems("regions");
    setOptions(document.querySelector('[data-fitment-catalogue="regions"]'), regions, "Выберите рынок", form.vehicle.market);
    setOptions(document.querySelector('[data-fitment-catalogue="makes"]'), fitmentCatalogueItems("makes"), "Выберите марку", form.vehicle.make);
    setOptions(document.querySelector('[data-fitment-catalogue="models"]'), fitmentCatalogueItems("models"), "Выберите модель", form.vehicle.model);
    setOptions(document.querySelector('[data-fitment-catalogue="years"]'), fitmentCatalogueItems("years"), "Выберите год", form.vehicle.year);
    const makeSelect = document.querySelector('[data-fitment-catalogue="makes"]');
    const modelSelect = document.querySelector('[data-fitment-catalogue="models"]');
    const yearSelect = document.querySelector('[data-fitment-catalogue="years"]');
    const regionSelect = document.querySelector('[data-fitment-catalogue="regions"]');
    if (regionSelect) regionSelect.disabled = state.fitmentLoading || state.fitmentSaving || state.fitmentCatalogue.regions.status === "loading";
    if (makeSelect) makeSelect.disabled = state.fitmentLoading || state.fitmentSaving || state.fitmentCatalogue.makes.status === "loading";
    if (modelSelect) modelSelect.disabled = !form.vehicle.make || state.fitmentCatalogue.models.status === "loading" || state.fitmentLoading || state.fitmentSaving;
    if (yearSelect) yearSelect.disabled = !form.vehicle.make || !form.vehicle.model || !form.vehicle.market || state.fitmentCatalogue.years.status !== "loaded" || state.fitmentLoading || state.fitmentSaving;

    const presetSelect = (path, values, label, suffix = "") => {
        const select = document.querySelector(`[data-fitment-preset="${path}"]`);
        if (!select) return;
        const current = getDeepValue(form, path);
        const currentText = current === null || current === undefined ? "" : String(current);
        const options = [`<option value="">${label}</option>`];
        for (const value of values) options.push(`<option value="${value}">${formatFitmentInputNumber(value)}${suffix}</option>`);
        options.push('<option value="custom">Другое значение</option>');
        select.innerHTML = options.join("");
        select.value = values.map(String).includes(currentText) ? currentText : currentText ? "custom" : "";
        const custom = document.querySelector(`[data-fitment-custom="${path}"]`);
        if (custom) {
            custom.hidden = select.value !== "custom";
            custom.value = select.value === "custom" ? formatFitmentInputNumber(current) : "";
        }
    };
    presetSelect("rim.wheel_diameter_in", FITMENT_DIAMETER_PRESETS, "Выберите диаметр", '"');
    presetSelect("rim.wheel_width_j", FITMENT_WIDTH_PRESETS, "Выберите ширину", "J");
    const datalist = document.querySelector("#fitment-dia-options");
    if (datalist) datalist.innerHTML = FITMENT_DIA_PRESETS.map((value) => `<option value="${formatFitmentInputNumber(value)}"></option>`).join("");
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
    const demoLiveNote = document.querySelector("[data-fitment-demo-live-note]");
    const readiness = document.querySelector("[data-fitment-readiness]");
    const readinessTitle = document.querySelector("[data-fitment-readiness-title]");
    const readinessFields = document.querySelector("[data-fitment-readiness-fields]");
    const saveButton = document.querySelector("[data-fitment-save]");
    const skipButton = document.querySelector("[data-fitment-skip]");
    const sourceEntry = document.querySelector("[data-fitment-source-entry]");
    const sourceUrl = document.querySelector("[data-fitment-source-url]");
    const sourceSubmit = document.querySelector("[data-fitment-source-submit]");
    const sourceStatus = document.querySelector("[data-fitment-source-status]");
    const sourceToggle = document.querySelector("[data-fitment-source-toggle]");
    const sourceProgress = document.querySelector("[data-fitment-source-progress]");
    const sourceProgressTitle = document.querySelector("[data-fitment-source-progress-title]");
    const sourceProgressCopy = document.querySelector("[data-fitment-source-progress-copy]");
    const sourceProgressFields = document.querySelector("[data-fitment-source-progress-fields]");
    const sourceSpinner = document.querySelector("[data-fitment-source-spinner]");
    const parserWarning = document.querySelector("[data-fitment-parser-warning]");
    const variantsLoad = document.querySelector("[data-fitment-variants-load]");
    const variantsList = document.querySelector("[data-fitment-variant-list]");
    const verdictCard = document.querySelector("[data-fitment-verdict-card]");
    const verdictTitle = document.querySelector("[data-fitment-verdict-title]");
    const verdictCopy = document.querySelector("[data-fitment-verdict-copy]");
    const verdictWarning = document.querySelector("[data-fitment-verdict-warning]");
    const verdictCurrentness = document.querySelector("[data-fitment-currentness]");
    const verdictFields = document.querySelector("[data-fitment-verdict-fields]");
    const missingDataWarning = document.querySelector("[data-fitment-missing-data-warning]");
    const verdictCheckButton = document.querySelector("[data-fitment-check]");
    const authRequired = document.querySelector("[data-fitment-auth-required]");
    const authRequiredText = document.querySelector("[data-fitment-auth-required-text]");
    const authLoginLabel = document.querySelector("[data-fitment-auth-login-label]");
    const restoreConflict = document.querySelector("[data-fitment-restore-conflict]");
    const restoreConflictText = document.querySelector("[data-fitment-restore-conflict-text]");
    const basicsCard = document.querySelector(".fitment-basics-card");
    const vehicleSection = document.querySelector('[data-fitment-section="vehicle"]');
    const rimSection = document.querySelector('[data-fitment-section="rim"]');
    const overviewGrid = document.querySelector("[data-fitment-overview-grid]");
    const pcdSelect = document.querySelector("[data-fitment-pcd-select]");
    const pcdCustom = document.querySelector("[data-fitment-pcd-custom]");
    const setupModeSelect = document.querySelector("[data-fitment-setup-mode]");
    const rearRimSection = document.querySelector("[data-fitment-rear-rim]");
    const actions = document.querySelector("[data-fitment-actions]");
    const overview = state.fitmentOverview;
    const ui = fitmentUiState(overview);
    const vehicleState = document.querySelector("[data-fitment-vehicle-state]");
    const modificationState = document.querySelector("[data-fitment-modification-state]");
    const rimState = document.querySelector("[data-fitment-rim-state]");
    const rimAxes = document.querySelector("[data-fitment-rim-axes]");
    if (overview && !state.fitmentActiveStep) {
        state.fitmentActiveStep = state.fitmentCheck
            ? 3
            : fitmentNextAction(overview) === "run_standard_check"
                ? 2
                : 1;
    }

    if (loading) loading.dataset.visible = String(state.fitmentLoading);
    if (error) error.dataset.visible = String(Boolean(state.fitmentError));
    if (errorText) errorText.textContent = localizeErrorMessage(state.fitmentError);
    if (authRequired) authRequired.hidden = !state.fitmentAuthRequired || HAS_TG;
    if (authRequiredText) {
        authRequiredText.textContent = locale === "ru"
            ? "Сессия истекла. Войдите через Telegram, чтобы продолжить."
            : "Your session has expired. Sign in with Telegram to continue.";
    }
    if (authLoginLabel) {
        authLoginLabel.textContent = locale === "ru" ? "Войти через Telegram" : "Sign in with Telegram";
    }
    if (restoreConflict) restoreConflict.hidden = !state.fitmentRestoreConflict;
    if (restoreConflictText) {
        restoreConflictText.textContent = locale === "ru"
            ? "Данные на сервере изменились. Черновик не применён автоматически."
            : "Server details changed. The draft was not applied automatically.";
    }
    if (message) {
        message.dataset.visible = String(Boolean(state.fitmentMessage));
        message.className = `wallet-status-island tone-${state.fitmentMessageTone || "neutral"}`;
    }
    if (messageText) messageText.textContent = state.fitmentMessage || "";
    if (saveButton) {
        saveButton.disabled = state.fitmentLoading || state.fitmentSaving;
        saveButton.textContent = state.fitmentSaving
            ? (locale === "ru" ? "Сохраняем…" : "Saving…")
            : fitmentSaveLabel();
    }
    if (skipButton) skipButton.disabled = state.fitmentLoading || state.fitmentSaving;
    const demoMode = shouldUseDemoFitment(state.fitmentJobId);
    if (sourceEntry) sourceEntry.hidden = demoMode || !state.fitmentSourceOpen;
    if (sourceToggle) sourceToggle.textContent = state.fitmentSourceOpen
        ? t("fitment.sourceClose")
        : t("fitment.jumpSource");
    if (sourceToggle) sourceToggle.disabled = demoMode || state.fitmentSourceResolving;
    if (sourceUrl) {
        sourceUrl.value = state.fitmentForm.rim.product_url || "";
        sourceUrl.disabled = state.fitmentSourceResolving;
    }
    if (sourceSubmit) {
        sourceSubmit.disabled = state.fitmentSourceResolving;
        sourceSubmit.textContent = state.fitmentForm.rim.product_url
            ? (locale === "ru" ? "Повторить извлечение" : "Extract again")
            : (locale === "ru" ? "Извлечь параметры" : "Extract parameters");
    }
    if (sourceStatus) {
        sourceStatus.hidden = !state.fitmentSourceStatus;
        sourceStatus.textContent = state.fitmentSourceStatus;
        sourceStatus.dataset.tone = state.fitmentSourceStatusTone;
    }
    if (parserWarning) parserWarning.hidden = !state.fitmentSourceDetected;
    if (sourceProgress) {
        const visible = Boolean(state.fitmentSourceStatus) || state.fitmentSourceResolving;
        sourceProgress.hidden = !visible;
        sourceProgress.dataset.tone = state.fitmentSourceStatusTone || "neutral";
        sourceProgress.dataset.loading = String(state.fitmentSourceResolving);
    }
    if (sourceProgressTitle) sourceProgressTitle.textContent = fitmentSourceProgressTitle();
    if (sourceProgressCopy) sourceProgressCopy.textContent = state.fitmentSourceStatus || "";
    if (sourceProgressFields) {
        const appliedFields = fitmentSourceProgressFields();
        sourceProgressFields.hidden = !appliedFields;
        sourceProgressFields.textContent = appliedFields
            ? `${locale === "ru" ? "Заполнены поля" : "Fields filled"}: ${appliedFields}`
            : "";
    }
    if (sourceSpinner) sourceSpinner.hidden = !state.fitmentSourceResolving;
    renderFitmentSourceSteps();
    renderFitmentRimVariants();
    renderFitmentParserConflicts();
    document.querySelectorAll('[data-fitment-input^="rim."]').forEach((input) => {
        input.disabled = state.fitmentSourceResolving;
        input.closest(".fitment-field")?.toggleAttribute("data-resolving", state.fitmentSourceResolving);
        input.closest(".fitment-field")?.toggleAttribute(
            "data-source-applied",
            state.fitmentSourceAppliedFields.includes(input.dataset.fitmentInput?.replace("rim.", ""))
        );
    });
    if (variantsLoad) {
        variantsLoad.disabled = state.fitmentVehicleVariantsLoading
            || state.fitmentVehicleVariantApplying;
        variantsLoad.textContent = state.fitmentVehicleVariantsLoading
            ? (locale === "ru" ? "Подбираем комплектации…" : "Finding versions…")
            : (locale === "ru" ? "Подобрать комплектацию" : "Choose vehicle version");
    }
    if (variantsList) {
        variantsList.replaceChildren();
        variantsList.hidden = !state.fitmentVehicleVariants.length;
        for (const [index, variant] of state.fitmentVehicleVariants.entries()) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "fitment-variant-choice";
            button.dataset.fitmentVehicleVariant = String(index);
            button.disabled = state.fitmentVehicleVariantApplying;
            button.textContent = [variant.market, variant.generation, variant.modification]
                .filter(Boolean)
                .join(" / ");
            variantsList.append(button);
        }
    }

    if (previewBadge) previewBadge.hidden = !demoMode;
    if (previewNote) previewNote.hidden = !demoMode;
    if (demoLiveNote) demoLiveNote.hidden = !demoMode;
    if (!overview) {
        if (shell) shell.hidden = true;
        return;
    }

    renderFitmentControls();
    if (setupModeSelect) setupModeSelect.value = state.fitmentForm.setup_mode || ui.rim.setupMode;
    if (rearRimSection) rearRimSection.hidden = (state.fitmentForm.setup_mode || ui.rim.setupMode) !== "staggered";
    const invalidFields = state.fitmentFormState.validation === "invalid" ? validateFitmentForm() : [];
    document.querySelectorAll("[data-fitment-input]").forEach((input) => {
        const field = input.closest(".fitment-field");
        const invalid = invalidFields.includes(input.dataset.fitmentInput);
        if (field) field.setAttribute("data-invalid", String(invalid));
        input.setAttribute("aria-invalid", invalid ? "true" : "false");
    });

    const activeStep = state.fitmentActiveStep;
    if (shell) {
        const previousStep = shell.dataset.activeStep;
        shell.dataset.activeStep = String(activeStep);
        if (previousStep && previousStep !== String(activeStep)) {
            shell.classList.remove("fitment-step-transition");
            void shell.offsetWidth;
            shell.classList.add("fitment-step-transition");
            window.setTimeout(() => shell.classList.remove("fitment-step-transition"), 420);
        }
    }
    if (skipButton) {
        skipButton.textContent = activeStep === 2 && fitmentNeedsVehicleVariant(overview)
            ? (locale === "ru" ? "Выбрать комплектацию" : "Choose vehicle version")
            : (locale === "ru" ? "Вернуться без изменений" : "Back without changes");
    }
    document.querySelectorAll("[data-fitment-step-indicator]").forEach((indicator) => {
        const step = Number(indicator.dataset.fitmentStepIndicator);
        indicator.classList.toggle("active", step === activeStep);
        indicator.classList.toggle("complete", step < activeStep);
    });
    if (basicsCard) basicsCard.hidden = activeStep !== 1;
    if (vehicleSection) vehicleSection.hidden = activeStep !== 1;
    if (rimSection) rimSection.hidden = activeStep !== 2;
    if (overviewGrid) overviewGrid.hidden = activeStep !== 2;
    if (actions) actions.hidden = activeStep === 3;

    if (verdictCard) verdictCard.hidden = activeStep !== 3 || demoMode;
    if (verdictWarning) {
        verdictWarning.hidden = !state.fitmentCheck || state.fitmentCheck.execution_status === "failed";
    }
    if (verdictCheckButton) {
        const pending = ui.check.pending;
        const failed = state.fitmentCheck?.execution_status === "failed";
        verdictCheckButton.disabled = demoMode || ui.request.submitting || pending || ui.nextAction !== "run_standard_check";
        verdictCheckButton.textContent = pending
            ? (state.fitmentCheck.execution_status === "queued" ? "Проверка поставлена в очередь" : "Проверяем совместимость")
            : failed && state.fitmentCheck?.retry_mode !== "not_applicable" ? "Повторить" : t("fitment.check");
    }
    if (verdictCopy && !state.fitmentCheck && ui.nextAction !== "run_standard_check") {
        verdictCopy.textContent = locale === "ru"
            ? "Сначала выберите точную комплектацию автомобиля — это нужно для подтверждения заводских параметров."
            : "Select the exact vehicle version first to confirm factory specifications.";
    }
    if (state.fitmentCheck && verdictTitle && verdictCopy) {
        const check = state.fitmentCheck;
        const labels = {
            compatible: locale === "ru" ? "Совместимо" : "Compatible",
            compatible_with_conditions: locale === "ru" ? "Совместимо с условиями" : "Compatible with conditions",
            unknown: locale === "ru" ? "Недостаточно данных" : "Insufficient data",
            incompatible: locale === "ru" ? "Несовместимо" : "Incompatible",
            failed: locale === "ru" ? "Проверка не выполнена" : "Check failed",
            queued: locale === "ru" ? "Проверка поставлена в очередь" : "Check queued",
            processing: locale === "ru" ? "Проверяем совместимость" : "Checking compatibility",
        };
        verdictCard.dataset.status = check.verdict || check.execution_status;
        verdictTitle.textContent = labels[check.verdict || check.execution_status] || t("fitment.verdictTitle");
        verdictCopy.textContent = check.execution_status === "queued"
            ? "Проверка начнётся автоматически"
            : check.execution_status === "processing"
            ? "Сверяем параметры с данными выбранной комплектации"
            : check.execution_status === "failed"
            ? fitmentVerdictMessage({ code: check.error?.code || "provider_unavailable" })
            : check.verdict === "compatible"
                ? (locale === "ru" ? "Параметры совпадают с подтверждёнными данными выбранной комплектации." : "Parameters match the confirmed data for the selected vehicle version.")
                : "";
        const retryMessage = fitmentRetryMessage(check);
        if (retryMessage) verdictCopy.textContent = `${verdictCopy.textContent}${verdictCopy.textContent ? " " : ""}${retryMessage}`;
        if (verdictCurrentness) {
            verdictCurrentness.hidden = ui.check.isCurrent;
            verdictCurrentness.textContent = locale === "ru"
                ? "Параметры автомобиля или диска изменились. Этот результат сохранён в истории, но больше не актуален."
                : "Vehicle or wheel details changed. This result remains in history but is no longer current.";
        }
        renderFitmentVerdictGroup(
            "[data-fitment-verdict-blocking]",
            "[data-fitment-verdict-blocking-list]",
            check.blocking_issues || [],
            "blocking"
        );
        renderFitmentVerdictGroup(
            "[data-fitment-verdict-conditions]",
            "[data-fitment-verdict-conditions-list]",
            check.conditions || [],
            "conditions"
        );
        renderFitmentVerdictGroup(
            "[data-fitment-verdict-advisories]",
            "[data-fitment-verdict-advisories-list]",
            check.advisories || [],
            "advisories"
        );
        const groups = document.querySelector("[data-fitment-verdict-groups]");
        if (groups) {
            groups.hidden = ![...(check.blocking_issues || []), ...(check.conditions || []), ...(check.advisories || [])].length;
        }
        if (verdictFields) {
            const fieldResults = check.field_results || check.fields || [];
            verdictFields.replaceChildren();
            verdictFields.hidden = !fieldResults.length;
            const labelsByStatus = {
                pass: locale === "ru" ? "Подходит" : "Fits",
                conditional: locale === "ru" ? "Требуется условие" : "Condition required",
                unknown: locale === "ru" ? "Недостаточно данных" : "Insufficient data",
                fail: locale === "ru" ? "Конфликт" : "Conflict",
            };
            for (const field of fieldResults) {
                const line = document.createElement("div");
                line.className = "fitment-verdict-field";
                line.dataset.status = field.status || field.result || "unknown";
                line.textContent = `${field.label || field.field || ""}: ${labelsByStatus[field.status || field.result] || labelsByStatus.unknown}`;
                verdictFields.append(line);
            }
        }
    }

    setFitmentOverviewCollapsed(state.fitmentOverviewCollapsed);

    if (shell) shell.hidden = false;
    if (subtitle) subtitle.textContent = fitmentSubtitle(overview);
    if (readiness) readiness.dataset.ready = String(Boolean(overview.readiness?.ready));
    if (vehicleState) {
        vehicleState.textContent = ui.vehicle.state === "confirmed_ready"
            ? (locale === "ru" ? "Автомобиль подтверждён" : "Vehicle confirmed")
            : ui.vehicle.state === "unconfirmed"
                ? (locale === "ru" ? "Данные требуют подтверждения" : "Details need confirmation")
                : (locale === "ru" ? "Укажите автомобиль" : "Enter vehicle details");
        vehicleState.dataset.state = ui.vehicle.state;
    }
    if (modificationState) {
        modificationState.textContent = fitmentModificationStateLabel(ui);
        modificationState.dataset.state = ui.vehicle.modificationState;
    }
    if (rimState) {
        rimState.textContent = fitmentRimStateLabel(ui.rim.setupState);
        rimState.dataset.state = ui.rim.setupState;
    }
    if (rimAxes) {
        rimAxes.hidden = ui.rim.setupMode !== "staggered";
        rimAxes.textContent = ui.rim.setupMode === "staggered"
            ? `${locale === "ru" ? "Передняя ось" : "Front axle"}: ${fitmentRimStateLabel(ui.rim.front?.rim_setup_state)} / ${locale === "ru" ? "Задняя ось" : "Rear axle"}: ${fitmentRimStateLabel(ui.rim.rear?.rim_setup_state)}`
            : "";
    }
    if (readinessTitle) {
        readinessTitle.textContent = overview.readiness?.ready
            ? t("fitment.readinessReady")
            : t("fitment.readinessMissing");
    }
    if (readinessFields) {
        const missing = overview.readiness?.missing_fields || [];
        const unconfirmed = overview.readiness?.unconfirmed_fields || [];
        if (missing.length) {
            readinessFields.textContent = missing.map(fitmentFieldLabel).join(", ");
        } else if (unconfirmed.length) {
            readinessFields.textContent = `${t("fitment.readinessUnconfirmed")}: ${unconfirmed
                .map(fitmentFieldLabel)
                .join(", ")}`;
        } else {
            readinessFields.textContent =
                locale === "ru"
                    ? "Можно будет запускать отдельную проверку позже"
                    : "A separate check can be started later";
        }
    }
    if (missingDataWarning) {
        missingDataWarning.hidden = !((overview.readiness?.missing_fields || []).length);
    }
    document.querySelector("[data-fitment-vehicle-title]")?.replaceChildren(
        document.createTextNode(demoVehicleTitle(overview.vehicle))
    );
    const vehicleSpecs = fitmentVehicleSpecs(overview.vehicle);
    const vehicleSpecsTarget = document.querySelector("[data-fitment-vehicle-specs]");
    if (vehicleSpecsTarget) {
        vehicleSpecsTarget.textContent = vehicleSpecs;
        vehicleSpecsTarget.hidden = !vehicleSpecs;
    }
    document.querySelector("[data-fitment-card-vehicle-title]")?.replaceChildren(
        document.createTextNode(demoVehicleTitle(overview.vehicle))
    );
    const vehicleCardSpecs = document.querySelector("[data-fitment-card-vehicle-specs]");
    if (vehicleCardSpecs) {
        vehicleCardSpecs.textContent = vehicleSpecs;
        vehicleCardSpecs.hidden = !vehicleSpecs;
    }
    document.querySelector("[data-fitment-card-vehicle-meta]")?.replaceChildren(
        document.createTextNode(fitmentVehicleMeta(overview))
    );
    document.querySelector("[data-fitment-card-rim-title]")?.replaceChildren(
        document.createTextNode(demoRimTitle(overview.rim))
    );
    const rimSpecs = fitmentRimSpecs(overview.rim);
    const rimCardSpecs = document.querySelector("[data-fitment-card-rim-specs]");
    if (rimCardSpecs) {
        rimCardSpecs.textContent = rimSpecs;
        rimCardSpecs.hidden = !rimSpecs;
    }
    document.querySelector("[data-fitment-card-rim-meta]")?.replaceChildren(
        document.createTextNode(fitmentRimMeta(overview))
    );
    document.querySelector("[data-fitment-card-source-brand]")?.replaceChildren(
        document.createTextNode(fitmentSourceBrand(overview))
    );
    const sourceSku = document.querySelector("[data-fitment-card-source-sku]");
    if (sourceSku) {
        sourceSku.textContent = fitmentSourceSku(overview);
        sourceSku.hidden = !fitmentSourceSku(overview);
    }
    document.querySelector("[data-fitment-card-source-meta]")?.replaceChildren(
        document.createTextNode(overview?.rim?.has_product_url ? t("fitment.sourceAdded") : t("fitment.sourceCardMeta"))
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
    renderFitmentFieldStates(ui);
    if (pcdSelect) {
        const pcdKey = fitmentPcdOptionValue(state.fitmentForm.rim.bolt_count, state.fitmentForm.rim.pcd_mm);
        const hasOption = [...pcdSelect.options].some((option) => option.value === pcdKey);
        pcdSelect.value = hasOption ? pcdKey : pcdKey ? "custom" : "";
        if (pcdCustom) pcdCustom.hidden = pcdSelect.value !== "custom";
    }
    renderFitmentCandidates();
}

function renderFitmentSourceSteps() {
    const hasSourceUrl = Boolean(normalizeFitmentText(state.fitmentForm.rim.product_url));
    const hasResolvedFields = state.fitmentSourceAppliedFields.length > 0;
    const extractionFailed = Boolean(state.fitmentSourceStatus) && state.fitmentSourceStatusTone === "error";
    const states = {
        saved: hasSourceUrl ? "done" : "pending",
        extract: state.fitmentSourceResolving ? "current" : extractionFailed ? "error" : hasResolvedFields ? "done" : "pending",
        review: hasResolvedFields && !state.fitmentSourceResolving ? "current" : "pending",
        verdict: "pending",
    };
    document.querySelectorAll("[data-fitment-source-step]").forEach((step) => {
        step.dataset.state = states[step.dataset.fitmentSourceStep] || "pending";
    });
}

function renderFitmentRimVariants() {
    const picker = document.querySelector("[data-fitment-rim-variant-picker]");
    if (!picker) return;
    const variants = state.fitmentSourceVariants || [];
    picker.hidden = !variants.length;
    picker.replaceChildren();
    if (!variants.length) return;

    const title = document.createElement("strong");
    title.textContent = locale === "ru"
        ? "Выберите вариант диска"
        : "Choose the wheel variant";
    const copy = document.createElement("p");
    copy.textContent = locale === "ru"
        ? "Параметры будут добавлены только в незаполненные вручную поля."
        : "Only fields you have not entered manually will be filled.";
    const list = document.createElement("div");
    list.className = "fitment-rim-variant-list";
    for (const [index, variant] of variants.entries()) {
        const values = variant.values || {};
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fitment-rim-variant";
        button.dataset.fitmentRimVariant = String(index);
        const titleParts = [values.brand, values.model, variant.sku || values.sku].filter(Boolean);
        const technical = fitmentRimSpecs(values);
        button.textContent = [titleParts.join(" "), technical].filter(Boolean).join(" / ")
            || (locale === "ru" ? `Вариант ${index + 1}` : `Variant ${index + 1}`);
        list.append(button);
    }
    picker.append(title, copy, list);
}

function renderFitmentParserConflicts() {
    const container = document.querySelector("[data-fitment-parser-conflicts]");
    if (!container) return;
    const conflicts = state.fitmentSourceConflicts || [];
    container.replaceChildren();
    for (const conflict of conflicts) {
        const fieldName = conflict.field || "";
        const persisted = state.fitmentOverview?.rim_field_states?.[fieldName]
            || state.fitmentOverview?.front_rim?.field_states?.[fieldName];
        // The resolver only supplies parser candidates. A compare/replace card
        // is meaningful only where the server tells us a current value is user-confirmed.
        if (persisted?.state !== "confirmed") continue;
        const current = persisted.value;
        const suggested = conflict.candidates?.[0]?.value;
        if (suggested === null || suggested === undefined || String(suggested) === String(current)) continue;
        const row = document.createElement("div");
        row.className = "fitment-parser-conflict";
        const label = fitmentFieldLabel(`rim.${fieldName}`);
        row.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(current))} — Подтверждено пользователем</span><span>Новое автоматическое значение: ${escapeHtml(String(suggested))}</span>`;
        const actions = document.createElement("div");
        actions.className = "fitment-parser-conflict-actions";
        const keep = document.createElement("button");
        keep.type = "button";
        keep.className = "ghost-button compact-button";
        keep.textContent = locale === "ru" ? `Оставить ${current}` : `Keep ${current}`;
        keep.dataset.fitmentConflictKeep = fieldName;
        const use = document.createElement("button");
        use.type = "button";
        use.className = "ghost-button compact-button";
        use.textContent = locale === "ru" ? `Использовать ${suggested}` : `Use ${suggested}`;
        use.dataset.fitmentConflictUse = fieldName;
        use.dataset.fitmentConflictValue = String(suggested);
        actions.append(keep, use);
        row.append(actions);
        container.append(row);
    }
    container.hidden = !container.children.length;
}

function fitmentCatalogueErrorMessage() {
    return locale === "ru"
        ? "Не удалось загрузить варианты. Повторите попытку"
        : "Options could not be loaded. Try again";
}

async function loadFitmentCatalogue(kind, params = {}) {
    if (!state.fitmentJobId || shouldUseDemoFitment(state.fitmentJobId)) return;
    state.fitmentCatalogueControllers[kind]?.abort?.();
    const controller = new AbortController();
    state.fitmentCatalogueControllers[kind] = controller;
    state.fitmentCatalogue[kind] = { status: "loading", items: [] };
    renderFitment();
    try {
        const query = new URLSearchParams(params);
        const suffix = query.toString() ? `?${query}` : "";
        const response = await fetch(
            apiUrl(`/jobs/${state.fitmentJobId}/fitment/catalogue/${kind}${suffix}`, { includeIdentity: true }),
            { headers: withAuthHeaders(), signal: controller.signal }
        );
        if (response.status === 401) {
            showFitmentAuthRequired();
            return;
        }
        if (!response.ok) throw new Error(await parseApiError(response));
        const result = await response.json();
        if (state.fitmentCatalogueControllers[kind] !== controller) return;
        state.fitmentCatalogue[kind] = {
            status: result.outcome === "no_data" ? "no_data" : "loaded",
            items: Array.isArray(result.items) ? result.items : [],
        };
    } catch (error) {
        if (error?.name === "AbortError" || state.fitmentCatalogueControllers[kind] !== controller) return;
        state.fitmentCatalogue[kind] = { status: "failed", items: [] };
        state.fitmentMessage = fitmentCatalogueErrorMessage();
        state.fitmentMessageTone = "warning";
    } finally {
        if (state.fitmentCatalogueControllers[kind] === controller) renderFitment();
    }
}

function loadFitmentVehicleCatalogue() {
    if (shouldUseDemoFitment(state.fitmentJobId)) {
        const overview = state.fitmentOverview || {};
        state.fitmentCatalogue.makes = { status: "loaded", items: [{ value: overview.vehicle?.make || "Toyota", label: overview.vehicle?.make || "Toyota" }] };
        state.fitmentCatalogue.models = { status: "loaded", items: [{ value: overview.vehicle?.model || "Prius", label: overview.vehicle?.model || "Prius" }] };
        state.fitmentCatalogue.years = { status: "loaded", items: [{ value: String(overview.vehicle?.year || 2016), label: String(overview.vehicle?.year || 2016) }] };
        return;
    }
    void loadFitmentCatalogue("regions");
    const vehicle = state.fitmentForm.vehicle;
    if (vehicle.market) void loadFitmentCatalogue("makes", { region: vehicle.market });
    if (vehicle.market && vehicle.make) void loadFitmentCatalogue("models", { region: vehicle.market, make: vehicle.make });
    if (vehicle.market && vehicle.make && vehicle.model) void loadFitmentCatalogue("years", { region: vehicle.market, make: vehicle.make, model: vehicle.model });
}

async function loadFitmentOverview(jobId, { restoreReason = null, suppressAutomaticResolver = false } = {}) {
    if (!jobId) return;
    let restoration = "none";
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
            state.fitmentSourceIdentity = fitmentSourceIdentityFromOverview(overview);
            state.fitmentCheck = overview.current_check || null;
            state.fitmentFormState.baseline = cloneFitmentForm(state.fitmentForm);
            if (restoreReason) restoration = restoreFitmentTransientDraft({ reason: restoreReason, overview });
            loadFitmentVehicleCatalogue();
            if (fitmentCheckIsPending(state.fitmentCheck)) pollFitmentCheck(state.fitmentCheck.id, fitmentCheckContextKey());
            return restoration;
        }
        const response = await fetch(apiUrl(`/jobs/${jobId}/fitment`, { includeIdentity: true }), {
            headers: withAuthHeaders(),
        });
        if (response.status === 401) {
            showFitmentAuthRequired();
            return restoration;
        }
        if (!response.ok) throw new Error(await parseApiError(response));
        const overview = await response.json();
        state.fitmentOverview = overview;
        state.fitmentForm = fitmentFormFromOverview(overview);
        state.fitmentSourceIdentity = fitmentSourceIdentityFromOverview(overview);
        state.fitmentCheck = overview.current_check || null;
        state.fitmentFormState.baseline = cloneFitmentForm(state.fitmentForm);
        if (restoreReason) restoration = restoreFitmentTransientDraft({ reason: restoreReason, overview });
        loadFitmentVehicleCatalogue();
        if (fitmentCheckIsPending(state.fitmentCheck)) pollFitmentCheck(state.fitmentCheck.id, fitmentCheckContextKey());
        if (!suppressAutomaticResolver && restoration !== "restored" && overview?.rim?.product_url && state.fitmentSourceAutoResolvedForJob !== jobId) {
            state.fitmentSourceAutoResolvedForJob = jobId;
            void resolveFitmentRimSource({ automatic: true });
        }
    } catch (error) {
        state.fitmentOverview = null;
        state.fitmentForm = createEmptyFitmentForm();
        state.fitmentError = error?.message || t("errors.requestFailed");
    } finally {
        state.fitmentLoading = false;
        renderFitment();
    }
    return restoration;
}

function openFitmentView(jobId, { originView = state.view } = {}) {
    if (!jobId) return;
    clearFitmentCheckPolling();
    state.fitmentJobId = jobId;
    state.fitmentOriginView = originView;
    state.fitmentOriginJobId = jobId;
    state.fitmentOverview = null;
    state.fitmentCheck = null;
    state.fitmentActiveStep = 0;
    state.fitmentForm = createEmptyFitmentForm();
    state.fitmentFormState = { status: "clean", validation: "valid", baseline: null };
    state.fitmentCatalogue = {
        regions: { status: "idle", items: [] },
        makes: { status: "idle", items: [] },
        models: { status: "idle", items: [] },
        years: { status: "idle", items: [] },
    };
    state.fitmentError = "";
    state.fitmentMessage = "";
    state.fitmentSourceStatus = "";
    state.fitmentSourceStatusTone = "neutral";
    state.fitmentSourceAppliedFields = [];
    state.fitmentSourceDetected = false;
    state.fitmentSourceVariants = [];
    state.fitmentSourceConflicts = [];
    state.fitmentSourceIdentity = { sourceFingerprint: null, selectedVariantSku: null, variantState: "not_applicable" };
    state.fitmentRimManualFields = [];
    state.fitmentRestoreConflict = null;
    state.fitmentSourceAutoResolvedForJob = "";
    setView("fitment");
    void loadFitmentOverview(jobId, { restoreReason: "navigation" });
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

function fitmentSourceErrorMessage(error) {
    const message = error?.message || "";
    let reasonCode = "";
    try {
        reasonCode = JSON.parse(message)?.code || "";
    } catch {
        // Legacy backend errors are plain text.
    }
    if (reasonCode === "rim_source_url_rejected") {
        return locale === "ru"
            ? "Ссылка должна вести на публичную HTTPS-страницу товара. Проверьте адрес или заполните параметры вручную."
            : "Use a public HTTPS product page, or enter the wheel details manually.";
    }
    if (reasonCode === "rim_source_redirect_failed") {
        return locale === "ru"
            ? "Страница диска перенаправляет слишком много раз. Откройте карточку товара напрямую или заполните параметры вручную."
            : "The product page redirects too many times. Open the product page directly, or enter the wheel details manually.";
    }
    if (reasonCode === "rim_source_unsupported_document") {
        return locale === "ru"
            ? "Ссылка не ведёт на поддерживаемую страницу товара. Укажите страницу диска или заполните параметры вручную."
            : "The link is not a supported product page. Use a wheel product page, or enter the details manually.";
    }
    if (reasonCode === "rim_source_document_too_large") {
        return locale === "ru"
            ? "Страница диска слишком велика для автоматического разбора. Заполните параметры вручную."
            : "The product page is too large for automatic extraction. Enter the wheel details manually.";
    }
    if (reasonCode === "rim_source_fetch_failed") {
        return locale === "ru"
            ? "Страница диска сейчас недоступна. Повторите позже или заполните параметры вручную."
            : "The product page is unavailable right now. Try again later, or enter the wheel details manually.";
    }
    if (/too many requests/i.test(message)) {
        return locale === "ru"
            ? "Слишком много попыток. Повторите извлечение позже."
            : "Too many attempts. Try extracting the parameters later.";
    }
    if (/disabled/i.test(message)) {
        return locale === "ru"
            ? "Автоматическое извлечение временно недоступно. Сохраните ссылку и заполните параметры вручную."
            : "Automatic extraction is temporarily unavailable. Save the link and enter the parameters manually.";
    }
    return locale === "ru"
        ? "Не удалось извлечь параметры автоматически. Проверьте ссылку или заполните поля вручную."
        : "Parameters could not be extracted automatically. Check the link or enter them manually.";
}

function applyRimSourceValues(values) {
    const appliedFields = [];
    for (const [fieldName, value] of Object.entries(values || {})) {
        const currentValue = state.fitmentForm.rim[fieldName];
        if (
            Object.hasOwn(state.fitmentForm.rim, fieldName)
            && !state.fitmentRimManualFields.includes(fieldName)
            && (currentValue === null || currentValue === undefined || currentValue === "")
            && value !== null
            && value !== undefined
            && value !== ""
        ) {
            state.fitmentForm.rim[fieldName] = value;
            appliedFields.push(fieldName);
        }
    }
    return appliedFields;
}

function selectFitmentRimVariant(index) {
    const variant = state.fitmentSourceVariants[index];
    if (!variant) return;
    const appliedFields = applyRimSourceValues(variant.values);
    state.fitmentSourceAppliedFields = appliedFields;
    state.fitmentSourceDetected = Object.keys(variant.values || {}).length > 0;
    state.fitmentSourceVariants = [];
    state.fitmentSourceIdentity = {
        ...state.fitmentSourceIdentity,
        selectedVariantSku: variant.sku || null,
        variantState: "selected",
    };
    state.fitmentSourceStatus = appliedFields.length
        ? (locale === "ru"
            ? "Вариант выбран. Проверьте заполненные параметры и сохраните их."
            : "Variant selected. Review the filled parameters and save them.")
        : (locale === "ru"
            ? "Вариант выбран. Ручные значения сохранены; при необходимости дополните параметры."
            : "Variant selected. Manual values were preserved; complete any missing parameters.");
    state.fitmentSourceStatusTone = "success";
    renderFitment();
    scrollFitmentTo('[data-fitment-section="rim"]');
}

function resolveFitmentParserConflict(fieldName, value = undefined) {
    if (value !== undefined && Object.hasOwn(state.fitmentForm.rim, fieldName)) {
        state.fitmentForm.rim[fieldName] = value;
        if (!state.fitmentRimManualFields.includes(fieldName)) state.fitmentRimManualFields.push(fieldName);
        markFitmentDirty();
    }
    state.fitmentSourceConflicts = state.fitmentSourceConflicts.filter((conflict) => conflict.field !== fieldName);
    renderFitment();
}

async function resolveFitmentRimSource({ automatic = false } = {}) {
    if (!state.fitmentJobId || shouldUseDemoFitment(state.fitmentJobId) || state.fitmentSourceResolving) return;
    const productUrl = normalizeFitmentText(state.fitmentForm.rim.product_url);
    if (!productUrl) {
        state.fitmentSourceStatus = locale === "ru" ? "Введите ссылку на диск" : "Enter a wheel link";
        state.fitmentSourceStatusTone = "error";
        renderFitment();
        return;
    }
    state.fitmentSourceResolving = true;
    state.fitmentSourceAppliedFields = [];
    state.fitmentSourceDetected = false;
    state.fitmentSourceVariants = [];
    state.fitmentSourceStatus = locale === "ru" ? "Получаем параметры диска…" : "Extracting wheel parameters…";
    state.fitmentSourceStatusTone = "neutral";
    renderFitment();
    state.fitmentSourceController?.abort?.();
    const controller = new AbortController();
    state.fitmentSourceController = controller;
    const requestTimeout = window.setTimeout(() => controller.abort(), RIM_SOURCE_RESOLVE_TIMEOUT_MS);
    try {
        const response = await fetch(
            apiUrl(`/jobs/${state.fitmentJobId}/fitment/rim-source/resolve`, { includeIdentity: true }),
            {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ product_url: productUrl }),
                signal: controller.signal,
            }
        );
        if (response.status === 401) {
            showFitmentAuthRequired();
            return;
        }
        if (!response.ok) throw new Error(await parseApiError(response));
        const result = await response.json();
        state.fitmentForm.rim.product_url = result.final_url || productUrl;
        state.fitmentSourceVariants = result.selection_required ? (result.variants || []) : [];
        state.fitmentSourceConflicts = result.conflicts || [];
        state.fitmentSourceIdentity = {
            sourceFingerprint: result.source_fingerprint || null,
            selectedVariantSku: result.selected_variant_sku || null,
            variantState: result.selection_required ? "selection_required" : result.selected_variant_sku ? "selected" : "none",
        };
        const resolvedEntries = Object.entries(result.values || {}).filter(
            ([, value]) => value !== null && value !== undefined && value !== ""
        );
        state.fitmentSourceDetected = resolvedEntries.length > 0;
        const appliedFields = applyRimSourceValues(result.values);
        state.fitmentSourceAppliedFields = appliedFields;
        const conflictFields = (result.conflicts || []).map((conflict) => conflict.field);
        state.fitmentSourceStatus = result.selection_required
            ? locale === "ru"
                ? "Найдено несколько вариантов. Выберите подходящий SKU, затем проверьте параметры."
                : "Several variants were found. Choose the matching SKU, then review the parameters."
            : !resolvedEntries.length
            ? locale === "ru"
                ? "По этой ссылке не удалось распознать параметры. Проверьте ссылку или заполните поля вручную."
                : "No wheel parameters could be recognised from this link. Check the URL or fill in the fields manually."
            : conflictFields.length
            ? `${locale === "ru" ? "Параметры заполнены; проверьте" : "Parameters filled; review"}: ${conflictFields.join(", ")}`
            : locale === "ru"
                ? "Параметры заполнены. Проверьте их и сохраните для запуска проверки совместимости."
                : "Parameters filled. Review them and save to run the compatibility check.";
        state.fitmentSourceStatusTone = result.selection_required || !resolvedEntries.length || conflictFields.length ? "warning" : "success";
        state.fitmentSourceOpen = !resolvedEntries.length ? true : result.selection_required ? true : automatic ? false : state.fitmentSourceOpen;
    } catch (error) {
        state.fitmentSourceStatus = fitmentSourceErrorMessage(error);
        state.fitmentSourceStatusTone = "error";
        if (automatic) {
            state.fitmentSourceOpen = true;
            state.fitmentMessage = state.fitmentSourceStatus;
            state.fitmentMessageTone = "warning";
        }
    } finally {
        window.clearTimeout(requestTimeout);
        if (state.fitmentSourceController === controller) state.fitmentSourceController = null;
        state.fitmentSourceResolving = false;
        renderFitment();
        if (state.fitmentSourceStatusTone !== "error") {
            scrollFitmentTo("[data-fitment-section=\"rim\"]");
        }
    }
}

async function loadFitmentVehicleVariants() {
    if (!state.fitmentJobId || state.fitmentVehicleVariantsLoading) return;
    if (fitmentFormIsDirty()) {
        state.fitmentError = locale === "ru"
            ? "Сначала сохраните изменения автомобиля, затем подберите комплектацию."
            : "Save vehicle changes before finding a vehicle version.";
        renderFitment();
        return;
    }
    const vehicle = state.fitmentForm.vehicle;
    if (!vehicle.make || !vehicle.model || !vehicle.year) {
        state.fitmentError = locale === "ru"
            ? "Укажите марку, модель и год автомобиля, чтобы подобрать комплектацию."
            : "Enter the vehicle make, model, and year to find its exact version.";
        renderFitment();
        return;
    }
    if (shouldUseDemoFitment(state.fitmentJobId)) {
        state.fitmentMessage = locale === "ru"
            ? "Для примера выберите параметры диска на следующем шаге."
            : "For this example, continue to the wheel details.";
        state.fitmentMessageTone = "success";
        state.fitmentActiveStep = 2;
        renderFitment();
        scrollFitmentTo('[data-fitment-section="rim"]');
        return;
    }
    state.fitmentVehicleVariantsLoading = true;
    state.fitmentLookup = { status: "loading", outcome: "" };
    state.fitmentError = "";
    renderFitment();
    try {
        const response = await fetch(
            apiUrl(`/jobs/${state.fitmentJobId}/fitment/vehicle-variants`, { includeIdentity: true }),
            { method: "POST", headers: withAuthHeaders() }
        );
        if (response.status === 401) {
            showFitmentAuthRequired();
            return;
        }
        if (!response.ok) throw new Error(await parseApiError(response));
        const result = await response.json();
        state.fitmentLookup = { status: result.outcome === "no_match" ? "no_match" : "loaded", outcome: result.outcome || "" };
        state.fitmentVehicleVariants = result.outcome === "multiple" ? (result.variants || []) : [];
        if (result.outcome === "single") {
            await loadFitmentOverview(state.fitmentJobId);
            state.fitmentMessage = locale === "ru" ? "Комплектация выбрана автоматически." : "Vehicle version was selected automatically.";
            state.fitmentMessageTone = "success";
        } else if (result.outcome === "no_match") {
            state.fitmentMessage = locale === "ru"
                ? "Для выбранного автомобиля данные о комплектации не найдены."
                : "No vehicle version data was found for the selected vehicle.";
            state.fitmentMessageTone = "warning";
        } else {
            state.fitmentMessage = locale === "ru"
                ? "Выберите подходящую комплектацию из списка ниже."
                : "Choose the matching vehicle version below.";
            state.fitmentMessageTone = "success";
        }
    } catch (error) {
        state.fitmentLookup = { status: "failed", outcome: "" };
        state.fitmentError = error?.message || t("errors.requestFailed");
    } finally {
        state.fitmentVehicleVariantsLoading = false;
        renderFitment();
    }
}

function clearFitmentCheckPolling() {
    if (state.fitmentCheckPollTimer) window.clearTimeout(state.fitmentCheckPollTimer);
    state.fitmentCheckPollTimer = null;
    state.fitmentCheckPollToken += 1;
}

function clearFitmentRuntimeRequests() {
    clearFitmentCheckPolling();
    Object.values(state.fitmentCatalogueControllers).forEach((controller) => controller?.abort?.());
    state.fitmentCatalogueControllers = {};
    state.fitmentSourceController?.abort?.();
    state.fitmentSourceController = null;
}

function fitmentCheckIsPending(check = state.fitmentCheck) {
    return check?.execution_status === "queued" || check?.execution_status === "processing";
}

function fitmentCheckContextKey() {
    const overview = state.fitmentOverview;
    return [
        state.fitmentJobId,
        overview?.vehicle_identity_id,
        overview?.rim_setup_id,
        overview?.vehicle_revision,
        overview?.rim_setup_revision,
        overview?.rim_revision,
        overview?.setup_mode,
        overview?.front_rim?.source_fingerprint,
        overview?.front_rim?.selected_variant_sku,
        overview?.rear_rim?.source_fingerprint,
        overview?.rear_rim?.selected_variant_sku,
    ].join(":");
}

async function refreshFitmentCheckCurrentness() {
    const checkId = state.fitmentCheck?.id;
    if (!checkId || !state.fitmentJobId || shouldUseDemoFitment(state.fitmentJobId)) return;
    try {
        const response = await fetch(apiUrl(`/fitment/checks/${checkId}`, { includeIdentity: true }), { headers: withAuthHeaders() });
        if (response.status === 401) {
            showFitmentAuthRequired();
            return;
        }
        if (!response.ok) return;
        state.fitmentCheck = await response.json();
    } catch {
        // Currentness is refreshed on the next explicit check/history read.
    }
}

function pollFitmentCheck(checkId, contextKey = fitmentCheckContextKey()) {
    clearFitmentCheckPolling();
    const token = state.fitmentCheckPollToken;
    const poll = async () => {
        if (token !== state.fitmentCheckPollToken || state.view !== "fitment" || contextKey !== fitmentCheckContextKey()) return;
        try {
            const response = await fetch(apiUrl(`/fitment/checks/${checkId}`, { includeIdentity: true }), { headers: withAuthHeaders() });
            if (response.status === 401) {
                showFitmentAuthRequired();
                return;
            }
            if (!response.ok) throw new Error(await parseApiError(response));
            const check = await response.json();
            if (token !== state.fitmentCheckPollToken || contextKey !== fitmentCheckContextKey()) return;
            state.fitmentCheck = check;
            state.fitmentChecking = fitmentCheckIsPending(check);
            renderFitment();
            if (fitmentCheckIsPending(check)) {
                state.fitmentCheckPollTimer = window.setTimeout(poll, POLL_INTERVAL_MS);
            }
        } catch (error) {
            if (token !== state.fitmentCheckPollToken) return;
            state.fitmentChecking = false;
            state.fitmentError = error?.message || t("errors.requestFailed");
            renderFitment();
        }
    };
    void poll();
}

async function runFitmentCheck() {
    const overview = state.fitmentOverview;
    if (fitmentNextAction(overview) !== "run_standard_check" || shouldUseDemoFitment(state.fitmentJobId) || state.fitmentChecking) return;
    state.fitmentChecking = true;
    state.fitmentError = "";
    renderFitment();
    try {
        const response = await fetch(apiUrl("/fitment/checks", { includeIdentity: true }), {
            method: "POST",
            headers: withAuthHeaders({
                "Content-Type": "application/json",
                "Idempotency-Key": makeIdempotencyKey(),
            }),
            body: JSON.stringify({
                vehicle_identity_id: overview.vehicle_identity_id,
                rim_setup_id: overview.rim_setup_id,
                render_job_id: overview.job_id,
                trigger: "user_requested",
                mode: "standard",
            }),
        });
        if (response.status === 401) {
            showFitmentAuthRequired();
            return;
        }
        if (!response.ok) throw new Error(await parseApiError(response));
        state.fitmentCheck = await response.json();
        if (fitmentCheckIsPending(state.fitmentCheck)) {
            pollFitmentCheck(state.fitmentCheck.id, fitmentCheckContextKey());
        }
    } catch (error) {
        state.fitmentError = error?.message || t("errors.requestFailed");
    } finally {
        if (!fitmentCheckIsPending(state.fitmentCheck)) state.fitmentChecking = false;
        renderFitment();
    }
}

async function applyFitmentVehicleVariant(variant) {
    const overview = state.fitmentOverview;
    if (!overview || !variant || state.fitmentVehicleVariantApplying) return;
    state.fitmentVehicleVariantApplying = true;
    renderFitment();
    try {
        const response = await fetch(
            apiUrl(`/jobs/${state.fitmentJobId}/fitment/vehicle-variants/apply`, { includeIdentity: true }),
            {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ expected_vehicle_revision: overview.vehicle_revision, ...variant }),
            }
        );
        if (response.status === 401) {
            showFitmentAuthRequired();
            return;
        }
        if (response.status === 409) {
            state.fitmentVehicleVariants = [];
            await loadFitmentOverview(state.fitmentJobId);
            state.fitmentMessage = locale === "ru"
                ? "Данные автомобиля изменились. Список комплектаций обновлён; выберите вариант ещё раз."
                : "Vehicle details changed. The version list was refreshed; choose again.";
            state.fitmentMessageTone = "warning";
            return;
        }
        if (!response.ok) throw new Error(await parseApiError(response));
        state.fitmentOverview = await response.json();
        state.fitmentForm = fitmentFormFromOverview(state.fitmentOverview);
        state.fitmentSourceIdentity = fitmentSourceIdentityFromOverview(state.fitmentOverview);
        await refreshFitmentCheckCurrentness();
        state.fitmentActiveStep = 2;
    } catch (error) {
        state.fitmentError = error?.message || t("errors.requestFailed");
    } finally {
        state.fitmentVehicleVariantApplying = false;
        renderFitment();
    }
}

async function saveFitment(event) {
    event?.preventDefault?.();
    if (!state.fitmentJobId || state.fitmentSaving) return;
    const missing = validateFitmentForm();
    if (missing.length) {
        state.fitmentFormState.status = "dirty";
        state.fitmentError = locale === "ru"
            ? `Заполните обязательные поля: ${missing.map(fitmentFieldLabel).join(", ")}`
            : `Complete the required fields: ${missing.map(fitmentFieldLabel).join(", ")}`;
        renderFitment();
        return;
    }
    state.fitmentFormState.validation = "valid";
    state.fitmentFormState.status = "saving";
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
            state.fitmentFormState.baseline = cloneFitmentForm(state.fitmentForm);
            state.fitmentFormState.status = "clean";
            state.fitmentMessage = t("fitment.saveSuccess");
            state.fitmentMessageTone = "success";
            state.fitmentActiveStep = Math.min(3, Math.max(2, state.fitmentActiveStep + 1));
            return;
        }
        const response = await fetch(
            apiUrl(`/jobs/${state.fitmentJobId}/fitment`, { includeIdentity: true }),
            {
                method: "PATCH",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(fitmentPayload()),
            }
        );
        if (response.status === 401) {
            showFitmentAuthRequired();
            return;
        }
        if (!response.ok) {
            const detail = await parseApiError(response);
            throw new Error(response.status === 409 ? t("fitment.stale") : detail);
        }
        const overview = await response.json();
        state.fitmentOverview = overview;
        state.fitmentForm = fitmentFormFromOverview(overview);
        state.fitmentSourceIdentity = fitmentSourceIdentityFromOverview(overview);
        await refreshFitmentCheckCurrentness();
        state.fitmentFormState.baseline = cloneFitmentForm(state.fitmentForm);
        state.fitmentFormState.status = "clean";
        const savedFromStep = state.fitmentActiveStep;
        const nextStep = fitmentNextStep(overview);
        const nextAction = fitmentNextAction(overview);
        void loadRenderHistory({ silent: true });
        if (savedFromStep === 1) {
            state.fitmentActiveStep = 2;
            state.fitmentMessage = fitmentNextAction(overview) === "run_standard_check"
                ? (locale === "ru" ? "Автомобиль сохранён. Проверьте параметры диска." : "Vehicle saved. Review the wheel details.")
                : (locale === "ru" ? "Автомобиль сохранён. Заполните параметры диска; комплектацию можно выбрать перед итоговой проверкой." : "Vehicle saved. Add wheel details; choose the exact vehicle version before the final check.");
            state.fitmentMessageTone = "success";
            scrollFitmentTo('[data-fitment-section="rim"]');
        } else if (nextAction === "select_vehicle_variant") {
            state.fitmentActiveStep = 1;
            state.fitmentMessage = locale === "ru"
                ? "Параметры диска сохранены. Теперь выберите точную комплектацию автомобиля."
                : "Wheel details saved. Now choose the exact vehicle version.";
            state.fitmentMessageTone = "success";
            void loadFitmentVehicleVariants();
            scrollFitmentTo('[data-fitment-section="vehicle"]');
        } else if (nextAction === "complete_vehicle_details") {
            state.fitmentActiveStep = 1;
            state.fitmentMessage = nextStep.message;
            state.fitmentMessageTone = "warning";
            scrollFitmentTo('[data-fitment-section="vehicle"]');
        } else if (nextAction === "run_standard_check") {
            state.fitmentActiveStep = 3;
            state.fitmentMessage = locale === "ru" ? "Данные сохранены. Проверку совместимости можно запустить отдельно." : "Details saved. You can start the compatibility check separately.";
            state.fitmentMessageTone = "success";
        } else {
            state.fitmentMessage = fitmentNextAction(overview) === "run_standard_check"
                ? nextStep.message
                : (locale === "ru" ? "Чтобы получить вывод, выберите точную комплектацию автомобиля." : "Choose the exact vehicle version to get the result.");
            state.fitmentMessageTone = "warning";
            scrollFitmentTo("[data-fitment-shell]");
        }
    } catch (error) {
        state.fitmentFormState.status = "save_failed";
        state.fitmentError = error?.message || t("errors.requestFailed");
    } finally {
        state.fitmentSaving = false;
        if (state.fitmentFormState.status === "saving") markFitmentDirty();
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
    const topbar = document.querySelector(".topbar");
    const applyCaption = (text) => {
        if (caption) caption.textContent = text;
        if (topbar) topbar.classList.toggle("has-long-caption", String(text).length > 9);
    };
    if (state.view === "render-detail") {
        applyCaption(locale === "ru" ? "Детали примерки" : "Try-on details");
        return;
    }
    const captionKey = state.view === "photo-guide" ? "photoGuide" : state.view;
    applyCaption(t(`caption.${captionKey}`));
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
    const viewChanged = state.view !== view;
    const leavingFitment = viewChanged && state.view === "fitment" && view !== "fitment";
    if (leavingFitment) {
        persistFitmentTransientDraft("navigation");
        clearFitmentRuntimeRequests();
    }
    state.view = view;
    if (view !== "fitment") clearFitmentCheckPolling();
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
    if (viewChanged) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    refreshButtonsForCurrentView();
    if (view === "dashboard") {
        void loadDashboardData({ silent: true });
    } else if (view === "wallet") {
        void loadCabinet({ silent: true });
    } else if (view === "renders") {
        void loadRenderHistory({ silent: true });
    } else if (view === "render-detail") {
        renderRenderDetail();
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
    renderConfirmation();
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
    const authNotice = document.querySelector("[data-wallet-auth-notice]");
    if (authNotice) {
        const visible = !hasFrontendAuth();
        authNotice.hidden = !visible;
        authNotice.dataset.visible = String(visible);
        authNotice.setAttribute("aria-hidden", String(!visible));
    }
}

function focusWalletAuthNotice() {
    const notice = document.querySelector("[data-wallet-auth-notice]");
    if (!notice || notice.hidden) return;
    notice.scrollIntoView({ behavior: "smooth", block: "center" });
    notice.classList.remove("wallet-auth-attention");
    window.requestAnimationFrame(() => notice.classList.add("wallet-auth-attention"));
    window.setTimeout(() => notice.classList.remove("wallet-auth-attention"), 1100);
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
    const balanceUnit = document.querySelector("[data-balance-unit]");
    const balanceNoteValue = document.querySelector("[data-balance-note-value]");
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
    if (balanceUnit) balanceUnit.textContent = formatRenderCount(state.balance ?? 0).replace(/^\d+\s+/, "");
    if (balanceNoteValue) balanceNoteValue.textContent = getAccountLabel();

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
    document.querySelector("[data-wallet-expiry-section]")?.toggleAttribute("hidden", expiryItems.length === 0);
    if (expiryList) {
        expiryList.innerHTML = expiryItems.length ? renderExpiryRows(expiryItems) : "";
    }
    if (expiryNote) {
        const firstCohort = expiryItems[0] || null;
        expiryNote.hidden = !firstCohort;
        expiryNote.textContent = firstCohort
            ? (
                locale === "ru"
                    ? `Сначала будут использованы ${formatRenderCount(firstCohort.credits)} со сроком ${expiryLabel(firstCohort.expiresAt)}.`
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
                            <strong>${formatRub(item.amount)} / ${item.credits} ${t("credits")}</strong>
                            <div class="meta">Robokassa — ${item.createdAt}</div>
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
                creditsLabel: formatRenderCount(credits),
            })
        )
    );
    const payButton = document.querySelector("[data-pay-button]");
    if (payButton) payButton.textContent = state.walletBusy ? t("wallet.openingPayment") : t("wallet.pay");
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
        return `${formatIdentityNumber(rim.wheel_diameter_in)}" / ${formatIdentityNumber(rim.wheel_width_j)}J / ${formatPcdDisplay(rim.pcd_display)}`;
    }
    if (rim.wheel_diameter_in && rim.wheel_width_j && rim.bolt_count && rim.pcd_mm) {
        return `${formatIdentityNumber(rim.wheel_diameter_in)}" / ${formatIdentityNumber(rim.wheel_width_j)}J / ${rim.bolt_count}×${formatIdentityNumber(rim.pcd_mm)}`;
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
    return state.creditPackages
        .filter((item) => Number(item.remainingCredits || 0) > 0 && item.expiresAt && Date.parse(item.expiresAt) > Date.now())
        .map((item) => ({
            key: item.id || `${item.source}-${item.expiresAt}`,
            credits: Number(item.remainingCredits),
            expiresAt: item.expiresAt,
            meta: item.label || (item.source === "starter_grant" ? "Стартовый пакет" : "Пакет примерок"),
        }))
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
    if (downloadUrl.startsWith("/")) {
        return getWebsiteAuthToken()
            ? apiUrl(downloadUrl)
            : apiUrl(downloadUrl, { includeIdentity: true });
    }
    if (canUseIdentityAssetUrls()) return withIdentityQuery(downloadUrl);
    return getWebsiteAuthToken() ? downloadUrl : "";
}

function proxiedAssetUrl(asset) {
    const assetPath = asset?.download_url;
    if (!assetPath) return "";
    // Website auth lives in Authorization header, so direct <img src> or <a href>
    // cannot use protected asset endpoints. Those flows must go through fetch+blob.
    if (assetPath.startsWith("/")) {
        if (getWebsiteAuthToken()) return "";
        return apiUrl(assetPath, { includeIdentity: true });
    }
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
        if (state.view === "render-detail") renderRenderDetail();
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
    if (getWebsiteAuthToken()) return resultUrlForJob(job);
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

function feedbackReasonPickerVisible(job) {
    return feedbackSentimentForJob(job) === "disliked";
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
    delete state.feedbackReasonPickerByJob[jobId];
    state.renderHistory = state.renderHistory.map((job) => (
        job.job_id === jobId ? { ...job, feedback: normalized } : job
    ));
}

function mergeHistoryFeedbackState(jobs) {
    jobs.forEach((job) => {
        if (!job?.job_id) return;
        if (state.feedbackBusyByJob[job.job_id]) return;
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
                <button type="button" data-history-view="${escapeHtml(job.job_id)}" data-asset-view="original" class="${activeView === "original" ? "active" : ""}" aria-selected="${activeView === "original"}" ${originalAvailable ? "" : "disabled"}>До</button>
                <button type="button" data-history-view="${escapeHtml(job.job_id)}" data-asset-view="result" class="${activeView === "result" ? "active" : ""}" aria-selected="${activeView === "result"}" ${resultAvailable ? "" : "disabled"}>После</button>
            </div>
            <div class="render-asset-frame" data-asset-frame>
                ${activeAvailable && activeUrl ? `
                    <img src="${escapeHtml(activeUrl)}" alt="${escapeHtml(activeView === "original" ? "Исходное фото" : "Результат")}" class="render-full-image" data-asset-image data-job-id="${escapeHtml(job.job_id)}" data-asset-kind="${escapeHtml(assetErrorKey(activeView))}">
                ` : originalBlobLoading ? renderAssetMissingState("Загружаем исходное фото…") : renderAssetMissingState()}
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
    const reasonsVisible = feedbackReasonPickerVisible(job);
    const guestDemo = isGuestRenderJob(job);
    const notice = state.feedbackNoticeByJob[jobId] || "";

    return `
        <section class="render-feedback" aria-live="polite">
            <h3>Оценка результата</h3>
            <p>${guestDemo ? "Гостевой пример: оценка сохранится только в этом браузере" : "Помогите улучшить следующие примерки"}</p>
            <div class="render-feedback-actions">
                <button type="button" class="render-feedback-button like ${selected === "liked" ? "selected" : ""}" data-history-feedback="${escapeHtml(jobId)}" data-feedback-sentiment="liked" ${busy ? "disabled" : ""}>👍 Удачный результат</button>
                <button type="button" class="render-feedback-button dislike ${reasonsVisible ? "selected" : ""}" data-history-feedback="${escapeHtml(jobId)}" data-feedback-sentiment="disliked" ${busy ? "disabled" : ""}>👎 Нужна доработка</button>
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
    const optimisticFeedback = deleting
        ? null
        : guestFeedbackRecord(
            {
                sentiment,
                reason: reason !== undefined
                    ? reason
                    : sentiment === "liked"
                        ? null
                        : currentFeedback?.reason || null,
            },
            currentFeedback,
        );
    state.feedbackBusyByJob[jobId] = true;
    state.feedbackErrorByJob[jobId] = "";
    if (reason === undefined && sentiment !== "liked") {
        setFeedbackNotice(jobId, "");
    }
    setFeedbackRecord(jobId, optimisticFeedback);
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
            void trackEvent("feedback_submitted", { job_id: jobId, sentiment, reason: reason || null });
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
        setFeedbackRecord(jobId, currentFeedback);
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
    const canOpen = status === "completed";
    const hasResult = hasAssetSource(job, "result");
    const hasOriginal = hasAssetSource(job, "original");
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
          ? `<button type="button" class="ghost-button compact-button" data-open-render-detail="${escapeHtml(job.job_id)}">Посмотреть</button>`
          : "";
    const statusMarkup = status === "completed"
        ? ""
        : `<div class="render-info-footer"><div class="status-pill ${statusClass(status)}">${statusLabel(status)}</div></div>`;
    return `
        <article class="render-card cabinet-render-card">
            <div class="render-summary">
                <div class="render-thumb-wrap">
                    ${hasResult && resultUrl ? `<img src="${escapeHtml(resultUrl)}" alt="" class="render-thumb-image" data-asset-image data-job-id="${escapeHtml(job.job_id)}" data-asset-kind="result">` : `<div class="render-thumb"></div>`}
                </div>
                <div class="render-body">
                    <div class="render-info-island">
                        <div class="render-title">${escapeHtml(title)}</div>
                        <div class="render-subtitle ${rimSummary ? "render-rim-specs" : ""}">${escapeHtml(subtitle)}</div>
                        ${metaText ? `<div class="render-meta">${escapeHtml(metaText)}</div>` : ""}
                        ${guestDemo ? `<div class="render-demo-note">Гостевой пример</div>` : ""}
                        ${statusMarkup}
                    </div>
                </div>
                <div class="render-card-action">${action}</div>
            </div>
        </article>
    `;
}

function renderRenderDetail() {
    const container = document.querySelector("[data-render-detail]");
    if (!container) return;
    const job = state.renderHistory.find((item) => item.job_id === state.renderDetailJobId);
    if (!job) {
        if (state.renderDetailLoading) {
            container.innerHTML = `<div class="render-empty" aria-live="polite"><strong>Загружаем примерку…</strong></div>`;
        } else {
            const message = state.renderDetailError || "Примерка не найдена";
            container.innerHTML = `<div class="render-empty"><strong>${escapeHtml(message)}</strong><button type="button" class="ghost-button compact-button" data-nav="renders">К моим примеркам</button></div>`;
        }
        return;
    }
    const downloadUrl = hasAssetSource(job, "result") ? downloadUrlForJob(job) : "";
    const fitmentOverview = state.fitmentContextByJob[job.job_id] || null;
    const fitmentAction = fitmentAvailable(job)
        ? `<button type="button" class="ghost-button compact-button" data-open-fitment="${escapeHtml(job.job_id)}" data-origin-view="render-detail">${escapeHtml(fitmentReturnAction(fitmentOverview))}</button>`
        : "";
    container.innerHTML = `
        <div class="render-detail-page">
            <button type="button" class="ghost-button compact-button" data-nav="renders">← К моим примеркам</button>
            <h2>${escapeHtml(humanRenderTitle(job))}</h2>
            <p class="meta">${escapeHtml(formatDateTime(job.created_at))}</p>
            ${renderHistoryViewer(job)}
            <div class="render-expanded-actions">
                ${downloadUrl ? `<a class="ghost-button compact-button" href="${escapeHtml(downloadUrl)}" download>Скачать результат</a>` : ""}
                <button type="button" class="ghost-button compact-button" data-share-history-result="${escapeHtml(job.job_id)}">Поделиться</button>
                ${fitmentAction}
                <button type="button" class="ghost-button compact-button" data-repeat-render="${escapeHtml(job.job_id)}">Повторить с этими фото</button>
            </div>
            ${renderFeedbackBlock(job)}
        </div>`;
}

function openRenderDetail(jobId, originView = "renders") {
    void trackEvent("result_opened", { job_id: jobId, origin_view: originView });
    state.renderDetailJobId = jobId;
    state.fitmentOriginView = originView;
    state.renderDetailError = "";
    setView("render-detail");
    void loadFitmentReturnContext(jobId);
    if (!state.renderHistory.some((item) => item.job_id === jobId)) {
        void loadRenderDetailJob(jobId);
    }
}

async function loadRenderDetailJob(jobId) {
    if (!jobId || !hasFrontendAuth()) return;
    state.renderDetailLoading = true;
    state.renderDetailError = "";
    renderRenderDetail();
    try {
        const job = await fetchJobStatusForHistory(jobId);
        const existingIndex = state.renderHistory.findIndex((item) => item.job_id === jobId);
        if (existingIndex >= 0) state.renderHistory[existingIndex] = { ...state.renderHistory[existingIndex], ...job };
        else state.renderHistory.unshift(job);
    } catch (error) {
        state.renderDetailError = localizeErrorMessage(error?.message || t("errors.requestFailed"));
    } finally {
        state.renderDetailLoading = false;
        if (state.view === "render-detail" && state.renderDetailJobId === jobId) renderRenderDetail();
    }
}

function openBlankTryOn() {
    resetFlow();
}

async function repeatRenderWithSavedPhotos(jobId) {
    void trackEvent("repeat_render_started", { source_job_id: jobId });
    const job = state.renderHistory.find((item) => item.job_id === jobId);
    const car = job?.assets?.car_original;
    const wheel = job?.assets?.rim_original;
    if (!car?.download_url || !wheel?.download_url) {
        setView("create");
        return;
    }
    try {
        const fetchAsset = async (asset) => {
            const url = asset.download_url.startsWith("/") ? apiUrl(asset.download_url) : asset.download_url;
            const response = await fetch(url, { headers: withAuthHeaders() });
            if (!response.ok) throw new Error(await parseApiError(response));
            const blob = await response.blob();
            return { blob, name: `${asset.kind}.jpg`, size: blob.size, type: blob.type || "image/jpeg" };
        };
        const [carFile, wheelFile] = await Promise.all([fetchAsset(car), fetchAsset(wheel)]);
        resetIdentityState();
        state.files.car = carFile;
        state.files.wheel = wheelFile;
        renderPreviewFromFile("car", carFile);
        renderPreviewFromFile("wheel", wheelFile);
        setView("create");
        renderIdentityFlow();
        void resolveIdentity();
    } catch (error) {
        console.error("[DW] Unable to restore saved photos", error);
        setView("create");
    }
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
    const visible = state.renderHistory.slice(0, state.renderHistoryVisibleCount);
    const groups = new Map();
    visible.forEach((job) => {
        const label = new Date(job.created_at).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long" });
        groups.set(label, [...(groups.get(label) || []), job]);
    });
    container.innerHTML = [...groups.entries()].map(([label, jobs]) => `
        <section class="render-date-group"><h2>${escapeHtml(label)}</h2>${jobs.map(renderHistoryCard).join("")}</section>`).join("")
        + (state.renderHistory.length > visible.length ? `<button type="button" class="ghost-button compact-button" data-show-more-renders>Показать ещё</button>` : "");
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
    const balanceUnit = document.querySelector("[data-dashboard-balance-unit]");
    const dashboardBalanceAccount = document.querySelector("[data-dashboard-balance-account]");
    const latestTitle = document.querySelector("[data-latest-title]");
    const latestStatus = document.querySelector("[data-latest-status]");
    const latestContent = document.querySelector("[data-latest-content]");
    const loading = document.querySelector("[data-dashboard-loading]");
    const auth = document.querySelector("[data-dashboard-auth]");
    const authInfo = document.querySelector("[data-dashboard-auth-info]");
    const error = document.querySelector("[data-dashboard-error]");
    const errorText = document.querySelector("[data-dashboard-error-text]");
    const dashboardExpiryCard = document.querySelector("[data-dashboard-expiry]");
    const dashboardExpiryList = document.querySelector("[data-dashboard-expiry-list]");
    const dashboardExpiryNote = document.querySelector("[data-dashboard-expiry-note]");
    const balanceSkeleton = document.querySelector("[data-dashboard-balance-skeleton]");
    const latestSkeleton = document.querySelector("[data-dashboard-latest-skeleton]");
    const dashboardPrimaryAction = document.querySelector("[data-dashboard-primary-action]");
    const dashboardSecondaryAction = document.querySelector("[data-dashboard-secondary-action]");
    const expiryCohorts = buildRenderExpiryCohorts();

    if (balance) balance.textContent = state.balance === null ? "0" : String(state.balance);
    if (balanceUnit) {
        balanceUnit.textContent = state.balance === null
            ? formatRenderCount(0).replace(/^\d+\s+/, "")
            : formatRenderCount(state.balance).replace(/^\d+\s+/, "");
    }
    if (dashboardBalanceAccount) dashboardBalanceAccount.textContent = getAccountLabel();
    if (balanceSkeleton) balanceSkeleton.hidden = !(state.walletLoading && state.balance === null);
    document.querySelector(".dashboard-balance-card")?.toggleAttribute(
        "data-loading",
        Boolean(state.walletLoading && state.balance === null)
    );
    if (loading) loading.dataset.visible = String(state.walletLoading || state.renderHistoryLoading);
    if (auth) auth.dataset.visible = String(!hasFrontendAuth());
    if (authInfo) authInfo.dataset.visible = String(!hasFrontendAuth());
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
        dashboardExpiryNote.textContent = expiryCohorts.length ? t("dashboard.expiryPriority") : "";
    }

    if (!latestTitle || !latestStatus || !latestContent) return;
    const showLatestSkeleton = state.renderHistoryLoading && !state.renderHistory.length;
    if (latestSkeleton) latestSkeleton.hidden = !showLatestSkeleton;
    document.querySelector(".latest-render-card")?.toggleAttribute("data-loading", showLatestSkeleton);
    const latest = state.renderHistory[0] || null;
    const latestCompleted = latest?.status === "completed" && fitmentAvailable(latest);
    if (dashboardPrimaryAction) {
        dashboardPrimaryAction.textContent = t("dashboard.startRender");
        dashboardPrimaryAction.dataset.nav = "create";
        delete dashboardPrimaryAction.dataset.expandLatest;
        delete dashboardPrimaryAction.dataset.openRenderDetail;
    }
    if (dashboardSecondaryAction) {
        dashboardSecondaryAction.textContent = latestCompleted ? t("dashboard.lastRender") : t("menu.renders");
        if (latestCompleted) {
            delete dashboardSecondaryAction.dataset.nav;
            dashboardSecondaryAction.dataset.openRenderDetail = latest.job_id;
        } else {
            dashboardSecondaryAction.dataset.nav = "renders";
            delete dashboardSecondaryAction.dataset.openRenderDetail;
        }
        delete dashboardSecondaryAction.dataset.expandLatest;
    }
    if (!latest) {
        latestTitle.textContent = "Ваша первая примерка";
        latestStatus.textContent = "Нет истории";
        latestStatus.className = "status-pill neutral";
        latestStatus.hidden = false;
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
    latestStatus.hidden = latest.status === "completed";

    const resultUrl = assetUrlForJob(latest, "result");
    if (latest.status === "completed" && isAssetAvailable(latest, "result") && resultUrl) {
        const latestFitmentOverview = state.fitmentContextByJob[latest.job_id] || null;
        const fitmentContext = latestFitmentOverview
            ? fitmentDashboardContext(latestFitmentOverview.current_check)
            : fitmentAvailable(latest)
                ? { tone: "warning", text: t("fitment.compatibilityNotChecked") }
                : null;
        latestContent.innerHTML = `
            <div class="latest-preview-layout">
                <img src="${escapeHtml(resultUrl)}" alt="${escapeHtml(title)}" class="latest-result-image" data-asset-image data-job-id="${escapeHtml(latest.job_id)}" data-asset-kind="result">
                <div class="latest-preview-info">
                    ${rimSummary ? `<div class="latest-render-copy"><div class="latest-render-specs">${escapeHtml(rimSummary)}</div></div>` : ""}
                    <div class="latest-meta">${escapeHtml(formatDateTime(latest.completed_at || latest.created_at))}</div>
                    ${fitmentContext ? `<div class="panel-note dashboard-fitment-context ${escapeHtml(fitmentContext.tone)}">${escapeHtml(fitmentContext.text)}</div>` : ""}
                    <div class="render-card-buttons latest-render-actions">
                        <button type="button" class="primary-button compact-button" data-open-render-detail="${escapeHtml(latest.job_id)}">${escapeHtml(t("dashboard.lastRender"))}</button>
                        ${fitmentAvailable(latest) ? `<button type="button" class="ghost-button compact-button" data-open-fitment="${escapeHtml(latest.job_id)}" data-origin-view="dashboard">${escapeHtml(fitmentReturnAction(latestFitmentOverview))}</button>` : ""}
                    </div>
                </div>
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

function fitmentDashboardContext(check) {
    const contexts = {
        compatible: { tone: "success", text: "Совместимость: предварительно совместимо" },
        compatible_with_conditions: { tone: "warning", text: "Совместимость: есть условия установки" },
        incompatible: { tone: "error", text: "Совместимость: несовместимо" },
        unknown: { tone: "warning", text: "Совместимость: нужны данные" },
        failed: { tone: "error", text: "Совместимость: проверка временно недоступна" },
    };
    return contexts[check?.verdict || check?.execution_status] || { tone: "warning", text: t("fitment.compatibilityNotChecked") };
}

function fitmentReturnAction(overview) {
    const currentCheck = overview?.current_check || null;
    if (currentCheck?.execution_status === "completed") {
        return locale === "ru" ? "Открыть проверку" : "Open check";
    }
    if (overview?.next_action?.kind === "run_standard_check") {
        return locale === "ru" ? "Проверить совместимость" : "Check compatibility";
    }
    return locale === "ru" ? "Продолжить проверку" : "Continue check";
}

async function loadFitmentReturnContext(jobId) {
    if (!jobId || shouldUseDemoFitment(jobId) || state.fitmentContextLoadingByJob[jobId]) return;
    state.fitmentContextLoadingByJob[jobId] = true;
    try {
        const response = await fetch(apiUrl(`/jobs/${jobId}/fitment`, { includeIdentity: true }), {
            headers: withAuthHeaders(),
        });
        if (!response.ok) return;
        state.fitmentContextByJob[jobId] = await response.json();
    } catch {
        // The editor itself remains available; its authoritative context loads on entry.
    } finally {
        delete state.fitmentContextLoadingByJob[jobId];
        renderRenderDetail();
        renderDashboard();
    }
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
        const latestFitmentJob = state.renderHistory.find((job) => fitmentAvailable(job));
        if (latestFitmentJob) void loadFitmentReturnContext(latestFitmentJob.job_id);
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
        if (state.view === "render-detail") renderRenderDetail();
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
        setWalletMessage("");
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
        state.creditPackages = (cabinet.credit_packages || []).map((item) => ({
            id: item.id || "",
            source: item.source || "purchase",
            label: item.label || "",
            remainingCredits: Number(item.remaining_credits || 0),
            expiresAt: item.expires_at || "",
        }));
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
        renderWallet();
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
        setWalletMessage("");
        renderWalletStatus();
        focusWalletAuthNotice();
        return;
    }

    setWalletBusy(true);
    setWalletMessage(t("wallet.openingPayment"));
    void trackEvent("payment_started", { source_screen: "cabinet", amount_rub: normalizeTopUpAmount(state.selectedAmount) });
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
        void trackEvent("payment_failed", { return_channel: "browser" });
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

function resetPreviewGeometry(kind) {
    document.querySelector(`[data-preview-media="${kind}"]`)
        ?.style.removeProperty("--preview-aspect-ratio");
}

function syncPreviewGeometry(kind) {
    const img = document.querySelector(`[data-preview-img="${kind}"]`);
    const media = document.querySelector(`[data-preview-media="${kind}"]`);
    if (!img?.naturalWidth || !img?.naturalHeight || !media) return;
    media.style.setProperty("--preview-aspect-ratio", `${img.naturalWidth} / ${img.naturalHeight}`);
}

function renderPreviewFromFile(kind, fileLike) {
    revokePreviewUrl(kind);
    const img = document.querySelector(`[data-preview-img="${kind}"]`);
    const preview = document.querySelector(`[data-preview="${kind}"]`);
    const zone = document.querySelector(`[data-upload-zone="${kind}"]`);
    if (!img || !preview || !zone || !fileLike?.blob) return;
    const objectUrl = URL.createObjectURL(fileLike.blob);
    state.previewUrls[kind] = objectUrl;
    resetPreviewGeometry(kind);
    img.onload = () => syncPreviewGeometry(kind);
    img.src = objectUrl;
    preview.hidden = false;
    zone.hidden = true;
    if (img.complete) syncPreviewGeometry(kind);
}

function resetIdentityState() {
    state.identityDraftId = "";
    state.identityProposal = null;
    state.identityResolving = false;
    state.identityError = "";
    state.selectedVehicleIndex = 0;
    state.manualVehicle = { make: "", model: "", year: "", year_start: "", year_end: "" };
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
    if (vehicles.length) return vehicles[state.selectedVehicleIndex] || vehicles[0] || null;
    const manual = state.manualVehicle;
    if (!manual.make.trim() || !manual.model.trim()) return null;
    const year = Number(manual.year) || null;
    const yearStart = Number(manual.year_start) || null;
    const yearEnd = Number(manual.year_end) || null;
    if (year && (yearStart || yearEnd)) return null;
    if ((yearStart && !yearEnd) || (!yearStart && yearEnd) || (yearStart && yearEnd && yearStart > yearEnd)) return null;
    return {
        make: manual.make.trim(), model: manual.model.trim(), year,
        year_start: yearStart, year_end: yearEnd, confidence: 1, source: "user_confirmed",
    };
}

function selectedRimProposal() {
    const productUrl = state.rimProductUrl.trim();
    return {
        product_url: productUrl || null,
        confidence: productUrl ? 1 : 0,
        source: productUrl ? "user_input" : "unknown",
    };
}

function formatVehicle(candidate) {
    if (!candidate) return "—";
    const year = candidate.year ?? (
        candidate.year_start && candidate.year_end ? `${candidate.year_start}-${candidate.year_end}` : ""
    );
    return `${candidate.make} ${candidate.model}${year ? ` ${year}` : ""}`;
}

function formatPcd(rim) {
    if (!rim) return "—";
    const pcd = Number(rim.pcd_mm);
    return `${rim.bolt_count}×${formatIdentityNumber(pcd)}`;
}

function formatIdentityNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    const text = Number.isInteger(numeric) ? numeric.toFixed(0) : String(numeric);
    return locale === "ru" ? text.replace(".", ",") : text;
}

function formatPcdDisplay(value) {
    const text = String(value || "");
    return locale === "ru" ? text.replace(".", ",") : text;
}

function formatRim(rim) {
    if (!rim) return "—";
    if (rim.product_url) return "Ссылка на товар добавлена";
    if (!rim.wheel_diameter_in || !rim.wheel_width_j || !rim.bolt_count || !rim.pcd_mm) {
        return "Параметры будут уточнены позже";
    }
    return `${formatIdentityNumber(rim.wheel_diameter_in)}" / ${formatIdentityNumber(rim.wheel_width_j)}J / ${formatPcd(rim)}`;
}

function confidenceLabel(confidence) {
    const value = Number(confidence || 0);
    if (value >= 0.85) return "уверенность высокая";
    if (value >= 0.65) return "уверенность средняя";
    return "уверенность низкая";
}

function renderIdentityFlow() {
    const ready = Boolean(state.files.car?.blob && state.files.wheel?.blob);

    const flow = document.querySelector("[data-identity-flow]");
    const loading = document.querySelector("[data-identity-loading]");
    const error = document.querySelector("[data-identity-error]");
    const errorTitle = document.querySelector("[data-identity-error-title]");
    const errorText = document.querySelector("[data-identity-error-text]");
    const errorBadge = document.querySelector("[data-identity-error-badge]");
    const errorAction = document.querySelector("[data-identity-error-action]");
    const errorRetry = document.querySelector("[data-identity-error-retry]");
    const confirmations = document.querySelector("[data-identity-confirmations]");
    const review = document.querySelector("[data-identity-review]");
    const sourcePreflight = document.querySelector("[data-rim-source-preflight]");
    if (sourcePreflight) sourcePreflight.hidden = !ready;
    const productUrlInput = document.querySelector("[data-rim-product-url]");
    if (productUrlInput && productUrlInput.value !== state.rimProductUrl) {
        productUrlInput.value = state.rimProductUrl;
    }
    const hasFlow = state.identityResolving || state.identityError || state.identityProposal;
    if (flow) flow.hidden = !hasFlow;
    if (loading) loading.dataset.visible = String(state.identityResolving);
    if (error) error.dataset.visible = String(Boolean(state.identityError));
    const identityErrorView = state.identityError ? classifyIdentityError(state.identityError) : null;
    if (errorTitle && identityErrorView) errorTitle.textContent = identityErrorView.title;
    if (errorText && identityErrorView) errorText.textContent = identityErrorView.body;
    if (errorBadge && identityErrorView) errorBadge.textContent = identityErrorView.badgeLabel;
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
    const needsManualVehicle = vehicles.length === 0;
    document.querySelector("[data-manual-vehicle-fields]")?.toggleAttribute("hidden", !needsManualVehicle);
    document.querySelector("[data-manual-vehicle-note]")?.toggleAttribute("hidden", !needsManualVehicle);
    document.querySelectorAll("[data-manual-identity-input]").forEach((input) => {
        const [, field] = input.dataset.manualIdentityInput.split(".");
        input.value = state.manualVehicle[field] || "";
    });
    const vehicleOptions = document.querySelector("[data-vehicle-options]");
    if (vehicleOptions) {
        vehicleOptions.innerHTML = vehicles
            .slice(0, 3)
            .map((candidate, index) => {
                const selected = index === state.selectedVehicleIndex;
                const actionText = selected ? "✓ Выбрано" : "Выбрать";
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
    const vehicleTitle = document.querySelector("[data-vehicle-resolution-title]");
    if (vehicleTitle) {
        vehicleTitle.textContent = needsManualVehicle
            ? "Автомобиль не распознан — укажите вручную"
            : "Подтвердите вариант от AI";
    }
    const rimSourceSummary = document.querySelector("[data-rim-source-summary]");
    if (rimSourceSummary) {
        rimSourceSummary.textContent = state.rimProductUrl.trim()
            ? "Ссылка на товар сохранится с примеркой и будет доступна в проверке совместимости."
            : "Источник колесного диска не указан. Его можно добавить позже в проверке совместимости.";
    }
    document.querySelector("[data-review-vehicle]")?.replaceChildren(
        document.createTextNode(formatVehicle(selectedVehicle))
    );
    document.querySelector("[data-review-rim]")?.replaceChildren(
        document.createTextNode(formatRim(selectedRimProposal()))
    );
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
    (document.querySelector('[data-view="create"]') || document.body).appendChild(fallbackButton);
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
    btn.hidden = false;
    document.body.classList.add("has-fallback-main-button");
}

function hideMainButton() {
    mainButtonHandler = null;
    if (HAS_TG && tg.MainButton) {
        tg.MainButton.offClick();
        tg.MainButton.hide();
    } else if (fallbackButton) {
        fallbackButton.hidden = true;
    }
    document.body.classList.remove("has-fallback-main-button");
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

function persistPhotoConsent(accepted) {
    state.photoConsentAccepted = Boolean(accepted);
    try {
        if (state.photoConsentAccepted) {
            localStorage.setItem(PHOTO_CONSENT_STORAGE_KEY, PHOTO_CONSENT_VERSION);
        } else {
            localStorage.removeItem(PHOTO_CONSENT_STORAGE_KEY);
        }
    } catch (_) {
        // Consent remains valid for the current session if storage is unavailable.
    }
}

function renderPhotoConsent(ready) {
    const fullCard = document.querySelector("[data-photo-consent]");
    const compactNote = document.querySelector("[data-photo-consent-compact]");
    const checkbox = document.querySelector("[data-photo-consent-checkbox]");
    if (fullCard) fullCard.hidden = !ready || state.photoConsentAccepted;
    if (compactNote) compactNote.hidden = !ready || !state.photoConsentAccepted;
    if (checkbox) checkbox.checked = state.photoConsentAccepted;
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
        const selectedVehicle = selectedVehicleCandidate();
        renderPhotoConsent(ready);
        if (!ready) {
            setBackButton(null);
            hideMainButton();
            return;
        }
        const consentMissing = ready && !state.photoConsentAccepted;
        const disabled = !ready || consentMissing || state.submitting || state.identityResolving || (hasProposal && !selectedVehicle);
        setBackButton(null);
        setMainButton({
            text: hasProposal
                ? (locale === "ru" ? "Создать изображение — 1 рендер" : "Create image — 1 render")
                : t("create.detectIdentity"),
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
    state.rimProductUrl = "";
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
        resetPreviewGeometry(kind);
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
    if (!state.photoConsentAccepted) {
        renderPhotoConsent(Boolean(state.files.car?.blob && state.files.wheel?.blob));
        refreshButtonsForCurrentView();
        return;
    }
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
    if (state.rimProductUrl.trim()) formData.append("rim_product_url", state.rimProductUrl.trim());
    const identity = getIdentityPayload({ includeTelegramUserId: true });
    if (identity.init_data) formData.append("init_data", identity.init_data);
    if (identity.telegram_user_id != null) {
        formData.append("telegram_user_id", String(identity.telegram_user_id));
    }

    try {
        const resp = await fetch(apiUrl("/identity/resolve"), {
            method: "POST",
            headers: withAuthHeaders(),
            body: formData,
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) {
                clearWebsiteAuthSession();
                throw new Error("identity_auth_required");
            }
            const failure = data.detail;
            if (failure?.manual_fallback && failure?.draft_id) {
                state.identityDraftId = failure.draft_id;
                state.identityProposal = {
                    vehicle: {
                        status: "unknown",
                        primary: null,
                        alternatives: [],
                        abstention_reason: "provider_returned_no_candidates",
                    },
                    rim: { status: "manual_required" },
                    resolver: "vehicle_identity_provider_error",
                };
                state.identityError = failure.error_code || "vehicle_identity_provider_unavailable";
                haptic("warning");
                return;
            }
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
        haptic("success");
        requestAnimationFrame(() => {
            document.querySelector("[data-identity-confirmations]")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
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
    const resultImg = document.querySelector("[data-result-img]");
    const errorText = document.querySelector("[data-error-text]");
    const errorTitle = document.querySelector("[data-error-title]");
    const errorCopy = document.querySelector("[data-error-copy]");
    const errorAction = document.querySelector("[data-error-action]");
    const errorSupport = document.querySelector("[data-error-support]");
    function showError(message) {
        state.submitting = false;
        if (statusBlock) statusBlock.hidden = true;
        if (resultBlock) resultBlock.hidden = true;
        if (errorBlock) errorBlock.hidden = false;
        const errorState = classifyGenerationError(message);
        if (errorText) errorText.textContent = errorState.title;
        if (errorTitle) errorTitle.textContent = errorState.title;
        if (errorCopy) errorCopy.textContent = errorState.copy;
        if (errorAction) {
            errorAction.textContent = errorState.actionLabel;
            errorAction.dataset.generationErrorAction = errorState.action;
        }
        if (errorSupport) errorSupport.hidden = !errorState.showSupport;
        refreshButtonsForCurrentView();
        haptic("error");
        if (state.jobId) void loadRenderHistory({ silent: true });
    }

    if (statusBlock) statusBlock.hidden = false;
    if (resultBlock) resultBlock.hidden = true;
    if (errorBlock) errorBlock.hidden = true;
    if (statusText) statusText.textContent = "Подготавливаем примерку";
    if (statusSub) statusSub.textContent = "Это обычно занимает 1–2 минуты";

    const selectedVehicle = selectedVehicleCandidate();
    const rim = selectedRimProposal();
    if (!state.identityDraftId || !selectedVehicle) {
        showError(t("errors.missingIdentity"));
        return;
    }

    const identity = getIdentityPayload({ includeTelegramUserId: true });
    const idempotencyKey = makeIdempotencyKey();
    const payload = {
        draft_id: state.identityDraftId,
        idempotency_key: idempotencyKey,
        vehicle: { ...selectedVehicle, source: "user_confirmed", confidence: 1 },
        rim,
        rim_user_confirmed: false,
    };
    if (identity.init_data) payload.init_data = identity.init_data;
    if (identity.telegram_user_id != null) payload.telegram_user_id = identity.telegram_user_id;
    try {
        const resp = await fetch(apiUrl("/jobs/from-assets"), {
            method: "POST",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            const detail = Array.isArray(data.detail)
                ? data.detail.map((entry) => entry.msg).join("; ")
                : (data.detail || `HTTP ${resp.status}`);
            throw new Error(detail);
        }
        state.jobId = data.job_id;
        void trackEvent("render_started", { job_id: state.jobId });
    } catch (error) {
        showError(error.message);
        return;
    }

    if (statusText) statusText.textContent = "Примеряем диски";

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        let statusData;
        try {
            const response = await fetch(
                apiUrl(`/jobs/${state.jobId}/status`, { includeIdentity: true }),
                { headers: withAuthHeaders() }
            );
            statusData = await response.json();
        } catch {
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
            if (resultBlock) resultBlock.hidden = true;
            void loadRenderHistory({ silent: true }).then(() => openRenderDetail(state.jobId, "create"));
            haptic("success");
            return;
        }

        if (statusData.status === "failed") {
            showError(statusData.error || t("errors.generationFailed"));
            return;
        }
    }

    state.submitting = false;
    if (statusBlock) statusBlock.hidden = true;
    if (resultBlock) resultBlock.hidden = true;
    if (errorBlock) errorBlock.hidden = false;
    if (errorText) errorText.textContent = "Примерка всё ещё создаётся";
    if (errorTitle) errorTitle.textContent = "Примерка всё ещё создаётся";
    if (errorCopy) errorCopy.textContent = "Мы продолжаем обрабатывать фото. Результат появится в «Моих примерках».";
    if (errorAction) {
        errorAction.textContent = "Обновить статус";
        errorAction.dataset.generationErrorAction = "refresh-job";
    }
    refreshButtonsForCurrentView();
    void loadRenderHistory({ silent: true });
}

async function refreshExistingJobStatus() {
    if (!state.jobId) {
        setView("renders");
        return;
    }
    const response = await fetch(apiUrl(`/jobs/${state.jobId}/status`, { includeIdentity: true }), {
        headers: withAuthHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === "failed") {
        void loadRenderHistory({ silent: true });
        setView("renders");
        return;
    }
    if (data.status !== "completed") {
        void loadRenderHistory({ silent: true });
        setView("renders");
        return;
    }
    void loadRenderHistory({ silent: true }).then(() => openRenderDetail(state.jobId, "create"));
}

function classifyGenerationError(message) {
    const normalized = String(message || "").toLowerCase();
    if (/(timeout|unavailable|connection|network|fetch|временно|недоступ)/.test(normalized)) {
        return {
            title: t("warnings.generationUnavailable"),
            copy: "Сервис временно недоступен. Повторите попытку через несколько минут или обратитесь в поддержку.",
            actionLabel: "Повторить",
            action: "retry",
            showSupport: true,
        };
    }
    if (/(wheel|rim|disk|колес|диск)/.test(normalized)) {
        return { title: "Не удалось обработать изображение диска", copy: "Загрузите другое фото: диск должен быть снят спереди и находиться в фокусе.", actionLabel: "Заменить фото диска", action: "wheel", showSupport: false };
    }
    if (/(vehicle|car|identity|автомоб|машин)/.test(normalized)) {
        return { title: "Не удалось распознать автомобиль на фото", copy: "Загрузите другое фото: автомобиль должен быть виден целиком и снят сбоку.", actionLabel: "Заменить фото автомобиля", action: "car", showSupport: false };
    }
    if (/(credits?|balance|insufficient|баланс|недостаточно\s+(кредит|рендер))/.test(normalized)) {
        return { title: "Недостаточно рендеров на балансе", copy: "Пополните счёт, чтобы создать новую виртуальную примерку.", actionLabel: "Пополнить счёт", action: "wallet", showSupport: false };
    }
    return { title: "Не удалось создать виртуальную примерку", copy: "Попробуйте ещё раз. Если ошибка повторится, обратитесь в поддержку.", actionLabel: "Повторить", action: "retry", showSupport: true };
}

function handleFileSelected(kind, file) {
    void trackEvent("upload_started", { asset_kind: kind });
    file.arrayBuffer().then((buffer) => {
        resetIdentityState();
        state.files[kind] = {
            blob: new Blob([buffer], { type: file.type }),
            name: file.name,
            size: file.size,
            type: file.type,
        };
        void saveDraftFile(kind, file, buffer);
        if (state.files.car?.blob && state.files.wheel?.blob) void trackEvent("upload_completed");
        renderPreviewFromFile(kind, state.files[kind]);
        renderIdentityFlow();
        refreshButtonsForCurrentView();
        if (state.files.car?.blob && state.files.wheel?.blob && state.photoConsentAccepted) {
            void resolveIdentity();
        }
    });
    haptic("light");
}

function clearSelectedFile(kind) {
    state.files[kind] = null;
    if (kind === "wheel") state.rimProductUrl = "";
    resetIdentityState();
    revokePreviewUrl(kind);
    resetPreviewGeometry(kind);
    void deleteDraftFile(kind);
    const input = document.querySelector(`input[data-input="${kind}"]`);
    if (input) input.value = "";
    document.querySelector(`[data-preview="${kind}"]`)?.toggleAttribute("hidden", true);
    document.querySelector(`[data-upload-zone="${kind}"]`)?.toggleAttribute("hidden", false);
    renderIdentityFlow();
    refreshButtonsForCurrentView();
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
        if (HAS_TG || getWebsiteAuthToken()) void resolveIdentity();
        else void loginWithTelegram();
    });
    document.querySelector("[data-dashboard-auth-login]")?.addEventListener("click", () => {
        void loginWithTelegram();
    });
    document.querySelector("[data-identity-error-retry]")?.addEventListener("click", () => {
        void resolveIdentity();
    });

    document.querySelectorAll("[data-nav]").forEach((button) => {
        button.addEventListener("click", (event) => {
            if (!button.dataset.nav) return;
            event.stopPropagation();
            setView(button.dataset.nav);
        });
    });
    document.querySelector("[data-fitment-pcd-select]")?.addEventListener("change", (event) => {
        const select = event.target;
        const custom = document.querySelector("[data-fitment-pcd-custom]");
        if (select.value === "custom") {
            if (custom) custom.hidden = false;
            return;
        }
        if (custom) custom.hidden = true;
        const [boltCount, pcdMm] = select.value.split("x");
        state.fitmentForm.rim.bolt_count = boltCount || state.fitmentForm.rim.bolt_count;
        state.fitmentForm.rim.pcd_mm = pcdMm || "";
        const pcdInput = document.querySelector('[data-fitment-input="rim.pcd_mm"]');
        if (pcdInput) pcdInput.value = pcdMm || "";
        markFitmentDirty();
        renderFitment();
    });
    document.querySelector("[data-fitment-setup-mode]")?.addEventListener("change", (event) => {
        state.fitmentForm.setup_mode = event.target.value === "staggered" ? "staggered" : "uniform";
        markFitmentDirty();
        renderFitment();
    });

    document.querySelectorAll("[data-external-link]").forEach((link) => {
        link.addEventListener("click", (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            openExternal(link.href);
        });
    });

    document.querySelectorAll("[data-telegram-link]").forEach((link) => {
        link.addEventListener("click", (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (HAS_TG && typeof tg?.openTelegramLink === "function") {
                tg.openTelegramLink(link.href);
                return;
            }
            openExternal(link.href);
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

    document.querySelector("[data-photo-consent-checkbox]")?.addEventListener("change", (event) => {
        persistPhotoConsent(event.target.checked);
        renderPhotoConsent(Boolean(state.files.car?.blob && state.files.wheel?.blob));
        refreshButtonsForCurrentView();
        if (event.target.checked && state.files.car?.blob && state.files.wheel?.blob && !state.identityProposal) {
            void resolveIdentity();
        }
        haptic(event.target.checked ? "success" : "light");
    });

    document.querySelector("[data-photo-consent-cancel]")?.addEventListener("click", () => {
        clearSelectedFile("car");
        clearSelectedFile("wheel");
        document.querySelector('[data-input="car"]')?.click();
    });

    document.querySelectorAll("[data-clear]").forEach((button) => {
        button.addEventListener("click", () => {
            clearSelectedFile(button.dataset.clear);
        });
    });

    document.querySelector("[data-download-result]")?.addEventListener("click", downloadResult);
    document.querySelector("[data-share-result]")?.addEventListener("click", shareResult);
    document.querySelector("[data-error-action]")?.addEventListener("click", () => {
        const action = document.querySelector("[data-error-action]")?.dataset.generationErrorAction;
        if (action === "wallet") {
            setView("wallet");
            return;
        }
        if (action === "car" || action === "wheel") {
            showCreateScreen("upload");
            document.querySelector(`[data-input="${action}"]`)?.click();
            return;
        }
        if (action === "refresh-job") {
            void refreshExistingJobStatus();
            return;
        }
        void submitJob();
    });
    document.querySelector("[data-open-fitment-result]")?.addEventListener("click", () => {
        if (!state.jobId) return;
        void openFitmentView(state.jobId, { originView: "create" });
    });
    document.querySelector("[data-fitment-back]")?.addEventListener("click", closeFitmentView);
    document.querySelector("[data-fitment-skip]")?.addEventListener("click", () => {
        closeFitmentView();
    });
    document.querySelector("[data-fitment-source-toggle]")?.addEventListener("click", () => {
        state.fitmentSourceOpen = !state.fitmentSourceOpen;
        renderFitment();
    });
    document.querySelector("[data-fitment-source-url]")?.addEventListener("input", (event) => {
        state.fitmentForm.rim.product_url = event.target.value;
        markFitmentDirty();
    });
    document.querySelector("[data-fitment-source-submit]")?.addEventListener("click", () => {
        void resolveFitmentRimSource();
    });
    document.querySelector("[data-fitment-variants-load]")?.addEventListener("click", () => {
        void loadFitmentVehicleVariants();
    });
    document.querySelector("[data-fitment-check]")?.addEventListener("click", () => {
        void runFitmentCheck();
    });
    document.querySelector("[data-fitment-create-image]")?.addEventListener("click", () => {
        // Rendering stays available independently from the fitment result.
        setView("create");
    });
    document.querySelector("[data-fitment-auth-login]")?.addEventListener("click", () => {
        void resumeFitmentAfterLogin();
    });
    document.querySelector("[data-fitment-restore-conflict-apply]")?.addEventListener("click", () => {
        applyFitmentRestoreConflict();
        state.fitmentMessage = locale === "ru"
            ? "Сохранённые значения открыты как несохранённый черновик. Проверьте их перед сохранением."
            : "Saved values are open as an unsaved draft. Review them before saving.";
        state.fitmentMessageTone = "warning";
        renderFitment();
    });
    document.querySelector("[data-fitment-form]")?.addEventListener("submit", (event) => {
        void saveFitment(event);
    });
    document.querySelectorAll("[data-fitment-input]").forEach((input) => {
        input.addEventListener("focus", () => setFitmentOverviewCollapsed(true));
        input.addEventListener("input", (event) => {
            if (input.tagName === "SELECT") return;
            const path = input.dataset.fitmentInput;
            setDeepValue(state.fitmentForm, path, event.target.value);
            const fieldName = input.dataset.fitmentInput?.replace("rim.", "");
            if (fieldName && input.dataset.fitmentInput?.startsWith("rim.")) {
                state.fitmentSourceAppliedFields = state.fitmentSourceAppliedFields.filter((field) => field !== fieldName);
                if (!state.fitmentRimManualFields.includes(fieldName)) {
                    state.fitmentRimManualFields.push(fieldName);
                }
            }
            markFitmentDirty();
            refreshFitmentSaveLabel();
        });
        input.addEventListener("change", (event) => {
            const path = input.dataset.fitmentInput;
            const value = event.target.value;
            if (input.dataset.fitmentPreset) {
                const custom = document.querySelector(`[data-fitment-custom="${path}"]`);
                if (value === "custom") {
                    custom?.removeAttribute("hidden");
                    custom?.focus();
                } else {
                    setDeepValue(state.fitmentForm, path, value);
                    if (custom) custom.hidden = true;
                }
            } else if (input.dataset.fitmentCatalogue === "makes") {
                state.fitmentForm.vehicle.make = value;
                state.fitmentForm.vehicle.model = "";
                state.fitmentForm.vehicle.year = "";
                state.fitmentCatalogue.models = { status: "idle", items: [] };
                state.fitmentCatalogue.years = { status: "idle", items: [] };
                if (value && state.fitmentForm.vehicle.market) void loadFitmentCatalogue("models", { region: state.fitmentForm.vehicle.market, make: value });
            } else if (input.dataset.fitmentCatalogue === "models") {
                state.fitmentForm.vehicle.model = value;
                state.fitmentForm.vehicle.year = "";
                state.fitmentCatalogue.years = { status: "idle", items: [] };
                if (value && state.fitmentForm.vehicle.market && state.fitmentForm.vehicle.make) void loadFitmentCatalogue("years", { region: state.fitmentForm.vehicle.market, make: state.fitmentForm.vehicle.make, model: value });
            } else if (input.dataset.fitmentCatalogue === "regions") {
                state.fitmentForm.vehicle.market = value;
                state.fitmentForm.vehicle.year = "";
                state.fitmentCatalogue.makes = { status: "idle", items: [] };
                state.fitmentCatalogue.models = { status: "idle", items: [] };
                state.fitmentCatalogue.years = { status: "idle", items: [] };
                if (value) void loadFitmentCatalogue("makes", { region: value });
                if (value && state.fitmentForm.vehicle.make) {
                    void loadFitmentCatalogue("models", { region: value, make: state.fitmentForm.vehicle.make });
                }
                if (state.fitmentForm.vehicle.make && state.fitmentForm.vehicle.model) void loadFitmentCatalogue("years", { region: value, make: state.fitmentForm.vehicle.make, model: state.fitmentForm.vehicle.model });
            } else {
                setDeepValue(state.fitmentForm, path, value);
            }
            markFitmentDirty();
            renderFitment();
        });
    });
    document.querySelectorAll("[data-fitment-custom]").forEach((input) => {
        input.addEventListener("input", (event) => {
            setDeepValue(state.fitmentForm, input.dataset.fitmentCustom, event.target.value);
            markFitmentDirty();
        });
    });
    document.querySelectorAll("[data-manual-identity-input]").forEach((input) => {
        input.addEventListener("input", (event) => {
            const [, field] = event.target.dataset.manualIdentityInput.split(".");
            state.manualVehicle[field] = event.target.value;
            renderIdentityFlow();
        });
    });
    document.querySelector("[data-rim-product-url]")?.addEventListener("input", (event) => {
        state.rimProductUrl = event.target.value;
        renderIdentityFlow();
    });
    document.querySelector("[data-fitment-overview-toggle]")?.addEventListener("click", () => {
        setFitmentOverviewCollapsed(!state.fitmentOverviewCollapsed);
    });
    document.querySelectorAll("[data-fitment-jump]").forEach((button) => {
        button.addEventListener("click", () => {
            state.fitmentActiveStep = button.dataset.fitmentJump === "rim" ? 2 : 1;
            renderFitment();
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

        const openRenderDetailButton = event.target.closest("[data-open-render-detail]");
        if (openRenderDetailButton) {
            openRenderDetail(openRenderDetailButton.dataset.openRenderDetail);
            return;
        }

        if (event.target.closest("[data-new-tryon]")) {
            openBlankTryOn();
            return;
        }

        const showMoreRendersButton = event.target.closest("[data-show-more-renders]");
        if (showMoreRendersButton) {
            state.renderHistoryVisibleCount += 6;
            renderRenders();
            return;
        }

        const shareHistoryResult = event.target.closest("[data-share-history-result]");
        if (shareHistoryResult) {
            const job = state.renderHistory.find((item) => item.job_id === shareHistoryResult.dataset.shareHistoryResult);
            if (!job) return;
            state.resultUrl = assetUrlForJob(job, "result");
            void shareResult();
            return;
        }

        const repeatRenderButton = event.target.closest("[data-repeat-render]");
        if (repeatRenderButton) {
            void repeatRenderWithSavedPhotos(repeatRenderButton.dataset.repeatRender);
            return;
        }

        const fitmentButton = event.target.closest("[data-open-fitment]");
        if (fitmentButton) {
            void openFitmentView(fitmentButton.dataset.openFitment, {
                originView: fitmentButton.dataset.originView || state.view,
            });
            return;
        }

        const rimVariant = event.target.closest("[data-fitment-rim-variant]");
        if (rimVariant) {
            selectFitmentRimVariant(Number(rimVariant.dataset.fitmentRimVariant));
            return;
        }

        const keepConflict = event.target.closest("[data-fitment-conflict-keep]");
        if (keepConflict) {
            resolveFitmentParserConflict(keepConflict.dataset.fitmentConflictKeep);
            return;
        }

        const useConflict = event.target.closest("[data-fitment-conflict-use]");
        if (useConflict) {
            resolveFitmentParserConflict(
                useConflict.dataset.fitmentConflictUse,
                useConflict.dataset.fitmentConflictValue
            );
            return;
        }

        const fitmentCandidate = event.target.closest("[data-fitment-candidate]");
        if (fitmentCandidate) {
            const path = fitmentCandidate.dataset.fitmentCandidate;
            const value = fitmentCandidate.dataset.fitmentCandidateValue || "";
            setDeepValue(state.fitmentForm, path, value);
            const input = document.querySelector(`[data-fitment-input="${path}"]`);
            if (input) input.value = value;
            markFitmentDirty();
            renderFitment();
            return;
        }

        const vehicleVariant = event.target.closest("[data-fitment-vehicle-variant]");
        if (vehicleVariant) {
            const variant = state.fitmentVehicleVariants[Number(vehicleVariant.dataset.fitmentVehicleVariant)];
            if (!variant) return;
            void applyFitmentVehicleVariant(variant).then(() => {
                state.fitmentVehicleVariants = [];
                state.fitmentMessage = locale === "ru" ? "Точная версия сохранена." : "Exact version saved.";
                state.fitmentMessageTone = "success";
                renderFitment();
            }).catch((error) => {
                state.fitmentError = error?.message || t("errors.requestFailed");
                renderFitment();
            });
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
                if (state.view === "render-detail") renderRenderDetail();
            }
            return;
        }

        const feedbackButton = event.target.closest("[data-history-feedback]");
        if (feedbackButton) {
            const jobId = feedbackButton.dataset.historyFeedback;
            const sentiment = feedbackButton.dataset.feedbackSentiment;
            if (sentiment !== "liked" && sentiment !== "disliked") return;
            delete state.feedbackReasonPickerByJob[jobId];
            void submitHistoryFeedback(jobId, sentiment);
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
    void trackEvent("app_opened", { surface: HAS_TG ? "telegram" : "website" });
    if (HAS_TG && tg?.initData) void trackEvent("auth_completed", { auth_channel: "mini_app" });
    void checkCurrentBuild();
    applyTranslations();
    initTelegram();
    updateWebsiteAuthUi();
    bindEvents();
    observeUiCopyRule();
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
        if (!document.hidden) void checkCurrentBuild();
        if (document.hidden) {
            clearRenderHistoryPolling();
        }
    });
    window.addEventListener("pagehide", () => {
        if (state.view === "fitment") persistFitmentTransientDraft("navigation");
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
