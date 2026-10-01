const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const button = (label, action, { primary = false, disabled = false, value = "" } = {}) => `<button type="button" class="vnext-button vnext-button--${primary ? "primary" : "secondary"}" data-fitment-action="${esc(action)}" data-value="${esc(value)}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;

const verdictLabels = {
  compatible: "Подходит",
  compatible_with_conditions: "Подходит с условиями",
  unknown: "Недостаточно данных",
  incompatible: "Не подходит",
};

const nextActionCopy = {
  complete_vehicle_details: "Уточните данные автомобиля",
  select_vehicle_variant: "Выберите комплектацию автомобиля",
  complete_rim_specs: "Уточните параметры колесного диска",
  run_standard_check: "Данные готовы к проверке",
};

function loadingStatus(label) {
  return `<div class="vnext-fitment__loading" role="status" aria-live="polite"><span class="vnext-spinner" aria-hidden="true"></span><span>${esc(label)}</span></div>`;
}

function field(label, path, value, { type = "text", options = null, disabled = false, message = "", error = "", retry = "", placeholder = "Не выбрано" } = {}) {
  const invalid = Boolean(error);
  const inputAttributes = `${invalid ? ' aria-invalid="true" aria-describedby="fitment-error-' + esc(path.replaceAll(".", "-")) + '"' : ""} ${disabled ? "disabled" : ""}`;
  const control = options
    ? `<select data-fitment-field="${esc(path)}"${inputAttributes}><option value="">${esc(placeholder)}</option>${options.map((option) => `<option value="${esc(option.value)}" ${String(option.value) === String(value ?? "") ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select>`
    : `<input type="${type === "number" ? "text" : type}"${type === "number" ? ' inputmode="decimal"' : ""} data-fitment-field="${esc(path)}" value="${esc(value)}"${inputAttributes}>`;
  return `<label class="vnext-fitment__field${invalid ? " vnext-fitment__field--invalid" : ""}"><span>${esc(label)}</span>${control}${message ? `<small class="vnext-fitment__field-message" role="status">${esc(message)}${retry ? ` ${button("Повторить", "retry-catalogue", { value: retry })}` : ""}</small>` : ""}${invalid ? `<small class="vnext-fitment__field-error" id="fitment-error-${esc(path.replaceAll(".", "-"))}" role="alert">${esc(error)}</small>` : ""}</label>`;
}

function fieldConflict(model, path) {
  if (!path.startsWith("rim.")) return "";
  const name = path.slice(4);
  const conflict = (model.resolver?.conflicts || []).find((item) => item.field === name);
  if (!conflict) return "";
  return `<div class="vnext-fitment__conflict" role="group" aria-label="Конфликт значения ${esc(name)}"><p>Сейчас: ${esc(conflict.current ?? "Нет данных")} — Найдено: ${esc(conflict.suggested ?? "Нет данных")}</p><div>${button(`Использовать ${conflict.suggested ?? "найденное"}`, "conflict-use", { value: `${name}|${conflict.suggested ?? ""}` })}${button(`Оставить ${conflict.current ?? "введённое"}`, "conflict-keep", { value: name })}</div></div>`;
}

function fieldWithCandidates(model, label, path, value, options = {}) {
  const kind = path.startsWith("vehicle.") ? "vehicleCandidates" : path.startsWith("rim.") ? "rimCandidates" : "";
  const fieldName = path.replace(/^(?:vehicle|rim|rear_rim)\./, "");
  const candidates = kind
    ? (model[kind] || []).filter((candidate) => candidate.field === fieldName && String(candidate.value) !== String(value ?? ""))
    : [];
  const suggestions = candidates.length
    ? `<div class="vnext-fitment__suggestions" role="group" aria-label="Предложения для поля ${esc(label.toLocaleLowerCase())}">${candidates.map((candidate) => button(String(candidate.value), "candidate", { value: `${path}|${candidate.value}` })).join("")}</div>`
    : "";
  return `<div class="vnext-fitment__field-wrap">${field(label, path, value, options)}${suggestions}${fieldConflict(model, path)}</div>`;
}

function parameters(model) {
  return (model.fieldEvidence || []).map((item) => `<div class="vnext-fitment__parameter"><span data-label="Параметр">${esc(item.name)}</span><span data-label="Автомобиль">${item.vehicleValue == null ? "Нет данных" : esc(item.vehicleValue)}</span><span data-label="Колесный диск">${item.rimValue == null ? "Нет данных" : esc(item.rimValue)}</span><span data-label="Результат">${esc(item.resultLabel || "Нет данных")}</span></div>`).join("");
}

function verdict(model) {
  const status = model.executionStatus;
  if (status === "failed") {
    const message = model.executionError || model.resultCopy || model.checkError || model.error;
    return `<section class="vnext-fitment__verdict vnext-fitment__verdict--failed" role="alert"><p class="vnext-eyebrow">Техническая проверка</p><h2>Не удалось проверить совместимость</h2>${message ? `<p>${esc(message)}</p>` : ""}</section>`;
  }
  if (status === "queued" || status === "processing") return `<section class="vnext-fitment__verdict" role="status"><p class="vnext-eyebrow">Техническая проверка</p>${loadingStatus(status === "queued" ? "Проверка в очереди" : "Проверяем совместимость")}${status === "queued" ? '<p class="vnext-fitment__queue-note">Проверка ожидает запуска.</p>' : ""}<p>${esc(model.vehicleTitle)} — ${esc(model.rimTitle)}</p></section>`;
  const check = model.check;
  if (check?.execution_status === "completed") {
    const stale = check.is_current === false;
    const verdictLabel = verdictLabels[check.verdict] || "";
    return `<section class="vnext-fitment__verdict vnext-fitment__verdict--${stale ? "stale" : esc(check.verdict || "unknown")}" role="status"><p class="vnext-eyebrow">Техническая проверка</p><h2>${stale ? "Результат больше не актуален" : esc(verdictLabel)}</h2>${stale && verdictLabel ? `<p class="vnext-fitment__previous-verdict">Предыдущий результат: ${esc(verdictLabel)}</p><p>Данные автомобиля или колесного диска изменились.</p>` : ""}${model.resultCopy ? `<p>${esc(model.resultCopy)}</p>` : ""}</section>`;
  }
  const copy = nextActionCopy[model.nextAction] || (model.loading ? "Загружаем данные…" : "Техническая проверка ещё не готова");
  return `<section class="vnext-fitment__verdict"${model.loading ? ' aria-busy="true"' : ""}><p class="vnext-eyebrow">Техническая проверка</p>${model.loading ? loadingStatus(copy) : `<h2>${esc(copy)}</h2>`}${model.checkError ? `<p role="alert">${esc(model.checkError)}</p>` : ""}</section>`;
}

function sourceEditor(model) {
  const resolver = model.resolver || {};
  const status = resolver.status || "";
  const statusClass = resolver.statusTone === "error" ? " vnext-fitment__notice--error" : resolver.statusTone === "success" ? " vnext-fitment__notice--success" : resolver.statusTone === "warning" ? " vnext-fitment__notice--warning" : "";
  const resolving = resolver.loading ? loadingStatus("Определяем параметры колесного диска") : "";
  const retries = resolver.statusTone === "error" && resolver.url ? `<div class="vnext-fitment__actions">${button("Повторить", "resolve-rim", { disabled: resolver.loading })}${button("Заполнить вручную", "manual-rim")}</div>` : "";
  const variants = resolver.variants?.length ? `<div class="vnext-fitment__choices"><h3>Выберите вариант диска</h3><div role="group" aria-label="Варианты колесного диска">${resolver.variants.map((variant, index) => {
    const values = variant.values || {};
    const known = (value, suffix = "") => value === null || value === undefined || value === "" ? "Не определено" : `${value}${suffix}`;
    const pcd = values.bolt_count != null && values.pcd_mm != null ? `${values.bolt_count}×${values.pcd_mm}` : "Не определено";
    const specs = [["Диаметр", known(values.wheel_diameter_in, "″")], ["Ширина", known(values.wheel_width_j, "J")], ["PCD", pcd], ["DIA", known(values.center_bore_mm, " мм")], ["ET", known(values.offset_et_mm, " мм")]];
    return `<button type="button" class="vnext-fitment__sku-row" data-fitment-action="rim-variant" data-value="${index}"><span class="vnext-fitment__sku-name">${esc([variant.brand, variant.model].filter(Boolean).join(" ") || `Вариант ${index + 1}`)}</span><span class="vnext-fitment__sku-code">SKU: ${esc(variant.sku || "Не определено")}</span><span class="vnext-fitment__sku-specs">${specs.map(([label, value]) => `<span><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`).join("")}</span><span class="vnext-fitment__sku-select">Выбрать</span></button>`;
  }).join("")}</div></div>` : "";
  return `<section class="vnext-fitment__source-disclosure"><button type="button" class="vnext-button vnext-button--secondary" data-fitment-action="toggle-source" aria-expanded="${String(Boolean(resolver.open))}" aria-controls="fitment-source-panel">${resolver.url ? "Изменить ссылку на товар" : "Добавить ссылку на товар"}</button>${resolver.open ? `<div class="vnext-fitment__source-panel" id="fitment-source-panel"><div class="vnext-fitment__section-heading"><h3>Источник колесного диска</h3></div><label class="vnext-fitment__field"><span>Ссылка на товар</span><input type="url" inputmode="url" data-fitment-source-url value="${esc(resolver.url)}" placeholder="https://"></label><div class="vnext-fitment__source-actions">${button("Определить параметры", "resolve-rim", { primary: true, disabled: resolver.loading || !resolver.url })}<p>Необязательно — попробуем получить модель и технические параметры со страницы.</p></div>${resolving}${status ? `<p class="vnext-fitment__notice${statusClass}" role="${resolver.statusTone === "error" ? "alert" : "status"}">${esc(status)}</p>` : ""}${variants}${retries}</div>` : ""}</section>`;
}

function evidence(model) {
  const items = [...(model.blockingIssues || []), ...(model.conditions || [])];
  if (model.check?.execution_status !== "completed" || !items.length) return "";
  return `<section class="vnext-fitment__evidence"><div class="vnext-fitment__section-heading"><h2>Условия и пояснения</h2></div><ul>${items.map((item) => `<li>${esc(item.label || item.message || item.code || "Нет описания")}</li>`).join("")}</ul></section>`;
}

function comparisonTable(model) {
  if (model.executionStatus === "failed" || model.check?.execution_status !== "completed") return "";
  const rows = model.fieldEvidence || [];
  if (!rows.length) return `<section class="vnext-fitment__comparison"><div class="vnext-fitment__section-heading"><h2>Технические данные</h2></div><p>Нет дополнительных данных</p></section>`;
  return `<section class="vnext-fitment__comparison"><div class="vnext-fitment__section-heading"><h2>Сравнение параметров</h2></div><div class="vnext-fitment__parameter vnext-fitment__parameter--head"><span>Параметр</span><span>Автомобиль</span><span>Колесный диск</span><span>Результат</span></div><div class="vnext-fitment__parameters">${parameters(model)}</div></section>`;
}

function preview(url, alt, { kind = "vehicle" } = {}) {
  return `<div class="vnext-fitment__stage vnext-fitment__stage--${kind}">${url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">` : `<span>Фото недоступно</span>`}</div>`;
}

function rimSetupLabel(state) {
  return ({
    empty: "Параметры не заполнены",
    partial: "Не хватает параметров",
    complete_unconfirmed: "Проверьте и подтвердите параметры",
    confirmed_ready: "Параметры подтверждены",
  })[state] || "Состояние параметров неизвестно";
}

function catalogueField(model, kind, label, path, value, extra = {}) {
  const fieldState = model.catalogue?.states?.[kind] || {};
  const retry = fieldState.status === "failed" ? kind : "";
  const options = model.catalogue?.[kind] || [];
  const disabled = !["selected", "loaded_unselected", "selection_required", "resolved_multiple"].includes(fieldState.status);
  return fieldWithCandidates(model, label, path, value, {
    options,
    disabled,
    message: fieldState.message || "",
    retry,
    error: model.fieldErrors?.[path] || "",
    ...extra,
  });
}

function axleFields(model, axle, rim, { candidates = true } = {}) {
  const prefix = axle === "rear" ? "rear_rim" : "rim";
  const source = axle === "rear" ? { ...model, rimCandidates: [] } : model;
  const entries = (items) => items.map(([label, fieldName, value]) => candidates
    ? fieldWithCandidates(source, label, `${prefix}.${fieldName}`, value, { type: "number", error: model.fieldErrors?.[`${prefix}.${fieldName}`] || "" })
    : field(`${label}`, `${prefix}.${fieldName}`, value, { type: "number", error: model.fieldErrors?.[`${prefix}.${fieldName}`] || "" }));
  const pcd = `<div class="vnext-fitment__pcd"><h4>PCD</h4><div>${entries([["Отверстия", "bolt_count", rim?.bolt_count], ["Разболтовка, мм", "pcd_mm", rim?.pcd_mm]]).join("")}</div></div>`;
  return `<div class="vnext-fitment__axle-fields">${pcd}<div class="vnext-fitment__fields">${entries([["Диаметр, дюймы", "wheel_diameter_in", rim?.wheel_diameter_in], ["Ширина, J", "wheel_width_j", rim?.wheel_width_j], ["DIA, мм", "center_bore_mm", rim?.center_bore_mm], ["ET, мм", "offset_et_mm", rim?.offset_et_mm]]).join("")}</div></div>`;
}

function vehicleEditor(model, vehicle) {
  if (!model.vehicleEditing || model.nextAction === "select_vehicle_variant" && !model.manualVehicleEditing) return "";
  const marketState = model.catalogue?.states?.markets || {};
  const marketRequired = marketState.resolution === "selection_required";
  const marketField = marketRequired
    ? fieldWithCandidates(model, "Версия для рынка", "vehicle.market", vehicle.market, {
        options: model.catalogue?.markets || [],
        disabled: !["selected", "selection_required", "resolved_multiple"].includes(marketState.status),
        message: marketState.message || "",
        error: model.fieldErrors?.["vehicle.market"] || "",
      }) : "";
  const marketNotice = vehicle.year && ["failed", "no_data"].includes(marketState.status)
    ? `<p class="vnext-fitment__notice${marketState.status === "failed" ? " vnext-fitment__notice--error" : ""}" role="${marketState.status === "failed" ? "alert" : "status"}">${esc(marketState.message)}</p>${marketState.status === "failed" ? button("Повторить", "retry-catalogue", { value: "markets" }) : ""}` : "";
  return `<section class="vnext-fitment__editor" aria-labelledby="fitment-vehicle-editor-title"><div class="vnext-fitment__section-heading"><h2 id="fitment-vehicle-editor-title">Данные автомобиля</h2></div><div class="vnext-fitment__field-group"><h3>Укажите автомобиль</h3><div class="vnext-fitment__fields">${catalogueField(model, "makes", "Марка", "vehicle.make", vehicle.make)}${catalogueField(model, "models", "Модель", "vehicle.model", vehicle.model)}${catalogueField(model, "years", "Год", "vehicle.year", vehicle.year)}${marketField}</div>${marketNotice}</div>${model.vehicleError ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.vehicleError)}</p>` : ""}${model.nextAction === "select_vehicle_variant" ? button("Вернуться к выбору комплектации", "show-variants") : ""}${button("Сохранить автомобиль", "save", { primary: true, disabled: model.saving })}</section>`;
}

