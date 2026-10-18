import { copy as uiText, applicationLocale, localeOf } from "../copy.mjs";
import { createButton } from "../ui/primitives.js";

function imageStage(kind, file, callbacks, disabled, snapshot, locale = localeOf(snapshot)) {
  const article = document.createElement("article");
  article.className = `vnext-create__object vnext-create__object--${kind}`;
  const heading = document.createElement("div");
  heading.className = "vnext-create__object-heading";
  const label = document.createElement("p");
  label.className = "vnext-eyebrow";
  label.textContent = kind === "car" ? uiText("create.vehicle", locale) : uiText("create.wheelHeading", locale);
  const action = createButton({
    variant: "secondary",
    label: file ? uiText("create.replacePhoto", locale) : uiText("create.addPhoto", locale),
    onClick: () => callbacks.pickFile?.(kind),
  });
  action.dataset.createFocus = `photo-${kind}`;
  action.disabled = Boolean(disabled);
  heading.append(label, action);

  const stage = document.createElement("button");
  stage.type = "button";
  stage.dataset.createFocus = `stage-${kind}`;
  stage.className = `vnext-create__stage${file ? " is-ready" : " is-empty"}`;
  stage.setAttribute("aria-label", file ? uiText("create.photo.replaceAria", locale, { value0: kind === "car" ? uiText("create.vehicle2", locale) : uiText("wheel.object", snapshot.locale) }) : uiText("create.photo.addAria", locale, { value0: kind === "car" ? uiText("create.vehicle2", locale) : uiText("wheel.object", snapshot.locale) }));
  stage.disabled = Boolean(disabled);
  stage.addEventListener("click", () => callbacks.pickFile?.(kind));
  if (file?.previewUrl) {
    const image = document.createElement("img");
    image.src = file.previewUrl;
    image.alt = kind === "car" ? uiText("create.uploadedVehicle", locale) : uiText("wheel.uploaded", snapshot.locale);
    stage.append(image);
  } else {
    const empty = document.createElement("span");
    empty.className = "vnext-create__empty-copy";
    empty.textContent = kind === "car" ? uiText("create.addACarPhoto", locale) : uiText("create.addAWheelPhoto", locale);
    stage.append(empty);
  }

  const foot = document.createElement("div");
  foot.className = "vnext-create__object-foot";
  const status = document.createElement("span");
  status.textContent = file
    ? (kind === "car" ? uiText("create.carPhotoAdded", locale) : uiText("wheel.photoAdded", snapshot.locale))
    : (kind === "car" ? uiText("create.vehiclePhoto", locale) : uiText("wheel.photo", snapshot.locale));
  foot.append(status);
  article.append(heading, stage);
  if (!file) article.append(foot);

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

function sourceEditor(snapshot, callbacks) {
  const form = document.createElement("form");
  form.className = "vnext-create__source-form";
  form.noValidate = true;
  const field = document.createElement("label");
  field.className = "vnext-field";
  const caption = document.createElement("span");
  caption.textContent = uiText("create.wheelProductLink", localeOf(snapshot));
  const input = document.createElement("input");
  input.type = "url";
  input.name = "rim_product_url";
  input.inputMode = "url";
  input.autocomplete = "url";
  input.placeholder = "https://";
  input.value = snapshot.rimProductUrl || "";
  input.setAttribute("aria-invalid", String(Boolean(snapshot.productUrlError)));
  field.append(caption, input);
  const save = createButton({ label: uiText("create.saveLink", localeOf(snapshot)), variant: "secondary", onClick: () => callbacks.saveRimProductUrl?.(input.value), disabled: snapshot.submitting });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    callbacks.saveRimProductUrl?.(input.value);
  });
  form.append(field);
  if (snapshot.productUrlError) {
    const error = document.createElement("p");
    error.className = "vnext-create__source-helper";
    error.setAttribute("role", "alert");
    error.id = "create-product-url-error";
    error.textContent = snapshot.productUrlError;
    input.setAttribute("aria-describedby", error.id);
    form.append(error);
  }
  const helper = document.createElement("p");
  helper.className = "vnext-create__source-helper";
  helper.textContent = uiText("create.wheelProductLinkHint", localeOf(snapshot));
  form.append(helper);
  save.dataset.createFocus = "save-link";
  form.append(save);
  if (snapshot.rimProductUrl && !snapshot.productUrlError) {
    const saved = statusLine(uiText("create.linkSaved", localeOf(snapshot)), "positive");
    input.addEventListener("input", () => { saved.hidden = input.value !== (snapshot.rimProductUrl || ""); });
    saved.hidden = input.value !== (snapshot.rimProductUrl || "");
    form.append(saved);
  }
  return form;
}

