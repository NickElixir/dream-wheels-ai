const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#39;",
}[char]));

const legalOrigin = "https://legal.dreamwheels.pro";

function expiryRows(items) {
  return items.map((item) => `<div class="vnext-wallet__expiry-row"><span>${esc(item.creditsLabel)}${item.meta ? `<small>${esc(item.meta)}</small>` : ""}</span><strong>${esc(item.expiresLabel)}</strong></div>`).join("");
}

function historyRows(items) {
  if (!items.length) return '<p class="vnext-wallet__empty">Пополнений пока нет.</p>';
  return items.map((item) => `<div class="vnext-wallet__history-row"><div class="vnext-wallet__history-main"><strong>${esc(item.amountLabel)}</strong><span>${esc(item.creditsLabel)}</span><small><span>${esc(item.dateLabel)}</span><span>#${esc(item.invoiceId)}</span></small></div><span class="vnext-wallet__history-status vnext-wallet__history-status--${esc(item.tone)}">${esc(item.statusLabel)}</span></div>`).join("");
}

function packageChoices(items) {
  return items.map((item) => `<button type="button" class="vnext-wallet__package" data-wallet-package="${esc(item.amount)}" aria-pressed="false"><strong>${esc(item.amountLabel)}</strong><span>${esc(item.creditsLabel)}</span></button>`).join("");
}

export function createWalletView(model = {}, callbacks = {}) {
  const root = document.createElement("section");
  root.className = "vnext-wallet";
  root.innerHTML = `
    <div class="vnext-wallet__notice" data-wallet-notice hidden role="status"></div>
    <section class="vnext-wallet__main">
      <div class="vnext-wallet__primary">
        <section class="vnext-wallet__balance" aria-label="Доступный баланс">
          <p class="vnext-wallet__label">Доступно</p>
          <div class="vnext-wallet__balance-figure" data-wallet-balance><strong data-wallet-balance-value></strong><span data-wallet-balance-unit></span></div>
          <div class="vnext-wallet__loading" data-wallet-loading hidden role="status"><span class="vnext-spinner" aria-hidden="true"></span>Загружаем баланс…</div>
          <div class="vnext-wallet__error" data-wallet-cabinet-error hidden role="alert"><span>Не удалось загрузить баланс.</span><button type="button" class="vnext-button vnext-button--secondary" data-wallet-action="refresh">Повторить</button></div>
          <div class="vnext-wallet__auth" data-wallet-auth hidden role="status"><span>Сессия истекла.</span><button type="button" class="vnext-button vnext-button--secondary" data-wallet-action="login">Войти</button></div>
          <div class="vnext-wallet__expiry" data-wallet-expiry hidden><h2>Срок действия</h2><div data-wallet-expiry-rows></div><p data-wallet-expiry-note></p></div>
        </section>

        <section class="vnext-wallet__topup" aria-labelledby="wallet-topup-title">
          <h2 id="wallet-topup-title">Пополнить баланс</h2>
          <div class="vnext-wallet__packages" data-wallet-packages role="group" aria-label="Пакеты пополнения"></div>
          <div class="vnext-wallet__field">
            <label for="vnext-wallet-email">Email для чека</label>
            <input id="vnext-wallet-email" data-topup-email type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" aria-describedby="vnext-wallet-email-hint vnext-wallet-email-error">
            <p id="vnext-wallet-email-hint">Чек будет отправлен на этот адрес.</p>
            <p id="vnext-wallet-email-error" class="vnext-wallet__field-error" data-wallet-email-error hidden role="alert">Введите корректный email</p>
          </div>
          <div class="vnext-wallet__selection" aria-live="polite"><p data-wallet-selection-title>Выберите пакет</p><strong data-wallet-selection-amount hidden></strong><span data-wallet-selection-credits hidden></span><span data-wallet-selection-duration hidden></span><span data-wallet-selection-email hidden></span></div>
          <button type="button" class="vnext-button vnext-button--primary vnext-wallet__pay" data-wallet-action="pay" disabled>Перейти к оплате</button>
          <p class="vnext-wallet__provider">Оплата через Robokassa</p>
          <p class="vnext-wallet__legal">Продолжая, вы принимаете <a href="${legalOrigin}/legal/offer" target="_blank" rel="noopener noreferrer" data-external-link>оферту</a> и <a href="${legalOrigin}/legal/refund" target="_blank" rel="noopener noreferrer" data-external-link>условия возврата</a>. <a href="${legalOrigin}/legal/privacy" target="_blank" rel="noopener noreferrer" data-external-link>Обработка персональных данных</a>.</p>
        </section>
      </div>
      <aside class="vnext-wallet__pending" data-wallet-pending hidden aria-label="Оплата в обработке">
        <h2>Ожидаем подтверждение оплаты</h2>
        <div class="vnext-wallet__pending-values"><strong data-wallet-pending-amount></strong><span data-wallet-pending-credits></span></div>
        <p data-wallet-pending-message></p>
        <button type="button" class="vnext-button vnext-button--secondary" data-wallet-action="refresh"><span class="vnext-spinner" data-wallet-refresh-spinner hidden aria-hidden="true"></span><span data-wallet-refresh-label>Обновить статус</span></button>
      </aside>
    </section>
    <section class="vnext-wallet__history" aria-labelledby="wallet-history-title"><h2 id="wallet-history-title">История пополнений</h2><div data-wallet-history></div><button type="button" class="vnext-text-action" data-wallet-action="more" hidden>Показать ещё</button></section>`;

  root.addEventListener("click", (event) => {
    const choice = event.target.closest?.("[data-wallet-package]");
    if (choice && root.contains(choice)) {
      callbacks.selectPackage?.(Number(choice.dataset.walletPackage));
      return;
    }
    const action = event.target.closest?.("[data-wallet-action]");
    if (!action || !root.contains(action)) return;
    if (action.dataset.walletAction === "pay") callbacks.createPayment?.();
    else if (action.dataset.walletAction === "refresh") callbacks.refreshPayment?.();
    else if (action.dataset.walletAction === "more") callbacks.showMoreHistory?.();
    else if (action.dataset.walletAction === "login") callbacks.login?.();
  });
  root.querySelector("[data-topup-email]").addEventListener("input", (event) => callbacks.setReceiptEmail?.(event.target.value));
  refreshWalletView(root, model);
  return root;
}

