import { copy as uiText, applicationLocale, localeOf } from "../copy.mjs";
import { createButton, createTextAction } from "../ui/primitives.js";

function imageStage(kind, file, callbacks, disabled, snapshot, locale = localeOf(snapshot)) {
  const article = document.createElement("article");
  article.className = `vnext-create__object vnext-create__object--${kind}`;
  const heading = document.createElement("div");
  heading.className = "vnext-create__object-heading";
  const label = document.createElement("p");
  label.className = "vnext-eyebrow";
  label.textContent = kind === "car" ? uiText("create.vehicle", locale) : uiText("wheel.label", snapshot.locale);
  const action = createTextAction({
    label: file ? uiText("create.replacePhoto", locale) : uiText("create.addPhoto", locale),
    onClick: () => callbacks.pickFile?.(kind),
  });
  action.disabled = Boolean(disabled);
  heading.append(label, action);

  const stage = document.createElement("button");
  stage.type = "button";
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
    label: snapshot.sourceEditing ? uiText("create.closeLink", localeOf(snapshot)) : snapshot.rimProductUrl ? uiText("create.changeProductLink", localeOf(snapshot)) : uiText("create.addProductLink", localeOf(snapshot)),
    variant: "secondary", disabled: snapshot.submitting,
    onClick: () => callbacks.setSourceEditing?.(!snapshot.sourceEditing),
  }));
  if (snapshot.rimProductUrl && !snapshot.sourceEditing) section.append(statusLine(uiText("create.linkSaved", localeOf(snapshot)), "positive"));
  if (snapshot.sourceEditing) section.append(sourceEditor(snapshot, callbacks));
  return section;
}

function sourceEditor(snapshot, callbacks) {
  const form = document.createElement("form");
  form.className = "vnext-create__source-form";
  form.noValidate = true;
  const field = document.createElement("label");
  field.className = "vnext-field";
  const caption = document.createElement("span");
  caption.textContent = uiText("create.productLink", localeOf(snapshot));
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
  helper.textContent = uiText("create.productLinkIsOptionalWeWillSaveItFor", localeOf(snapshot));
  form.append(helper);
  const cancel = createTextAction({ label: uiText("create.cancel", localeOf(snapshot)), onClick: () => callbacks.setSourceEditing?.(false) });
  cancel.disabled = Boolean(snapshot.submitting);
  form.append(save, cancel);
  return form;
}

export function createCreateView(snapshot = {}, callbacks = {}) {
  const page = document.createElement("section");
  page.className = "vnext-create";

  const pair = document.createElement("div");
  pair.className = "vnext-create__pair";
  pair.append(imageStage("car", snapshot.files?.car, callbacks, snapshot.submitting, snapshot, localeOf(snapshot)), imageStage("wheel", snapshot.files?.wheel, callbacks, snapshot.submitting, snapshot, localeOf(snapshot)));
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
    text.append(document.createTextNode(uiText("create.iConfirmMyRightToUseThesePhotosAnd", localeOf(snapshot))));
    const privacy = document.createElement("a");
    privacy.href = "https://legal.dreamwheels.pro/legal/privacy";
    privacy.target = "_blank";
    privacy.rel = "noopener noreferrer";
    privacy.textContent = uiText("create.privacyPolicy", localeOf(snapshot));
    const separator = document.createTextNode(" · ");
    const consentDocument = document.createElement("a");
    consentDocument.href = "https://legal.dreamwheels.pro/legal/consent";
    consentDocument.target = "_blank";
    consentDocument.rel = "noopener noreferrer";
    consentDocument.textContent = uiText("create.dataProcessingConsent", localeOf(snapshot));
    text.append(privacy, separator, consentDocument);
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
