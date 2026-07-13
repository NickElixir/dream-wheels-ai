const FITMENT_POLL_INTERVAL_MS = 2000;
const FITMENT_POLL_TIMEOUT_MS = 120000;

const COPY = {
    ru: {
        hero: {
            eyebrow: "Техническая проверка",
            title: "Проверь совместимость дисков",
            lede: "Сначала распознаем авто и диск по фото, затем проверим подтверждённые параметры по каталогу и правилам.",
        },
        progress: {
            photos: "Фото",
            data: "Данные",
            verdict: "Вердикт",
        },
        upload: {
            title: "Используем те же фото",
            text: "Если вы уже сделали рендер, повторно выбирать файлы не нужно. Fitment запускается отдельно и только по вашему запросу.",
            car: "Автомобиль",
            rim: "Диск",
            choose: "Выбрать фото",
            replace: "Заменить",
            remove: "Убрать",
            manual: "Ввести параметры вручную",
            linked: "Проверка будет привязана к текущему рендеру.",
        },
        loading: {
            preliminary: "Анализируем фотографии",
            preliminarySub: "Определяем автомобиль, читаем маркировку и готовим черновик параметров.",
            confirmed: "Сверяем подтверждённые данные",
            confirmedSub: "Получаем профиль Wheel-Size и запускаем проверку по передней и задней оси.",
            polling: "Проверка ещё выполняется",
        },
        review: {
            eyebrow: "Предварительная оценка",
            title: "Проверьте распознанные данные",
            likelihood: "Оценка по фото",
            manualTitle: "Ручной ввод",
            manualText: "Заполните известные параметры. Неизвестные поля можно оставить пустыми — итог честно покажет, чего не хватает.",
            detectedVehicle: "Распознано",
            detectedRim: "Подсказки по диску",
            disclaimer: "Фото и VLM дают только предварительные подсказки. Подтверждённая проверка выполняется после вашего исправления данных.",
            vehicleSection: "Автомобиль",
            rimSection: "Диск — передняя ось",
            rearSection: "Диск — задняя ось",
            requiredHint: "Марка, модель и год обязательны. Чем полнее параметры диска, тем точнее результат.",
            staggered: "Разноширокий комплект",
            staggeredHint: "Указать отдельные параметры задней оси",
            advanced: "Дополнительные данные диска",
            confirm: "Я проверил данные и подтверждаю их для технической оценки",
        },
        fields: {
            make: "Марка",
            model: "Модель",
            year: "Год",
            body: "Кузов",
            generation: "Поколение",
            modification: "Модификация",
            market: "Рынок",
            brand: "Бренд диска",
            rimModel: "Модель диска",
            sku: "Артикул / SKU",
            productUrl: "Ссылка на товар (HTTPS)",
            boltCount: "Отверстия",
            pcd: "PCD, мм",
            centerBore: "DIA, мм",
            diameter: "Диаметр, дюймы",
            width: "Ширина J",
            offset: "Вылет ET, мм",
            loadRating: "Нагрузка, кг",
            fastener: "Система крепежа",
            seatType: "Тип посадочного места",
            threadDiameter: "Диаметр резьбы, мм",
            threadPitch: "Шаг резьбы, мм",
            boltLength: "Длина болта, мм",
        },
        result: {
            eyebrow: "Подтверждённая проверка",
            risk: "Уровень риска",
            reasons: "Что обнаружено",
            conditions: "Условия установки",
            missing: "Что нужно уточнить",
            recommendations: "Что делать дальше",
            breakdown: "Проверка параметров",
            technical: "Техническая информация",
            noItems: "Нет дополнительных замечаний.",
            edit: "Исправить данные",
            render: "Перейти к рендеру",
            disclaimer: "Оценка основана на справочных данных. Перед покупкой и установкой подтвердите совместимость у специалиста.",
        },
        actions: {
            analyze: "Анализировать фото",
            check: "Подтвердить и проверить",
            newCheck: "Новая проверка",
        },
        status: {
            compatible: "Совместимо по известным параметрам",
            compatible_with_conditions: "Совместимо при условиях",
            unknown: "Недостаточно данных",
            incompatible: "Обнаружена несовместимость",
            queued: "В очереди",
            processing: "Выполняется",
            completed: "Готово",
            failed: "Ошибка",
        },
        risk: {
            low: "Низкий",
            moderate: "Умеренный",
            elevated: "Повышенный",
            high: "Высокий",
            critical: "Критический",
        },
        axle: {
            front: "передняя ось",
            rear: "задняя ось",
        },
        errors: {
            generic: "Не удалось выполнить проверку. Попробуйте ещё раз.",
            unavailable: "Проверка совместимости пока недоступна на этом сервере.",
            auth: "Откройте Mini App в Telegram или войдите через Telegram на сайте.",
            rateLimit: "Слишком много запросов. Повторите попытку позже.",
            files: "Выберите фото автомобиля и диска.",
            preliminaryFailed: "Не удалось распознать фотографии. Можно продолжить с ручным вводом.",
            providerFailed: "Каталог временно недоступен. Повторите подтверждённую проверку позже.",
            timeout: "Проверка выполняется дольше ожидаемого. Повторите запрос с теми же данными.",
            required: "Заполните марку, модель и год автомобиля и подтвердите данные.",
        },
    },
    en: {
        hero: {
            eyebrow: "Technical check",
            title: "Check wheel compatibility",
            lede: "First we identify the vehicle and wheel from photos, then check confirmed values against catalog data and deterministic rules.",
        },
        progress: {
            photos: "Photos",
            data: "Data",
            verdict: "Verdict",
        },
        upload: {
            title: "Use the same photos",
            text: "If you already created a render, there is no need to select the files again. Fitment runs separately and only when you request it.",
            car: "Vehicle",
            rim: "Wheel",
            choose: "Choose photo",
            replace: "Replace",
            remove: "Remove",
            manual: "Enter specifications manually",
            linked: "This check will be linked to the current render.",
        },
        loading: {
            preliminary: "Analyzing photos",
            preliminarySub: "Identifying the vehicle, reading markings, and preparing an editable draft.",
            confirmed: "Checking confirmed data",
            confirmedSub: "Loading the Wheel-Size profile and evaluating both axles.",
            polling: "The check is still running",
        },
        review: {
            eyebrow: "Preliminary estimate",
            title: "Review the detected data",
            likelihood: "Photo estimate",
            manualTitle: "Manual input",
            manualText: "Fill in the values you know. Unknown fields may stay empty—the result will state what is missing.",
            detectedVehicle: "Detected",
            detectedRim: "Wheel hints",
            disclaimer: "Photos and VLM provide preliminary hints only. The confirmed check starts after you review the data.",
            vehicleSection: "Vehicle",
            rimSection: "Wheel — front axle",
            rearSection: "Wheel — rear axle",
            requiredHint: "Make, model, and year are required. More wheel data produces a more precise result.",
            staggered: "Staggered setup",
            staggeredHint: "Use separate rear-axle specifications",
            advanced: "Additional wheel data",
            confirm: "I reviewed and confirm these values for the technical assessment",
        },
        fields: {
            make: "Make",
            model: "Model",
            year: "Year",
            body: "Body",
            generation: "Generation",
            modification: "Modification",
            market: "Market",
            brand: "Wheel brand",
            rimModel: "Wheel model",
            sku: "Part number / SKU",
            productUrl: "Product URL (HTTPS)",
            boltCount: "Bolt count",
            pcd: "PCD, mm",
            centerBore: "Center bore, mm",
            diameter: "Diameter, inches",
            width: "Width J",
            offset: "Offset ET, mm",
            loadRating: "Load rating, kg",
            fastener: "Fastener system",
            seatType: "Seat type",
            threadDiameter: "Thread diameter, mm",
            threadPitch: "Thread pitch, mm",
            boltLength: "Bolt length, mm",
        },
        result: {
            eyebrow: "Confirmed check",
            risk: "Risk level",
            reasons: "What we found",
            conditions: "Installation conditions",
            missing: "What to confirm",
            recommendations: "Recommended next steps",
            breakdown: "Parameter checks",
            technical: "Technical information",
            noItems: "No additional notes.",
            edit: "Edit data",
            render: "Go to render",
            disclaimer: "This assessment is based on reference data. Confirm compatibility with a specialist before purchase or installation.",
        },
        actions: {
            analyze: "Analyze photos",
            check: "Confirm and check",
            newCheck: "New check",
        },
        status: {
            compatible: "Compatible by known parameters",
            compatible_with_conditions: "Compatible with conditions",
            unknown: "Not enough data",
            incompatible: "Incompatibility found",
            queued: "Queued",
            processing: "Processing",
            completed: "Done",
            failed: "Failed",
        },
        risk: {
            low: "Low",
            moderate: "Moderate",
            elevated: "Elevated",
            high: "High",
            critical: "Critical",
        },
        axle: {
            front: "front axle",
            rear: "rear axle",
        },
        errors: {
            generic: "The check could not be completed. Please try again.",
            unavailable: "Fitment checks are not available on this server yet.",
            auth: "Open the Mini App in Telegram or log in with Telegram on the website.",
            rateLimit: "Too many requests. Please try again later.",
            files: "Choose both the vehicle and wheel photos.",
            preliminaryFailed: "The photos could not be identified. You can continue with manual input.",
            providerFailed: "The catalog is temporarily unavailable. Retry the confirmed check later.",
            timeout: "The check is taking longer than expected. Retry with the same data.",
            required: "Enter the vehicle make, model, and year, then confirm the data.",
        },
    },
};