function variantChooser(model) {
  if (model.nextAction !== "select_vehicle_variant" || model.manualVehicleEditing || model.rimEditing) return "";
  const choices = model.vehicleVariants || [];
  const status = model.vehicleLookup?.status;
  const loading = model.vehicleVariantsLoading || status === "loading";
  const choicesMarkup = choices.map((variant, index) => `<button type="button" class="vnext-fitment__choice" aria-pressed="${String(index === model.selectedVehicleVariant)}" data-fitment-action="vehicle-variant" data-value="${index}"><span class="vnext-fitment__choice-copy"><strong>${esc(variant.label || `Вариант ${index + 1}`)}</strong>${variant.technical ? `<small>${esc(variant.technical)}</small>` : ""}</span></button>`).join("");
  const message = status === "failed" ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">Не удалось загрузить комплектации.</p>${button("Повторить", "load-vehicle-variants")}` : status === "no_match" ? `<p class="vnext-fitment__notice" role="status">Комплектации не найдены.</p>` : "";
  return `<section class="vnext-fitment__variant-step" aria-labelledby="fitment-variant-title"><div class="vnext-fitment__section-heading"><h2 id="fitment-variant-title">Выберите комплектацию</h2></div><div class="vnext-fitment__variant-list" role="group" aria-label="Варианты комплектации">${choicesMarkup}${loading ? loadingStatus("Загружаем комплектации автомобиля") : ""}${message}${model.selectedVehicleVariant != null && choices[model.selectedVehicleVariant] ? button("Подтвердить комплектацию", "confirm-vehicle-variant", { primary: true }) : ""}</div></section>`;
}

