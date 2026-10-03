import { createButton, createTextAction } from "../ui/primitives.js";

function imageStage(kind, file, callbacks, disabled, snapshot) {
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
  status.textContent = file
    ? (kind === "car" ? "Фото автомобиля добавлено" : "Фото колесного диска добавлено")
    : (kind === "car" ? "Фото автомобиля" : "Фото колесного диска");
  foot.append(status);
  article.append(heading, stage, foot);
  if (kind === "wheel") article.append(wheelSummary(snapshot, callbacks));
  return article;
}

function statusLine(label, tone = "pending", detail = "") {
  const box = document.createElement("div");
  box.className = `vnext-create__status vnext-create__status--${tone}`;
  box.setAttribute("role", "status");
  if (tone === "pending") {
    const spinner = document.createElement("span");
    spinner.className = "vnext-spinner";
    spinner.setAttribute("aria-hidden", "true");
    box.append(spinner);
  }
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

function wheelSummary(snapshot, callbacks) {
  const section = document.createElement("div");
  section.className = "vnext-create__wheel-details";
  section.append(createButton({
    label: snapshot.sourceEditing ? "Закрыть ссылку" : snapshot.rimProductUrl ? "Изменить ссылку на товар" : "Добавить ссылку на товар",
    variant: "secondary", disabled: snapshot.submitting,
    onClick: () => callbacks.setSourceEditing?.(!snapshot.sourceEditing),
  }));
  if (snapshot.rimProductUrl && !snapshot.sourceEditing) section.append(statusLine("Ссылка сохранена", "positive"));
  if (snapshot.sourceEditing) section.append(sourceEditor(snapshot, callbacks));
  return section;
}

function sourceEditor(snapshot, callbacks) {
  const form = document.createElement("form");
  form.className = "vnext-create__source-form";
  const field = document.createElement("label");
  field.className = "vnext-field";
  const caption = document.createElement("span");
  caption.textContent = "Ссылка на товар";
  const input = document.createElement("input");
  input.type = "url";
  input.name = "rim_product_url";
  input.inputMode = "url";
  input.autocomplete = "url";
  input.placeholder = "https://";
  input.value = snapshot.rimProductUrl || "";
  field.append(caption, input);
  const save = createButton({ label: "Сохранить ссылку", variant: "secondary", onClick: () => callbacks.saveRimProductUrl?.(input.value), disabled: snapshot.submitting });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    callbacks.saveRimProductUrl?.(input.value);
  });
  form.append(field);
  const helper = document.createElement("p");
  helper.className = "vnext-create__source-helper";
  helper.textContent = "Ссылка на товар — необязательно. Сохраним её для последующей проверки совместимости.";
  form.append(helper);
  const cancel = createTextAction({ label: "Отмена", onClick: () => callbacks.setSourceEditing?.(false) });
  cancel.disabled = Boolean(snapshot.submitting);
  form.append(save, cancel);
  return form;
}

export function createCreateView(snapshot = {}, callbacks = {}) {
  const page = document.createElement("section");
  page.className = "vnext-create";

  const pair = document.createElement("div");
  pair.className = "vnext-create__pair";
  pair.append(imageStage("car", snapshot.files?.car, callbacks, snapshot.submitting, snapshot), imageStage("wheel", snapshot.files?.wheel, callbacks, snapshot.submitting, snapshot));
  page.append(pair);

  if (snapshot.bothReady) {
    const consent = document.createElement("label");
    consent.className = "vnext-create__consent";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(snapshot.consentAccepted);
    checkbox.disabled = Boolean(snapshot.submitting);
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
  const reason = !snapshot.files?.car ? "Добавьте фото автомобиля"
    : !snapshot.files?.wheel ? "Добавьте фото диска"
    : !snapshot.consentAccepted ? "Подтвердите согласие на обработку фотографий" : "";
  actions.append(createButton({ label: "Создать изображение", onClick: callbacks.createImage, disabled: Boolean(reason || snapshot.submitting) }));
  if (reason) {
    const hint = document.createElement("p");
    hint.className = "vnext-create__source-helper";
    hint.setAttribute("role", "status");
    hint.textContent = reason;
    actions.append(hint);
  }
  page.append(actions);
  if (snapshot.locale === "en") {
    const translations = {
      "Автомобиль": "Car", "Колесный диск": "Wheel", "Добавить фото": "Add photo",
      "Заменить фото": "Replace photo", "Фото автомобиля": "Car photo", "Фото колесного диска": "Wheel photo",
      "Фото автомобиля добавлено": "Car photo added", "Фото колесного диска добавлено": "Wheel photo added",
      "Добавьте фото автомобиля": "Add a car photo", "Добавьте фото диска": "Add a wheel photo",
      "Создать изображение": "Create image", "Подтвердите согласие на обработку фотографий": "Confirm consent to process the photos",
      "Добавить ссылку на товар": "Add product link", "Изменить ссылку на товар": "Edit product link",
      "Закрыть ссылку": "Close link", "Ссылка на товар": "Product link", "Сохранить ссылку": "Save link",
      "Ссылка сохранена": "Link saved", "Отмена": "Cancel",
      "Ссылка на товар — необязательно. Сохраним её для последующей проверки совместимости.": "Product link is optional. We will save it for a later compatibility check.",
      "Политика конфиденциальности": "Privacy policy", "Согласие на обработку данных": "Data processing consent",
      "Я подтверждаю право использовать эти фотографии и соглашаюсь на их обработку для создания примерки. ": "I confirm my right to use these photos and consent to processing them for a visual try-on. ",
      "Создаём виртуальную примерку": "Creating a visual try-on", "Это может занять до 90 секунд.": "This may take up to 90 seconds.",
    };
    const visit = (node) => {
      if ((node.nodeType === 3 || !node.childNodes.length) && translations[node.textContent]) node.textContent = translations[node.textContent];
      for (const child of node.childNodes) visit(child);
    };
    visit(page);
  }
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
