import { copy as uiText, applicationLocale, localeOf } from "../copy.mjs";
import { createButton } from "../ui/primitives.js";

const sourceInputState = new WeakMap();
const createViewOwner = new WeakMap();

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
  input.disabled = Boolean(snapshot.draftBlocked);
  const inputState = { savedValue: input.value, edited: false, wheel: snapshot.wheelReplacementToken };
  sourceInputState.set(input, inputState);
  input.addEventListener("input", () => {
    inputState.edited = true;
    const saved = form.querySelector(".vnext-create__status--positive");
    if (saved) saved.hidden = input.value !== inputState.savedValue;
  });
  input.setAttribute("aria-invalid", String(Boolean(snapshot.productUrlError)));
  field.append(caption, input);
  const save = createButton({ label: uiText("create.saveLink", localeOf(snapshot)), variant: "secondary", onClick: () => callbacks.saveRimProductUrl?.(input.value), disabled: snapshot.submitting || snapshot.draftBlocked });
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
    saved.hidden = input.value !== (snapshot.rimProductUrl || "");
    form.append(saved);
  }
  return form;
}

function catalogNotice(snapshot, callbacks) {
  const handoff = snapshot.catalogHandoff || {};
  if (!handoff.selection && !handoff.error) return null;
  const locale = localeOf(snapshot);
  const warning = Boolean(handoff.error && !handoff.busy);
  const box = document.createElement("section");
  box.className = `vnext-create__catalog-notice${warning ? " is-warning" : ""}`;
  box.dataset.createFocus = "catalog-status";
  box.tabIndex = -1;
  box.setAttribute("role", "region");
  box.setAttribute("aria-labelledby", "catalog-replace-title");
  box.setAttribute("aria-busy", String(Boolean(handoff.busy)));
  const details = document.createElement("div");
  details.className = "vnext-create__catalog-copy";
  const title = document.createElement("h2");
  title.id = "catalog-replace-title";
  const errorTitle = handoff.error === "storage" ? "create.catalog.saveErrorTitle" : handoff.error === "invalid" ? "create.catalog.restoreErrorTitle" : "create.catalog.errorTitle";
  title.textContent = uiText(handoff.busy ? "create.catalog.loading" : warning ? errorTitle : "create.catalog.replaceTitle", locale);
  if (warning) {
    title.className = "vnext-create__catalog-warning-title";
    const icon = document.createElement("span");
    icon.className = "vnext-create__catalog-warning-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v.1"/></svg>';
    title.append(icon);
  }
  if (!warning) details.append(title);
  if (handoff.selection) {
    const image = document.createElement("img");
    image.src = handoff.selection.thumbnail;
    image.alt = handoff.selection.name;
    image.width = image.height = 76;
    box.append(image);
    const name = document.createElement("p");
    name.className = "vnext-create__catalog-name";
    const modelLabel = document.createElement("strong");
    modelLabel.textContent = uiText("create.catalog.modelLabel", locale);
    name.append(modelLabel, document.createTextNode(` ${handoff.selection.name}`));
    const sku = document.createElement("p");
    sku.className = "vnext-create__catalog-sku";
    const skuLabel = document.createElement("strong");
    skuLabel.textContent = uiText("create.catalog.sku", locale, { value0: "" }).trim();
    sku.append(skuLabel, document.createTextNode(` ${handoff.selection.sku.sku}`));
    const description = document.createElement("p");
    description.textContent = uiText("create.catalog.description", locale);
    details.append(name, sku);
    if (!warning) details.append(description);
  }
  if (warning) details.append(title);
  if (handoff.error) {
    const error = document.createElement("p");
    error.setAttribute("role", "alert");
    error.textContent = uiText(`create.catalog.${handoff.error}`, locale);
    details.append(error);
  }
  box.append(details);
  if (handoff.selection) {
    const actions = document.createElement("div");
    actions.className = "vnext-create__catalog-actions";
    const replace = createButton({ label: uiText(warning ? handoff.error === "storage" ? "create.catalog.retrySave" : "create.catalog.retry" : "create.catalog.replace", locale), disabled: handoff.busy || snapshot.submitting || snapshot.draftBlocked, onClick: callbacks.acceptCatalogWheel });
    replace.dataset.createFocus = "catalog-replace";
    const keep = createButton({ label: uiText("create.catalog.keep", locale), variant: "secondary", disabled: handoff.busy || snapshot.submitting || snapshot.draftBlocked, onClick: callbacks.keepCurrentWheel });
    keep.dataset.createFocus = "catalog-keep";
    actions.append(replace, keep);
    box.append(actions);
  }
  return box;
}