const REASON_COPY = {
    ru: {
        bolt_count_mismatch: "Не совпадает количество крепёжных отверстий",
        pcd_mismatch: "Не совпадает разболтовка (PCD)",
        center_bore_too_small: "Центральное отверстие диска меньше ступицы",
        diameter_out_of_range: "Диаметр выходит за допустимый диапазон",
        width_out_of_range: "Ширина выходит за допустимый диапазон",
        offset_out_of_range: "Вылет ET выходит за допустимый диапазон",
        load_rating_insufficient: "Недостаточная грузоподъёмность диска",
        fastener_incompatible: "Система крепежа несовместима",
        hub_rings_required: "Потребуются центровочные кольца",
        offset_deviation_check_required: "Нужно проверить зазоры из-за отличия вылета",
        width_deviation_check_required: "Нужно проверить зазоры из-за отличия ширины",
        non_approved_size_check_required: "Размер не найден в заводском списке — нужна проверка на месте",
        fastener_hardware_check_required: "Нужно подтвердить подходящий комплект крепежа",
        offset_not_verified: "Вылет ET не удалось подтвердить",
        vehicle_not_resolved: "Автомобиль не найден в каталоге",
        pcd_unknown: "Разболтовка диска не подтверждена",
        center_bore_unknown: "Центральное отверстие не подтверждено",
        offset_unknown: "Вылет ET не подтверждён",
        size_unknown: "Размер диска не подтверждён",
        load_rating_unknown: "Грузоподъёмность не подтверждена",
        fastener_unknown: "Система крепежа не подтверждена",
        conflict_low_evidence: "Есть расхождение, но исходные данные недостаточно надёжны",
        allowed_set_empty: "Для этой оси нет заводских конфигураций для сравнения",
        matches_approved_fitment: "Параметр совпадает с заводской конфигурацией",
    },
    en: {
        bolt_count_mismatch: "Bolt count does not match",
        pcd_mismatch: "Bolt pattern (PCD) does not match",
        center_bore_too_small: "Wheel center bore is smaller than the vehicle hub",
        diameter_out_of_range: "Diameter is outside the supported range",
        width_out_of_range: "Width is outside the supported range",
        offset_out_of_range: "Offset ET is outside the supported range",
        load_rating_insufficient: "Wheel load rating is insufficient",
        fastener_incompatible: "Fastener system is incompatible",
        hub_rings_required: "Hub-centric rings are required",
        offset_deviation_check_required: "Clearance must be checked because the offset differs",
        width_deviation_check_required: "Clearance must be checked because the width differs",
        non_approved_size_check_required: "Size is not in the approved list and needs an on-vehicle check",
        fastener_hardware_check_required: "The correct fastener hardware must be confirmed",
        offset_not_verified: "Offset ET could not be verified",
        vehicle_not_resolved: "The vehicle was not found in the catalog",
        pcd_unknown: "Wheel bolt pattern is not confirmed",
        center_bore_unknown: "Center bore is not confirmed",
        offset_unknown: "Offset ET is not confirmed",
        size_unknown: "Wheel size is not confirmed",
        load_rating_unknown: "Load rating is not confirmed",
        fastener_unknown: "Fastener system is not confirmed",
        conflict_low_evidence: "A conflict exists, but the source data is not reliable enough",
        allowed_set_empty: "No approved configurations are available for this axle",
        matches_approved_fitment: "The value matches an approved configuration",
    },
};

