import { fitmentDisplayValue } from "../fitment-display.mjs";

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const button = (label, action, { primary = false, disabled = false, value = "" } = {}) => `<button type="button" class="vnext-button vnext-button--${primary ? "primary" : "secondary"}" data-fitment-action="${esc(action)}" data-value="${esc(value)}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;

const verdictLabels = {
  compatible: "Подходит",
  compatible_with_conditions: "Подходит с условиями",
  unknown: "Не можем подтвердить совместимость",
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
  const id = `fitment-field-${path.replaceAll(".", "-")}`;
  const inputAttributes = ` id="${esc(id)}" ${invalid ? ' aria-invalid="true" aria-describedby="fitment-error-' + esc(path.replaceAll(".", "-")) + '"' : ""} ${disabled ? "disabled" : ""}`;
  const control = options
    ? `<select data-fitment-field="${esc(path)}"${inputAttributes}><option value="">${esc(placeholder)}</option>${options.map((option) => `<option value="${esc(option.value)}" ${String(option.value) === String(value ?? "") ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select>`
    : `<input type="${type === "number" ? "text" : type}"${type === "number" ? ' inputmode="decimal"' : ""} data-fitment-field="${esc(path)}" value="${esc(value)}"${inputAttributes}>`;
  return `<div class="vnext-fitment__field${invalid ? " vnext-fitment__field--invalid" : ""}"><label for="${esc(id)}">${esc(label)}</label>${control}${message ? `<small class="vnext-fitment__field-message" role="status">${esc(message)}${retry ? ` ${button("Повторить", "retry-catalogue", { value: retry })}` : ""}</small>` : ""}${invalid ? `<small class="vnext-fitment__field-error" id="fitment-error-${esc(path.replaceAll(".", "-"))}" role="alert">${esc(error)}</small>` : ""}</div>`;
}

function fieldConflict(model, path) {
  if (!path.startsWith("rim.")) return "";
  const name = path.slice(4);
  const conflict = (model.resolver?.conflicts || []).find((item) => item.field === name);
  if (!conflict) return "";
  const choices = conflict.choices?.length ? conflict.choices : [conflict.suggested];
  const label = { wheel_diameter_in: ["Диаметр", "Diameter"], wheel_width_j: ["Ширина", "Width"], bolt_count: ["PCD", "PCD"], pcd_mm: ["PCD", "PCD"], center_bore_mm: ["DIA", "DIA"], offset_et_mm: ["ET", "ET"] }[name]?.[model.locale === "en" ? 1 : 0] || name;
  const display = value => wheelDisplay(value, model.locale) + (name === "wheel_width_j" ? "J" : "");
  const sourceLabel = (value, current) => model.locale === "en" ? current ? `Current ${label} value: ${display(value)}` : `${label} value from product page: ${display(value)}` : current ? `Текущее значение ${label}: ${display(value)}` : `Значение ${label} из карточки товара: ${display(value)}`;
  const chip = (value, current) => `<button type="button" class="vnext-fitment__conflict-chip" aria-pressed="false" aria-label="${esc(sourceLabel(value, current))}" data-fitment-focus="rim.${["bolt_count", "pcd_mm"].includes(name) ? "pcd" : esc(name)}" data-fitment-action="${current ? "conflict-keep" : "conflict-use"}" data-value="${esc(current ? name : `${name}|${value}`)}">${esc(display(value))}</button>`;
  return `<div class="vnext-fitment__conflict" role="group" aria-label="Конфликт значения ${esc(label)}">${conflict.current == null ? "" : chip(conflict.current, true)}${choices.map(value => chip(value, false)).join("")}</div>`;
}

function fieldWithCandidates(model, label, path, value, options = {}) {
  const kind = path.startsWith("rim.") ? "rimCandidates" : "";
  const fieldName = path.replace(/^(?:vehicle|rim|rear_rim)\./, "");
  const candidates = kind
    ? (model[kind] || []).filter((candidate) => candidate.field === fieldName && normalizedIdentity(candidate.value) !== normalizedIdentity(value))
    : [];
  const suggestions = candidates.length
    ? `<div class="vnext-fitment__suggestions" role="group" aria-label="Предложения для поля ${esc(label.toLocaleLowerCase())}">${candidates.map((candidate) => button(String(candidate.value), "candidate", { value: `${path}|${candidate.value}` })).join("")}</div>`
    : "";
  return `<div class="vnext-fitment__field-wrap">${field(label, path, value, options)}${suggestions}${fieldConflict(model, path)}</div>`;
}

function normalizedIdentity(value) {
  return String(value ?? "").trim().toLocaleLowerCase().replace(/[\s_-]+/g, "");
}

const comparisonFields = [
  ["wheel_diameter_in", "Диаметр", "Diameter", "″"], ["wheel_width_j", "Ширина", "Width", "J"],
  ["offset_et_mm", "ET", "ET", " mm"], ["pcd", "PCD", "PCD", " mm"],
  ["bolt_count", "Количество отверстий", "Bolt count", ""], ["center_bore_mm", "DIA", "DIA", " mm"],
];
const hasSummary = value => Boolean(String(value ?? "").trim()) && !/^[—–-]$/.test(String(value).trim());
const comparisonLabel = (model, ru, en) => model.locale === "en" ? en : ru;
const comparisonResult = (model, item) => ({
  pass: comparisonLabel(model, "Подходит", "Matches"),
  conditional: comparisonLabel(model, "С условием", "With conditions"),
  fail: comparisonLabel(model, "Не подходит", "Does not match"),
  unknown: comparisonLabel(model, "Нет данных", "No data"),
}[item.status] || item.resultLabel || comparisonLabel(model, "Нет данных", "No data"));

function parameters(model, rows) {
  return comparisonFields.map(([field, ru, en, unit]) => {
    const item = rows.find(row => row.field === field || row.name === ru || row.name === en) || {};
    const value = raw => raw == null ? comparisonLabel(model, "Нет данных", "No data") : esc(fitmentDisplayValue(raw, model.locale) + (model.locale !== "en" ? unit.replace(" mm", " мм") : unit));
    const result = comparisonResult(model, item);
    const submittedSizeKnown = ["wheel_diameter_in", "wheel_width_j"].every(name => rows.some(row => row.field === name && row.rimValue != null));
    const contextualMissing = field === "offset_et_mm" && item.code === "vehicle_reference_offset_missing" && item.vehicleValue == null && submittedSizeKnown;
    const referenceValue = contextualMissing ? esc(comparisonLabel(model, "Нет для этого размера", "None for this size")) : value(item.vehicleValue);
    return `<tr tabindex="0"><th scope="row">${comparisonLabel(model, ru, en)}</th><td>${referenceValue}</td><td>${value(item.rimValue)}</td><td class="vnext-fitment__row-result${item.status === "conditional" ? " vnext-fitment__row-result--conditional" : item.status === "fail" ? " vnext-fitment__row-result--fail" : ""}">${esc(result)}</td></tr>`;
  }).join("");
}

function verdict(model) {
  const status = model.executionStatus;
  if (model.rimDraftDirty) return `<section class="vnext-fitment__verdict" role="status"><h2>Есть несохранённые изменения</h2><p>Сохраните параметры, чтобы проверить обновлённые данные.</p></section>`;
  if (status === "failed" || model.checkStartFailed) {
    return `<section class="vnext-fitment__verdict vnext-fitment__verdict--failed" role="alert"><p class="vnext-eyebrow">Техническая проверка</p><h2>Проверку выполнить не удалось</h2><p>Попробуйте ещё раз.</p><p>Подтверждённые данные сохранены.</p></section>`;
  }
  if (status === "queued" || status === "processing" || model.checking) return `<section class="vnext-fitment__verdict"><p class="vnext-eyebrow">Техническая проверка</p>${loadingStatus("Проверяем совместимость…")}<p>${esc(model.vehicleTitle)} — ${esc(model.rimTitle)}</p>${model.checkError ? button("Обновить статус", "reload") : ""}</section>`;
  const check = model.check;
  if (check?.execution_status === "completed") {
    const stale = check.is_current === false;
    const verdictLabel = verdictLabels[check.verdict] || "";
    return `<section class="vnext-fitment__verdict vnext-fitment__verdict--${stale ? "stale" : esc(check.verdict || "unknown")}" role="status"><p class="vnext-eyebrow">Техническая проверка</p><h2>${stale ? "Результат больше не актуален" : esc(verdictLabel)}</h2>${stale && verdictLabel ? `<p class="vnext-fitment__previous-verdict">Предыдущий результат: ${esc(verdictLabel)}</p><p>Данные автомобиля или колесного диска изменились.</p>` : ""}${!stale && check.verdict === "unknown" ? `<p>${comparisonLabel(model, 'Доступных данных недостаточно, чтобы подтвердить совместимость этого размера целиком.', 'The available data is not enough to confirm this wheel size as a whole.')}</p>` : !stale && model.resultCopy ? `<p>${esc(model.resultCopy)}</p>` : ""}</section>`;
  }
  const copy = nextActionCopy[model.nextAction] || (model.loading ? "Загружаем данные…" : "Техническая проверка ещё не готова");
  return `<section class="vnext-fitment__verdict"${model.loading ? ' aria-busy="true"' : ""}><p class="vnext-eyebrow">Техническая проверка</p>${model.loading ? loadingStatus(copy) : `<h2>${esc(copy)}</h2>`}${model.checkError ? `<p role="alert">${esc(model.checkError)}</p>` : ""}</section>`;
}

function sourceEditor(model) {
  const resolver = model.resolver || {};
  const status = resolver.status || "";
  const statusClass = resolver.statusTone === "error" ? " vnext-fitment__notice--error" : "";
  const resolving = resolver.loading ? loadingStatus("Определяем параметры колесного диска") : "";
  const retries = resolver.statusTone === "error" && resolver.url ? `<div class="vnext-fitment__actions">${button("Повторить", "resolve-rim", { disabled: resolver.loading })}${button("Указать параметры вручную", "manual-rim")}</div>` : "";
  const variants = resolver.variants?.length ? `<div class="vnext-fitment__choices"><div class="vnext-fitment__sku-legend" aria-hidden="true"><span>Вариант</span><span class="vnext-fitment__sku-specs"><span>Диаметр</span><span>Ширина</span><span>PCD</span><span>DIA</span><span>ET</span></span><span></span></div><div role="group" aria-label="Варианты колесного диска">${resolver.variants.map((variant, index) => {
    const values = variant.values || {};
    const known = (value, suffix = "") => value === null || value === undefined || value === "" ? "Не определено" : `${wheelDisplay(value, model.locale)}${suffix}`;
    const pcd = values.bolt_count != null && values.pcd_mm != null ? `${values.bolt_count}×${wheelDisplay(values.pcd_mm, model.locale)}` : "Не определено";
    const specs = [["Диаметр", known(values.wheel_diameter_in, "″")], ["Ширина", known(values.wheel_width_j, "J")], ["PCD", pcd], ["DIA", known(values.center_bore_mm)], ["ET", known(values.offset_et_mm)]];
    return `<button type="button" class="vnext-fitment__sku-row" data-fitment-action="rim-variant" data-value="${index}" aria-pressed="${String(variant.sku === resolver.selectedSku)}"><span class="vnext-fitment__sku-identity">${variant.imageUrl ? `<img src="${esc(variant.imageUrl)}" alt="" class="vnext-fitment__sku-image">` : ""}<span class="vnext-fitment__sku-name">${esc([variant.brand, variant.model].filter(Boolean).join(" ") || `Вариант ${index + 1}`)}</span><span class="vnext-fitment__sku-code">SKU: ${esc(variant.sku || "Не определено")}</span></span><span class="vnext-fitment__sku-specs">${specs.map(([label, value]) => `<span><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`).join("")}</span><span class="vnext-fitment__sku-select">Выбрать</span></button>`;
  }).join("")}</div></div>` : "";
  return `<section class="vnext-fitment__source-disclosure">${!variants ? `<button type="button" class="vnext-button vnext-button--secondary" data-fitment-action="toggle-source" aria-expanded="${String(Boolean(resolver.open))}" aria-controls="fitment-source-panel">${resolver.url ? "Изменить ссылку на товар" : "Добавить ссылку на товар"}</button>` : ""}${!variants && resolver.open ? `<div class="vnext-fitment__source-panel" id="fitment-source-panel"><div class="vnext-fitment__section-heading"><h3>Источник колесного диска</h3></div><label class="vnext-fitment__field"><span>Ссылка на товар</span><input type="url" inputmode="url" data-fitment-source-url value="${esc(resolver.url)}" placeholder="https://"></label><div class="vnext-fitment__source-actions">${button("Определить параметры", "resolve-rim", { primary: true, disabled: resolver.loading || !resolver.url })}<p>Необязательно — попробуем получить модель и технические параметры со страницы.</p></div>${resolving}${status ? `<p class="vnext-fitment__notice${statusClass}" role="${resolver.statusTone === "error" ? "alert" : "status"}">${esc(status)}</p>` : ""}${retries}</div>` : ""}${variants}${resolver.chooserOpen ? button("Отмена", "cancel-rim-sku") : ""}${!resolver.open ? resolving + (resolver.statusTone === "error" ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(status)}</p>${retries}` : "") : ""}</section>`;
}

function evidence(model) {
  if (model.check?.execution_status !== "completed" || model.checkStartFailed) return "";
  const seen = new Set();
  const groups = [[model.check.verdict === "incompatible" ? "Почему не подходит" : model.check.verdict === "unknown" ? "Что не удалось подтвердить" : "Что нужно уточнить", model.blockingIssues], ["Что нужно уточнить", model.missingData], ["Условия установки", model.conditions], ["Дополнительная информация", model.advisories]]
    .map(([title, items]) => ({ title, items: (items || []).map(item => item.label || item.message || item.code || "").filter(label => {
      if (!label || seen.has(label)) return false;
      seen.add(label); return true;
    }) })).filter(group => group.items.length);
  if (!groups.length) return "";
  const blockersAndConditions = groups.some(group => group.title === "Почему не подходит") && groups.some(group => group.title === "Условия установки");
  return `<section class="vnext-fitment__evidence">${groups.map(group => `<div><h3>${group.title}</h3><ul>${group.items.map(label => `<li>${esc(label)}</li>`).join("")}</ul></div>`).join("")}${blockersAndConditions ? '<p>Условия установки не отменяют причины несовместимости.</p>' : ""}</section>`;
}

function comparisonTable(model) {
  if (model.executionStatus === "failed" || model.check?.execution_status !== "completed") return "";
  const rows = model.fieldEvidence || [];
  const front = rows.filter(row => row.axle !== "rear");
  const rear = rows.filter(row => row.axle === "rear");
  const comparable = items => comparisonFields.map(([field, ru, en]) => {
    const item = items.find(row => row.field === field || row.name === ru || row.name === en) || {};
    const display = value => value == null ? "Нет данных" : fitmentDisplayValue(value, model.locale);
    const tone = ["conditional", "fail"].includes(item.status) ? item.status : "";
    return [display(item.vehicleValue), display(item.rimValue), comparisonResult(model, item), tone];
  });
  const staggered = Boolean(rear.length || (model.resultSetupMode || model.overview?.setup_mode) === "staggered");
  const separateAxles = staggered && (!rear.length || JSON.stringify(comparable(front)) !== JSON.stringify(comparable(rear)));
  const table = (items, caption) => `<table class="vnext-fitment__comparison-table"><caption>${model.check?.is_current === false ? `Предыдущий результат — ${caption}` : caption}</caption><colgroup><col><col><col><col></colgroup><thead><tr><th scope="col">${comparisonLabel(model, "Параметр", "Parameter")}</th><th scope="col">${comparisonLabel(model, "Автомобиль", "Vehicle")}</th><th scope="col">${comparisonLabel(model, "Колесный диск", "Wheel")}</th><th scope="col">${comparisonLabel(model, "Результат", "Result")}</th></tr></thead><tbody>${parameters(model, items)}</tbody></table>`;
  return `<section class="vnext-fitment__comparison">${table(front, separateAxles ? comparisonLabel(model, "Передняя ось", "Front axle") : staggered ? comparisonLabel(model, "Одинаково для обеих осей", "Same for both axles") : comparisonLabel(model, "Параметры колёс", "Wheel parameters"))}${separateAxles ? table(rear, comparisonLabel(model, "Задняя ось", "Rear axle")) : ""}</section>`;
}

function preliminaryWarning(model) {
  if (!model.preliminaryWarning || model.executionStatus !== "completed" || model.check?.execution_status !== "completed") return "";
  return `<footer class="vnext-fitment__commercial-warning"><p>${esc(comparisonLabel(model, "Это предварительная проверка по техническим данным. Перед покупкой уточните совместимость у продавца или в шиномонтаже.", "This is a preliminary check based on technical data. Before purchasing, confirm compatibility with the seller or an installation shop."))}</p></footer>`;
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


const wheelPickerPresets = {
  wheel_diameter_in: [15,16,17,18,19,20,21,22,23,24],
  wheel_width_j: [6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12],
  pcd: ["4×100","5×100","5×108","5×110","5×112","5×114.3","5×120","5×130","6×130"],
  center_bore_mm: [57.1,60.1,63.4,64.1,65.1,66.1,66.6,67.1,71.6,72.6,74.1],
  offset_et_mm: [35,37.5,40,43.1,45,48.1],
};
const wheelEtCatalogue = [-129,-37,-30,-25.4,-25,-20,-15.5,-15,-12,-10,-8,-6.4,-6.35,-6,-5,-3,-2.5,-2,-1,0,0.15,0.34,2,3,4,5,6,6.35,6.4,7,7.5,7.6,8,8.6,8.64,8.9,9,10,10.6,11,11.2,11.4,12,12.7,13,13.5,14,14.2,14.22,14.3,14.4,15,15.5,16,17,18,18.5,19,19.05,19.1,19.5,19.85,20,20.5,20.6,21,21.5,22,22.1,22.3,22.35,22.4,22.5,23,23.3,23.5,23.6,24,24.1,24.25,24.75,25,25.1,25.2,25.3,25.4,25.5,26,26.2,26.3,27,27.5,27.6,28,28.4,28.8,29,29.5,30,30.1,30.5,31,31.5,31.7,31.75,31.8,32,32.1,32.2,32.25,32.5,32.7,33,33.2,33.275,33.5,33.7,34,34.1,34.5,35,35.5,35.9,36,36.1,36.5,37,37.17,37.2,37.3,37.5,38,38.1,38.5,38.8,39,39.5,40,40.1,40.475,40.5,40.65,40.7,41,41.1,41.15,41.3,41.5,41.65,42,42.1,42.3,42.4,42.5,42.55,42.85,43,43.1,43.2,43.3,43.5,43.75,44,44.45,44.5,44.7,44.9,45,45.1,45.5,45.72,46,46.4,46.5,46.6,46.67,47,47.3,47.5,47.9,48,48.1,48.2,48.4,48.5,48.75,49,49.5,49.75,50,50.08,50.1,50.3,50.5,50.8,51,51.2,51.5,52,52.2,52.3,52.5,53,53.3,53.4,53.5,53.7,54,54.5,54.6,54.65,54.8,55,55.2,55.5,56,56.1,56.2,56.4,56.5,57,57.15,57.4,57.5,58,58.1,58.2,58.5,59,59.1,59.5,60,60.1,60.2,60.5,60.6,60.8,61,61.1,61.4,61.5,61.85,62,62.2,62.5,62.6,63,63.5,63.8,64,65,66,66.7,67,67.1,68,68.05,68.5,69,70,70.4,71,71.1,71.5,71.6,72,73,75,76,77,78,79,80,81,82,83,87,87.5,88,91,94,98,100,101,102,105,106,107,108,109,109.5,110,113,115,116.5,117,118.3,120,121.5,122.17,122.5,124,125,127,129.5,130.81,131,135.89,136,142];
const wheelFieldLabels = { wheel_diameter_in: "Диаметр", wheel_width_j: "Ширина", pcd: "PCD", center_bore_mm: "DIA", offset_et_mm: "ET" };
const wheelDisplay = fitmentDisplayValue;

export function wheelPickerOptions(field, query = "", mode = "recommended") {
  const all = field === "offset_et_mm" ? wheelEtCatalogue : wheelPickerPresets[field] || [];
  const normalized = query.trim().replaceAll(",", ".").replaceAll("x", "×");
  if (!normalized) return { exact: [], matches: mode === "all" ? all : wheelPickerPresets[field] || [] };
  const equal = value => field === "pcd" ? String(value) === normalized : Number(value) === Number(normalized);
  const exact = all.filter(equal);
  return { exact, matches: all.filter(value => !equal(value) && String(value).includes(normalized)).slice(0,18) };
}

export function wheelPickerManualValue(field, query) {
  const normalized = query.trim().replaceAll(",", ".");
  if (field === "pcd") {
    const match = normalized.match(/^(\d+)[×xX]([0-9]+(?:\.[0-9]+)?)$/);
    return match && Number(match[1]) > 0 && Number(match[2]) > 0 ? `${Number(match[1])}×${match[2]}` : null;
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && (field === "offset_et_mm" ? Math.abs(value) <= 150 : value > 0) ? normalized : null;
}

function wheelPickerMarkup(picker) {
  if (!picker) return "";
  const field = picker.path.split(".")[1];
  const label = wheelFieldLabels[field];
  const options = wheelPickerOptions(field, picker.query, picker.mode);
  const option = value => `<button type="button" class="vnext-fitment__picker-option" data-wheel-picker-value="${esc(value)}">${esc(wheelDisplay(value, picker.locale))}</button>`;
  const group = (title, values) => values.length ? `<section><h3>${title}</h3><div class="vnext-fitment__picker-options">${values.map(option).join("")}</div></section>` : "";
  const manual = wheelPickerManualValue(field, picker.query);
  return `<div class="vnext-fitment__picker-scrim" data-wheel-picker-close></div><section class="vnext-fitment__picker" role="dialog" aria-modal="true" aria-labelledby="wheel-picker-title"><div class="vnext-fitment__section-heading"><h2 id="wheel-picker-title">${label}</h2><button type="button" class="vnext-button vnext-button--secondary" data-wheel-picker-close aria-label="Закрыть выбор ${label}">Закрыть</button></div><label class="vnext-fitment__field"><span>Поиск ${label}</span><input type="text" inputmode="${field === "pcd" ? "text" : "decimal"}" data-wheel-picker-search value="${esc(picker.query)}" placeholder="${field === "pcd" ? "5×112" : "Поиск"}"></label>${group("Точное совпадение",options.exact)}${group(picker.query ? "Похожие значения" : picker.mode === "all" ? "Все значения" : field === "offset_et_mm" ? "Рекомендуемые" : "Значения",options.matches)}${field === "offset_et_mm" ? `<button type="button" class="vnext-button vnext-button--secondary" data-wheel-picker-mode>${picker.mode === "all" ? "Рекомендуемые значения" : "Показать все значения"}</button>` : ""}<div class="vnext-fitment__picker-manual"><p>Ручной ввод ${label}${field === "offset_et_mm" ? " от −150 до +150 мм. Без округления." : "."}</p><button type="button" class="vnext-button vnext-button--secondary" data-wheel-picker-value="${esc(manual ?? "")}" ${manual === null ? "disabled" : ""}>Использовать ${esc(wheelDisplay(picker.query, picker.locale))}</button></div></section>`;
}

function axleFields(model, axle, rim) {
  const prefix = axle === "rear" ? "rear_rim" : "rim";
  const pending = axle === "rear" ? model.rearRimPendingProposals || [] : model.rimPendingProposals || [];
  return `<div class="vnext-fitment__proposal-stack">${Object.entries(wheelFieldLabels).map(([field,label]) => {
    const path = `${prefix}.${field}`;
    const error = model.fieldErrors?.[path];
    const errorId = `fitment-error-${path.replaceAll(".", "-")}`;
    const errorAttributes = error ? `aria-invalid="true" aria-describedby="${esc(errorId)}"` : "";
    const value = field === "pcd" ? rim?.bolt_count && rim?.pcd_mm ? `${rim.bolt_count}×${rim.pcd_mm}` : "" : rim?.[field] ?? "";
    const displayValue = value === "" ? "Не выбрано" : `${field === "offset_et_mm" ? "ET " : ""}${wheelDisplay(value, model.locale)}${field === "wheel_diameter_in" ? "″" : field === "wheel_width_j" ? "J" : ""}`;
    const proposed = field === "pcd" ? pending.includes("bolt_count") || pending.includes("pcd_mm") : pending.includes(field);
    const conflict = axle === "front" ? field === "pcd" ? fieldConflict(model, "rim.bolt_count") + fieldConflict(model, "rim.pcd_mm") : fieldConflict(model, path) : "";
    const candidates = axle === "front" ? (model.rimCandidates || []).filter(item => item.field === field && String(item.value) !== String(value)) : [];
    const suggestions = candidates.length ? `<div class="vnext-fitment__suggestions">${candidates.map(item => button(wheelDisplay(item.value, model.locale), "candidate", { value: `${path}|${item.value}` })).join("")}</div>` : "";
    return `<div class="vnext-fitment__compound-field" data-confirmation-state="${proposed ? "proposed" : value === "" ? "missing" : "confirmed"}"><span>${label}</span><div class="vnext-fitment__compound${!proposed && value !== "" ? " vnext-fitment__compound--accepted" : ""}"><button type="button" data-fitment-action="${value === "" ? "open-wheel-picker" : "accept-rim-proposal"}" data-value="${prefix}.${field}" data-fitment-focus="${path}" ${errorAttributes} ${conflict ? "disabled" : ""} aria-label="${proposed ? "Подтвердить предложение" : value === "" ? "Выбрать" : "Подтверждено"} ${field === "offset_et_mm" && value !== "" ? "" : label + " "}${esc(displayValue)}">${esc(displayValue)}</button><button type="button" data-wheel-picker-open="${path}" aria-label="Выбрать другое ${label} для ${axle === "rear" ? "задней" : "передней"} оси">Выбрать другое ▾</button></div>${proposed ? '<small>Предложено автоматически</small>' : ""}${suggestions}${conflict}${error ? `<small id="${esc(errorId)}" role="alert">${esc(error)}</small>` : ""}</div>`;
  }).join("")}</div>`;
}

function vehicleEditor(model, vehicle) {
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
  return `<section class="vnext-fitment__editor" data-fitment-workspace="vehicle" aria-labelledby="fitment-vehicle-editor-title"><div class="vnext-fitment__section-heading"><p class="vnext-eyebrow">Автомобиль</p><h2 id="fitment-vehicle-editor-title" tabindex="-1">Укажите автомобиль</h2></div><div class="vnext-fitment__field-group"><div class="vnext-fitment__fields">${catalogueField(model, "makes", "Марка", "vehicle.make", vehicle.make)}${catalogueField(model, "models", "Модель", "vehicle.model", vehicle.model)}${catalogueField(model, "years", "Год", "vehicle.year", vehicle.year)}${marketField}</div>${marketNotice}</div>${model.vehicleRecognition?.status === "applied" ? '<p class="vnext-fitment__notice">Проверьте данные в каталоге и выберите точный год автомобиля.</p>' : ""}${model.vehicleError ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.vehicleError)}</p>` : ""}${model.nextAction === "select_vehicle_variant" ? button("Вернуться к выбору комплектации", "show-variants") : ""}${button(model.vehicleAwaitingConfirmation ? "Подтвердить данные" : "Сохранить автомобиль", model.vehicleAwaitingConfirmation ? "confirm-vehicle" : "save-vehicle", { primary: true, disabled: model.saving })}</section>`;
}

