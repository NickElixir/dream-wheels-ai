import { copy as uiText, applicationLocale, localeOf } from "../copy.mjs";
// These views receive runtime snapshots. They never fetch, poll or persist jobs.
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const button = (label, action, { primary = false, tertiary = false, text = false, disabled = false, jobId = "", value = "", selected = false, tone = "" } = {}) => {
  const variant = primary ? "primary" : tertiary ? "tertiary" : text ? "text" : "secondary";
  const icon = action === "download" ? '<svg class="vnext-render-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 2.5v7m0 0 2.5-2.5M8 9.5 5.5 7M3 11.5v2h10v-2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "";
  return `<button type="button" class="vnext-button vnext-button--${variant} ${selected ? `is-selected-${tone || "neutral"}` : ""}" data-render-action="${action}" data-job="${esc(jobId)}" data-value="${esc(value)}" ${disabled ? "disabled" : ""} ${selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${icon}${esc(label)}</button>`;
};
const media = (url, alt, jobId = "", kind = "result", failed = false, loading = false, copy = null, locale = applicationLocale()) => `<div class="vnext-render-media">${url && !failed ? `<img src="${esc(url)}" alt="${esc(alt)}" data-render-image="${kind}" data-job="${esc(jobId)}">` : `<span role="status">${esc(loading ? copy?.loadingImage || uiText("render.loadingImage", locale) : copy?.assetUnavailable || uiText("render.imageTemporarilyUnavailable", locale))}</span>`}</div>`;

export function failedMarkup(model) {
  const copy = model.failureCopy || {};
  const original = model.originalUrl || model.carUrl;
  const source = original && !model.originalFailed
    ? `<img src="${esc(original)}" alt="${esc(copy.sourcePhoto)}" data-render-image="original" data-job="${esc(model.jobId)}">`
    : `<span>${esc(copy.sourceUnavailable)}</span>`;
  return `<section class="vnext-render-failed" role="status"><div class="vnext-render-failed-source">${source}</div><div><span class="vnext-status vnext-status--negative">${esc(copy.failedBadge)}</span><h2>${esc(copy.generationFailed)}</h2>${model.billingMessage ? `<p>${esc(model.billingMessage)}</p>` : ""}${button(copy.retry, model.retryAction || "retry-create", { primary: true })}</div></section>`;
}

export function processingMarkup(model) {
  if (model.status === "failed") return failedMarkup(model);
  if (model.error) {
    const vehicle = model.title ? `<section class="vnext-generation-meta"><h3>${model.vehicleConfirmed ? uiText("create.vehicle", localeOf(model)) : uiText("render.tryOn", localeOf(model))}</h3><p class="vnext-generation-value">${esc(model.title)}</p></section>` : "";
    const wheel = model.rimName || model.specs || model.wheelUrl ? `<section class="vnext-generation-meta"><h3>${esc(uiText("wheel.label", localeOf(model)))}</h3><div class="vnext-generation-wheel">${model.wheelUrl ? `<div class="vnext-generation-wheel-thumb">${media(model.wheelUrl, uiText("wheel.selectedPhoto", localeOf(model)), undefined, undefined, undefined, undefined, undefined, localeOf(model))}</div>` : ""}<div class="vnext-generation-wheel-copy">${model.rimName ? `<p class="vnext-generation-value">${esc(model.rimName)}</p>` : ""}${model.specs ? `<p class="vnext-generation-specs">${esc(model.specs)}</p>` : ""}</div></div></section>` : "";
    const hasCar = Boolean(model.carUrl);
    return `<section class="vnext-generation-error${hasCar ? "" : " vnext-generation-error--no-car"}" role="status"><div class="vnext-generation-media">${hasCar ? media(model.carUrl, uiText("create.vehiclePhoto", localeOf(model)), undefined, undefined, undefined, undefined, undefined, localeOf(model)) : ""}</div><aside class="vnext-generation-aside"><div class="vnext-generation-copy"><p class="vnext-eyebrow">${esc(uiText("render.generation", localeOf(model)))}</p><h2>${esc(model.error.title)}</h2><p>${esc(model.error.copy)}</p></div>${vehicle}${wheel}<div class="vnext-generation-actions">${button(model.error.actionLabel, "generation-retry", { primary: true })}${model.error.showSupport ? button(uiText("nav.support", localeOf(model)), "support", { text: true }) : ""}</div></aside></section>`;
  }
  return `<section class="vnext-render-intro"><p class="vnext-eyebrow">${model.status === "queued" ? uiText("render.queued", localeOf(model)) : uiText("render.processing", localeOf(model))}</p><h2>${esc(uiText("page.renderProcessing", localeOf(model)))}</h2><p>${esc(uiText("render.processing.resultAfterProcessing", localeOf(model)))}</p></section><div class="vnext-processing-layout"><section class="vnext-processing-card">${media(model.carUrl, uiText("render.originalVehiclePhoto", localeOf(model)), undefined, undefined, undefined, undefined, undefined, localeOf(model))}<div class="vnext-processing-status" role="status"><span class="vnext-spinner" aria-hidden="true"></span><div><strong>${model.status === "queued" ? uiText("render.tryOnQueued", localeOf(model)) : uiText("render.generatingRender", localeOf(model))}</strong><p>${esc(uiText("render.thisCanTakeUpToSeconds", localeOf(model)))}</p></div></div></section><aside class="vnext-processing-aside"><p class="vnext-eyebrow">${esc(uiText("fitment.selected", localeOf(model)))}</p><div class="vnext-render-object">${esc(model.title)}</div>${model.rimName ? `<p class="vnext-processing-wheel-name">${esc(model.rimName)}</p>` : ""}${model.specs ? `<p class="vnext-processing-wheel-specs">${esc(model.specs)}</p>` : ""}${media(model.wheelUrl, uiText("wheel.label", localeOf(model)), undefined, undefined, undefined, undefined, undefined, localeOf(model))}<div class="vnext-render-actions">${button(uiText("nav.history", localeOf(model)), "history")}</div></aside></div>`;
}