export function createCreateView(snapshot = {}, callbacks = {}) {
  const page = document.createElement("section");
  page.className = "vnext-create";

  const pair = document.createElement("div");
  pair.className = "vnext-create__pair";
  pair.append(imageStage("car", snapshot.files?.car, callbacks, snapshot.submitting, snapshot, localeOf(snapshot)), imageStage("wheel", snapshot.files?.wheel, callbacks, snapshot.submitting, snapshot, localeOf(snapshot)));
  page.append(pair, sourceEditor(snapshot, callbacks));

  if (snapshot.bothReady) {
    const consent = document.createElement("label");
    consent.className = "vnext-create__consent";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.createFocus = "consent";
    checkbox.checked = Boolean(snapshot.consentAccepted);
    checkbox.disabled = Boolean(snapshot.submitting);
    checkbox.addEventListener("change", () => callbacks.setConsent?.(checkbox.checked));
    const text = document.createElement("span");
    text.append(document.createTextNode(uiText("create.iConfirmMyRightToUseThesePhotosAnd", localeOf(snapshot))));
    const privacy = document.createElement("a");
    privacy.href = "https://legal.dreamwheels.pro/legal/privacy";
    privacy.target = "_blank";
    privacy.rel = "noopener noreferrer";
    privacy.textContent = uiText("create.privacyPolicy", localeOf(snapshot));
    const consentDocument = document.createElement("a");
    consentDocument.href = "https://legal.dreamwheels.pro/legal/consent";
    consentDocument.target = "_blank";
    consentDocument.rel = "noopener noreferrer";
    consentDocument.textContent = uiText("create.dataProcessingConsent", localeOf(snapshot));
    const documents = document.createElement("ul");
    documents.className = "vnext-create__consent-documents";
    for (const link of [privacy, consentDocument]) {
      const item = document.createElement("li");
      item.append(link);
      documents.append(item);
    }
    text.append(documents);
    consent.append(checkbox, text);
    page.append(consent);
  }

  if (snapshot.submitting) page.append(statusLine(snapshot.renderStatus || uiText("page.renderProcessing", localeOf(snapshot)), "pending", uiText("create.thisMayTakeUpToSeconds", localeOf(snapshot))));
  if (snapshot.renderError) {
    const error = document.createElement("div");
    error.className = "vnext-create__error";
    error.append(statusLine(snapshot.renderError, "negative"));
    error.append(createButton({ label: snapshot.renderErrorActionLabel || uiText("create.retry", localeOf(snapshot)), variant: "secondary", onClick: callbacks.handleGenerationError }));
    page.append(error);
  }

  const actions = document.createElement("div");
  actions.className = "vnext-create__actions";
  const reason = !snapshot.files?.car ? uiText("create.addACarPhoto", localeOf(snapshot))
    : !snapshot.files?.wheel ? uiText("create.addAWheelPhoto", localeOf(snapshot))
    : !snapshot.consentAccepted ? uiText("create.confirmConsentToProcessThePhotos", localeOf(snapshot)) : "";
  actions.append(createButton({ label: uiText("create.createImage", localeOf(snapshot)), onClick: callbacks.createImage, disabled: Boolean(reason || snapshot.submitting) }));
  if (reason) {
    const hint = document.createElement("p");
    hint.className = "vnext-create__source-helper";
    hint.setAttribute("role", "status");
    hint.textContent = reason;
    actions.append(hint);
  }
  page.append(actions);

  return page;
}

export function refreshCreateView(current, snapshot, callbacks, locale = applicationLocale()) {
  const values = new Map([...current.querySelectorAll("input[name]")].map((input) => [input.name, input.value]));
  const focused = document.activeElement;
  const focusName = current.contains(focused) ? focused.name : "";
  const focusKey = current.contains(focused) ? focused.dataset?.createFocus : "";
  const selection = focusName ? [focused.selectionStart, focused.selectionEnd] : null;
  const next = createCreateView(snapshot, callbacks);
  current.replaceWith(next);
  for (const input of next.querySelectorAll("input[name]")) {
    if (values.has(input.name)) {
      input.value = values.get(input.name);
      const saved = next.querySelector(".vnext-create__status--positive");
      if (saved && input.name === "rim_product_url") saved.hidden = input.value !== (snapshot.rimProductUrl || "");
    }
    if (input.name === focusName) {
      input.focus({ preventScroll: true });
      if (input.setSelectionRange && selection?.[0] !== null) {
        try { input.setSelectionRange(...selection); } catch { /* URL inputs do not expose text selection. */ }
      }
    }
  }
  if (focusKey) next.querySelector(`[data-create-focus="${focusKey}"]:not(:disabled)`)?.focus({ preventScroll: true });
  return next;
}