function accountDraftNotice(snapshot, callbacks) {
  const locale = localeOf(snapshot);
  if (!snapshot.draftLoading && !snapshot.draftError && !snapshot.legacyDraftAvailable && !snapshot.legacyDraftBusy) return null;
  const box = document.createElement("section");
  box.className = "vnext-create__draft-notice";
  box.setAttribute("role", snapshot.draftError || snapshot.legacyDraftError ? "alert" : "status");
  box.tabIndex = -1;
  box.dataset.createFocus = "draft-status";
  const title = document.createElement("strong");
  title.textContent = uiText(snapshot.draftLoading ? "create.draft.loading" : snapshot.draftError ? snapshot.draftError === "blocked" ? "create.draft.blocked" : "create.draft.error" : "create.draft.legacyTitle", locale);
  box.append(title);
  if (snapshot.draftLoading) return box;
  const actions = document.createElement("div");
  actions.className = "vnext-create__draft-actions";
  if (snapshot.draftError) {
    const retry = createButton({ label: uiText("create.draft.retry", locale), variant: "secondary", onClick: callbacks.retryAccountDraft });
    retry.dataset.createFocus = "draft-retry";
    actions.append(retry);
  } else {
    const body = document.createElement("p");
    body.textContent = uiText("create.draft.legacyBody", locale);
    box.append(body);
    if (snapshot.legacyDraftError) {
      const error = document.createElement("p");
      error.textContent = uiText("create.draft.legacyError", locale);
      box.append(error);
    }
    const restore = createButton({ label: uiText(snapshot.legacyDraftBusy ? "create.draft.busy" : "create.draft.restore", locale), disabled: snapshot.legacyDraftBusy, onClick: callbacks.restoreLegacyDraft });
    restore.dataset.createFocus = "draft-restore";
    const dismiss = createButton({ label: uiText("create.draft.dismiss", locale), variant: "secondary", disabled: snapshot.legacyDraftBusy, onClick: callbacks.dismissLegacyDraft });
    dismiss.dataset.createFocus = "draft-dismiss";
    actions.append(restore, dismiss);
  }
  box.append(actions);
  return box;
}

export function createCreateView(snapshot = {}, callbacks = {}) {
  const page = document.createElement("section");
  page.className = "vnext-create";
  createViewOwner.set(page, snapshot.draftOwnerKey);

  const draftNotice = accountDraftNotice(snapshot, callbacks);
  if (draftNotice) page.append(draftNotice);
  const pair = document.createElement("div");
  pair.className = "vnext-create__pair";
  const notice = catalogNotice(snapshot, callbacks);
  if (notice) pair.append(notice);
  const disabled = snapshot.submitting || snapshot.catalogHandoff?.busy || snapshot.draftBlocked;
  const car = imageStage("car", snapshot.files?.car, callbacks, disabled, snapshot, localeOf(snapshot));
  const wheel = imageStage("wheel", snapshot.files?.wheel, callbacks, disabled, snapshot, localeOf(snapshot));
  if (snapshot.catalogWheel) {
    const label = document.createElement("p");
    label.className = "vnext-create__catalog-selected";
    label.textContent = `${snapshot.catalogWheel.name} — ${uiText("create.catalog.sku", localeOf(snapshot), { value0: snapshot.catalogWheel.sku.sku })}`;
    wheel.append(label);
  }
  pair.append(car, wheel);
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
  const reason = snapshot.catalogHandoff?.selection || snapshot.catalogHandoff?.busy ? uiText("create.catalog.resolve", localeOf(snapshot)) : !snapshot.files?.car ? uiText("create.addACarPhoto", localeOf(snapshot))
    : !snapshot.files?.wheel ? uiText("create.addAWheelPhoto", localeOf(snapshot))
    : !snapshot.consentAccepted ? uiText("create.confirmConsentToProcessThePhotos", localeOf(snapshot)) : "";
  actions.append(createButton({ label: uiText("create.createImage", localeOf(snapshot)), onClick: callbacks.createImage, disabled: Boolean(reason || snapshot.submitting || snapshot.draftBlocked) }));
  if (reason && snapshot.files?.car) {
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
  const sameOwner = createViewOwner.get(current) === snapshot.draftOwnerKey;
  const values = new Map([...current.querySelectorAll("input[name]")]
    .filter((input) => {
      const state = sourceInputState.get(input);
      if (!sameOwner || (state && state.wheel !== snapshot.wheelReplacementToken)) return false;
      return !state || state.edited || input.value !== state.savedValue;
    })
    .map((input) => [input.name, { value: input.value, savedValue: sourceInputState.get(input)?.savedValue }]));
  const focused = document.activeElement;
  const focusName = sameOwner && current.contains(focused) ? focused.name : "";
  const focusKey = current.contains(focused) && createViewOwner.get(current) === snapshot.draftOwnerKey ? focused.dataset?.createFocus : "";
  const selection = focusName ? [focused.selectionStart, focused.selectionEnd] : null;
  const next = createCreateView(snapshot, callbacks);
  current.replaceWith(next);
  for (const input of next.querySelectorAll("input[name]")) {
    if (values.has(input.name)) {
      const previous = values.get(input.name);
      input.value = previous.value;
      const state = sourceInputState.get(input);
      // An unchanged empty snapshot must not erase an intentional clear before hydration.
      if (state) state.edited = input.value !== state.savedValue || previous.savedValue === state.savedValue;
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
  if (focusKey) {
    const preferred = focusKey === "catalog-status" && !snapshot.catalogHandoff?.busy ? "catalog-replace" : focusKey;
    const target = next.querySelector(`[data-create-focus="${preferred}"]:not(:disabled)`)
      || (focusKey.startsWith("draft-") ? next.querySelector('[data-create-focus="draft-status"]') || next.querySelector('[data-create-focus="photo-car"]:not(:disabled)') : null)
      || (focusKey.startsWith("catalog-") ? next.querySelector('[data-create-focus="catalog-status"]') || next.querySelector('[data-create-focus="photo-wheel"]:not(:disabled)') : null);
    target?.focus({ preventScroll: true });
  }
  return next;
}