function vehicleRecognition(model) {
  const recognition = model.vehicleRecognition || {};
  const heading = recognition.status === "loading" ? "Распознаём автомобиль…" : recognition.status === "failed" ? "Не удалось распознать автомобиль" : "Распознано по фотографии";
  const candidates = (recognition.candidates || []).map((item, index) => {
    const identity = [item.make, item.model].filter(Boolean).join(" ");
    const year = item.year || (item.year_start && item.year_end ? `${item.year_start}–${item.year_end}` : "Год не определён");
    return `<button type="button" class="vnext-fitment__choice" data-fitment-action="recognition-proposal" data-value="${index}" aria-label="${esc(`${identity} ${year}`)}"><span class="vnext-fitment__choice-copy"><strong>${esc(identity)}</strong><small>${esc(year)}</small></span><span class="vnext-fitment__variant-cue" aria-hidden="true">›</span></button>`;
  }).join("");
  const content = recognition.status === "loading" ? loadingStatus("Распознаём автомобиль…") : recognition.status === "failed"
    ? `${recognition.message ? `<p role="alert">${esc(recognition.message)}</p>` : ""}<div class="vnext-fitment__paired-actions">${button("Попробовать ещё раз", "recognize-vehicle", { disabled: !recognition.canRecognize })}${button("Указать вручную", "edit-vehicle")}</div>`
    : `<p>Выберите найденный автомобиль, чтобы проверить данные по каталогу.</p><div class="vnext-fitment__variant-list">${candidates}</div>`;
  return `<section class="vnext-fitment__recognition" data-fitment-workspace="vehicle" aria-labelledby="fitment-recognition-title"${recognition.status === "loading" ? ' aria-busy="true"' : ""}><div class="vnext-fitment__section-heading"><p class="vnext-eyebrow">Распознавание автомобиля</p><h2 id="fitment-recognition-title" tabindex="-1">${heading}</h2></div>${content}</section>`;
}