const RECOMMENDATION_COPY = {
    ru: {
        confirm_vehicle_identity: "Уточните поколение и модификацию автомобиля",
        choose_correct_bolt_count: "Выберите диск с правильным количеством отверстий",
        choose_correct_pcd: "Выберите диск с подходящей разболтовкой",
        choose_larger_center_bore: "Выберите диск с DIA не меньше диаметра ступицы",
        install_hub_centric_rings: "Подберите точные центровочные кольца",
        verify_suspension_and_arch_clearance: "Проверьте зазоры до подвески, тормозов и кузова",
        confirm_offset: "Подтвердите вылет ET по маркировке или карточке товара",
        choose_approved_offset: "Выберите диск с поддерживаемым вылетом ET",
        verify_non_approved_size: "Проверьте нештатный размер на автомобиле",
        choose_approved_diameter: "Выберите поддерживаемый диаметр",
        choose_approved_width: "Выберите поддерживаемую ширину",
        verify_fastener_hardware: "Подтвердите тип посадки и комплект крепежа",
        choose_sufficient_load_rating: "Выберите диск с достаточной нагрузкой",
        provide_pcd: "Укажите количество отверстий и PCD",
        provide_center_bore: "Укажите DIA диска",
        provide_rim_size: "Укажите диаметр и ширину диска",
        provide_fastener_system: "Укажите систему крепежа и тип посадки",
        confirm_load_rating: "Уточните допустимую нагрузку диска",
        confirm_vehicle_modification: "Уточните модификацию автомобиля",
        confirm_low_evidence_value: "Перепроверьте параметры по маркировке или документации",
    },
    en: {
        confirm_vehicle_identity: "Confirm the vehicle generation and modification",
        choose_correct_bolt_count: "Choose a wheel with the correct bolt count",
        choose_correct_pcd: "Choose a wheel with the correct bolt pattern",
        choose_larger_center_bore: "Choose a wheel with a center bore at least as large as the hub",
        install_hub_centric_rings: "Use correctly sized hub-centric rings",
        verify_suspension_and_arch_clearance: "Check suspension, brake, and body clearance",
        confirm_offset: "Confirm offset ET from markings or the product page",
        choose_approved_offset: "Choose a supported offset ET",
        verify_non_approved_size: "Inspect the non-approved size on the vehicle",
        choose_approved_diameter: "Choose a supported diameter",
        choose_approved_width: "Choose a supported width",
        verify_fastener_hardware: "Confirm seat type and fastener hardware",
        choose_sufficient_load_rating: "Choose a wheel with a sufficient load rating",
        provide_pcd: "Enter bolt count and PCD",
        provide_center_bore: "Enter the wheel center bore",
        provide_rim_size: "Enter wheel diameter and width",
        provide_fastener_system: "Enter the fastener system and seat type",
        confirm_load_rating: "Confirm the wheel load rating",
        confirm_vehicle_modification: "Confirm the vehicle modification",
        confirm_low_evidence_value: "Recheck the values using markings or documentation",
    },
};

const MISSING_COPY = {
    ru: {
        pcd: "Разболтовка (PCD)",
        center_bore: "Центральное отверстие (DIA)",
        offset_et: "Вылет ET",
        diameter_width: "Диаметр и ширина",
        load_rating: "Допустимая нагрузка",
        fastener_system: "Система крепежа",
        provider_allowed_wheels: "Заводские размеры",
        vehicle_identity: "Точная модификация автомобиля",
        trusted_conflict_evidence: "Подтверждение конфликтующих параметров",
    },
    en: {
        pcd: "Bolt pattern (PCD)",
        center_bore: "Center bore",
        offset_et: "Offset ET",
        diameter_width: "Diameter and width",
        load_rating: "Load rating",
        fastener_system: "Fastener system",
        provider_allowed_wheels: "Approved wheel sizes",
        vehicle_identity: "Exact vehicle modification",
        trusted_conflict_evidence: "Trusted evidence for conflicting values",
    },
};

const PARAMETER_COPY = {
    ru: {
        bolt_pattern: "Разболтовка",
        center_bore: "Центральное отверстие",
        size_offset: "Размер и вылет",
        fasteners: "Крепёж",
        load_rating: "Нагрузка",
        vehicle_identity: "Автомобиль",
    },
    en: {
        bolt_pattern: "Bolt pattern",
        center_bore: "Center bore",
        size_offset: "Size and offset",
        fasteners: "Fasteners",
        load_rating: "Load rating",
        vehicle_identity: "Vehicle",
    },
};

function lookup(source, path) {
    return path.split(".").reduce((value, key) => value?.[key], source) ?? path;
}