export function resultMarkup(model) {
  if (!model.jobId) return `<section class="vnext-system-card" role="status"><h2>${esc(model.loading ? uiText("render.loadingTryOn", localeOf(model)) : model.error || uiText("render.tryOnNotFound", localeOf(model)))}</h2>${button(uiText("render.backToMyTryOns", localeOf(model)), "history")}</section>`;
  if (model.status !== "completed") return processingMarkup(model);
  const feedback = model.feedback || {};
  const resultUnavailable = (!model.resultUrl || model.resultFailed) && !model.resultLoading;
  const unavailable = `<div class="vnext-render-asset-unavailable" role="status"><h2>${esc(model.failureCopy?.assetUnavailable)}</h2>${model.originalUrl && !model.originalFailed ? `<img src="${esc(model.originalUrl)}" alt="${esc(model.failureCopy?.sourcePhoto)}" data-render-image="original" data-job="${esc(model.jobId)}">` : ""}</div>`;
  return `<div class="vnext-result-layout">${resultUnavailable ? unavailable : `<div class="vnext-compare" data-compare>
    <div class="vnext-compare-layer">${media(model.resultUrl, uiText("dashboard.aiRender", localeOf(model)), model.jobId, "result", model.resultFailed, model.resultLoading, model.failureCopy, localeOf(model))}</div>
    <div class="vnext-compare-layer vnext-compare-reveal">${media(model.originalUrl, uiText("render.originalPhoto", localeOf(model)), model.jobId, "original", model.originalFailed, model.originalLoading, model.failureCopy, localeOf(model))}</div>
    <span class="vnext-compare-label left">${esc(uiText("render.original", localeOf(model)))}</span><span class="vnext-compare-label right">${esc(uiText("page.renderResult", localeOf(model)))}</span><div class="vnext-compare-divider"></div><div class="vnext-compare-handle" aria-hidden="true">↔</div>
    <input class="vnext-compare-range" type="range" min="0" max="100" value="50" aria-label="${esc(uiText("render.compare.aria", localeOf(model)))}" ${!model.originalUrl || model.originalFailed || !model.resultUrl || model.resultFailed ? "disabled" : ""}>
  </div>`}<aside class="vnext-result-aside">${model.title ? `<section class="vnext-result-meta"><h3>${model.vehicleConfirmed ? uiText("create.vehicle", localeOf(model)) : uiText("render.tryOn", localeOf(model))}</h3><p class="vnext-result-value">${esc(model.title)}</p></section>` : ""}${model.rimName || model.specs || model.rimSku ? `<section class="vnext-result-meta"><h3>${esc(uiText("wheel.label", localeOf(model)))}</h3>${model.rimName ? `<p class="vnext-result-value">${esc(model.rimName)}</p>` : ""}${model.rimSku ? `<p class="vnext-result-detail">${esc(uiText("wheel.sku", localeOf(model)))} ${esc(model.rimSku)}</p>` : ""}${model.specs ? `<p class="vnext-result-detail">${esc(model.specs)}</p>` : ""}</section>` : ""}${model.createdLabel ? `<section class="vnext-result-meta"><h3>${esc(uiText("render.created", localeOf(model)))}</h3><p class="vnext-result-value vnext-result-value--date">${esc(model.createdLabel)}</p></section>` : ""}<div class="vnext-result-actions">${button(uiText("render.again", localeOf(model)), "repeat", { primary: true, jobId: model.jobId })}<div class="vnext-result-secondary">${model.canFitment ? `<button type="button" class="vnext-button vnext-button--secondary" data-render-action="fitment" data-job="${esc(model.jobId)}"><span class="vnext-result-check-full">${esc(uiText("fitment.checkCompatibility", localeOf(model)))}</span><span class="vnext-result-check-short">${esc(uiText("render.checkShort", localeOf(model)))}</span></button>` : ""}${button(model.downloading ? uiText("render.loading", localeOf(model)) : uiText("render.downloadShort", localeOf(model)), "download", { jobId: model.jobId, disabled: model.downloading || !model.canDownload })}</div>${model.originalFailed || model.resultFailed ? button(uiText("render.retryLoadingTheImage", localeOf(model)), "asset-retry", { text: true, jobId: model.jobId }) : ""}</div><p class="vnext-render-notice" role="status">${esc(model.downloadNotice)}</p></aside></div>
  <section class="vnext-rating" aria-label="${esc(uiText("render.feedback.title", localeOf(model)))}"><h3>${esc(uiText("render.feedback.title", localeOf(model)))}</h3><p>${esc(uiText("render.feedback.help", localeOf(model)))}</p><div class="vnext-rating-actions">${button(uiText("render.goodResult", localeOf(model)), "feedback", { jobId: model.jobId, value: "liked", disabled: feedback.busy, selected: feedback.sentiment === "liked", tone: "good" })}${button(uiText("render.needsImprovement", localeOf(model)), "feedback", { jobId: model.jobId, value: "disliked", disabled: feedback.busy, selected: feedback.sentiment === "disliked", tone: "warning" })}</div><div class="vnext-feedback-reasons" ${feedback.sentiment !== "disliked" ? "hidden" : ""}><p>${esc(uiText("render.feedback.whatToImprove", localeOf(model)))}</p><div class="vnext-feedback-chips">${(model.reasons || []).map((reason) => button(reason.label, "reason", { jobId: model.jobId, value: reason.code, disabled: feedback.busy, selected: reason.code === feedback.reason })).join("")}</div></div><p class="vnext-feedback-notice" role="status">${esc(feedback.busy ? uiText("render.savingFeedback", localeOf(model)) : feedback.notice)}</p><div class="vnext-feedback-error" role="status" ${!feedback.error ? "hidden" : ""}>${esc(feedback.error)} ${button(uiText("create.retry", localeOf(model)), "feedback-retry", { jobId: model.jobId, disabled: feedback.busy })}</div></section>`;
}