export function activeWorkspaceKind(model = {}) {
  // Explicit branch intent wins over a retained proposal or required server step.
  if (model.activeSection === "rim" && model.rimEditing) return "rim-editor";
  const recognition = model.vehicleRecognition || {};
  if (recognition.workspaceOpen !== false && ["loading", "proposed", "failed"].includes(recognition.status)
      && model.activeSection !== "rim") return "vehicle-recognition";
  if (model.vehicleEditing && (model.nextAction !== "select_vehicle_variant" || model.manualVehicleEditing)
      && (model.activeSection === "vehicle" || !model.rimEditing)) return "vehicle-editor";
  if (model.rimEditing) return "rim-editor";
  if (model.nextAction === "select_vehicle_variant" || model.vehicleVariantPickerOpen && model.vehicleVariantMode === "reselect") return "vehicle-variant";
  return "none";
}

function activeWorkspace(model) {
  const kind = activeWorkspaceKind(model);
  let markup = "";
  if (kind === "vehicle-recognition") markup = vehicleRecognition(model);
  else if (kind === "vehicle-editor") markup = vehicleEditor(model, model.vehicleForm || model.vehicle || {});
  else if (kind === "vehicle-variant") markup = variantChooser(model);
  else if (kind === "rim-editor") markup = wheelEditor(model, model.rim || {});
  return markup.replace('data-fitment-workspace=', `data-fitment-workspace-kind="${kind}" data-fitment-workspace=`);
}

