// These views receive runtime snapshots. They never fetch, poll or persist jobs.
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const button = (label, action, { primary = false, disabled = false, jobId = "", value = "", selected = false, tone = "" } = {}) => `<button type="button" class="vnext-button vnext-button--${primary ? "primary" : "secondary"} ${selected ? `is-selected-${tone || "neutral"}` : ""}" data-render-action="${action}" data-job="${esc(jobId)}" data-value="${esc(value)}" ${disabled ? "disabled" : ""} ${selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${esc(label)}</button>`;
const media = (url, alt, jobId = "", kind = "result", failed = false, loading = false) => `<div class="vnext-render-media">${url && !failed ? `<img src="${esc(url)}" alt="${esc(alt)}" data-render-image="${kind}" data-job="${esc(jobId)}">` : `<span role="status">${loading ? "Загружаем изображение…" : "Изображение временно недоступно"}</span>`}</div>`;

export function processingMarkup(model) {
  if (model.error) return `<div class="vnext-system-wrap"><section class="vnext-system-card" role="status"><div class="vnext-system-mark">!</div><p class="vnext-eyebrow">Генерация</p><h2>${esc(model.error.title)}</h2><p>${esc(model.error.copy)}</p><div class="vnext-render-actions">${button(model.error.actionLabel, "generation-retry", { primary: true })}${model.error.showSupport ? button("Поддержка", "support") : ""}</div></section></div>`;
  return `<section class="vnext-render-intro"><p class="vnext-eyebrow">${model.status === "queued" ? "В очереди" : "В обработке"}</p><h2>Создаём виртуальную примерку</h2><p>Результат появится после завершения обработки</p></section><div class="vnext-processing-layout"><section class="vnext-processing-card">${media(model.carUrl, "Исходное фото автомобиля")}<div class="vnext-processing-status" role="status"><span class="vnext-spinner" aria-hidden="true"></span><div><strong>${model.status === "queued" ? "Примерка в очереди" : "Создаём примерку..."}</strong><p>Это может занять до 90 секунд</p></div></div></section><aside class="vnext-processing-aside"><p class="vnext-eyebrow">Выбрано</p><div class="vnext-render-object">${esc(model.title)}</div><p>${esc(model.rimName)}${model.specs ? ` / ${esc(model.specs)}` : ""}</p>${media(model.wheelUrl, "Колесный диск")}<div class="vnext-render-actions">${button("Мои примерки", "history")}</div></aside></div>`;
}

export function resultMarkup(model) {
  if (!model.jobId) return `<section class="vnext-system-card" role="status"><h2>${esc(model.loading ? "Загружаем примерку…" : model.error || "Примерка не найдена")}</h2>${button("К моим примеркам", "history")}</section>`;
  if (model.status !== "completed") return processingMarkup(model);
  const feedback = model.feedback || {};
  return `<section class="vnext-result-head"><p class="vnext-eyebrow">Виртуальная примерка</p><h2>${esc(model.title)}</h2><p>${esc(model.rimName)}</p><p>${esc([model.specs, model.createdLabel].filter(Boolean).join(" – "))}</p></section><div class="vnext-result-primary">${button("Создать ещё вариант", "repeat", { primary: true, jobId: model.jobId })}</div><div class="vnext-compare" data-compare>
    <div class="vnext-compare-layer">${media(model.originalUrl, "Исходное фото", model.jobId, "original", model.originalFailed, model.originalLoading)}</div>
    <div class="vnext-compare-layer vnext-compare-reveal">${media(model.resultUrl, "Результат примерки", model.jobId, "result", model.resultFailed, model.resultLoading)}</div>
    <span class="vnext-compare-label left">Результат</span><span class="vnext-compare-label right">Оригинал</span><div class="vnext-compare-divider"></div><div class="vnext-compare-handle" aria-hidden="true">↔</div>
    <input class="vnext-compare-range" type="range" min="0" max="100" value="50" aria-label="Сравнение результата и оригинала" ${!model.originalUrl || model.originalFailed || !model.resultUrl || model.resultFailed ? "disabled" : ""}>
  </div><div class="vnext-result-utilities">${button(model.downloading ? "Загружаем…" : "Скачать изображение", "download", { jobId: model.jobId, disabled: model.downloading || !model.canDownload })}${model.canFitment ? button("Проверка совместимости", "fitment", { jobId: model.jobId }) : ""}${button("К моим примеркам", "history")}${model.originalFailed || model.resultFailed ? button("Повторить загрузку изображения", "asset-retry", { jobId: model.jobId }) : ""}</div><p class="vnext-render-notice" role="status">${esc(model.downloadNotice)}</p>
  <section class="vnext-rating" aria-label="Оценка результата"><h3>Оценка результата</h3><p>Помогите улучшить следующие примерки</p><div class="vnext-rating-actions">${button("👍 Удачный результат", "feedback", { jobId: model.jobId, value: "liked", disabled: feedback.busy, selected: feedback.sentiment === "liked", tone: "good" })}${button("👎 Нужна доработка", "feedback", { jobId: model.jobId, value: "disliked", disabled: feedback.busy, selected: feedback.sentiment === "disliked", tone: "warning" })}</div><div class="vnext-feedback-reasons" ${feedback.sentiment !== "disliked" ? "hidden" : ""}><p>Что улучшить</p><div class="vnext-feedback-chips">${(model.reasons || []).map((reason) => button(reason.label, "reason", { jobId: model.jobId, value: reason.code, disabled: feedback.busy, selected: reason.code === feedback.reason })).join("")}</div></div><p class="vnext-feedback-notice" role="status">${esc(feedback.busy ? "Сохраняем оценку…" : feedback.notice)}</p><div class="vnext-feedback-error" role="status" ${!feedback.error ? "hidden" : ""}>${esc(feedback.error)} ${button("Повторить", "feedback-retry", { jobId: model.jobId, disabled: feedback.busy })}</div></section>`;
}

