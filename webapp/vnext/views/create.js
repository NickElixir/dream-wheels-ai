import { createButton, createTextAction } from "../ui/primitives.js";

const wheelFields = [
  ["brand", "Бренд"], ["model", "Модель"], ["sku", "Артикул"],
  ["wheel_diameter_in", "Диаметр"], ["wheel_width_j", "Ширина"], ["pcd", "PCD"],
  ["offset_et_mm", "ET"], ["center_bore_mm", "DIA"],
];

function appendFieldRow(list, label, value) {
  if (value === null || value === undefined || String(value).trim() === "") return;
  const row = document.createElement("div");
  row.className = "vnext-create__summary-row";
  const key = document.createElement("span");
  key.className = "vnext-create__summary-label";
  key.textContent = label;
  const result = document.createElement("strong");
  result.className = "vnext-create__summary-value";
  result.textContent = String(value);
  row.append(key, result);
  list.append(row);
}

function manualVehicleValid(form) {
  const values = Object.fromEntries([...form.querySelectorAll("input")].map((input) => [input.name, input.value.trim()]));
  if (!values.make || !values.model) return false;
  const year = Number(values.year) || null;
  const start = Number(values.year_start) || null;
  const end = Number(values.year_end) || null;
  return !(year && (start || end)) && !((start && !end) || (!start && end) || (start && end && start > end));
}

function imageStage(kind, file, callbacks, disabled) {
  const article = document.createElement("article");
  article.className = `vnext-create__object vnext-create__object--${kind}`;
  const heading = document.createElement("div");
  heading.className = "vnext-create__object-heading";
  const label = document.createElement("p");
  label.className = "vnext-eyebrow";
  label.textContent = kind === "car" ? "Автомобиль" : "Колесный диск";
  const action = createTextAction({
    label: file ? (kind === "car" ? "Заменить фото" : "Заменить фото") : "Добавить фото",
    onClick: () => callbacks.pickFile?.(kind),
  });
  action.disabled = Boolean(disabled);
  heading.append(label, action);

  const stage = document.createElement("button");
  stage.type = "button";
  stage.className = `vnext-create__stage${file ? " is-ready" : " is-empty"}`;
  stage.setAttribute("aria-label", file ? `Заменить фото: ${kind === "car" ? "автомобиль" : "колесный диск"}` : `Добавить фото: ${kind === "car" ? "автомобиль" : "колесный диск"}`);
  stage.disabled = Boolean(disabled);
  stage.addEventListener("click", () => callbacks.pickFile?.(kind));
  if (file?.previewUrl) {
    const image = document.createElement("img");
    image.src = file.previewUrl;
    image.alt = kind === "car" ? "Загруженный автомобиль" : "Загруженный колесный диск";
    stage.append(image);
  } else {
    const empty = document.createElement("span");
    empty.className = "vnext-create__empty-copy";
    empty.textContent = kind === "car" ? "Добавьте фото автомобиля" : "Добавьте фото диска";
    stage.append(empty);
  }

  const foot = document.createElement("div");
  foot.className = "vnext-create__object-foot";
  const status = document.createElement("span");
  status.textContent = file ? file.name : (kind === "car" ? "Фото автомобиля" : "Фото колесного диска");
  const size = document.createElement("span");
  size.textContent = file?.size ? `${(file.size / (1024 * 1024)).toFixed(1)} МБ` : "JPG, PNG или WebP";
  foot.append(status, size);
  article.append(heading, stage, foot);
  return article;
}

function statusLine(label, tone = "pending", detail = "") {
  const box = document.createElement("div");
  box.className = `vnext-create__status vnext-create__status--${tone}`;
  box.setAttribute("role", "status");
  const title = document.createElement("strong");
  title.textContent = label;
  box.append(title);
  if (detail) {
    const copy = document.createElement("span");
    copy.textContent = detail;
    box.append(copy);
  }
  return box;
}