function variantChooser(model) {
  const reselection = model.vehicleVariantPickerOpen && model.vehicleVariantMode === "reselect";
  const choices = model.vehicleVariants || [];
  const status = model.vehicleLookup?.status;
  const loading = model.vehicleVariantsLoading || status === "loading";
  const choicesMarkup = choices.map((variant, index) => `<button type="button" class="vnext-fitment__choice" aria-pressed="${String(index === model.selectedVehicleVariant)}" data-fitment-action="vehicle-variant" data-value="${index}"><span class="vnext-fitment__choice-copy"><strong>${esc(variant.label || `Вариант ${index + 1}`)}</strong>${variant.technical ? `<small>${esc(variant.technical)}</small>` : ""}</span><span class="vnext-fitment__variant-cue">${index === model.selectedVehicleVariant ? "Выбрано" : "Выбрать"}</span></button>`).join("");
  const message = status === "failed" ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">Не удалось загрузить комплектации.</p>${button("Повторить", "load-vehicle-variants")}` : status === "no_match" ? `<p class="vnext-fitment__notice" role="status">Комплектации не найдены.</p>` : "";
  return `<section class="vnext-fitment__variant-step" data-fitment-workspace="vehicle" aria-labelledby="fitment-variant-title"><div class="vnext-fitment__section-heading"><p class="vnext-eyebrow">Комплектация автомобиля</p><h2 id="fitment-variant-title" tabindex="-1">Выберите комплектацию</h2></div><div class="vnext-fitment__variant-list" role="group" aria-label="Варианты комплектации">${choicesMarkup}${loading ? loadingStatus("Загружаем комплектации автомобиля") : ""}${message}<div class="vnext-fitment__paired-actions">${button("Подтвердить комплектацию", "confirm-vehicle-variant", { primary: true, disabled: model.selectedVehicleVariant == null || !choices[model.selectedVehicleVariant] })}${reselection ? button("Отмена", "cancel-vehicle-reselection") : button("Указать вручную", "manual-vehicle")}</div></div></section>`;
}