export function historyMarkup(model) {
  if (model.loading) return `<section class="vnext-render-intro" role="status"><p>${esc(uiText("history.loading", localeOf(model)))}</p></section>`;
  if (model.error) return `<section class="vnext-system-card" role="status"><h2>${esc(uiText("history.unavailable", localeOf(model)))}</h2><p>${esc(model.error)}</p>${button(uiText("create.retry", localeOf(model)), "history-retry", { primary: true })}</section>`;
  if (!model.rows?.length) return `<div class="vnext-system-wrap"><section class="vnext-system-card"><p class="vnext-eyebrow">${esc(uiText("nav.history", localeOf(model)))}</p><h2>${esc(uiText("history.empty.title", localeOf(model)))}</h2><p>${esc(uiText("history.empty.copy", localeOf(model)))}</p>${button(uiText("nav.create", localeOf(model)), "create", { primary: true })}</section></div>`;
  let group = "";
  return `<section class="vnext-render-intro"><p></p></section><div class="vnext-history-list">${model.rows.map((row) => {
    const date = row.dateLabel !== group ? `<h2 class="vnext-history-date">${esc(row.dateLabel)}</h2>` : "";
    group = row.dateLabel;
    const action = row.status === "completed" ? button(uiText("dashboard.open", localeOf(model)), "open", { jobId: row.jobId }) : row.status === "failed" ? button(row.failureCopy?.retry, "retry-create") : "";
    return `${date}<article class="vnext-history-row" data-row-job="${esc(row.jobId)}">${row.status === "failed" ? `<div class="vnext-render-media">${row.thumbnailUrl && !row.thumbnailFailed ? `<img src="${esc(row.thumbnailUrl)}" alt="${esc(row.failureCopy?.sourcePhoto)}" data-render-image="original" data-job="${esc(row.jobId)}">` : ""}</div>` : media(row.thumbnailUrl, uiText("render.vehicleTryOn", localeOf(model)), row.jobId, row.thumbnailKind, row.thumbnailFailed, row.thumbnailLoading, row.failureCopy, localeOf(model))}<div><h3>${esc(row.status === "completed" ? row.title : row.status === "failed" ? row.failureCopy?.generationFailed : uiText("page.renderProcessing", localeOf(model)))}</h3><p>${esc([row.rimName, row.specs].filter(Boolean).join(" · "))}</p>${row.timeLabel ? `<p class="vnext-history-time">${esc(row.timeLabel)}</p>` : ""}${row.status !== "completed" ? `<span class="vnext-status vnext-status--${row.status === "completed" ? "positive" : row.status === "failed" ? "negative" : "pending"}">${esc(row.status === "failed" ? row.failureCopy?.failedBadge : row.statusLabel)}</span>` : ""}${row.status === "failed" && row.billingMessage ? `<p>${esc(row.billingMessage)}</p>` : ""}</div><div class="vnext-history-actions">${action}</div></article>`;
  }).join("")}</div>${model.hasMore ? button(uiText("render.showMore", localeOf(model)), "more") : ""}`;
}

