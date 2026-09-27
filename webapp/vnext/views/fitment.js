const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const button = (label, action, { primary = false, disabled = false, value = "" } = {}) => `<button type="button" class="vnext-button vnext-button--${primary ? "primary" : "secondary"}" data-fitment-action="${esc(action)}" data-value="${esc(value)}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
const field = (label, path, value, { type = "text", options = null, disabled = false } = {}) => `<label class="vnext-fitment__field"><span>${esc(label)}</span>${options ? `<select data-fitment-field="${esc(path)}" ${disabled ? "disabled" : ""}><option value="">Не выбрано</option>${options.map((option) => `<option value="${esc(option.value)}" ${String(option.value) === String(value ?? "") ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select>` : `<input type="${type}" data-fitment-field="${esc(path)}" value="${esc(value)}" ${disabled ? "disabled" : ""}>`}</label>`;

const verdictLabels = {
  compatible: "Подходит",
  compatible_with_conditions: "Подходит с условиями",
  unknown: "Недостаточно данных",
  incompatible: "Не подходит",
};

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
  if (status === "queued" || status === "processing") return `<section class="vnext-fitment__verdict" role="status"><p class="vnext-eyebrow">Проверка совместимости</p><h2>${status === "queued" ? "Проверка в очереди" : "Проверяем совместимость"}</h2><p>${esc(model.vehicleTitle)} · ${esc(model.rimTitle)}</p></section>`;
  const check = model.check;
  if (check?.execution_status === "completed") {
    const stale = check.is_current === false;
    const verdictLabel = verdictLabels[check.verdict] || "";
    return `<section class="vnext-fitment__verdict vnext-fitment__verdict--${stale ? "stale" : esc(check.verdict || "unknown")}" role="status"><p class="vnext-eyebrow">Техническая проверка</p><h2>${stale ? "Результат больше не актуален" : esc(verdictLabel)}</h2>${stale && verdictLabel ? `<p>Предыдущий результат: ${esc(verdictLabel)}</p>` : ""}${model.resultCopy ? `<p>${esc(model.resultCopy)}</p>` : ""}</section>`;
  }
  return `<section class="vnext-fitment__verdict"><p class="vnext-eyebrow">Техническая проверка</p><h2>${model.loading ? "Загружаем данные…" : "Данные готовы к проверке"}</h2></section>`;
}

function sourceEditor(model) {
  const resolver = model.resolver || {};
  return `<section class="vnext-fitment__editor"><div class="vnext-fitment__section-heading"><h2>Источник колесного диска</h2></div><div class="vnext-fitment__source"><label class="vnext-fitment__field"><span>Ссылка на колесный диск</span><input type="url" inputmode="url" data-fitment-source-url value="${esc(resolver.url)}" placeholder="https://" ${resolver.loading ? "disabled" : ""}></label>${button(resolver.loading ? "Определяем параметры…" : "Извлечь параметры", "resolve-rim", { disabled: resolver.loading })}</div>${resolver.status ? `<p class="vnext-fitment__notice" role="status">${esc(resolver.status)}</p>` : ""}${resolver.status && resolver.url ? `<div class="vnext-fitment__actions">${button("Повторить", "resolve-rim", { disabled: resolver.loading })}${button("Заполнить вручную", "manual-rim")}</div>` : ""}${resolver.variants?.length ? `<div class="vnext-fitment__choices"><h3>Выберите вариант</h3>${resolver.variants.map((variant, index) => button([variant.brand, variant.model, variant.sku].filter(Boolean).join(" · ") || `Вариант ${index + 1}`, "rim-variant", { value: index })).join("")}</div>` : ""}${resolver.conflicts?.length ? `<div class="vnext-fitment__choices"><h3>Проверьте найденные значения</h3>${resolver.conflicts.map((conflict) => `<div class="vnext-fitment__conflict"><span>${esc(conflict.field)}: ${esc(conflict.current ?? "Нет данных")} → ${esc(conflict.suggested ?? "Нет данных")}</span>${button("Использовать найденное", "conflict-use", { value: `${conflict.field}|${conflict.suggested ?? ""}` })}${button("Оставить введённое", "conflict-keep", { value: conflict.field })}</div>`).join("")}</div>` : ""}</section>`;
}

function evidence(model) {
  const check = model.check || {};
  const conditions = model.conditions || [];
  const blocking = model.blockingIssues || [];
  const items = [...blocking, ...conditions];
  if (check.execution_status === "failed" || !items.length) return "";
  return `<section class="vnext-fitment__evidence"><div class="vnext-fitment__section-heading"><h2>Условия и пояснения</h2></div><ul>${items.map((item) => `<li>${esc(item.label || item.message || item.code || "Нет описания")}</li>`).join("")}</ul></section>`;
}

function comparisonTable(model) {
  if (model.executionStatus === "failed" || model.check?.execution_status === "failed") return "";
  const rows = model.fieldEvidence || [];
  if (!rows.length) return `<section class="vnext-fitment__comparison"><div class="vnext-fitment__section-heading"><h2>Технические данные</h2></div><p>Нет дополнительных данных</p></section>`;
  return `<section class="vnext-fitment__comparison"><div class="vnext-fitment__section-heading"><h2>Сравнение параметров</h2></div><div class="vnext-fitment__parameter vnext-fitment__parameter--head"><span>Параметр</span><span>Для автомобиля</span><span>Колесный диск</span><span>Результат</span></div>${parameters(model)}</section>`;
}

function preview(url, alt) {
  return `<div class="vnext-fitment__stage">${url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">` : `<span>Фото недоступно</span>`}</div>`;
}

export function fitmentMarkup(model = {}) {
  if (model.loading && !model.overview) return `<section class="vnext-fitment" role="status"><p>Загружаем совместимость…</p></section>`;
  if (model.error && !model.overview) return `<section class="vnext-fitment" role="alert"><h2>Не удалось загрузить совместимость</h2><p>${esc(model.error)}</p>${button("Повторить", "reload", { primary: true })}</section>`;
  const vehicle = model.vehicleForm || model.vehicle || {};
  const rim = model.rim || {};
  let contextualAction = "";
  if (model.retryAvailable) contextualAction = button(model.executionStatus === "failed" ? "Повторить проверку" : "Проверить ещё раз", "check", { disabled: model.checking });
  else if (model.canRunCheck) contextualAction = button("Проверить совместимость", "check", { disabled: model.checking });
  else if (model.nextAction === "complete_vehicle_details" || model.nextAction === "select_vehicle_variant") contextualAction = button("Уточнить данные автомобиля", "recovery", { value: model.nextAction });
  else if (model.nextAction === "complete_rim_specs") contextualAction = button("Уточнить параметры диска", "recovery", { value: model.nextAction });
  const vehicleFields = model.vehicleEditing ? `<section class="vnext-fitment__editor"><div class="vnext-fitment__section-heading"><h2>Данные автомобиля</h2></div><div class="vnext-fitment__fields">
    ${field("Марка", "vehicle.make", vehicle.make, { options: model.catalogue?.makes })}
    ${field("Модель", "vehicle.model", vehicle.model, { options: model.catalogue?.models })}
    ${field("Год", "vehicle.year", vehicle.year, { options: model.catalogue?.years })}
    ${field("Рынок", "vehicle.market", vehicle.market, { options: model.catalogue?.markets })}
    ${field("Кузов", "vehicle.body", vehicle.body)}
    ${field("Поколение", "vehicle.generation", vehicle.generation)}
    ${field("Модификация", "vehicle.modification", vehicle.modification)}
  </div>${model.vehicleCandidates?.length ? `<div class="vnext-fitment__choices"><h3>Данные-кандидаты</h3>${model.vehicleCandidates.map((candidate) => button(String(candidate.value), "candidate", { value: `vehicle.${candidate.field}|${candidate.value}` })).join("")}</div>` : ""}${model.vehicleVariants?.length ? `<div class="vnext-fitment__choices"><h3>Выберите комплектацию</h3>${model.vehicleVariants.map((variant, index) => button([variant.label, variant.technical].filter(Boolean).join(" · ") || `Вариант ${index + 1}`, "vehicle-variant", { value: index })).join("")}${model.selectedVehicleVariant != null ? button("Подтвердить комплектацию", "confirm-vehicle-variant", { primary: true }) : ""}</div>` : ""}${button("Сохранить автомобиль", "save", { primary: true, disabled: model.saving })}</section>` : "";
  const rimFields = model.rimEditing ? `<section class="vnext-fitment__editor"><div class="vnext-fitment__section-heading"><h2>Параметры колесного диска</h2></div><div class="vnext-fitment__fields">
    ${field("Бренд", "rim.brand", rim.brand)}
    ${field("Модель", "rim.model", rim.model)}
    ${field("Артикул", "rim.sku", rim.sku)}
    ${field("PCD: число отверстий", "rim.bolt_count", rim.bolt_count, { type: "number" })}
    ${field("PCD, мм", "rim.pcd_mm", rim.pcd_mm, { type: "number" })}
    ${field("Диаметр, дюймы", "rim.wheel_diameter_in", rim.wheel_diameter_in, { type: "number" })}
    ${field("Ширина, J", "rim.wheel_width_j", rim.wheel_width_j, { type: "number" })}
    ${field("DIA, мм", "rim.center_bore_mm", rim.center_bore_mm, { type: "number" })}
    ${field("ET, мм", "rim.offset_et_mm", rim.offset_et_mm, { type: "number" })}
    ${field("Схема", "setup_mode", model.setupMode, { options: [{ value: "uniform", label: "Одинаковые параметры" }, { value: "staggered", label: "Разные параметры по осям" }] })}
  </div>${model.setupMode === "staggered" ? `<section class="vnext-fitment__rear"><h3>Задняя ось</h3><div class="vnext-fitment__fields">
    ${field("PCD: число отверстий", "rear_rim.bolt_count", model.rearRim?.bolt_count, { type: "number" })}
    ${field("PCD, мм", "rear_rim.pcd_mm", model.rearRim?.pcd_mm, { type: "number" })}
    ${field("Диаметр, дюймы", "rear_rim.wheel_diameter_in", model.rearRim?.wheel_diameter_in, { type: "number" })}
    ${field("Ширина, J", "rear_rim.wheel_width_j", model.rearRim?.wheel_width_j, { type: "number" })}
    ${field("DIA, мм", "rear_rim.center_bore_mm", model.rearRim?.center_bore_mm, { type: "number" })}
    ${field("ET, мм", "rear_rim.offset_et_mm", model.rearRim?.offset_et_mm, { type: "number" })}
  </div></section>` : ""}${model.rimCandidates?.length ? `<div class="vnext-fitment__choices"><h3>Предложенные значения</h3>${model.rimCandidates.map((candidate) => button(String(candidate.value), "candidate", { value: `rim.${candidate.field}|${candidate.value}` })).join("")}</div>` : ""}${button("Сохранить параметры", "save", { primary: true, disabled: model.saving })}${sourceEditor(model)}</section>` : "";
  return `<section class="vnext-fitment">
    <div class="vnext-fitment__topline"><p class="vnext-eyebrow">Задание ${esc(model.jobId)}</p>${button("Назад", "back")}</div>
    ${model.error ? `<p class="vnext-fitment__notice" role="alert">${esc(model.error)}</p>` : ""}
    ${model.message ? `<p class="vnext-fitment__notice" role="status">${esc(model.message)}</p>` : ""}
    <div class="vnext-fitment__pair">
      <section><p class="vnext-eyebrow">Автомобиль</p>${preview(model.vehiclePreview, "Фотография автомобиля")}
        <div class="vnext-fitment__object-meta"><h2>${esc(model.vehicleTitle || "Данные автомобиля не заполнены")}</h2>
        ${(model.vehicleSpecs || []).length ? `<p>${model.vehicleSpecs.map(esc).join(" · ")}</p>` : ""}
        </div>
        ${model.vehicleVariantPickerOpen && model.vehicleVariants?.length ? `<div class="vnext-fitment__choices"><h3>Выберите комплектацию</h3>${model.vehicleVariants.map((variant, index) => button([variant.label, variant.technical].filter(Boolean).join(" · ") || `Вариант ${index + 1}`, "vehicle-variant", { value: index })).join("")}${model.selectedVehicleVariant != null ? button("Подтвердить комплектацию", "confirm-vehicle-variant", { primary: true }) : ""}</div>` : ""}
        <div class="vnext-fitment__actions">${!model.vehicleEditing ? button("Изменить автомобиль", "edit-vehicle") : ""}
          ${model.vehicleVariantAction ? button(model.vehicleVariantsLoading ? "Ищем комплектации…" : "Выбрать комплектацию", "load-vehicle-variants", { disabled: model.vehicleVariantsLoading }) : ""}
          ${model.canReselectVehicleVariant ? button(model.vehicleVariantPickerOpen ? "Скрыть комплектации" : "Изменить комплектацию", "reselect-vehicle", { disabled: model.vehicleVariantsLoading }) : ""}
        </div>
      </section>
      <section><p class="vnext-eyebrow">Колесный диск</p>${preview(model.rimPreview, "Фотография колесного диска")}
        <div class="vnext-fitment__object-meta"><h2>${esc(model.rimTitle || "Параметры не заполнены")}</h2>
        <p>${esc(model.rimSpecs || "")}</p>
        </div>
        <p class="vnext-fitment__provenance">${esc(model.rimProvenance || "")}</p>
        ${!model.rimEditing ? button("Изменить параметры", "edit-rim") : ""}
      </section>
    </div>
    ${verdict(model)}
    ${comparisonTable(model)}
    ${evidence(model)}
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