function wheelConfirmationProgress(model, axle = "front") {
  if (model.rimSaveReadiness?.conflicts?.length) return axle === "front" ? '<span data-fitment-conflict-notice>Выберите значение перед сохранением.</span>' : "";
  const rim = axle === "rear" ? model.rearRim || {} : model.rim || {};
  const pending = axle === "rear" ? model.rearRimPendingProposals || [] : model.rimPendingProposals || [];
  const count = Object.keys(wheelFieldLabels).filter(field => {
    const fields = field === "pcd" ? ["bolt_count", "pcd_mm"] : [field];
    return fields.some(name => pending.includes(name) || rim[name] == null || rim[name] === "");
  }).length;
  return count ? `Осталось подтвердить ${count} ${count === 1 ? "параметр" : count < 5 ? "параметра" : "параметров"}` : "Все параметры подтверждены";
}

function wheelEditor(model, rim) {
  const chooser = Boolean(model.resolver?.variants?.length);
  const identity = [rim.brand, rim.model].filter(Boolean).join(" ") || "Параметры колесного диска";
  const readiness = model.rimSaveReadiness || { ready: true };
  const identityEditor = model.rimIdentityEditing
    ? `<div class="vnext-fitment__fields">${fieldWithCandidates(model, "Бренд", "rim.brand", rim.brand)}${fieldWithCandidates(model, "Модель", "rim.model", rim.model)}${fieldWithCandidates(model, "Артикул", "rim.sku", rim.sku)}</div>` : "";
  const axle = (which, label) => `<section class="vnext-fitment__axle"><h3>${label}</h3>${axleFields(model, which, which === "rear" ? model.rearRim || {} : rim)}${model.setupMode === "staggered" ? `<p class="vnext-fitment__progress">${wheelConfirmationProgress(model, which)}</p>` : ""}</section>`;
  return `<section class="vnext-fitment__editor" data-fitment-workspace="rim" aria-labelledby="fitment-rim-editor-title">
    <div class="vnext-fitment__editor-heading"><div><p class="vnext-eyebrow">Параметры колесного диска</p><h2 id="fitment-rim-editor-title" tabindex="-1">${esc(chooser ? "Выберите колесный диск" : identity)}</h2>${!chooser && (model.resolver?.selectedSku || rim.sku) ? `<p class="vnext-fitment__identity-code">SKU ${esc(model.resolver?.selectedSku || rim.sku)}</p>` : ""}</div>${!chooser ? `<div class="vnext-fitment__mode" role="group" aria-label="Параметры по осям">${[ ["uniform", "Одинаковые"], ["staggered", "Разные"] ].map(([value,label]) => `<button type="button" data-fitment-action="setup-mode" data-value="${value}" aria-pressed="${String((model.setupMode || "uniform") === value)}">${label}</button>`).join("")}</div>` : ""}</div>
    ${chooser || model.resolver?.open || !model.resolver?.url ? sourceEditor(model) : ""}
    ${chooser ? '<p class="vnext-fitment__progress">Выбор SKU не подтверждает технические параметры</p>' : `${identityEditor}<div class="vnext-fitment__axles${model.setupMode === "staggered" ? " vnext-fitment__axles--staggered" : ""}">${axle("front", model.setupMode === "staggered" ? "Передняя ось" : "Обе оси")}${model.setupMode === "staggered" ? axle("rear", "Задняя ось") : ""}</div>${model.setupMode === "staggered" && model.resolver?.canChooseSku ? '<p class="vnext-fitment__progress">SKU относится к передней оси. Задние параметры подтверждаются отдельно.</p>' : ""}${model.rearDraftPreserved ? '<p class="vnext-fitment__progress">Задние параметры сохранены в черновике до сохранения.</p>' : ""}${model.rimError ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.rimError)}</p>` : ""}${model.setupMode !== "staggered" ? `<p class="vnext-fitment__progress" role="status">${wheelConfirmationProgress(model)}</p>` : ""}${readiness.invalid?.length ? '<p class="vnext-fitment__notice" role="alert">Проверьте числовые параметры диска.</p>' : ""}<div class="vnext-fitment__paired-actions">${button("Сохранить параметры", "save-rim", { primary: true, disabled: model.saving || !readiness.ready })}${model.resolver?.canChooseSku ? button("Выбрать другой SKU", "choose-rim-sku", { disabled: model.resolver.loading }) : ""}${button(model.rimIdentityEditing ? "Скрыть идентификацию" : "Изменить идентификацию", "toggle-rim-identity")}</div>`}
  </section>`;
}

export function fitmentMarkup(model = {}) {
  if (model.loading && !model.overview) return localizeFitmentMarkup(`<section class="vnext-fitment">${loadingStatus("Загружаем совместимость")}</section>`, model.locale);
  if (model.error && !model.overview) return `<section class="vnext-fitment" role="alert"><h2>Не удалось загрузить совместимость</h2><p>${esc(model.error)}</p>${button("Повторить", "reload", { primary: true })}</section>`;
  if (model.vehicleEditing && model.rimEditing) {
    model = { ...model, vehicleEditing: model.activeSection !== "rim", rimEditing: model.activeSection === "rim" };
  }
  const variantRequired = model.nextAction === "select_vehicle_variant";
  const rimSetupState = model.frontRimSetupState || model.overview?.rim_setup_state || "unknown";
  const localReady = model.rimSaveReadiness?.ready && (model.rimDraftDirty || model.overview?.rim_setup_state !== "confirmed_ready");
  const sourceStatus = state => model.rimSaveReadiness?.conflicts?.length ? "Требуется выбрать значение" : localReady ? model.rimEditing ? "Готово к сохранению" : "Есть несохранённые изменения" : model.rimDraftDirty ? "Есть несохранённые изменения" : rimSetupLabel(state);
  const rimStatus = model.setupMode === "staggered"
    ? `<span>Передняя ось: ${esc(sourceStatus(rimSetupState))}</span><span>Задняя ось: ${esc(sourceStatus(model.rearRimSetupState))}</span>`
    : esc(sourceStatus(rimSetupState));
  const vehicleStatus = model.vehicleStatus || "Требуется подтверждение";
  const configuration = model.vehicleVariantName ? `<div class="vnext-fitment__configuration"><p class="vnext-eyebrow">Комплектация</p><strong>${esc(model.vehicleVariantName)}</strong>${model.vehicleVariantTechnical ? `<small>${esc(model.vehicleVariantTechnical)}</small>` : ""}<span>Подтверждено</span></div>` : `<p class="vnext-fitment__object-status">${esc(vehicleStatus)}</p>`;
  const vehicleError = model.vehicleError && !model.vehicleEditing ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.vehicleError)}</p>` : "";
  const completedCurrent = !model.rimDraftDirty && !model.checkStartFailed && model.check?.execution_status === "completed" && model.check.is_current !== false;
  const retryState = model.checkStartFailed || model.executionStatus === "failed" || model.check?.execution_status === "completed" && model.check.is_current === false;
  const activeEditor = variantRequired && !model.manualVehicleEditing && !model.rimEditing || model.vehicleEditing || model.rimEditing;
  const checkLabel = retryState ? (model.checkStartFailed || model.executionStatus === "failed") ? "Повторить проверку" : "Проверить ещё раз" : completedCurrent ? "Проверить ещё раз" : "Проверить совместимость";
  const checkAction = (model.rimDraftDirty ? button("Сохранить параметры", "save-rim", { primary: true, disabled: model.saving || model.checking }) : "") + button(checkLabel, "check", { primary: !model.rimDraftDirty && !completedCurrent && !activeEditor && model.nextAction === "run_standard_check", disabled: model.rimDraftDirty || !model.canRunCheck || activeEditor || model.checking || retryState && !model.retryAvailable });
  const renderAction = button("Создать изображение", "create-image", { primary: completedCurrent && !activeEditor });
  const authNotice = model.authRequired ? `<div class="vnext-fitment__notice vnext-fitment__notice--error" role="alert"><p>Сессия истекла. Войдите, чтобы продолжить работу.</p>${button("Войти", "login")}</div>` : "";
  const checkError = !model.checkStartFailed && model.executionStatus !== "failed" && model.checkError ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.checkError)}</p>` : "";
  const markup = `<section class="vnext-fitment">
    <div class="vnext-fitment__workspace" ${model.wheelPicker ? "inert" : ""}>
    <div class="vnext-fitment__topline"><h1>Проверка совместимости</h1>${button("Назад", "back")}</div>
    ${authNotice}
    ${model.message ? `<p class="vnext-fitment__notice" data-fitment-save-notice tabindex="-1" role="status">${esc(model.message)}</p>` : ""}
    <fieldset class="vnext-fitment__mutation-region" ${model.checking || ["queued", "processing"].includes(model.executionStatus) ? "disabled" : ""} aria-label="Автомобиль и колесный диск">
    <div class="vnext-fitment__pair" aria-label="Источники и состояние данных">
      <section class="vnext-fitment__object${model.vehicleEditing ? " vnext-fitment__object--editing" : ""}" aria-labelledby="fitment-vehicle-title"><p class="vnext-eyebrow">Автомобиль</p>${preview(model.vehiclePreview, "Фотография автомобиля")}
        ${model.vehicleTitle ? `<h2 id="fitment-vehicle-title">${esc(model.vehicleTitle)}</h2>` : '<h2 id="fitment-vehicle-title">Автомобиль не указан</h2>'}
        <div class="vnext-fitment__source-row"><p><span>Источник данных</span><strong>Фото автомобиля</strong></p>${button("Заменить фото", "edit-vehicle-photo")}</div>
        <input type="file" accept="image/jpeg,image/png,image/webp" data-fitment-vehicle-photo hidden aria-label="Фото автомобиля">
        <div class="vnext-fitment__source-action">${button("Распознать автомобиль", "recognize-vehicle", { primary: !activeEditor && model.overview?.vehicle_state !== "confirmed_ready", disabled: !model.vehicleRecognition?.canRecognize || model.vehicleRecognition?.status === "loading" })}${button(!model.overview?.vehicle_identity_id && model.overview?.vehicle_state === "empty" ? "Указать автомобиль" : model.canReselectVehicleVariant ? "Изменить автомобиль" : "Указать вручную", "edit-vehicle")}</div>
        ${configuration}${model.canReselectVehicleVariant ? button("Изменить комплектацию", "reselect-vehicle") : ""}${variantRequired && model.rimEditing ? button("Выбрать комплектацию", "show-variants") : ""}${vehicleError}
      </section>
      <section class="vnext-fitment__object${model.rimEditing ? " vnext-fitment__object--editing" : ""}" aria-labelledby="fitment-rim-title"><p class="vnext-eyebrow">Колесный диск</p>${preview(model.rimPreview, "Фотография колесного диска", { kind: "wheel" })}
        ${model.rimTitle ? `<h2 id="fitment-rim-title">${esc(model.rimTitle)}</h2>` : '<h2 id="fitment-rim-title" class="vnext-fitment__visually-hidden">Колесный диск</h2>'}
        <div class="vnext-fitment__source-row"><p><span>Источник данных</span><strong>${esc(model.rimSourceLabel || "Источник не указан")}</strong>${model.rimSourceDomain ? `<small>${esc(model.rimSourceDomain)}</small>` : ""}</p>${button("Изменить", "edit-rim", { value: "source" })}</div>
        <div class="vnext-fitment__source-action">${button("Распознать колесный диск", "resolve-rim", { primary: !activeEditor && !model.resolver?.canChooseSku && model.overview?.rim_setup_state !== "confirmed_ready", disabled: !model.resolver?.url || model.resolver?.loading })}${!model.rimEditing ? button("Изменить параметры", "edit-rim") : ""}</div>
        <p class="vnext-fitment__object-status" data-rim-setup-state="${esc(rimSetupState)}">${rimStatus}</p>${model.rimError && !model.rimEditing ? `<p class="vnext-fitment__notice vnext-fitment__notice--error" role="alert">${esc(model.rimError)}</p>` : ""}
      </section>
    </div>
    <div class="vnext-fitment__active-editor" data-fitment-active-workspace>${activeWorkspace(model)}</div>
    </fieldset>
    ${model.check || model.checkStartFailed || model.checking || ["queued", "processing", "failed"].includes(model.executionStatus) ? `<section class="vnext-fitment__result-panel">${verdict(model)}${checkError}${!model.checkStartFailed ? evidence(model) + comparisonTable(model) + preliminaryWarning(model) : ""}${!model.rimEditing && !model.vehicleEditing ? `<div class="vnext-fitment__actions">${button("Изменить параметры", "edit-rim")}</div>` : ""}</section>` : checkError}
    <section class="vnext-fitment__standard" aria-labelledby="fitment-standard-title"><h2 id="fitment-standard-title">${model.checking ? "Проверяем совместимость…" : completedCurrent ? "Проверка выполнена" : "Проверка совместимости"}</h2>${!completedCurrent && !model.checking ? `<p>${esc(model.rimDraftDirty ? "Есть несохранённые изменения. Сохраните параметры, чтобы проверить обновлённые данные." : model.checkStartFailed || model.executionStatus === "failed" ? "Проверку выполнить не удалось. Попробуйте ещё раз." : nextActionCopy[model.nextAction] || "Подтвердите автомобиль и параметры диска.")}</p>` : ""}${hasSummary(model.canonicalVehicleSummary) || hasSummary(model.canonicalWheelSummary) ? `<div class="vnext-fitment__ready-summaries">${hasSummary(model.canonicalVehicleSummary) ? `<div><span>Автомобиль</span><strong>${esc(model.canonicalVehicleSummary)}</strong></div>` : ""}${hasSummary(model.canonicalWheelSummary) ? `<div><span>Колесный диск</span><strong>${esc(model.canonicalWheelSummary)}</strong></div>` : ""}</div>` : ""}<div class="vnext-fitment__footer">${checkAction}${renderAction}</div></section>
    </div>
    ${wheelPickerMarkup(model.wheelPicker ? { ...model.wheelPicker, locale: model.locale } : null)}
  </section>`;
  return localizeFitmentMarkup(markup, model.locale);
}

export function refreshFitmentView(root, model, callbacks = root.fitmentCallbacks) {
  root.fitmentCallbacks = callbacks;
  const previousWorkspace = root.fitmentWorkspaceKind;
  const nextWorkspace = activeWorkspaceKind(model);
  root.fitmentModel = model;
  root.fitmentWorkspaceKind = nextWorkspace;
  const focused = root.querySelector(":focus[data-fitment-field], :focus[data-fitment-source-url], :focus[data-wheel-picker-search], :focus[data-fitment-focus], :focus[data-fitment-action], :focus[id^='fitment-']");
  const focusSelector = focused?.dataset.fitmentAction && !focused.dataset.fitmentFocus ? `[data-fitment-action="${CSS.escape(focused.dataset.fitmentAction)}"][data-value="${CSS.escape(focused.dataset.value || "")}"]` : focused?.dataset.fitmentFocus ? `[data-fitment-focus="${CSS.escape(focused.dataset.fitmentFocus)}"]` : focused?.dataset.fitmentField ? `[data-fitment-field="${CSS.escape(focused.dataset.fitmentField)}"]` : focused?.id && !focused.dataset.fitmentField ? `#${CSS.escape(focused.id)}` : focused?.hasAttribute?.("data-wheel-picker-search") ? "[data-wheel-picker-search]" : focused ? "[data-fitment-source-url]" : "";
  const supportsSelection = (input) => input?.tagName === "TEXTAREA" || input?.tagName === "INPUT" && ["text", "search", "url", "tel", "password"].includes(input.type);
  const selection = supportsSelection(focused) ? [focused.selectionStart, focused.selectionEnd] : null;
  const markup = fitmentMarkup({ ...model, wheelPicker: root.fitmentPicker });
  const next = document.createElement("section");
  next.className = root.className;
  next.innerHTML = markup;
  root.replaceChildren(...next.childNodes);
  if (previousWorkspace !== undefined && previousWorkspace !== nextWorkspace) {
    const heading = nextWorkspace === "none" ? root.querySelector('[data-fitment-action="reselect-vehicle"], [data-fitment-action="edit-rim"]') : root.querySelector("[data-fitment-active-workspace] h2[tabindex]");
    heading?.focus({ preventScroll: true });
  } else if (focusSelector) {
    const nextFocus = root.querySelector(focusSelector);
    const focusTarget = nextFocus?.disabled && focused?.dataset.fitmentAction?.startsWith("conflict-")
      ? root.querySelector(`[data-wheel-picker-open="${CSS.escape(focused.dataset.fitmentFocus)}"]`) : nextFocus;
    (focusTarget || root.querySelector("[data-fitment-active-workspace] h2[tabindex]") || root.querySelector('[data-fitment-action="edit-vehicle"]'))?.focus({ preventScroll: true });
    if (selection && supportsSelection(nextFocus)) nextFocus.setSelectionRange(...selection);
  }
  return root;
}

