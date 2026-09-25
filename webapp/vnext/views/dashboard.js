import { createButton, createIsland, createStatusText } from "../ui/primitives.js";

function createMedia(job, className = "") {
  const media = document.createElement("div");
  media.className = `vnext-dashboard__media ${className}`.trim();
  if (job?.imageUrl) {
    const image = document.createElement("img");
    image.src = job.imageUrl;
    image.alt = job.title || "Результат примерки";
    image.loading = "lazy";
    media.append(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "vnext-dashboard__media-placeholder";
    placeholder.textContent = job?.status === "failed" ? "Результат недоступен" : "Виртуальная примерка";
    media.append(placeholder);
  }
  return media;
}

function createLatest(model, { navigate, openRenderDetail } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "vnext-dashboard__latest-content";

  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = "Последний результат";
  wrap.append(eyebrow);

  if (!model.latest) {
    const empty = document.createElement("div");
    empty.className = "vnext-dashboard__empty";
    const title = document.createElement("h3");
    title.textContent = "Ваша первая примерка";
    const copy = document.createElement("p");
    copy.textContent = "Загрузите фото автомобиля и диска — готовый результат появится здесь.";
    empty.append(title, copy, createButton({ label: "Создать примерку", variant: "secondary", onClick: () => navigate?.("create") }));
    wrap.append(empty);
    return createIsland(wrap);
  }

  const latest = model.latest;
  wrap.append(createMedia(latest, "vnext-dashboard__latest-media"));

  const meta = document.createElement("div");
  meta.className = "vnext-dashboard__latest-meta";
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = latest.title;
  const subtitle = document.createElement("div");
  subtitle.className = "vnext-dashboard__object-sub";
  subtitle.textContent = [latest.subtitle, latest.meta].filter(Boolean).join(" — ");
  copy.append(title, subtitle);
  if (latest.status !== "completed") {
    copy.append(createStatusText({
      label: latest.statusLabel,
      tone: latest.status === "failed" ? "negative" : "pending",
    }));
  }
  meta.append(copy);

  const action = latest.canOpen
    ? createButton({ label: "Открыть", variant: "secondary", onClick: () => openRenderDetail?.(latest.jobId) })
    : createButton({ label: latest.status === "failed" ? "Попробовать ещё раз" : "Мои примерки", variant: "secondary", onClick: () => navigate?.(latest.status === "failed" ? "create" : "renders") });
  meta.append(action);
  wrap.append(meta);
  return createIsland(wrap);
}

function createBalance(model, { navigate, openAuth } = {}) {
  const content = document.createElement("div");
  content.className = "vnext-dashboard__balance-content";

  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = "Баланс";
  content.append(eyebrow);

  if (!model.authenticated && !model.partialAuth) {
    const copy = document.createElement("p");
    copy.className = "vnext-dashboard__balance-auth";
    copy.textContent = "Войдите, чтобы увидеть баланс";
    content.append(copy, createButton({ label: "Войти", variant: "secondary", onClick: openAuth }));
    return createIsland(content);
  }

  const line = document.createElement("div");
  line.className = "vnext-dashboard__balance-line";
  const amount = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = model.balance === null ? "—" : String(model.balance);
  const unit = document.createElement("div");
  unit.className = "vnext-dashboard__object-sub";
  unit.textContent = model.balanceLabel.replace(/^\d+\s+/, "");
  amount.append(strong, unit);
  line.append(amount, createButton({ label: "Пополнить баланс", variant: "text", onClick: () => navigate?.("wallet") }));
  content.append(line);

  if (model.expiry.length) {
    const expiry = document.createElement("div");
    expiry.className = "vnext-dashboard__expiry";
    const label = document.createElement("p");
    label.className = "vnext-eyebrow";
    label.textContent = "Срок действия";
    expiry.append(label);
    model.expiry.forEach((item) => {
      const row = document.createElement("div");
      row.className = "vnext-dashboard__expiry-row";
      const credits = document.createElement("span");
      credits.textContent = `${item.credits} ${item.meta || "рендеров"}`;
      const date = document.createElement("strong");
      date.textContent = item.expiresLabel;
      row.append(credits, date);
      expiry.append(row);
    });
    const note = document.createElement("div");
    note.className = "vnext-dashboard__expiry-note";
    note.textContent = model.expiryNote;
    expiry.append(note);
    content.append(expiry);
  }

  return createIsland(content);
}

function createRecent(model, { navigate, openRenderDetail } = {}) {
  const section = document.createElement("section");
  section.className = "vnext-dashboard__recent";
  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = "Недавние примерки";
  section.append(eyebrow);

  if (!model.recent.length) {
    const empty = document.createElement("p");
    empty.className = "vnext-dashboard__object-sub";
    empty.textContent = "Здесь появятся последние виртуальные примерки.";
    section.append(empty);
    return section;
  }

  const grid = document.createElement("div");
  grid.className = "vnext-dashboard__recent-grid";
  model.recent.forEach((job) => {
    const item = document.createElement("article");
    item.className = "vnext-dashboard__recent-item";
    item.append(createMedia(job));
    const title = document.createElement("strong");
    title.textContent = job.title;
    const meta = document.createElement("span");
    meta.textContent = [job.subtitle, job.meta].filter(Boolean).join(", ");
    item.append(title, meta);
    if (job.canOpen) {
      const open = document.createElement("button");
      open.type = "button";
      open.className = "vnext-dashboard__recent-open";
      open.textContent = "Открыть";
      open.addEventListener("click", () => openRenderDetail?.(job.jobId));
      item.append(open);
    } else if (job.status !== "completed") {
      item.append(createStatusText({
        label: job.statusLabel,
        tone: job.status === "failed" ? "negative" : "pending",
      }));
    }
    grid.append(item);
  });
  section.append(grid);
  return section;
}

export function createDashboardView(model, callbacks = {}) {
  const page = document.createElement("section");
  page.className = "vnext-dashboard";

  const intro = document.createElement("section");
  intro.className = "vnext-dashboard__intro";
  const introCopy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = "Новая примерка";
  const title = document.createElement("h2");
  title.textContent = "Посмотрите выбранные диски на своей машине";
  const copy = document.createElement("p");
  copy.textContent = "Загрузите автомобиль и выберите конкретный колесный диск";
  introCopy.append(eyebrow, title, copy);
  intro.append(introCopy, createButton({ label: "Создать примерку", onClick: () => callbacks.navigate?.("create") }));
  page.append(intro);

  if (model.loading) {
    const loading = document.createElement("div");
    loading.className = "vnext-dashboard__loading";
    const spinner = document.createElement("span");
    spinner.className = "vnext-spinner";
    spinner.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = "Обновляем данные…";
    loading.append(spinner, text);
    page.append(loading);
  }
  if (model.error) {
    const error = document.createElement("p");
    error.className = "vnext-dashboard__error";
    error.textContent = model.error;
    page.append(error);
  }

  const grid = document.createElement("div");
  grid.className = "vnext-dashboard__grid";
  grid.append(createLatest(model, callbacks), createBalance(model, callbacks));
  page.append(grid, createRecent(model, callbacks));
  return page;
}