function vehiclePanel(snapshot, callbacks) {
  const proposal = snapshot.proposal?.vehicle;
  if (!proposal) return null;
  const panel = document.createElement("section");
  panel.className = "vnext-create__summary-section";
  const head = document.createElement("div");
  head.className = "vnext-create__section-heading";
  const title = document.createElement("h2");
  title.textContent = "Автомобиль";
  const edit = createTextAction({ label: "Изменить данные", onClick: () => callbacks.setVehicleEditing?.(!snapshot.vehicleEditing) });
  head.append(title, edit);
  panel.append(head);

  const choices = Array.isArray(proposal.alternatives) ? [proposal.primary, ...proposal.alternatives].filter(Boolean).slice(0, 3) : [proposal.primary].filter(Boolean);
  if ((snapshot.manualVehicleMode && snapshot.vehicleEditing) || (!choices.length && !snapshot.selectedVehicle)) {
    const form = document.createElement("div");
    form.className = "vnext-create__manual-grid";
    [["make", "Марка"], ["model", "Модель"], ["year", "Год"], ["year_start", "Год от"], ["year_end", "Год до"]].forEach(([key, fieldLabel]) => {
      const field = document.createElement("label");
      field.className = "vnext-field";
      const caption = document.createElement("span");
      caption.textContent = fieldLabel;
      const input = document.createElement("input");
      input.value = snapshot.manualVehicle?.[key] || "";
      input.name = key;
      input.inputMode = key.startsWith("year") ? "numeric" : "text";
      input.addEventListener("input", () => { save.disabled = !manualVehicleValid(form); });
      field.append(caption, input);
      form.append(field);
    });
    const save = createButton({ label: "Сохранить", onClick: () => callbacks.saveManualVehicle?.(Object.fromEntries([...form.querySelectorAll("input")].map((input) => [input.name, input.value.trim()]))) });
    save.disabled = !manualVehicleValid(form);
    panel.append(form, save, createTextAction({ label: "Отмена", onClick: callbacks.cancelVehicleEditing }));
  } else if (snapshot.selectedVehicle && !snapshot.vehicleEditing) {
    const selected = snapshot.selectedVehicle;
    const fields = document.createElement("div");
    fields.className = "vnext-create__summary-list";
    appendFieldRow(fields, "Данные автомобиля", [selected.make, selected.model, selected.year || (selected.year_start && selected.year_end ? `${selected.year_start}–${selected.year_end}` : "")].filter(Boolean).join(" "));
    fields.children[0]?.append(edit);
    if (fields.children[0]) fields.children[0].className += " vnext-create__summary-row--action";
    panel.replaceChildren(fields);
  } else {
    const selectedIndex = snapshot.selectedVehicleIndex;
    const list = document.createElement("div");
    list.className = "vnext-create__vehicle-options";
    choices.forEach((candidate, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vnext-create__vehicle-option";
      if (index === selectedIndex) button.setAttribute("aria-pressed", "true");
      const name = document.createElement("strong");
      name.textContent = [candidate.make, candidate.model, candidate.year || (candidate.year_start && candidate.year_end ? `${candidate.year_start}–${candidate.year_end}` : "")].filter(Boolean).join(" ");
      const meta = document.createElement("span");
      const confidence = Number(candidate.confidence);
      meta.textContent = [candidate.source === "user_input" ? "Указано вручную" : (Number.isFinite(confidence) && confidence > 0 ? `Уверенность ${Math.round(confidence * 100)}%` : "Предложение по фото")].join("");
      button.append(name, meta);
      button.addEventListener("click", () => callbacks.chooseVehicle?.(index));
      list.append(button);
    });
    panel.append(list);
    if (selectedIndex === null) panel.append(statusLine("Подтвердите вариант автомобиля", "unknown"));
    if (snapshot.vehicleEditing) panel.append(createTextAction({ label: "Скрыть варианты", onClick: () => callbacks.setVehicleEditing?.(false) }));
    panel.append(createTextAction({ label: "Не подходит? Указать вручную", onClick: () => callbacks.setManualVehicleMode?.(true) }));
  }
  return panel;
}

