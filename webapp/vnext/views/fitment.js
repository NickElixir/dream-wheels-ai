const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const button = (label, action, { primary = false, disabled = false, value = "" } = {}) => `<button type="button" class="vnext-button vnext-button--${primary ? "primary" : "secondary"}" data-fitment-action="${esc(action)}" data-value="${esc(value)}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
const field = (label, path, value, { type = "text", options = null, disabled = false } = {}) => `<label class="vnext-fitment__field"><span>${esc(label)}</span>${options ? `<select data-fitment-field="${esc(path)}" ${disabled ? "disabled" : ""}><option value="">Не выбрано</option>${options.map((option) => `<option value="${esc(option.value)}" ${String(option.value) === String(value ?? "") ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select>` : `<input type="${type}" data-fitment-field="${esc(path)}" value="${esc(value)}" ${disabled ? "disabled" : ""}>`}</label>`;

const verdictLabels = {
  compatible: "Подходит",
  compatible_with_conditions: "Подходит с условиями",
  unknown: "Недостаточно данных",
  incompatible: "Не подходит",
};

const nextActionCopy = {
  complete_vehicle_details: "Нужно уточнить данные автомобиля",
  select_vehicle_variant: "Выберите комплектацию автомобиля",
  complete_rim_specs: "Уточните параметры колесного диска",
  run_standard_check: "Данные готовы к проверке",
};

function loadingStatus(label) {
  return `<div class="vnext-fitment__loading" role="status"><span class="vnext-spinner" aria-hidden="true"></span><span>${esc(label)}</span></div>`;
}

function fieldWithCandidates(model, label, path, value, options = {}) {
  const kind = path.startsWith("vehicle.") ? "vehicleCandidates" : path.startsWith("rim.") ? "rimCandidates" : "";
  const fieldName = path.replace(/^(vehicle|rim|rear_rim)\./, "");
  const candidates = kind ? (model[kind] || []).filter((candidate) => candidate.field === fieldName) : [];
  const suggestions = candidates.length ? `<div class="vnext-fitment__suggestions" role="group" aria-label="Предложенные варианты ${esc(label.toLocaleLowerCase())}">${candidates.map((candidate) => button(String(candidate.value), "candidate", { value: `${path}|${candidate.value}` })).join("")}</div>` : "";
  return `<div class="vnext-fitment__field-wrap">${field(label, path, value, options)}${suggestions}</div>`;
}

function parameters(model) {
  const rows = model.fieldEvidence || [];
  return rows.map((item) => `<div class="vnext-fitment__parameter"><span data-label="Параметр">${esc(item.name)}</span><span data-label="Автомобиль">${item.vehicleValue == null ? "Нет данных" : esc(item.vehicleValue)}</span><span data-label="Диск">${item.rimValue == null ? "Нет данных" : esc(item.rimValue)}</span><span data-label="Результат">${esc(item.resultLabel || "Нет данных")}</span></div>`).join("");
}

function verdict(model) {
  const status = model.executionStatus;
  if (status === "failed") {
    const message = model.executionError || model.resultCopy || model.error;
    return `<section class="vnext-fitment__verdict vnext-fitment__verdict--failed" role="status"><p class="vnext-eyebrow">Проверка совместимости</p><h2>Не удалось проверить совместимость</h2>${message ? `<p>${esc(message)}</p>` : ""}</section>`;
  }
  if (status === "queued" || status === "processing") return `<section class="vnext-fitment__verdict" role="status"><p class="vnext-eyebrow">Проверка совместимости</p>${loadingStatus(status === "queued" ? "Проверка в очереди" : "Проверяем совместимость")}<p>${esc(model.vehicleTitle)} · ${esc(model.rimTitle)}</p></section>`;
  const check = model.check;
  if (check?.execution_status === "completed") {
    const stale = check.is_current === false;
    const verdictLabel = verdictLabels[check.verdict] || "";
    return `<section class="vnext-fitment__verdict vnext-fitment__verdict--${stale ? "stale" : esc(check.verdict || "unknown")}" role="status"><p class="vnext-eyebrow">Техническая проверка</p><h2>${stale ? "Результат больше не актуален" : esc(verdictLabel)}</h2>${stale && verdictLabel ? `<p>Предыдущий результат: ${esc(verdictLabel)}</p>` : ""}${model.resultCopy ? `<p>${esc(model.resultCopy)}</p>` : ""}</section>`;
  }
  const copy = nextActionCopy[model.nextAction] || (model.loading ? "Загружаем данные…" : "Техническая проверка ещё не готова");
  return `<section class="vnext-fitment__verdict"><p class="vnext-eyebrow">Техническая проверка</p>${model.loading ? loadingStatus(copy) : `<h2>${esc(copy)}</h2>`}</section>`;
}

function sourceEditor(model) {
  const resolver = model.resolver || {};
  return `<section class="vnext-fitment__editor"><div class="vnext-fitment__section-heading"><h2>Источник колесного диска</h2></div><div class="vnext-fitment__source"><label class="vnext-fitment__field"><span>Ссылка на колесный диск</span><input type="url" inputmode="url" data-fitment-source-url value="${esc(resolver.url)}" placeholder="https://" ${resolver.loading ? "disabled" : ""}></label>${button("Определить параметры", "resolve-rim", { disabled: resolver.loading })}</div>${resolver.loading ? loadingStatus("Определяем параметры колесного диска") : ""}${resolver.status ? `<p class="vnext-fitment__notice" role="status">${esc(resolver.status)}</p>` : ""}${resolver.status && resolver.url ? `<div class="vnext-fitment__actions">${button("Повторить", "resolve-rim", { disabled: resolver.loading })}${button("Заполнить вручную", "manual-rim")}</div>` : ""}${resolver.variants?.length ? `<div class="vnext-fitment__choices"><h3>Выберите вариант колесного диска</h3>${resolver.variants.map((variant, index) => button([variant.brand, variant.model, variant.sku].filter(Boolean).join(" · ") || `Вариант ${index + 1}`, "rim-variant", { value: index })).join("")}</div>` : ""}${resolver.conflicts?.length ? `<div class="vnext-fitment__choices"><h3>Проверьте найденные значения</h3>${resolver.conflicts.map((conflict) => `<div class="vnext-fitment__conflict"><span>${esc(conflict.field)}: ${esc(conflict.current ?? "Нет данных")} → ${esc(conflict.suggested ?? "Нет данных")}</span>${button("Использовать найденное", "conflict-use", { value: `${conflict.field}|${conflict.suggested ?? ""}` })}${button("Оставить введённое", "conflict-keep", { value: conflict.field })}</div>`).join("")}</div>` : ""}</section>`;
}

function evidence(model) {
  const check = model.check || {};
  const conditions = model.conditions || [];
  const blocking = model.blockingIssues || [];
  const items = [...blocking, ...conditions];
  if (check.execution_status !== "completed" || !items.length) return "";
  return `<section class="vnext-fitment__evidence"><div class="vnext-fitment__section-heading"><h2>Условия и пояснения</h2></div><ul>${items.map((item) => `<li>${esc(item.label || item.message || item.code || "Нет описания")}</li>`).join("")}</ul></section>`;
}

function comparisonTable(model) {
  if (model.executionStatus === "failed" || model.check?.execution_status === "failed") return "";
  if (model.check?.execution_status !== "completed") return "";
  const rows = model.fieldEvidence || [];
  if (!rows.length) return `<section class="vnext-fitment__comparison"><div class="vnext-fitment__section-heading"><h2>Технические данные</h2></div><p>Нет дополнительных данных</p></section>`;
  return `<section class="vnext-fitment__comparison"><div class="vnext-fitment__section-heading"><h2>Сравнение параметров</h2></div><div class="vnext-fitment__parameter vnext-fitment__parameter--head"><span>Параметр</span><span>Для автомобиля</span><span>Колесный диск</span><span>Результат</span></div>${parameters(model)}</section>`;
}

function preview(url, alt) {
  return `<div class="vnext-fitment__stage">${url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">` : `<span>Фото недоступно</span>`}</div>`;
}

function rimSetupLabel(state) {
  return ({
    empty: "Параметры не заполнены",
    partial: "Нужно уточнить параметры",
    complete_unconfirmed: "Параметры требуют подтверждения",
    confirmed_ready: "Параметры подтверждены",
  })[state] || "Состояние параметров неизвестно";
}

export function fitmentMarkup(model = {}) {
  if (model.loading && !model.overview) return `<section class="vnext-fitment">${loadingStatus("Загружаем совместимость")}</section>`;
  if (model.error && !model.overview) return `<section class="vnext-fitment" role="alert"><h2>Не удалось загрузить совместимость</h2><p>${esc(model.error)}</p>${button("Повторить", "reload", { primary: true })}</section>`;
  const vehicle = model.vehicleForm || model.vehicle || {};
  const rim = model.rim || {};
  const vehicleNeedsDetails = model.nextAction === "complete_vehicle_details";
  const variantRequired = model.nextAction === "select_vehicle_variant";
  const rimNeedsDetails = model.nextAction === "complete_rim_specs";
  let contextualAction = "";
  if (model.retryAvailable) contextualAction = button(model.executionStatus === "failed" ? "Повторить проверку" : "Проверить ещё раз", "check", { disabled: model.checking });
  else if (model.canRunCheck) contextualAction = button("Проверить совместимость", "check", { disabled: model.checking });
  else if (vehicleNeedsDetails || variantRequired) contextualAction = button(vehicleNeedsDetails ? "Уточнить автомобиль" : "Выбрать комплектацию", "recovery", { value: model.nextAction });
  else if (rimNeedsDetails) contextualAction = button("Уточнить параметры", "recovery", { value: model.nextAction });
  const vehicleChoices = model.vehicleVariants || [];
  const variantChoices = (variantRequired || model.vehicleVariantPickerOpen) ? `<div class="vnext-fitment__variant-list" role="radiogroup" aria-label="Комплектация автомобиля">${vehicleChoices.map((variant, index) => `<button type="button" class="vnext-fitment__choice" role="radio" aria-checked="${String(index === model.selectedVehicleVariant)}" data-fitment-action="vehicle-variant" data-value="${index}"><span class="vnext-fitment__choice-marker" aria-hidden="true">${index === model.selectedVehicleVariant ? "●" : "○"}</span><span class="vnext-fitment__choice-copy"><strong>${esc(variant.label || `Вариант ${index + 1}`)}</strong>${variant.technical ? `<small>${esc(variant.technical)}</small>` : ""}</span></button>`).join("")}${model.vehicleVariantsLoading ? loadingStatus("Подбираем комплектации автомобиля") : ""}${model.selectedVehicleVariant != null ? button("Подтвердить комплектацию", "confirm-vehicle-variant", { primary: true }) : ""}</div>` : "";
  const vehicleVariantSummary = model.vehicleVariantName ? `<div class="vnext-fitment__variant-summary"><span>Комплектация</span><strong>${esc(model.vehicleVariantName)}</strong>${button(model.vehicleVariantPickerOpen ? "Закрыть варианты" : "Изменить комплектацию", "reselect-vehicle")}</div>` : "";
  const vehicleStatus = vehicleNeedsDetails ? "Нужно уточнить данные" : variantRequired ? "Выберите комплектацию автомобиля" : model.vehicleStatus || "Данные подтверждены";
  const rimStatus = model.setupMode === "staggered"
    ? `Передняя ось: ${rimSetupLabel(model.frontRimSetupState)} · Задняя ось: ${rimSetupLabel(model.rearRimSetupState)}`
    : rimSetupLabel(model.frontRimSetupState || model.overview?.rim_setup_state);
  const vehicleFields = model.vehicleEditing ? `<section class="vnext-fitment__editor"><div class="vnext-fitment__section-heading"><h2>Данные автомобиля</h2></div><div class="vnext-fitment__fields">
    ${fieldWithCandidates(model, "Марка", "vehicle.make", vehicle.make, { options: model.catalogue?.makes })}
    ${fieldWithCandidates(model, "Модель", "vehicle.model", vehicle.model, { options: model.catalogue?.models })}
    ${fieldWithCandidates(model, "Год", "vehicle.year", vehicle.year, { options: model.catalogue?.years })}
    ${fieldWithCandidates(model, "Рынок", "vehicle.market", vehicle.market, { options: model.catalogue?.markets })}
    ${fieldWithCandidates(model, "Кузов", "vehicle.body", vehicle.body)}
    ${fieldWithCandidates(model, "Поколение", "vehicle.generation", vehicle.generation)}
    ${fieldWithCandidates(model, "Модификация", "vehicle.modification", vehicle.modification)}
  </div>${variantRequired ? variantChoices : ""}${button("Сохранить автомобиль", "save", { primary: true, disabled: model.saving })}</section>` : "";
  const rimFields = model.rimEditing ? `<section class="vnext-fitment__editor"><div class="vnext-fitment__section-heading"><h2>Параметры колесного диска</h2></div><div class="vnext-fitment__fields">
    ${fieldWithCandidates(model, "Бренд", "rim.brand", rim.brand)}
    ${fieldWithCandidates(model, "Модель", "rim.model", rim.model)}
    ${fieldWithCandidates(model, "Артикул", "rim.sku", rim.sku)}
    ${fieldWithCandidates(model, "PCD: число отверстий", "rim.bolt_count", rim.bolt_count, { type: "number" })}
    ${fieldWithCandidates(model, "PCD, мм", "rim.pcd_mm", rim.pcd_mm, { type: "number" })}
    ${fieldWithCandidates(model, "Диаметр, дюймы", "rim.wheel_diameter_in", rim.wheel_diameter_in, { type: "number" })}
    ${fieldWithCandidates(model, "Ширина, J", "rim.wheel_width_j", rim.wheel_width_j, { type: "number" })}
    ${fieldWithCandidates(model, "DIA, мм", "rim.center_bore_mm", rim.center_bore_mm, { type: "number" })}
    ${fieldWithCandidates(model, "ET, мм", "rim.offset_et_mm", rim.offset_et_mm, { type: "number" })}
    ${field("Схема", "setup_mode", model.setupMode, { options: [{ value: "uniform", label: "Одинаковые параметры" }, { value: "staggered", label: "Разные параметры по осям" }] })}
  </div>${model.setupMode === "staggered" ? `<section class="vnext-fitment__rear"><h3>Задняя ось</h3><div class="vnext-fitment__fields">
    ${fieldWithCandidates(model, "PCD: число отверстий", "rear_rim.bolt_count", model.rearRim?.bolt_count, { type: "number" })}
    ${fieldWithCandidates(model, "PCD, мм", "rear_rim.pcd_mm", model.rearRim?.pcd_mm, { type: "number" })}
    ${fieldWithCandidates(model, "Диаметр, дюймы", "rear_rim.wheel_diameter_in", model.rearRim?.wheel_diameter_in, { type: "number" })}
    ${fieldWithCandidates(model, "Ширина, J", "rear_rim.wheel_width_j", model.rearRim?.wheel_width_j, { type: "number" })}
    ${fieldWithCandidates(model, "DIA, мм", "rear_rim.center_bore_mm", model.rearRim?.center_bore_mm, { type: "number" })}
    ${fieldWithCandidates(model, "ET, мм", "rear_rim.offset_et_mm", model.rearRim?.offset_et_mm, { type: "number" })}
  </div></section>` : ""}${button("Сохранить параметры", "save", { primary: true, disabled: model.saving })}${sourceEditor(model)}</section>` : "";
  const vehicleActions = `<div class="vnext-fitment__actions">${!model.vehicleEditing && !vehicleNeedsDetails && !variantRequired ? button("Изменить данные автомобиля", "edit-vehicle") : ""}${!model.vehicleEditing && (vehicleNeedsDetails || variantRequired) ? button("Не мой автомобиль — указать вручную", "manual-vehicle") : ""}</div>`;
  const rimActions = !model.rimEditing && !rimNeedsDetails ? button("Изменить параметры", "edit-rim") : "";
  const variantPending = variantRequired && !vehicleChoices.length && model.vehicleVariantsLoading ? loadingStatus("Подбираем комплектации автомобиля") : "";
  const showVariantChoices = (variantRequired || model.vehicleVariantPickerOpen) && vehicleChoices.length && !model.vehicleEditing ? variantChoices : "";
  const variantLookupAction = variantRequired && !vehicleChoices.length && !model.vehicleVariantsLoading
    ? button("Найти комплектации", "load-vehicle-variants", { disabled: model.vehicleVariantsLoading })
    : "";
  return `<section class="vnext-fitment">
    <div class="vnext-fitment__topline"><p class="vnext-eyebrow">Задание ${esc(model.jobId)}</p>${button("Назад", "back")}</div>
    ${model.error ? `<p class="vnext-fitment__notice" role="alert">${esc(model.error)}</p>` : ""}
    ${model.message ? `<p class="vnext-fitment__notice" role="status">${esc(model.message)}</p>` : ""}
    <div class="vnext-fitment__pair">
      <section class="vnext-fitment__object"><p class="vnext-eyebrow">Автомобиль</p>${preview(model.vehiclePreview, "Фотография автомобиля")}
        <div class="vnext-fitment__object-meta"><h2>${esc(model.vehicleTitle || "Данные автомобиля не заполнены")}</h2>
        ${(model.vehicleSpecs || []).length ? `<p>${model.vehicleSpecs.map(esc).join(" · ")}</p>` : ""}
        </div>
        <div class="vnext-fitment__object-status" data-next-action="${esc(vehicleNeedsDetails ? "complete_vehicle_details" : variantRequired ? "select_vehicle_variant" : "confirmed")}">${esc(vehicleStatus)}</div>
        ${vehicleVariantSummary}${variantPending}${showVariantChoices}${variantLookupAction}${vehicleActions}
      </section>
      <section class="vnext-fitment__object"><p class="vnext-eyebrow">Колесный диск</p>${preview(model.rimPreview, "Фотография колесного диска")}
        <div class="vnext-fitment__object-meta"><h2>${esc(model.rimTitle || "Параметры не заполнены")}</h2>
        <p>${esc(model.rimSpecs || "")}</p>
        </div>
        <div class="vnext-fitment__object-status" data-next-action="${esc(rimNeedsDetails ? "complete_rim_specs" : "confirmed")}" data-rim-setup-state="${esc(model.frontRimSetupState || model.overview?.rim_setup_state || "unknown")}">${esc(rimStatus)}</div>
        <p class="vnext-fitment__provenance">${esc(model.rimProvenance || "")}</p>
        ${rimActions}
      </section>
    </div>
    ${verdict(model)}
    ${evidence(model)}
    ${comparisonTable(model)}
    ${vehicleFields}
    ${rimFields}
    <footer class="vnext-fitment__footer">${button("Создать изображение", "create-image", { primary: true })}${contextualAction}</footer>
  </section>`;
}

export function refreshFitmentView(root, model, callbacks = root.fitmentCallbacks) {
  root.fitmentCallbacks = callbacks;
  const focused = root.querySelector(":focus[data-fitment-field], :focus[data-fitment-source-url]");
  const focusSelector = focused?.dataset.fitmentField ? `[data-fitment-field="${CSS.escape(focused.dataset.fitmentField)}"]` : focused ? "[data-fitment-source-url]" : "";
  const selection = focused && "selectionStart" in focused ? [focused.selectionStart, focused.selectionEnd] : null;
  const markup = fitmentMarkup(model);
  const next = document.createElement("section");
  next.className = root.className;
  next.innerHTML = markup;
  root.replaceChildren(...next.childNodes);
  if (focusSelector) {
    const nextFocus = root.querySelector(focusSelector);
    nextFocus?.focus({ preventScroll: true });
    if (selection && nextFocus?.setSelectionRange) nextFocus.setSelectionRange(...selection);
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