export function historyMarkup(model) {
  if (model.loading) return '<section class="vnext-render-intro" role="status"><p>Загружаем историю…</p></section>';
  if (model.error) return `<section class="vnext-system-card" role="status"><h2>История временно недоступна</h2><p>${esc(model.error)}</p>${button("Повторить", "history-retry", { primary: true })}</section>`;
  if (!model.rows?.length) return `<div class="vnext-system-wrap"><section class="vnext-system-card"><p class="vnext-eyebrow">Мои примерки</p><h2>Готовых рендеров пока нет</h2><p>Создайте первую виртуальную примерку на главном экране</p>${button("Создать примерку", "create", { primary: true })}</section></div>`;
  let group = "";
  return `<section class="vnext-render-intro"><p>Результаты и текущие статусы вашей истории</p></section><div class="vnext-history-list">${model.rows.map((row) => {
    const date = row.dateLabel !== group ? `<h2 class="vnext-history-date">${esc(row.dateLabel)}</h2>` : "";
    group = row.dateLabel;
    const action = row.status === "completed" ? button("Открыть", "open", { jobId: row.jobId }) : row.status === "failed" ? button("Повторить", "retry-create") : "";
    return `${date}<article class="vnext-history-row" data-row-job="${esc(row.jobId)}">${media(row.thumbnailUrl, "Примерка автомобиля", row.jobId, row.thumbnailKind, row.thumbnailFailed, row.thumbnailLoading)}<div><h3>${esc(row.status === "completed" ? row.title : row.status === "failed" ? "Не удалось создать виртуальную примерку" : "Создаём виртуальную примерку")}</h3><p>${esc([row.rimName, row.specs, row.createdLabel].filter(Boolean).join(" / "))}</p><span class="vnext-status vnext-status--${row.status === "completed" ? "positive" : row.status === "failed" ? "negative" : "pending"}">${esc(row.statusLabel)}</span></div><div class="vnext-history-actions">${action}</div></article>`;
  }).join("")}</div>${model.hasMore ? button("Показать ещё", "more") : ""}`;
}

// Reconcile in place: feedback/polling updates keep the same image, slider,
// focus and scroll. Delegated handlers are attached exactly once to the root.
function patchNode(current, next) {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) { current.replaceWith(next); return; }
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

export function refreshRenderView(root, model, callbacks = root.renderCallbacks) {
  root.renderCallbacks = callbacks;
  if (root.renderJobId !== model.jobId) {
    root.querySelector("[data-compare]")?.style.removeProperty("--compare");
    const range = root.querySelector(".vnext-compare-range");
    if (range) range.value = "50";
    root.renderJobId = model.jobId;
  }
  const markup = root.renderKind === "history" ? historyMarkup(model) : root.renderKind === "processing" ? processingMarkup(model) : resultMarkup(model);
  const next = document.createElement("section");
  next.className = root.className;
  next.innerHTML = markup;
  patchNode(root, next);
  return root;
}

export function createRenderView(kind, model = {}, callbacks = {}) {
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
  root.addEventListener("error", (event) => {
    if (event.target.matches("[data-render-image]")) root.renderCallbacks?.assetError?.(event.target.dataset.job, event.target.dataset.renderImage);
  }, true);
  return refreshRenderView(root, model, callbacks);
}