function wheelSummary(snapshot, callbacks) {
  const rim = snapshot.proposal?.rim || {};
  const section = document.createElement("section");
  section.className = "vnext-create__summary-section";
  const sourceAction = createTextAction({
    label: snapshot.sourceEditing ? "Закрыть" : (snapshot.rimProductUrl ? "Изменить ссылку" : "Добавить ссылку"),
    onClick: () => callbacks.setSourceEditing?.(!snapshot.sourceEditing),
  });
  const rows = document.createElement("div");
  rows.className = "vnext-create__summary-list";
  const values = {
    brand: rim.brand,
    model: rim.model,
    sku: rim.sku || rim.article,
    wheel_diameter_in: rim.wheel_diameter_in ? `${rim.wheel_diameter_in}″` : "",
    wheel_width_j: rim.wheel_width_j ? `${rim.wheel_width_j}J` : "",
    pcd: rim.bolt_count && rim.pcd_mm ? `${rim.bolt_count}×${rim.pcd_mm}` : "",
    offset_et_mm: rim.offset_et_mm !== null && rim.offset_et_mm !== undefined ? `ET ${rim.offset_et_mm}` : "",
    center_bore_mm: rim.center_bore_mm ? `DIA ${rim.center_bore_mm}` : "",
  };
  appendFieldRow(rows, "Источник диска", snapshot.rimProductUrl || "Фото колесного диска");
  rows.children[0].append(sourceAction);
  rows.children[0].className += " vnext-create__summary-row--action";
  appendFieldRow(rows, "Параметры диска", wheelFields.map(([key]) => values[key]).filter(Boolean).join(" / "));
  section.append(rows);
  if (snapshot.sourceEditing) section.append(sourceEditor(snapshot, callbacks));
  return section;
}

function sourceEditor(snapshot, callbacks) {
  const form = document.createElement("form");
  form.className = "vnext-create__source-form";
  const field = document.createElement("label");
  field.className = "vnext-field";
  const caption = document.createElement("span");
  caption.textContent = "Ссылка на товар (необязательно)";
  const input = document.createElement("input");
  input.type = "url";
  input.name = "rim_product_url";
  input.inputMode = "url";
  input.autocomplete = "url";
  input.placeholder = "https://";
  input.value = snapshot.rimProductUrl || "";
  field.append(caption, input);
  const save = createButton({ label: "Сохранить ссылку", variant: "secondary", onClick: () => callbacks.saveRimProductUrl?.(input.value) });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    callbacks.saveRimProductUrl?.(input.value);
  });
  form.append(field, save, createTextAction({ label: "Отмена", onClick: () => callbacks.setSourceEditing?.(false) }));
  return form;
}