function wheelEditor(model, rim) {
  if (!model.rimEditing) return "";
  const state = model.frontRimSetupState || model.overview?.rim_setup_state;
  const rearState = model.rearRimSetupState;
  const stateText = model.setupMode === "staggered"
    ? `Передняя ось: ${rimSetupLabel(state)} — Задняя ось: ${rimSetupLabel(rearState)}`
    : rimSetupLabel(state);
  return `<section class="vnext-fitment__editor" aria-labelledby="fitment-rim-editor-title"><div class="vnext-fitment__section-heading"><h2 id="fitment-rim-editor-title">Параметры колесного диска</h2></div><p class="vnext-fitment__rim-state" data-rim-setup-state="${esc(state || "unknown")}">${esc(stateText)}</p><div class="vnext-fitment__field-group"><h3>Идентификация диска</h3><div class="vnext-fitment__fields">${fieldWithCandidates(model, "Бренд", "rim.brand", rim.brand, { error: model.fieldErrors?.["rim.brand"] || "" })}${fieldWithCandidates(model, "Модель", "rim.model", rim.model, { error: model.fieldErrors?.["rim.model"] || "" })}${fieldWithCandidates(model, "Артикул", "rim.sku", rim.sku, { error: model.fieldErrors?.["rim.sku"] || "" })}</div></div><div class="vnext-fitment__field-group"><h3>Геометрия</h3><div class="vnext-fitment__axle"><h4>Передняя ось</h4>${axleFields(model, "front", rim)}</div></div><div class="vnext-fitment__field-group"><h3>Конфигурация</h3>${field("Параметры по осям", "setup_mode", model.setupMode, { options: [{ value: "uniform", label: "Одинаковые параметры" }, { value: "staggered", label: "Разные параметры по осям" }] })}${model.setupMode === "staggered" ? `<div class="vnext-fitment__axle vnext-fitment__axle--rear"><h4>Задняя ось</h4>${axleFields(model, "rear", model.rearRim || {}, { candidates: false })}</div>` : ""}</div>${model.rimError ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.rimError)}</p>` : ""}${sourceEditor(model)}${button("Сохранить параметры", "save", { primary: true, disabled: model.saving })}</section>`;
}

export function fitmentMarkup(model = {}) {
  if (model.loading && !model.overview) return `<section class="vnext-fitment">${loadingStatus("Загружаем совместимость")}</section>`;
  if (model.error && !model.overview) return `<section class="vnext-fitment" role="alert"><h2>Не удалось загрузить совместимость</h2><p>${esc(model.error)}</p>${button("Повторить", "reload", { primary: true })}</section>`;
  if (model.vehicleEditing && model.rimEditing) {
    model = { ...model, vehicleEditing: model.activeSection !== "rim", rimEditing: model.activeSection === "rim" };
  }
  const vehicle = model.vehicleForm || model.vehicle || {};
  const rim = model.rim || {};
  const variantRequired = model.nextAction === "select_vehicle_variant";
  const rimSetupState = model.frontRimSetupState || model.overview?.rim_setup_state || "unknown";
  const rimStatus = model.setupMode === "staggered"
    ? `Передняя ось: ${rimSetupLabel(rimSetupState)} — Задняя ось: ${rimSetupLabel(model.rearRimSetupState)}`
    : rimSetupLabel(rimSetupState);
  const vehicleStatus = model.vehicleStatus || "Требуется подтверждение";
  const vehicleError = model.vehicleError && !model.vehicleEditing ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.vehicleError)}</p>` : "";
  const completedCurrent = model.check?.execution_status === "completed" && model.check.is_current !== false;
  const retryState = model.executionStatus === "failed" || model.check?.execution_status === "completed" && model.check.is_current === false;
  const activeEditor = variantRequired && !model.manualVehicleEditing || model.vehicleEditing || model.rimEditing;
  const contextualAction = !activeEditor && retryState && model.retryAvailable
    ? button(model.executionStatus === "failed" ? "Повторить проверку" : "Проверить ещё раз", "check", { primary: true, disabled: model.checking })
    : !activeEditor && !completedCurrent && !["queued", "processing", "failed"].includes(model.executionStatus) && model.canRunCheck
      ? button("Проверить совместимость", "check", { primary: true, disabled: model.checking })
      : "";
  const renderAction = button("Создать изображение", "create-image");
  const checkAction = contextualAction || button("Проверить совместимость", "check", { primary: true, disabled: !model.canRunCheck || activeEditor || model.checking });
  const authNotice = model.authRequired ? `<div class="vnext-fitment__notice vnext-fitment__notice--error" role="alert"><p>Сессия истекла. Войдите, чтобы продолжить работу.</p>${button("Войти", "login")}</div>` : "";
  const checkError = model.checkError && model.executionStatus !== "failed" ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.checkError)}</p>` : "";
  return `<section class="vnext-fitment">
    <div class="vnext-fitment__topline"><h1>Проверка совместимости</h1>${button("Назад", "back")}</div>
    ${authNotice}
    ${model.message ? `<p class="vnext-fitment__notice" role="status">${esc(model.message)}</p>` : ""}
    <div class="vnext-fitment__pair" aria-label="Источники и состояние данных">
      <section class="vnext-fitment__object${model.vehicleEditing ? " vnext-fitment__object--editing" : ""}" aria-labelledby="fitment-vehicle-title"><p class="vnext-eyebrow">Автомобиль</p>${preview(model.vehiclePreview, "Фотография автомобиля")}
        ${model.vehicleTitle ? `<h2 id="fitment-vehicle-title">${esc(model.vehicleTitle)}</h2>` : '<h2 id="fitment-vehicle-title" class="vnext-fitment__visually-hidden">Автомобиль</h2>'}
        <div class="vnext-fitment__source-row"><p><span>Источник данных</span><strong>Фото автомобиля</strong></p>${button("Изменить", "edit-vehicle")}</div>
        <div class="vnext-fitment__source-action">${button("Распознать автомобиль", "recognize-vehicle", { primary: true, disabled: true })}</div>
        <p class="vnext-fitment__object-status">${esc(vehicleStatus)}</p>${model.vehicleVariantName ? `<p class="vnext-fitment__object-detail"><span>Комплектация</span> ${esc(model.vehicleVariantName)}</p>` : ""}${model.canReselectVehicleVariant ? button("Изменить комплектацию", "reselect-vehicle") : ""}${vehicleError}
      </section>
      <section class="vnext-fitment__object${model.rimEditing ? " vnext-fitment__object--editing" : ""}" aria-labelledby="fitment-rim-title"><p class="vnext-eyebrow">Колесный диск</p>${preview(model.rimPreview, "Фотография колесного диска", { kind: "wheel" })}
        ${model.rimTitle ? `<h2 id="fitment-rim-title">${esc(model.rimTitle)}</h2>` : '<h2 id="fitment-rim-title" class="vnext-fitment__visually-hidden">Колесный диск</h2>'}
        <div class="vnext-fitment__source-row"><p><span>Источник данных</span><strong>Ссылка на товар</strong>${model.rimSourceDomain ? `<small>${esc(model.rimSourceDomain)}</small>` : ""}</p>${button("Изменить", "edit-rim")}</div>
        <div class="vnext-fitment__source-action">${button("Распознать колесный диск", "resolve-rim", { primary: true, disabled: !model.rimEditing || !model.resolver?.url || model.resolver?.loading })}</div>
        <p class="vnext-fitment__object-status" data-rim-setup-state="${esc(rimSetupState)}">${esc(rimStatus)}</p>${model.rimError && !model.rimEditing ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.rimError)}</p>` : ""}
      </section>
    </div>
    <div class="vnext-fitment__active-editor">${variantChooser(model)}${vehicleEditor(model, vehicle)}${wheelEditor(model, rim)}</div>
    ${model.check || ["queued", "processing", "failed"].includes(model.executionStatus) ? verdict(model) : ""}
    ${checkError}
    ${evidence(model)}
    ${comparisonTable(model)}
    <section class="vnext-fitment__standard" aria-labelledby="fitment-standard-title"><h2 id="fitment-standard-title">Проверка совместимости</h2><p>${esc(nextActionCopy[model.nextAction] || "Подтвердите автомобиль и параметры диска.")}</p><div class="vnext-fitment__ready-summaries"><div><span>Автомобиль</span><strong>${esc(model.vehicleTitle || "Требуется подтверждение")}</strong></div><div><span>Колесный диск</span><strong>${esc(model.rimTitle || "Требуется подтверждение")}</strong></div></div><div class="vnext-fitment__footer">${checkAction}${renderAction}</div></section>
  </section>`;
}