export function createFitmentView(model = {}, callbacks = {}) {
  const root = document.createElement("section");
  root.className = "vnext-fitment";
  root.dataset.vnextFitmentRoot = "";
  root.fitmentCallbacks = callbacks;
  const redraw = () => refreshFitmentView(root, root.fitmentModel);
  const closePicker = () => {
    const path = root.fitmentPicker?.path;
    root.fitmentPicker = null;
    redraw();
    if (path) root.querySelector(`[data-wheel-picker-open="${CSS.escape(path)}"]`)?.focus();
  };
  root.addEventListener("click", (event) => {
    if (event.target.closest('[data-fitment-action="edit-vehicle-photo"]')) {
      root.fitmentCallbacks?.action?.("edit-vehicle-photo");
      root.querySelector("[data-fitment-vehicle-photo]")?.click();
      return;
    }
    const opener = event.target.closest("[data-wheel-picker-open], [data-fitment-action='open-wheel-picker']");
    if (opener) {
      root.fitmentPicker = { path: opener.dataset.wheelPickerOpen || opener.dataset.value, query: "", mode: "recommended" };
      redraw();
      root.querySelector("[data-wheel-picker-search]")?.focus();
      return;
    }
    if (event.target.closest("[data-wheel-picker-close]")) { closePicker(); return; }
    if (event.target.closest("[data-wheel-picker-mode]")) {
      root.fitmentPicker.mode = root.fitmentPicker.mode === "all" ? "recommended" : "all";
      redraw();
      root.querySelector("[data-wheel-picker-mode]")?.focus();
      return;
    }
    const picked = event.target.closest("[data-wheel-picker-value]");
    if (picked && !picked.disabled) {
      const path = root.fitmentPicker.path;
      const value = picked.dataset.wheelPickerValue;
      const [scope, fieldName] = path.split(".");
      root.fitmentPicker = null;
      if (fieldName === "pcd") {
        const [count, pcd] = value.split("×");
        root.fitmentCallbacks?.setField?.(`${scope}.bolt_count`, count);
        root.fitmentCallbacks?.setField?.(`${scope}.pcd_mm`, pcd);
      } else root.fitmentCallbacks?.setField?.(path, value);
      redraw();
      root.querySelector(`[data-wheel-picker-open="${CSS.escape(path)}"]`)?.focus();
      return;
    }
    const target = event.target.closest("[data-fitment-action]");
    if (target && root.contains(target) && !target.disabled) root.fitmentCallbacks?.action?.(target.dataset.fitmentAction, target.dataset.value);
  });
  root.addEventListener("keydown", (event) => {
    if (!root.fitmentPicker) return;
    if (event.key === "Escape") { event.preventDefault(); closePicker(); }
    if (event.key === "Tab") {
      const items = [...root.querySelectorAll('[role="dialog"] button:not(:disabled), [role="dialog"] input')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  const changeField = (event) => {
    const target = event.target.closest("[data-fitment-field]");
    if (target && root.contains(target)) root.fitmentCallbacks?.setField?.(target.dataset.fitmentField, target.value);
  };
  root.addEventListener("input", (event) => { if (event.target.tagName !== "SELECT") changeField(event); });
  root.addEventListener("change", (event) => { if (event.target.tagName === "SELECT") changeField(event); });
  root.addEventListener("change", (event) => {
    if (event.target.matches("[data-fitment-vehicle-photo]") && event.target.files?.[0]) {
      root.fitmentCallbacks?.setVehiclePhoto?.(event.target.files[0]);
      event.target.value = "";
    }
  });
  root.addEventListener("input", (event) => {
    if (event.target.matches("[data-wheel-picker-search]") && root.fitmentPicker) {
      root.fitmentPicker.query = event.target.value;
      redraw();
    }
    if (event.target.matches("[data-fitment-source-url]")) root.fitmentCallbacks?.setSourceUrl?.(event.target.value);
  });
  return refreshFitmentView(root, model, callbacks);
}

const fitmentEnglishCopy = {
  "Сохраните параметры, чтобы проверить обновлённые данные.": "Save the details to check the updated data.",
  "Проверку выполнить не удалось": "The check could not be completed",
  "Попробуйте ещё раз.": "Please try again.",
  "Повторить проверку": "Retry check",
  "Фото диска": "Wheel photo",
  "Указано вручную": "Entered manually",
  "Источник не указан": "Source not specified",
  "Почему не подходит": "Why it does not fit",
  "Что не удалось подтвердить": "What could not be confirmed",
  "Не можем подтвердить совместимость": "Compatibility could not be confirmed",
  "Что нужно уточнить": "What needs clarification",
  "Условия установки": "Installation conditions",
  "Дополнительная информация": "Additional information",
  "Условия установки не отменяют причины несовместимости.": "Installation conditions do not override the incompatibility reasons.",

  "Автомобиль не указан": "Car not specified",
  "Указать автомобиль": "Specify car",
  "Распознавание автомобиля": "Vehicle recognition",
  "Распознано по фотографии": "Recognized from the photo",
  "Распознаём автомобиль…": "Recognizing the vehicle…",
  "Не удалось распознать автомобиль": "Unable to recognize the vehicle",
  "Выберите найденный автомобиль, чтобы проверить данные по каталогу.": "Select the recognized vehicle to verify its details in the catalogue.",
  "Проверьте данные в каталоге и выберите точный год автомобиля.": "Verify the catalogue details and select the exact vehicle year.",
  "Попробовать ещё раз": "Try again",
  "Год не определён": "Year undetermined",
  "Комплектация автомобиля": "Vehicle version",
  "Проверка совместимости": "Compatibility check",
  "Проверка выполнена": "Check completed",
  "Назад": "Back",
  "Автомобиль": "Vehicle",
  "Колесный диск": "Wheel",
  "Источник данных": "Data source",
  "Фото автомобиля": "Vehicle photo",
  "Ссылка на товар": "Product link",
  "Изменить": "Change",
  "Заменить фото": "Replace photo",
  "Распознать автомобиль": "Recognize vehicle",
  "Распознать колесный диск": "Recognize wheel",
  "Указать вручную": "Enter manually",
  "Изменить автомобиль": "Edit vehicle",
  "Изменить параметры": "Edit parameters",
  "Комплектация": "Vehicle version",
  "Изменить комплектацию": "Change vehicle version",
  "Выбрать комплектацию": "Choose vehicle version",
  "Требуется подтверждение": "Confirmation required",
  "Комплектация подтверждена": "Vehicle version confirmed",
  "Данные подтверждены": "Details confirmed",
  "Выберите комплектацию автомобиля": "Choose the vehicle version",
  "Уточните данные автомобиля": "Complete the vehicle details",
  "Уточните параметры колесного диска": "Complete the wheel parameters",
  "Данные готовы к проверке": "Details are ready for checking",
  "Выберите значение перед сохранением.": "Choose a value before saving.",
  "Требуется выбрать значение": "Value selection required",
  "Есть несохранённые изменения": "There are unsaved changes",
  "Готово к сохранению": "Ready to save",
  "Текущее значение": "Current value",
  "Значение": "Value",
  "из карточки товара": "from the product page",
  "Параметры подтверждены": "Parameters confirmed",
  "Параметры не заполнены": "Parameters are empty",
  "Не хватает параметров": "Parameters are missing",
  "Проверьте и подтвердите параметры": "Review and confirm parameters",
  "Подтвердите автомобиль и параметры диска.": "Confirm the vehicle and wheel parameters.",
  "Сохранить параметры": "Save parameters",
  "Выбрать другой SKU": "Choose another SKU",
  "Изменить идентификацию": "Edit wheel identity",
  "Скрыть идентификацию": "Hide wheel identity",
  "Одинаковые": "Same",
  "Разные": "Different",
  "Обе оси": "Both axles",
  "Передняя ось": "Front axle",
  "Задняя ось": "Rear axle",
  "Диаметр": "Diameter",
  "Ширина": "Width",
  "Не выбрано": "Not selected",
  "Предложено автоматически": "Automatically suggested",
  "Выбрать другое ▾": "Choose another ▾",
  "Все параметры подтверждены": "All parameters confirmed",
  "SKU относится к передней оси. Задние параметры подтверждаются отдельно.": "SKU applies to the front axle. Rear parameters are confirmed separately.",
  "Задние параметры сохранены в черновике до сохранения.": "Rear parameters are preserved in the draft until saving.",
  "Выбор SKU не подтверждает технические параметры": "Selecting a SKU does not confirm its technical parameters",
  "Выберите колесный диск": "Choose the wheel",
  "Отмена": "Cancel",
  "Проверить совместимость": "Check compatibility",
  "Проверить ещё раз": "Check again",
  "Повторить": "Retry",
  "Создать изображение": "Create image",
  "Техническая проверка": "Technical check",
  "Подходит": "Compatible",
  "Подходит с условиями": "Compatible with conditions",
  "Не подходит": "Incompatible",
  "Недостаточно данных для проверки": "Insufficient data for checking",
  "В базе недостаточно технических данных, чтобы определить совместимость этого диска с автомобилем.": "The database has insufficient technical data to determine whether this wheel is compatible with the vehicle.",
  "Результат больше не актуален": "The result is no longer current",
  "Данные автомобиля или колесного диска изменились.": "Vehicle or wheel parameters have changed.",
  "Подтверждённые данные сохранены.": "Confirmed details are preserved.",
  "Не удалось выполнить проверку": "Unable to complete the check",
  "Проверяем совместимость…": "Checking compatibility…",
  "Параметр": "Parameter",
  "Результат": "Result",
  "Параметры колёс": "Wheel parameters",
  "Параметры колесного диска": "Wheel parameters",
  "Нет данных": "No data",
  "Не определено": "Undetermined",
  "С условием": "With a condition",
  "Не совпадает": "Mismatch",
  "Обе оси — параметры совпадают": "Both axles — parameters match",
  "Закрыть": "Close",
  "Точное совпадение": "Exact match",
  "Похожие значения": "Similar values",
  "Рекомендуемые": "Recommended",
  "Значения": "Values",
  "Все значения": "All values",
  "Показать все значения": "Show all values",
  "Рекомендуемые значения": "Recommended values",
  "Изменить ссылку на товар": "Change product link",
  "Добавить ссылку на товар": "Add product link",
  "Определить параметры": "Resolve parameters",
  "Необязательно — попробуем получить модель и технические параметры со страницы.": "Optional — retrieve the model and technical parameters from the page.",
  "Подтвердить комплектацию": "Confirm vehicle version",
  "Выберите комплектацию": "Choose a vehicle version",
  "Выбрано": "Selected",
  "Выбрать": "Select",
  "Данные автомобиля": "Vehicle details",
  "Укажите автомобиль": "Enter vehicle details",
  "Марка": "Make",
  "Модель": "Model",
  "Год": "Year",
  "Бренд": "Brand",
  "Артикул": "SKU",
  "Сохранить автомобиль": "Save vehicle",
  "Подтвердить данные": "Confirm details",
  "Версия для рынка": "Market version",
  "Автомобиль и колесный диск": "Vehicle and wheel",
  "Источники и состояние данных": "Sources and data status",
  "Фото недоступно": "Photo unavailable",
  "Состояние параметров неизвестно": "Parameter status is unknown",
  "Закрыть выбор": "Close selection",
  "от −150 до +150": "from −150 to +150",
  " мм": " mm",
  "Нет описания": "No description",
  "Для покупки": "For purchase",
  "для задней оси": "for the rear axle",
  "для передней оси": "for the front axle",
  "Выбрать другое": "Choose another",
  "Фотография автомобиля": "Vehicle photograph",
  "Фотография колесного диска": "Wheel photograph",
  "Загружаем совместимость": "Loading compatibility",
  "Не удалось загрузить совместимость": "Unable to load compatibility",
  "Варианты комплектации": "Vehicle versions",
  "Параметры по осям": "Axle configuration",
  "Варианты колесного диска": "Wheel variants",
  "Источник колесного диска": "Wheel source",
  "Не удалось загрузить комплектации.": "Unable to load vehicle versions.",
  "Комплектации не найдены.": "Vehicle versions were not found.",
  "Загружаем комплектации автомобиля": "Loading vehicle versions",
  "Вернуться к выбору комплектации": "Return to vehicle version selection",
  "Проверьте числовые параметры диска.": "Check the numeric wheel parameters.",
  "Разрешите конфликты перед сохранением.": "Resolve conflicts before saving.",
  "найдено": "found",
  "Оставить": "Keep",
  "Передняя": "Front",
  "Задняя": "Rear",
  "Выбрать другое ET для передней оси": "Choose another ET for the front axle",
  "выбор": "selection",
  "Совпадает": "Matches",
  "Вариант": "Variant",
  "Недостаточно данных": "Insufficient data",
  "Конфликт значения": "Conflicting value",
  "Найдено несколько значений. Выберите одно.": "Several values were found. Select one.",
  "Предложения для поля марка": "Suggestions for make",
  "Предложения для поля модель": "Suggestions for model",
  "Предложения для поля год": "Suggestions for year",
  "Предложения для поля версия для рынка": "Suggestions for market version"
};

function localizeFitmentMarkup(markup, locale) {
  if (locale !== "en") return markup;
  const translate = text => {
    let value = text;
    for (const [ru, en] of Object.entries(fitmentEnglishCopy).sort((a,b) => b[0].length - a[0].length)) value = value.replaceAll(ru, en);
    return value.replace(/Осталось подтвердить (\d+) параметр(?:а|ов)?/g, "$1 parameters left to confirm").replaceAll("Предыдущий результат", "Previous result").replaceAll("Подтвердить предложение", "Confirm suggestion").replaceAll("Подтверждено", "Confirmed").replaceAll("Использовать", "Use").replaceAll("Поиск", "Search").replaceAll("Ручной ввод", "Manual input").replaceAll("Без округления", "Without rounding");
  };
  return markup.replace(/>([^<>]+)</g, (_,text) => `>${translate(text)}<`).replace(/(aria-label|placeholder|alt)="([^"]*)"/g, (_,attr,text) => `${attr}="${translate(text)}"`);
}
