import { copy as uiText, applicationLocale, localeOf } from "../copy.mjs";
import { createButton, createIsland, createStatusText } from "../ui/primitives.js";

function createMedia(job, className = "", locale = applicationLocale()) {
  const media = document.createElement("div");
  media.className = `vnext-dashboard__media ${className}`.trim();
  if (job?.imageUrl) {
    const image = document.createElement("img");
    image.src = job.imageUrl;
    image.alt = job.status === "failed" ? job.failureCopy?.sourcePhoto : job.title || uiText("dashboard.aiRender", locale);
    image.loading = "lazy";
    media.append(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "vnext-dashboard__media-placeholder";
    placeholder.textContent = job?.status === "failed" ? (job.failureCopy?.sourcePhoto || "") : uiText("page.tryOn", locale);
    media.append(placeholder);
  }
  return media;
}

function createLatest(model, { navigate, openRenderDetail } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "vnext-dashboard__latest-content";

  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = uiText("dashboard.latestResult", localeOf(model));
  wrap.append(eyebrow);

  if (!model.latest) {
    const empty = document.createElement("div");
    empty.className = "vnext-dashboard__empty";
    const title = document.createElement("h3");
    title.textContent = uiText("dashboard.yourFirstTryOn", localeOf(model));
    const copy = document.createElement("p");
    copy.textContent = uiText("dashboard.uploadPhotosOfTheVehicleAndWheelTheFinished", localeOf(model));
    empty.append(title, copy, createButton({ label: uiText("nav.create", localeOf(model)), variant: "secondary", onClick: () => navigate?.("create") }));
    wrap.append(empty);
    return createIsland(wrap);
  }

  const latest = model.latest;
  wrap.append(createMedia(latest, "vnext-dashboard__latest-media", localeOf(model)));

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
      label: latest.status === "failed" ? latest.failureCopy?.generationFailed : latest.statusLabel,
      tone: latest.status === "failed" ? "negative" : "pending",
    }));
  }
  if (latest.status === "failed" && latest.billingMessage) {
    const billing = document.createElement("p"); billing.textContent = latest.billingMessage; copy.append(billing);
  }
  meta.append(copy);

  const action = latest.canOpen
    ? createButton({ label: uiText("dashboard.open", localeOf(model)), variant: "secondary", onClick: () => openRenderDetail?.(latest.jobId) })
    : createButton({ label: latest.status === "failed" ? uiText("dashboard.tryAgain", localeOf(model)) : uiText("nav.history", localeOf(model)), variant: "secondary", onClick: () => navigate?.(latest.status === "failed" ? "create" : "renders") });
  meta.append(action);
  wrap.append(meta);
  return createIsland(wrap);
}

function createBalance(model, { navigate, openAuth } = {}) {
  const content = document.createElement("div");
  content.className = "vnext-dashboard__balance-content";

  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = uiText("nav.wallet", localeOf(model));
  content.append(eyebrow);

  if (!model.authenticated && !model.partialAuth) {
    const copy = document.createElement("p");
    copy.className = "vnext-dashboard__balance-auth";
    copy.textContent = uiText("dashboard.signInToSeeYourBalance", localeOf(model));
    content.append(copy, createButton({ label: uiText("auth.login", localeOf(model)), variant: "secondary", onClick: openAuth }));
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
  line.append(amount, createButton({ label: uiText("dashboard.topUpBalance", localeOf(model)), variant: "text", onClick: () => navigate?.("wallet") }));
  content.append(line);

  if (model.expiry.length) {
    const expiry = document.createElement("div");
    expiry.className = "vnext-dashboard__expiry";
    const label = document.createElement("p");
    label.className = "vnext-eyebrow";
    label.textContent = uiText("dashboard.expiryDates", localeOf(model));
    expiry.append(label);
    model.expiry.forEach((item) => {
      const row = document.createElement("div");
      row.className = "vnext-dashboard__expiry-row";
      const credits = document.createElement("span");
      credits.textContent = item.creditsLabel || String(item.credits);
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
  eyebrow.textContent = uiText("dashboard.recentTryOns", localeOf(model));
  section.append(eyebrow);

  if (!model.recent.length) {
    const empty = document.createElement("p");
    empty.className = "vnext-dashboard__object-sub";
    empty.textContent = uiText("dashboard.yourLatestVirtualTryOnsWillAppearHere", localeOf(model));
    section.append(empty);
    return section;
  }

  const grid = document.createElement("div");
  grid.className = "vnext-dashboard__recent-grid";
  model.recent.forEach((job) => {
    const item = document.createElement("article");
    item.className = "vnext-dashboard__recent-item";
    item.append(createMedia(job, undefined, localeOf(model)));
    const title = document.createElement("strong");
    title.textContent = job.title;
    const meta = document.createElement("span");
    meta.textContent = [job.subtitle, job.meta].filter(Boolean).join(", ");
    item.append(title, meta);
    if (job.canOpen) {
      const open = document.createElement("button");
      open.type = "button";
      open.className = "vnext-dashboard__recent-open";
      open.textContent = uiText("dashboard.open", localeOf(model));
      open.addEventListener("click", () => openRenderDetail?.(job.jobId));
      item.append(open);
    } else if (job.status !== "completed") {
      item.append(createStatusText({
        label: job.status === "failed" ? job.failureCopy?.generationFailed : job.statusLabel,
        tone: job.status === "failed" ? "negative" : "pending",
      }));
    }
    if (job.status === "failed" && job.billingMessage) {
      const billing = document.createElement("p"); billing.textContent = job.billingMessage; item.append(billing);
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
  eyebrow.textContent = uiText("dashboard.newTryOn", localeOf(model));
  const title = document.createElement("h2");
  title.setAttribute("aria-label", uiText("dashboard.tryNewWheelsOnYourVehicle", localeOf(model)));
  [uiText("dashboard.try", localeOf(model)), uiText("dashboard.newWheels", localeOf(model)), uiText("dashboard.onYourVehicle", localeOf(model))].forEach((line) => {
    const lineElement = document.createElement("span");
    lineElement.textContent = line;
    title.append(lineElement);
  });
  introCopy.append(eyebrow, title);
  intro.append(introCopy, createButton({ label: uiText("nav.create", localeOf(model)), onClick: () => callbacks.navigate?.("create") }));
  page.append(intro);

  if (model.loading) {
    const loading = document.createElement("div");
    loading.className = "vnext-dashboard__loading";
    const spinner = document.createElement("span");
    spinner.className = "vnext-spinner";
    spinner.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = uiText("dashboard.updatingDetails", localeOf(model));
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