function humanizeCode(code) {
    return String(code || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asInputValue(field) {
    if (field && typeof field === "object" && "value" in field) {
        return field.value ?? "";
    }
    return field ?? "";
}

function optionalString(value) {
    const normalized = String(value || "").trim();
    return normalized || null;
}

function optionalNumber(value) {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createFitmentController({
    locale,
    apiBaseUrl,
    getFiles,
    hydrateFiles,
    selectFile,
    clearFile,
    getIdentityPayload,
    getIdentitySearchParams,
    withAuthHeaders,
    parseApiError,
    makeIdempotencyKey,
    haptic,
    onStateChange,
    openRender,
}) {
    const language = locale === "ru" ? "ru" : "en";
    let root = null;
    let stage = "upload";
    let busy = false;
    let preliminary = null;
    let result = null;
    let renderJobId = null;
    let identityId = null;
    let rimSetupId = null;
    let checkId = null;
    let idempotencyKey = null;
    let submissionFingerprint = null;
    const previewUrls = { car: "", wheel: "" };

    function ft(path) {
        return lookup(COPY[language], path);
    }

    function template() {
        return `
            <section class="hero-panel compact fitment-hero">
                <div class="hero-copy">
                    <p class="eyebrow">${ft("hero.eyebrow")}</p>
                    <h1>${ft("hero.title")}</h1>
                    <p class="lede">${ft("hero.lede")}</p>
                </div>
                <div class="fitment-mark" aria-hidden="true">
                    <span></span><span></span><span></span>
                </div>
            </section>

            <div class="fitment-progress" aria-label="${ft("hero.title")}">
                <div class="fitment-progress-step" data-fitment-progress="upload">
                    <span>1</span><strong>${ft("progress.photos")}</strong>
                </div>
                <div class="fitment-progress-line"></div>
                <div class="fitment-progress-step" data-fitment-progress="review">
                    <span>2</span><strong>${ft("progress.data")}</strong>
                </div>
                <div class="fitment-progress-line"></div>
                <div class="fitment-progress-step" data-fitment-progress="result">
                    <span>3</span><strong>${ft("progress.verdict")}</strong>
                </div>
            </div>

            <section class="panel fitment-stage" data-fitment-stage="upload">
                <div class="panel-head fitment-panel-head">
                    <div>
                        <p class="section-label">${ft("progress.photos")}</p>
                        <h2>${ft("upload.title")}</h2>
                    </div>
                </div>
                <p class="fitment-stage-copy">${ft("upload.text")}</p>
                <div class="fitment-linked-render" data-fitment-linked-render hidden>
                    <span aria-hidden="true">↗</span>
                    <span>${ft("upload.linked")}</span>
                </div>
                <div class="fitment-photo-grid">
                    ${photoCard("car", "📷", ft("upload.car"))}
                    ${photoCard("wheel", "◎", ft("upload.rim"))}
                </div>
                <div class="fitment-status-island" data-fitment-upload-status hidden aria-live="polite">
                    <div class="spinner"></div>
                    <div>
                        <strong data-fitment-upload-status-title></strong>
                        <p data-fitment-upload-status-sub></p>
                    </div>
                </div>
                <div class="fitment-error-island" data-fitment-upload-error hidden aria-live="assertive"></div>
                <button type="button" class="ghost-button fitment-manual-button" data-fitment-manual>
                    ${ft("upload.manual")}
                </button>
            </section>

            <section class="fitment-stage" data-fitment-stage="review" hidden>
                <section class="panel fitment-preliminary-card">
                    <div class="fitment-preliminary-head">
                        <div>
                            <p class="eyebrow">${ft("review.eyebrow")}</p>
                            <h2 data-fitment-review-title>${ft("review.title")}</h2>
                        </div>
                        <div class="fitment-likelihood" data-fitment-likelihood>
                            <strong data-fitment-likelihood-value>—</strong>
                            <span>${ft("review.likelihood")}</span>
                        </div>
                    </div>
                    <div class="fitment-detected-grid" data-fitment-detected-grid>
                        <div class="fitment-detected-card">
                            <span>${ft("review.detectedVehicle")}</span>
                            <strong data-fitment-detected-vehicle>—</strong>
                        </div>
                        <div class="fitment-detected-card">
                            <span>${ft("review.detectedRim")}</span>
                            <strong data-fitment-detected-rim>—</strong>
                        </div>
                    </div>
                    <div class="fitment-preliminary-verdict" data-fitment-preliminary-verdict></div>
                    <p class="fitment-disclaimer">${ft("review.disclaimer")}</p>
                </section>

                <form class="panel fitment-form" data-fitment-form novalidate>
                    <div class="fitment-form-heading">
                        <div>
                            <p class="section-label">${ft("review.vehicleSection")}</p>
                            <h2>${ft("review.title")}</h2>
                        </div>
                        <p>${ft("review.requiredHint")}</p>
                    </div>
                    <div class="fitment-field-grid">
                        ${textField("vehicle.make", ft("fields.make"), { required: true, autocomplete: "organization" })}
                        ${textField("vehicle.model", ft("fields.model"), { required: true })}
                        ${numberField("vehicle.year", ft("fields.year"), { required: true, min: 1950, max: 2100, step: 1 })}
                        ${textField("vehicle.generation", ft("fields.generation"))}
                        ${textField("vehicle.modification", ft("fields.modification"))}
                        ${textField("vehicle.body", ft("fields.body"))}
                        ${textField("vehicle.market", ft("fields.market"))}
                    </div>

                    ${rimFields("front", ft("review.rimSection"))}

                    <label class="fitment-toggle">
                        <input type="checkbox" data-fitment-staggered>
                        <span class="fitment-toggle-control" aria-hidden="true"></span>
                        <span>
                            <strong>${ft("review.staggered")}</strong>
                            <small>${ft("review.staggeredHint")}</small>
                        </span>
                    </label>

                    <div data-fitment-rear-fields hidden>
                        ${rimFields("rear", ft("review.rearSection"))}
                    </div>

                    <label class="fitment-confirm">
                        <input type="checkbox" data-fitment-confirm required>
                        <span>${ft("review.confirm")}</span>
                    </label>
                    <div class="fitment-status-island" data-fitment-review-status hidden aria-live="polite">
                        <div class="spinner"></div>
                        <div>
                            <strong data-fitment-review-status-title></strong>
                            <p data-fitment-review-status-sub></p>
                        </div>
                    </div>
                    <div class="fitment-error-island" data-fitment-review-error hidden aria-live="assertive"></div>
                </form>
            </section>

            <section class="fitment-stage" data-fitment-stage="result" hidden>
                <section class="panel fitment-verdict-card" data-fitment-verdict-card>
                    <div class="fitment-verdict-orbit" aria-hidden="true"><span></span></div>
                    <p class="eyebrow">${ft("result.eyebrow")}</p>
                    <h2 data-fitment-verdict-title>—</h2>
                    <div class="fitment-risk-summary">
                        <div class="fitment-risk-score">
                            <strong data-fitment-risk-score>—</strong>
                            <span>/ 100</span>
                        </div>
                        <div>
                            <span>${ft("result.risk")}</span>
                            <strong data-fitment-risk-level>—</strong>
                        </div>
                    </div>
                </section>
                <section class="fitment-result-grid">
                    ${resultPanel("reasons", ft("result.reasons"))}
                    ${resultPanel("conditions", ft("result.conditions"))}
                    ${resultPanel("missing", ft("result.missing"))}
                    ${resultPanel("recommendations", ft("result.recommendations"))}
                </section>
                <section class="panel">
                    <div class="panel-head">
                        <div>
                            <p class="section-label">${ft("result.breakdown")}</p>
                            <h2>${ft("result.breakdown")}</h2>
                        </div>
                    </div>
                    <div class="fitment-risk-breakdown" data-fitment-risk-breakdown></div>
                </section>
                <details class="collapsible panel fitment-technical">
                    <summary>
                        <strong>${ft("result.technical")}</strong>
                        <span class="summary-action">+</span>
                    </summary>
                    <div class="fitment-technical-grid" data-fitment-technical></div>
                </details>
                <section class="panel fitment-result-actions">
                    <p class="fitment-disclaimer">${ft("result.disclaimer")}</p>
                    <div>
                        <button type="button" class="ghost-button" data-fitment-edit>${ft("result.edit")}</button>
                        <button type="button" class="primary-button" data-fitment-render>${ft("result.render")}</button>
                    </div>
                </section>
            </section>
        `;
    }

    function photoCard(kind, icon, title) {
        return `
            <article class="fitment-photo-card" data-fitment-photo-card="${kind}">
                <label class="fitment-photo-select">
                    <input type="file" accept="image/jpeg,image/png,image/webp" data-fitment-file="${kind}" hidden>
                    <span class="fitment-photo-visual">
                        <img alt="" data-fitment-photo-img="${kind}" hidden>
                        <span class="fitment-photo-icon" data-fitment-photo-icon="${kind}" aria-hidden="true">${icon}</span>
                    </span>
                    <span class="fitment-photo-copy">
                        <strong>${title}</strong>
                        <small data-fitment-photo-name="${kind}">${ft("upload.choose")}</small>
                    </span>
                    <span class="fitment-photo-action" data-fitment-photo-action="${kind}">${ft("upload.choose")}</span>
                </label>
                <button type="button" class="fitment-photo-remove" data-fitment-file-clear="${kind}" hidden>${ft("upload.remove")}</button>
            </article>
        `;
    }

    function inputAttributes(options = {}) {
        const attributes = [];
        if (options.required) attributes.push("required");
        if (options.min != null) attributes.push(`min="${options.min}"`);
        if (options.max != null) attributes.push(`max="${options.max}"`);
        if (options.step != null) attributes.push(`step="${options.step}"`);
        if (options.autocomplete) attributes.push(`autocomplete="${options.autocomplete}"`);
        return attributes.join(" ");
    }

    function textField(name, label, options = {}) {
        return `
            <label class="fitment-field">
                <span>${label}${options.required ? " *" : ""}</span>
                <input type="${options.type || "text"}" data-fitment-field="${name}" ${inputAttributes(options)}>
            </label>
        `;
    }

    function numberField(name, label, options = {}) {
        return textField(name, label, { ...options, type: "number" });
    }

    function rimFields(prefix, title) {
        return `
            <fieldset class="fitment-rim-fieldset">
                <legend>${title}</legend>
                <div class="fitment-spec-grid">
                    ${numberField(`${prefix}.bolt_count`, ft("fields.boltCount"), { min: 3, max: 10, step: 1 })}
                    ${numberField(`${prefix}.pcd_mm`, ft("fields.pcd"), { min: 1, step: 0.1 })}
                    ${numberField(`${prefix}.center_bore_mm`, ft("fields.centerBore"), { min: 1, step: 0.1 })}
                    ${numberField(`${prefix}.wheel_diameter_in`, ft("fields.diameter"), { min: 1, step: 0.5 })}
                    ${numberField(`${prefix}.wheel_width_j`, ft("fields.width"), { min: 1, step: 0.5 })}
                    ${numberField(`${prefix}.offset_et_mm`, ft("fields.offset"), { step: 0.5 })}
                </div>
                <details class="fitment-advanced">
                    <summary>${ft("review.advanced")} <span>+</span></summary>
                    <div class="fitment-field-grid">
                        ${textField(`${prefix}.brand`, ft("fields.brand"))}
                        ${textField(`${prefix}.model`, ft("fields.rimModel"))}
                        ${textField(`${prefix}.sku`, ft("fields.sku"))}
                        ${textField(`${prefix}.product_url`, ft("fields.productUrl"), { type: "url" })}
                        ${numberField(`${prefix}.load_rating_kg`, ft("fields.loadRating"), { min: 1, step: 1 })}
                        ${textField(`${prefix}.fastener_system`, ft("fields.fastener"))}
                        ${textField(`${prefix}.seat_type`, ft("fields.seatType"))}
                        ${numberField(`${prefix}.thread_diameter_mm`, ft("fields.threadDiameter"), { min: 1, step: 0.1 })}
                        ${numberField(`${prefix}.thread_pitch_mm`, ft("fields.threadPitch"), { min: 0.1, step: 0.05 })}
                        ${numberField(`${prefix}.bolt_length_mm`, ft("fields.boltLength"), { min: 1, step: 0.5 })}
                    </div>
                </details>
            </fieldset>
        `;
    }

    function resultPanel(kind, title) {
        return `
            <section class="panel fitment-result-panel">
                <p class="section-label">${title}</p>
                <div class="fitment-result-list" data-fitment-result-list="${kind}"></div>
            </section>
        `;
    }

    function mount() {
        root = document.querySelector("[data-fitment-root]");
        if (!root) return;
        root.innerHTML = template();
        bindEvents();
        syncFiles();
        showStage("upload", { scroll: false });
    }

    function bindEvents() {
        root.querySelectorAll("[data-fitment-file]").forEach((input) => {
            input.addEventListener("change", async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                await selectFile(input.dataset.fitmentFile, file);
                renderJobId = null;
                syncFiles();
                updateLinkedRender();
            });
        });
        root.querySelectorAll("[data-fitment-file-clear]").forEach((button) => {
            button.addEventListener("click", () => {
                clearFile(button.dataset.fitmentFileClear);
                renderJobId = null;
                syncFiles();
                updateLinkedRender();
            });
        });
        root.querySelector("[data-fitment-manual]")?.addEventListener("click", startManual);
        root.querySelector("[data-fitment-staggered]")?.addEventListener("change", (event) => {
            const enabled = event.target.checked;
            root.querySelector("[data-fitment-rear-fields]").hidden = !enabled;
            if (enabled) copyFrontToRearIfEmpty();
            invalidateSubmission();
            notify();
        });
        root.querySelector("[data-fitment-form]")?.addEventListener("input", () => {
            invalidateSubmission();
            clearError("review");
            notify();
        });
        root.querySelector("[data-fitment-edit]")?.addEventListener("click", () => {
            showStage("review");
        });
        root.querySelector("[data-fitment-render]")?.addEventListener("click", openRender);
    }

    function notify() {
        onStateChange?.();
    }

    function showStage(nextStage, { scroll = true } = {}) {
        stage = nextStage;
        root?.querySelectorAll("[data-fitment-stage]").forEach((element) => {
            element.hidden = element.dataset.fitmentStage !== stage;
        });
        const order = ["upload", "review", "result"];
        const activeIndex = order.indexOf(stage);
        root?.querySelectorAll("[data-fitment-progress]").forEach((element) => {
            const index = order.indexOf(element.dataset.fitmentProgress);
            element.dataset.state = index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";
        });
        notify();
        if (scroll) {
            root?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function setBusy(value) {
        busy = value;
        root?.querySelectorAll("input, button").forEach((element) => {
            if (!element.matches("[data-fitment-edit], [data-fitment-render]")) {
                element.disabled = value;
            }
        });
        notify();
    }

    function syncFiles() {
        if (!root) return;
        const files = getFiles();
        for (const kind of ["car", "wheel"]) {
            const file = files[kind];
            const image = root.querySelector(`[data-fitment-photo-img="${kind}"]`);
            const icon = root.querySelector(`[data-fitment-photo-icon="${kind}"]`);
            const name = root.querySelector(`[data-fitment-photo-name="${kind}"]`);
            const action = root.querySelector(`[data-fitment-photo-action="${kind}"]`);
            const remove = root.querySelector(`[data-fitment-file-clear="${kind}"]`);
            if (previewUrls[kind]) {
                URL.revokeObjectURL(previewUrls[kind]);
                previewUrls[kind] = "";
            }
            if (file?.blob) {
                previewUrls[kind] = URL.createObjectURL(file.blob);
                image.src = previewUrls[kind];
                image.hidden = false;
                icon.hidden = true;
                name.textContent = file.name || kind;
                action.textContent = ft("upload.replace");
                remove.hidden = false;
            } else {
                image.hidden = true;
                image.removeAttribute("src");
                icon.hidden = false;
                name.textContent = ft("upload.choose");
                action.textContent = ft("upload.choose");
                remove.hidden = true;
            }
        }
        notify();
    }

    function updateLinkedRender() {
        const element = root?.querySelector("[data-fitment-linked-render]");
        if (element) element.hidden = !renderJobId;
    }

    function onFilesChanged({ clearRenderLink = false } = {}) {
        if (clearRenderLink) renderJobId = null;
        syncFiles();
        updateLinkedRender();
    }

    function openFromRender(jobId) {
        renderJobId = jobId || null;
        resetCheckState();
        showStage("upload");
        syncFiles();
        updateLinkedRender();
    }

    function resetCheckState() {
        preliminary = null;
        result = null;
        identityId = null;
        rimSetupId = null;
        checkId = null;
        idempotencyKey = null;
        submissionFingerprint = null;
        clearError("upload");
        clearError("review");
        hideStatus("upload");
        hideStatus("review");
    }

    function startManual() {
        resetCheckState();
        clearForm();
        renderPreliminary(null);
        showStage("review");
        haptic("light");
    }

    function clearForm() {
        root?.querySelector("[data-fitment-form]")?.reset();
        const rear = root?.querySelector("[data-fitment-rear-fields]");
        if (rear) rear.hidden = true;
    }

    function setField(name, value) {
        const input = root?.querySelector(`[data-fitment-field="${name}"]`);
        if (input && value !== undefined && value !== null) {
            input.value = String(value);
        }
    }

    function prefillFromPrediction(run) {
        clearForm();
        const prediction = run?.prediction;
        const vehicle = prediction?.vehicle?.selected || prediction?.vehicle?.candidates?.[0] || {};
        setField("vehicle.make", vehicle.make);
        setField("vehicle.model", vehicle.model);
        setField("vehicle.year", vehicle.year || vehicle.year_to || vehicle.year_from);
        setField("vehicle.body", vehicle.body);
        setField("vehicle.generation", vehicle.generation);
        setField("vehicle.modification", vehicle.modification);
        setField("vehicle.market", vehicle.market);

        const front = prediction?.suggested_rim_setup?.front || {};
        const hints = prediction?.rim_hints || {};
        setField("front.brand", front.brand || hints.brand);
        setField("front.model", front.model || hints.model);
        for (const field of [
            "bolt_count",
            "pcd_mm",
            "center_bore_mm",
            "wheel_diameter_in",
            "wheel_width_j",
            "offset_et_mm",
            "load_rating_kg",
            "fastener_system",
            "seat_type",
            "thread_diameter_mm",
            "thread_pitch_mm",
            "bolt_length_mm",
        ]) {
            setField(`front.${field}`, asInputValue(front[field]));
        }
        copyFrontToRearIfEmpty();
        invalidateSubmission();
    }

    function copyFrontToRearIfEmpty() {
        root?.querySelectorAll('[data-fitment-field^="front."]').forEach((frontInput) => {
            const suffix = frontInput.dataset.fitmentField.slice("front.".length);
            const rearInput = root.querySelector(`[data-fitment-field="rear.${suffix}"]`);
            if (rearInput && !rearInput.value) rearInput.value = frontInput.value;
        });
    }

    function renderPreliminary(run) {
        const likelihood = root?.querySelector("[data-fitment-likelihood]");
        const likelihoodValue = root?.querySelector("[data-fitment-likelihood-value]");
        const title = root?.querySelector("[data-fitment-review-title]");
        const detectedVehicle = root?.querySelector("[data-fitment-detected-vehicle]");
        const detectedRim = root?.querySelector("[data-fitment-detected-rim]");
        const detectedGrid = root?.querySelector("[data-fitment-detected-grid]");
        const verdict = root?.querySelector("[data-fitment-preliminary-verdict]");
        if (!run) {
            if (title) title.textContent = ft("review.manualTitle");
            if (likelihood) likelihood.hidden = true;
            if (detectedGrid) detectedGrid.hidden = true;
            if (verdict) {
                verdict.dataset.tone = "unknown";
                verdict.textContent = ft("review.manualText");
            }
            return;
        }
        const prediction = run.prediction || {};
        const vehicle = prediction.vehicle?.selected || prediction.vehicle?.candidates?.[0] || {};
        const hints = prediction.rim_hints || {};
        if (title) title.textContent = ft("review.title");
        if (likelihood) likelihood.hidden = false;
        if (detectedGrid) detectedGrid.hidden = false;
        if (likelihoodValue) {
            likelihoodValue.textContent = run.fit_likelihood == null
                ? "—"
                : `${Math.round(Number(run.fit_likelihood) * 100)}%`;
        }
        if (detectedVehicle) {
            detectedVehicle.textContent = [vehicle.make, vehicle.model, vehicle.year || vehicle.year_to]
                .filter(Boolean)
                .join(" · ") || "—";
        }
        if (detectedRim) {
            detectedRim.textContent = [
                hints.brand,
                hints.model,
                hints.style,
                hints.suggested_diameter_in ? `${hints.suggested_diameter_in}"` : null,
                hints.visible_marking_text,
            ]
                .filter(Boolean)
                .join(" · ") || "—";
        }
        if (verdict) {
            const status = run.verdict?.status || "unknown";
            verdict.dataset.tone = status;
            verdict.textContent = ft(`status.${status}`);
        }
    }

    function setStatus(kind, title, subtitle) {
        const island = root?.querySelector(`[data-fitment-${kind}-status]`);
        if (!island) return;
        island.hidden = false;
        const titleElement = root.querySelector(`[data-fitment-${kind}-status-title]`);
        const subElement = root.querySelector(`[data-fitment-${kind}-status-sub]`);
        if (titleElement) titleElement.textContent = title;
        if (subElement) subElement.textContent = subtitle;
    }

    function hideStatus(kind) {
        const island = root?.querySelector(`[data-fitment-${kind}-status]`);
        if (island) island.hidden = true;
    }

    function setError(kind, message) {
        const element = root?.querySelector(`[data-fitment-${kind}-error]`);
        if (!element) return;
        element.hidden = false;
        element.textContent = message;
    }

    function clearError(kind) {
        const element = root?.querySelector(`[data-fitment-${kind}-error]`);
        if (!element) return;
        element.hidden = true;
        element.textContent = "";
    }

    function friendlyError(error, fallback = "errors.generic") {
        if (error?.status === 503) return ft("errors.unavailable");
        if (error?.status === 401 || error?.status === 400 && /initData|required/i.test(error.message)) {
            return ft("errors.auth");
        }
        if (error?.status === 429) return ft("errors.rateLimit");
        if (error?.message === "fitment_timeout") return ft("errors.timeout");
        if (["vlm_error", "vlm_not_configured", "preliminary_internal_error"].includes(error?.message)) {
            return ft("errors.preliminaryFailed");
        }
        if (error?.message && !/^HTTP \d+$/.test(error.message)) return error.message;
        return ft(fallback);
    }

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = new Error(await parseApiError(response));
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    async function runPreliminary() {
        if (busy) return;
        clearError("upload");
        setBusy(true);
        try {
            await hydrateFiles();
            syncFiles();
            const files = getFiles();
            if (!files.car?.blob || !files.wheel?.blob) {
                setError("upload", ft("errors.files"));
                haptic("warning");
                return;
            }
            setStatus("upload", ft("loading.preliminary"), ft("loading.preliminarySub"));
            haptic("light");
            const formData = new FormData();
            formData.append("car_image", files.car.blob, files.car.name);
            formData.append("rim_image", files.wheel.blob, files.wheel.name);
            const identity = getIdentityPayload({ includeTelegramUserId: true });
            if (identity.init_data) formData.append("init_data", identity.init_data);
            if (identity.telegram_user_id != null) {
                formData.append("telegram_user_id", String(identity.telegram_user_id));
            }
            let run = await fetchJson(`${apiBaseUrl}/fitment/preliminary`, {
                method: "POST",
                headers: withAuthHeaders(),
                body: formData,
            });
            if (run.status === "queued" || run.status === "processing") {
                run = await pollPreliminary(run.run_id);
            }
            if (run.status !== "completed") {
                throw new Error(run.error_code || ft("errors.preliminaryFailed"));
            }
            preliminary = run;
            prefillFromPrediction(run);
            renderPreliminary(run);
            showStage("review");
            haptic("success");
        } catch (error) {
            console.error("[DW] fitment preliminary failed", {
                status: error?.status || null,
                message: error?.message || "unknown",
            });
            setError("upload", friendlyError(error, "errors.preliminaryFailed"));
            haptic("error");
        } finally {
            hideStatus("upload");
            setBusy(false);
        }
    }

    async function pollPreliminary(runId) {
        const deadline = Date.now() + FITMENT_POLL_TIMEOUT_MS;
        while (Date.now() < deadline) {
            await sleep(FITMENT_POLL_INTERVAL_MS);
            const params = getIdentitySearchParams();
            const run = await fetchJson(
                `${apiBaseUrl}/fitment/preliminary/${runId}?${params.toString()}`,
                { headers: withAuthHeaders() }
            );
            if (run.status === "completed" || run.status === "failed") return run;
            setStatus("upload", ft("loading.polling"), ft("loading.preliminarySub"));
        }
        throw new Error("fitment_timeout");
    }

    function fieldValue(name) {
        return root?.querySelector(`[data-fitment-field="${name}"]`)?.value ?? "";
    }

    function buildVehicle() {
        return {
            make: optionalString(fieldValue("vehicle.make")),
            model: optionalString(fieldValue("vehicle.model")),
            year: optionalNumber(fieldValue("vehicle.year")),
            body: optionalString(fieldValue("vehicle.body")),
            generation: optionalString(fieldValue("vehicle.generation")),
            modification: optionalString(fieldValue("vehicle.modification")),
            market: optionalString(fieldValue("vehicle.market")),
            is_confirmed: true,
        };
    }

    function buildRim(prefix) {
        return {
            brand: optionalString(fieldValue(`${prefix}.brand`)),
            model: optionalString(fieldValue(`${prefix}.model`)),
            sku: optionalString(fieldValue(`${prefix}.sku`)),
            product_url: optionalString(fieldValue(`${prefix}.product_url`)),
            bolt_count: optionalNumber(fieldValue(`${prefix}.bolt_count`)),
            pcd_mm: optionalNumber(fieldValue(`${prefix}.pcd_mm`)),
            center_bore_mm: optionalNumber(fieldValue(`${prefix}.center_bore_mm`)),
            wheel_diameter_in: optionalNumber(fieldValue(`${prefix}.wheel_diameter_in`)),
            wheel_width_j: optionalNumber(fieldValue(`${prefix}.wheel_width_j`)),
            offset_et_mm: optionalNumber(fieldValue(`${prefix}.offset_et_mm`)),
            load_rating_kg: optionalNumber(fieldValue(`${prefix}.load_rating_kg`)),
            fastener_system: optionalString(fieldValue(`${prefix}.fastener_system`)),
            seat_type: optionalString(fieldValue(`${prefix}.seat_type`)),
            thread_diameter_mm: optionalNumber(fieldValue(`${prefix}.thread_diameter_mm`)),
            thread_pitch_mm: optionalNumber(fieldValue(`${prefix}.thread_pitch_mm`)),
            bolt_length_mm: optionalNumber(fieldValue(`${prefix}.bolt_length_mm`)),
        };
    }

    function buildSubmission() {
        const staggered = Boolean(root?.querySelector("[data-fitment-staggered]")?.checked);
        return {
            vehicle: buildVehicle(),
            setup: {
                front: buildRim("front"),
                rear: staggered ? buildRim("rear") : null,
                is_confirmed: true,
            },
            preliminary_run_id: preliminary?.run_id || null,
            render_job_id: renderJobId,
        };
    }

    function isReviewReady() {
        if (!root) return false;
        const vehicle = buildVehicle();
        const confirmed = Boolean(root.querySelector("[data-fitment-confirm]")?.checked);
        return Boolean(vehicle.make && vehicle.model && vehicle.year && confirmed);
    }

    function invalidateSubmission() {
        identityId = null;
        rimSetupId = null;
        checkId = null;
        idempotencyKey = null;
        submissionFingerprint = null;
    }

    async function runConfirmed() {
        if (busy) return;
        clearError("review");
        const form = root?.querySelector("[data-fitment-form]");
        if (!isReviewReady() || !form?.checkValidity()) {
            setError("review", ft("errors.required"));
            form?.reportValidity();
            haptic("warning");
            return;
        }

        const submission = buildSubmission();
        const fingerprint = JSON.stringify(submission);
        if (submissionFingerprint && submissionFingerprint !== fingerprint) {
            invalidateSubmission();
        }
        submissionFingerprint = fingerprint;
        idempotencyKey ||= makeIdempotencyKey();
        const identity = getIdentityPayload({ includeTelegramUserId: true });
        setBusy(true);
        setStatus("review", ft("loading.confirmed"), ft("loading.confirmedSub"));
        haptic("light");
        try {
            if (!identityId) {
                const createdIdentity = await fetchJson(`${apiBaseUrl}/fitment/vehicle-identities`, {
                    method: "POST",
                    headers: withAuthHeaders({ "Content-Type": "application/json" }),
                    body: JSON.stringify({ ...submission.vehicle, ...identity }),
                });
                identityId = createdIdentity.id;
            }
            if (!rimSetupId) {
                const createdSetup = await fetchJson(`${apiBaseUrl}/fitment/rim-setups`, {
                    method: "POST",
                    headers: withAuthHeaders({ "Content-Type": "application/json" }),
                    body: JSON.stringify({ ...submission.setup, ...identity }),
                });
                rimSetupId = createdSetup.id;
            }
            let check = await fetchJson(`${apiBaseUrl}/fitment/checks`, {
                method: "POST",
                headers: withAuthHeaders({
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                }),
                body: JSON.stringify({
                    vehicle_identity_id: identityId,
                    rim_setup_id: rimSetupId,
                    render_job_id: submission.render_job_id,
                    preliminary_run_id: submission.preliminary_run_id,
                    trigger: "user_requested",
                    mode: "detailed",
                    ...identity,
                }),
            });
            checkId = check.check_id;
            if (check.status === "queued" || check.status === "processing") {
                check = await pollCheck(check.check_id);
            }
            if (check.status !== "completed") {
                checkId = null;
                idempotencyKey = null;
                const error = new Error(
                    check.error_code === "provider_error"
                        ? ft("errors.providerFailed")
                        : ft("errors.generic")
                );
                throw error;
            }
            result = check;
            renderConfirmedResult(check);
            showStage("result");
            haptic("success");
        } catch (error) {
            console.error("[DW] confirmed fitment failed", {
                status: error?.status || null,
                checkId,
                message: error?.message || "unknown",
            });
            setError("review", friendlyError(error));
            haptic("error");
        } finally {
            hideStatus("review");
            setBusy(false);
        }
    }

    async function pollCheck(id) {
        const deadline = Date.now() + FITMENT_POLL_TIMEOUT_MS;
        while (Date.now() < deadline) {
            await sleep(FITMENT_POLL_INTERVAL_MS);
            const params = getIdentitySearchParams();
            const check = await fetchJson(
                `${apiBaseUrl}/fitment/checks/${id}?${params.toString()}`,
                { headers: withAuthHeaders() }
            );
            if (check.status === "completed" || check.status === "failed") return check;
            setStatus("review", ft("loading.polling"), ft("loading.confirmedSub"));
        }
        throw new Error("fitment_timeout");
    }

    function localizedReason(code) {
        return REASON_COPY[language][code] || humanizeCode(code);
    }

    function localizedRecommendation(code, fallback) {
        return RECOMMENDATION_COPY[language][code] || fallback || humanizeCode(code);
    }

    function renderItems(kind, items) {
        const container = root?.querySelector(`[data-fitment-result-list="${kind}"]`);
        if (!container) return;
        container.replaceChildren();
        if (!items.length) {
            const empty = document.createElement("p");
            empty.className = "fitment-result-empty";
            empty.textContent = ft("result.noItems");
            container.append(empty);
            return;
        }
        for (const item of items) {
            const row = document.createElement("div");
            row.className = "fitment-result-item";
            const marker = document.createElement("span");
            marker.className = "fitment-result-marker";
            marker.setAttribute("aria-hidden", "true");
            const text = document.createElement("span");
            text.textContent = item;
            row.append(marker, text);
            container.append(row);
        }
    }

    function renderConfirmedResult(check) {
        const verdict = check.verdict || {};
        const risk = check.risk || {};
        const status = verdict.status || "unknown";
        const card = root?.querySelector("[data-fitment-verdict-card]");
        if (card) card.dataset.tone = status;
        const title = root?.querySelector("[data-fitment-verdict-title]");
        if (title) title.textContent = ft(`status.${status}`);
        const score = root?.querySelector("[data-fitment-risk-score]");
        if (score) score.textContent = risk.score == null ? "—" : String(Math.round(risk.score));
        const level = root?.querySelector("[data-fitment-risk-level]");
        if (level) level.textContent = risk.level ? ft(`risk.${risk.level}`) : "—";

        const conditionCodes = verdict.condition_codes || [];
        const reasonCodes = (verdict.reason_codes || []).filter(
            (code) => !conditionCodes.includes(code)
        );
        renderItems("reasons", reasonCodes.map(localizedReason));
        renderItems("conditions", conditionCodes.map(localizedReason));
        renderItems(
            "missing",
            (verdict.missing_fields || []).map(
                (field) => MISSING_COPY[language][field] || humanizeCode(field)
            )
        );
        const recommendations = (risk.recommendation_codes || []).map((code, index) =>
            localizedRecommendation(code, risk.recommendations?.[index])
        );
        renderItems("recommendations", recommendations);
        renderRiskBreakdown(risk.parameter_risks || []);
        renderTechnical(check);
    }

    function renderRiskBreakdown(parameterRisks) {
        const container = root?.querySelector("[data-fitment-risk-breakdown]");
        if (!container) return;
        container.replaceChildren();
        if (!parameterRisks.length) {
            container.textContent = ft("result.noItems");
            return;
        }
        for (const item of parameterRisks) {
            const row = document.createElement("div");
            row.className = "fitment-risk-row";
            row.dataset.tone = item.status || "unknown";
            const copy = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = PARAMETER_COPY[language][item.parameter] || humanizeCode(item.parameter);
            const meta = document.createElement("span");
            const axle = item.axle ? ft(`axle.${item.axle}`) : "";
            meta.textContent = [axle, localizedReason(item.reason_code)].filter(Boolean).join(" · ");
            copy.append(title, meta);
            const points = document.createElement("span");
            points.className = "fitment-risk-points";
            points.textContent = `+${Number(item.risk_points || 0).toFixed(1)}`;
            row.append(copy, points);
            container.append(row);
        }
    }

    function renderTechnical(check) {
        const verdict = check.verdict || {};
        const risk = check.risk || {};
        const container = root?.querySelector("[data-fitment-technical]");
        if (!container) return;
        container.replaceChildren();
        const values = [
            ["Check ID", check.check_id],
            ["Provider", verdict.provider],
            ["Engine", verdict.engine_version],
            ["Tolerances", verdict.tolerances_version],
            ["Risk model", risk.risk_model_version],
        ];
        for (const [label, value] of values) {
            if (!value) continue;
            const row = document.createElement("div");
            const key = document.createElement("span");
            key.textContent = label;
            const text = document.createElement("strong");
            text.textContent = String(value);
            row.append(key, text);
            container.append(row);
        }
    }

    function startNewCheck() {
        resetCheckState();
        clearForm();
        showStage("upload");
        syncFiles();
        updateLinkedRender();
    }

    function syncTelegramButtons({ setMainButton, hideMainButton, setBackButton }) {
        if (!root) {
            hideMainButton();
            setBackButton(null);
            return;
        }
        if (busy) {
            hideMainButton();
            setBackButton(null);
            return;
        }
        if (stage === "upload") {
            const files = getFiles();
            const ready = Boolean(files.car?.blob && files.wheel?.blob);
            setBackButton(null);
            setMainButton({
                text: ft("actions.analyze"),
                enabled: ready,
                onClick: ready ? runPreliminary : null,
            });
            return;
        }
        if (stage === "review") {
            setBackButton(() => showStage("upload"));
            setMainButton({
                text: ft("actions.check"),
                enabled: isReviewReady(),
                onClick: isReviewReady() ? runConfirmed : null,
            });
            return;
        }
        setBackButton(() => showStage("review"));
        setMainButton({
            text: ft("actions.newCheck"),
            enabled: true,
            onClick: startNewCheck,
        });
    }

    return {
        mount,
        onFilesChanged,
        openFromRender,
        syncTelegramButtons,
    };
}