export function createCreateView(snapshot = {}, callbacks = {}) {
  const page = document.createElement("section");
  page.className = "vnext-create";

  const pair = document.createElement("div");
  pair.className = "vnext-create__pair";
  pair.append(imageStage("car", snapshot.files?.car, callbacks, snapshot.submitting || snapshot.identityResolving), imageStage("wheel", snapshot.files?.wheel, callbacks, snapshot.submitting || snapshot.identityResolving));
  page.append(pair);

  if (snapshot.bothReady && !snapshot.consentAccepted) {
    const consent = document.createElement("label");
    consent.className = "vnext-create__consent";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = false;
    checkbox.addEventListener("change", () => callbacks.setConsent?.(checkbox.checked));
    const text = document.createElement("span");
    text.append(document.createTextNode("Я подтверждаю право использовать эти фотографии и соглашаюсь на их обработку для создания примерки. "));
    const privacy = document.createElement("a");
    privacy.href = "https://legal.dreamwheels.pro/legal/privacy";
    privacy.target = "_blank";
    privacy.rel = "noopener noreferrer";
    privacy.textContent = "Политика конфиденциальности";
    const separator = document.createTextNode(" · ");
    const consentDocument = document.createElement("a");
    consentDocument.href = "https://legal.dreamwheels.pro/legal/consent";
    consentDocument.target = "_blank";
    consentDocument.rel = "noopener noreferrer";
    consentDocument.textContent = "Согласие на обработку данных";
    text.append(privacy, separator, consentDocument);
    consent.append(checkbox, text);
    page.append(consent);
  }

  if (snapshot.identityResolving) page.append(statusLine("Определяем автомобиль", "pending", "Анализируем загруженные фотографии."));
  if (snapshot.identityError) {
    const error = document.createElement("div");
    error.className = "vnext-create__error";
    error.append(statusLine(snapshot.identityError.title || "Не удалось определить автомобиль", "negative", snapshot.identityError.body || ""));
    if (snapshot.identityError.showPrimaryAction) error.append(createButton({ label: snapshot.identityError.primaryActionLabel, variant: "secondary", onClick: callbacks.handleIdentityError }));
    error.append(createButton({ label: snapshot.identityError.retryLabel || "Повторить", variant: "secondary", onClick: callbacks.retryIdentity }));
    page.append(error);
  }

  if (snapshot.proposal && !snapshot.identityResolving) {
    const summary = document.createElement("div");
    summary.className = "vnext-create__summary";
    const vehicle = vehiclePanel(snapshot, callbacks);
    if (vehicle) summary.append(vehicle);
    summary.append(wheelSummary(snapshot, callbacks));
    page.append(summary);
  } else if (snapshot.bothReady) {
    const source = document.createElement("section");
    source.className = "vnext-create__source-section";
    if (snapshot.rimProductUrl) appendFieldRow(source, "Ссылка на товар", snapshot.rimProductUrl);
    if (snapshot.sourceEditing) source.append(sourceEditor(snapshot, callbacks));
    else source.append(createTextAction({ label: snapshot.rimProductUrl ? "Изменить ссылку" : "Добавить ссылку", onClick: () => callbacks.setSourceEditing?.(true) }));
    page.append(source);
  }

  if (snapshot.submitting) page.append(statusLine(snapshot.renderStatus || "Создаём виртуальную примерку", "pending", "Это может занять до 90 секунд."));
  if (snapshot.renderError) {
    const error = document.createElement("div");
    error.className = "vnext-create__error";
    error.append(statusLine(snapshot.renderError, "negative"));
    error.append(createButton({ label: snapshot.renderErrorActionLabel || "Повторить", variant: "secondary", onClick: callbacks.handleGenerationError }));
    page.append(error);
  }

  const actions = document.createElement("div");
  actions.className = "vnext-create__actions";
  const hasIdentity = Boolean(snapshot.draftId && snapshot.selectedVehicle);
  const canStart = snapshot.bothReady && snapshot.consentAccepted && hasIdentity && !snapshot.submitting && !snapshot.identityResolving && !snapshot.vehicleEditing;
  let primaryAction = null;
  if (snapshot.proposal && !snapshot.identityResolving) {
    primaryAction = createButton({ label: "Создать изображение", onClick: callbacks.createImage, disabled: !canStart });
    actions.append(primaryAction);
  } else if (snapshot.bothReady && snapshot.consentAccepted && !snapshot.identityResolving) {
    actions.append(createButton({ label: "Определить автомобиль", onClick: callbacks.resolveIdentity }));
  }
  const fitmentReady = Boolean(snapshot.fitmentJobId && snapshot.resultUrl && hasIdentity && !snapshot.submitting);
  actions.append(createButton({ label: "Проверить совместимость", variant: "secondary", onClick: callbacks.checkCompatibility, disabled: !fitmentReady }));
  page.append(actions);
  return page;
}

export function refreshCreateView(current, snapshot, callbacks) {
  const values = new Map([...current.querySelectorAll("input[name]")].map((input) => [input.name, input.value]));
  const focused = document.activeElement;
  const focusName = current.contains(focused) ? focused.name : "";
  const selection = focusName ? [focused.selectionStart, focused.selectionEnd] : null;
  const next = createCreateView(snapshot, callbacks);
  current.replaceWith(next);
  for (const input of next.querySelectorAll("input[name]")) {
    if (values.has(input.name)) {
      input.value = values.get(input.name);
      input.dispatchEvent(new Event("input"));
    }
    if (input.name === focusName) {
      input.focus({ preventScroll: true });
      if (input.setSelectionRange && selection?.[0] !== null) {
        try { input.setSelectionRange(...selection); } catch { /* URL inputs do not expose text selection. */ }
      }
    }
  }
  return next;
}