// Reconcile in place: feedback/polling updates keep the same image, slider,
// focus and scroll. Delegated handlers are attached exactly once to the root.
export function patchNode(current, next) {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) { current.replaceWith(next.cloneNode(true)); return; }
  if (current.nodeType === 3) { if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue; return; }
  for (const attribute of [...current.attributes]) if (!next.hasAttribute(attribute.name) && !(attribute.name === "style" && current.hasAttribute("data-compare"))) current.removeAttribute(attribute.name);
  for (const attribute of [...next.attributes]) {
    if (current.matches('input[type="range"]') && attribute.name === "value") continue;
    if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  }
  while (current.childNodes.length > next.childNodes.length) current.lastChild.remove();
  const count = next.childNodes.length;
  for (let i = 0; i < count; i += 1) {
    const oldChild = current.childNodes[i]; const newChild = next.childNodes[i];
    if (!newChild) oldChild.remove();
    else if (!oldChild) current.append(newChild.cloneNode(true));
    else patchNode(oldChild, newChild);
  }
}

export function refreshRenderView(root, model, callbacks = root.renderCallbacks, locale = applicationLocale()) {
  root.renderCallbacks = callbacks;
  if (root.renderJobId !== model.jobId) {
    root.querySelector("[data-compare]")?.style.removeProperty("--compare");
    root.querySelector("[data-compare]")?.style.removeProperty("--image-ratio");
    const range = root.querySelector(".vnext-compare-range");
    if (range) range.value = "50";
    root.renderJobId = model.jobId;
  }
  const markup = root.renderKind === "history" ? historyMarkup(model) : root.renderKind === "processing" ? processingMarkup(model) : resultMarkup(model);
  const next = document.createElement("section");
  next.className = root.className;
  next.innerHTML = markup;
  if (root.renderKind === "result") {
    next.querySelectorAll(".vnext-compare .vnext-render-media > span").forEach(status => {
      if (status.closest(".vnext-compare-reveal") ? !model.originalLoading : !model.resultLoading) return;
      status.className = "vnext-compare-loading";
      status.setAttribute("aria-label", uiText("render.loadingImage", localeOf(model)));
      status.innerHTML = '<i class="vnext-spinner" aria-hidden="true"></i>';
    });
  }
  patchNode(root, next);
  return root;
}

export function createRenderView(kind, model = {}, callbacks = {}, locale = applicationLocale()) {
  const root = document.createElement("section");
  root.className = `vnext-render vnext-render--${kind}`;
  root.renderKind = kind;
  root.addEventListener("click", (event) => {
    const target = event.target.closest("[data-render-action]");
    if (!target || !root.contains(target) || target.disabled) return;
    root.renderCallbacks?.action?.(target.dataset.renderAction, target.dataset.job, target.dataset.value);
  });
  root.addEventListener("input", (event) => {
    if (event.target.matches(".vnext-compare-range")) root.querySelector("[data-compare]")?.style.setProperty("--compare", `${event.target.value}%`);
  });
  root.addEventListener("load", (event) => {
    const image = event.target;
    if (image.matches?.("[data-render-image]") && image.naturalWidth && image.naturalHeight) {
      const result = root.querySelector('.vnext-compare img[data-render-image="result"]');
      const reference = result?.naturalWidth ? result : image;
      root.querySelector("[data-compare]")?.style.setProperty("--image-ratio", String(reference.naturalWidth / reference.naturalHeight));
    }
  }, true);
  root.addEventListener("error", (event) => {
    if (event.target.matches("[data-render-image]")) root.renderCallbacks?.assetError?.(event.target.dataset.job, event.target.dataset.renderImage);
  }, true);
  return refreshRenderView(root, model, callbacks, locale);
}