export function refreshFitmentView(root, model, callbacks = root.fitmentCallbacks) {
  root.fitmentCallbacks = callbacks;
  const focused = root.querySelector(":focus[data-fitment-field], :focus[data-fitment-source-url]");
  const focusSelector = focused?.dataset.fitmentField ? `[data-fitment-field="${CSS.escape(focused.dataset.fitmentField)}"]` : focused ? "[data-fitment-source-url]" : "";
  const supportsSelection = (input) => input?.tagName === "TEXTAREA" || input?.tagName === "INPUT" && ["text", "search", "url", "tel", "password"].includes(input.type);
  const selection = supportsSelection(focused) ? [focused.selectionStart, focused.selectionEnd] : null;
  const markup = fitmentMarkup(model);
  const next = document.createElement("section");
  next.className = root.className;
  next.innerHTML = markup;
  root.replaceChildren(...next.childNodes);
  if (focusSelector) {
    const nextFocus = root.querySelector(focusSelector);
    nextFocus?.focus({ preventScroll: true });
    if (selection && supportsSelection(nextFocus)) nextFocus.setSelectionRange(...selection);
  }
  return root;
}

export function createFitmentView(model = {}, callbacks = {}) {
  const root = document.createElement("section");
  root.className = "vnext-fitment";
  root.dataset.vnextFitmentRoot = "";
  root.fitmentCallbacks = callbacks;
  root.addEventListener("click", (event) => {
    const target = event.target.closest("[data-fitment-action]");
    if (target && root.contains(target) && !target.disabled) root.fitmentCallbacks?.action?.(target.dataset.fitmentAction, target.dataset.value);
  });
  const changeField = (event) => {
    const target = event.target.closest("[data-fitment-field]");
    if (target && root.contains(target)) root.fitmentCallbacks?.setField?.(target.dataset.fitmentField, target.value);
  };
  root.addEventListener("input", (event) => { if (event.target.tagName !== "SELECT") changeField(event); });
  root.addEventListener("change", (event) => { if (event.target.tagName === "SELECT") changeField(event); });
  root.addEventListener("input", (event) => {
    if (event.target.matches("[data-fitment-source-url]")) root.fitmentCallbacks?.setSourceUrl?.(event.target.value);
  });
  return refreshFitmentView(root, model, callbacks);
}