export function refreshWalletView(root, model = {}) {
  if (!root) return root;
  const one = (selector) => root.querySelector(selector);
  const setText = (selector, value) => { const node = one(selector); if (node) node.textContent = String(value ?? ""); };
  const setHidden = (selector, hidden) => { const node = one(selector); if (node) node.hidden = Boolean(hidden); };
  const authenticated = Boolean(model.authenticated);
  const initialLoading = authenticated && model.balance == null && !model.cabinetError;
  setHidden("[data-wallet-loading]", !initialLoading);
  setHidden("[data-wallet-balance]", model.balance == null);
  setText("[data-wallet-balance-value]", model.balance);
  setText("[data-wallet-balance-unit]", model.balanceUnit);
  setHidden("[data-wallet-cabinet-error]", !authenticated || !model.cabinetError);
  setHidden("[data-wallet-auth]", authenticated);

  const notice = one("[data-wallet-notice]");
  const message = model.paymentReturnMessage || model.message || "";
  notice.hidden = !authenticated || Boolean(model.cabinetError) || !message;
  notice.textContent = notice.hidden ? "" : message;
  notice.dataset.tone = model.messageTone || "neutral";

  const expiry = model.expiryCohorts || [];
  setHidden("[data-wallet-expiry]", !expiry.length);
  const expiryMarkup = expiryRows(expiry);
  if (one("[data-wallet-expiry-rows]").innerHTML !== expiryMarkup) one("[data-wallet-expiry-rows]").innerHTML = expiryMarkup;
  setText("[data-wallet-expiry-note]", model.expiryNote || "");

  const packages = model.topUpPackages || [];
  const packagesMarkup = packageChoices(packages);
  const packageHost = one("[data-wallet-packages]");
  if (packageHost.dataset.packages !== packagesMarkup) {
    packageHost.innerHTML = packagesMarkup;
    packageHost.dataset.packages = packagesMarkup;
  }
  root.querySelectorAll("[data-wallet-package]").forEach((button) => {
    const selected = Number(button.dataset.walletPackage) === Number(model.selectedPackage?.amount);
    button.setAttribute("aria-pressed", String(Boolean(model.selectedPackage && selected)));
    button.disabled = Boolean(model.interactionBusy);
  });

  const email = one("[data-topup-email]");
  if (email.value !== (model.receiptEmail || "")) email.value = model.receiptEmail || "";
  email.disabled = Boolean(model.interactionBusy);
  email.setAttribute("aria-invalid", String(Boolean(model.emailError)));
  setHidden("[data-wallet-email-error]", !model.emailError);
  setText("[data-wallet-email-error]", model.emailError);
  const selection = model.selectedPackage;
  setHidden("[data-wallet-selection-title]", Boolean(selection));
  for (const selector of ["[data-wallet-selection-amount]", "[data-wallet-selection-credits]", "[data-wallet-selection-duration]", "[data-wallet-selection-email]"]) setHidden(selector, !selection);
  setText("[data-wallet-selection-amount]", selection?.amountLabel);
  setText("[data-wallet-selection-credits]", selection?.creditsLabel);
  setText("[data-wallet-selection-duration]", selection?.durationLabel);
  setText("[data-wallet-selection-email]", selection ? model.receiptEmail || "—" : "");
  const pay = one('[data-wallet-action="pay"]');
  pay.disabled = !authenticated || !selection || !model.validEmail || Boolean(model.interactionBusy);
  pay.textContent = model.paymentBusy ? "Открываем оплату…" : "Перейти к оплате";

  const pending = model.latestPendingPayment;
  setHidden("[data-wallet-pending]", !pending);
  setText("[data-wallet-pending-amount]", pending?.amountLabel);
  setText("[data-wallet-pending-credits]", pending?.creditsLabel);
  setText("[data-wallet-pending-message]", pending?.message);
  const refresh = one('[data-wallet-pending] [data-wallet-action="refresh"]');
  refresh.disabled = Boolean(model.interactionBusy || model.loading);
  setHidden("[data-wallet-refresh-spinner]", !model.loading);
  setText("[data-wallet-refresh-label]", model.loading ? "Обновляем статус…" : "Обновить статус");

  const historyMarkup = !authenticated || !model.cabinetLoaded ? "" : historyRows(model.paymentHistory || []);
  if (one("[data-wallet-history]").innerHTML !== historyMarkup) one("[data-wallet-history]").innerHTML = historyMarkup;
  setHidden('[data-wallet-action="more"]', !model.hasMoreHistory);
  return root;
}
