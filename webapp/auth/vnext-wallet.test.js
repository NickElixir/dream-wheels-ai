import { buildFitmentRimReadiness } from "../vnext/fitment-readiness.mjs";
import { fitmentDisplayValue } from "../vnext/fitment-display.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  applicationRouteContext,
  applicationTopLevelReturnPath,
  isApplicationRoute,
  safeApplicationReturnPath,
} from "../app-route.mjs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")
  .replace(/^import \{[\s\S]*?\} from "\.\/app-route\.mjs";\n\n/u, `const fitmentDisplayValue = ${fitmentDisplayValue.toString()};\nconst buildFitmentRimReadiness = ${buildFitmentRimReadiness.toString()};\n`).replace(/import \{ fitmentDisplayValue \} from "\.\/vnext\/fitment-display\.mjs";\nimport \{ buildFitmentRimReadiness \} from "\.\/vnext\/fitment-readiness\.mjs";\n\n/u, "");

function runtime({ telegram = false, pathname = "/app/wallet", search = "", applicationRoute = false } = {}) {
  const calls = [];
  const redirects = [];
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const location = new URL(`${pathname}${search}`, "https://example.test");
  const context = {
    URL, URLSearchParams, Blob, FormData, console,
    applicationRouteContext, applicationTopLevelReturnPath, isApplicationRoute, safeApplicationReturnPath,
    applicationRoute,
    document: {
      documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {} }, appendChild() {} },
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ click() {}, remove() {}, set textContent(value) { this.innerHTML = String(value); } }),
    },
    window: {
      Telegram: telegram ? { WebApp: { expand() {}, platform: "ios" } } : {}, location,
      dispatchEvent() {}, scrollTo() {}, setTimeout, clearTimeout,
      history: { replaceState(_state, _title, path) { location.href = new URL(path, location.origin).href; } },
    },
    localStorage: storage, sessionStorage: storage,
    navigator: { language: "ru-RU", userAgent: "test" },
    setTimeout, clearTimeout,
  };
  vm.runInNewContext(`
${source}
renderDashboard = () => {};
trackEvent = async () => {};
getWebsiteAuthToken = () => "test-token";
withAuthHeaders = () => ({ Authorization: "Bearer test-token" });
getIdentityPayload = () => ({});
apiUrl = (path) => path;
openPaymentUrl = (url) => globalThis.redirects.push(url);
authenticatedFetch = async (url, options = {}) => {
  globalThis.calls.push({ url, options });
  if (url === "/payments/topups") return { ok: true, json: async () => ({ payment_url: "https://provider.test/invoice" }) };
  return { ok: true, json: async () => ({ balance: 25, payments: [], credit_packages: [] }) };
};
globalThis.calls = [];
globalThis.redirects = [];
globalThis.api = {
  state, bridge: window.dreamwheelsWalletBridge, loadCabinet, createPayment,
  handlePaymentReturn, paymentReturnContext, schedulePendingInvoiceRefresh, clearPendingRefreshTimer,
  resetApplicationSessionState: clearApplicationSessionState,
  setFetch: (fetcher) => { authenticatedFetch = fetcher; },
};
state.applicationAuthRequired = globalThis.applicationRoute;
`, context);
  return { ...context.api, calls: context.calls, redirects: context.redirects, location };
}

test("Wallet projects cabinet balance, FIFO expiry, starter grant and runtime pricing without calculating credits", () => {
  const app = runtime();
  app.state.balance = 25;
  app.state.creditPackages = [
    { id: "late", remainingCredits: 15, expiresAt: "2099-10-21T00:00:00Z", source: "purchase" },
    { id: "early", remainingCredits: 10, expiresAt: "2099-10-12T00:00:00Z", source: "starter_grant" },
  ];
  app.state.starterGrant = { credits: 10 };
  const model = app.bridge.snapshot();
  assert.equal(model.balance, 25);
  assert.equal(model.balanceUnit, "рендеров");
  assert.deepEqual(Array.from(model.expiryCohorts, (item) => item.creditsLabel), ["10 рендеров", "15 рендеров"]);
  assert.equal(model.starterGrant.credits, 10);
  assert.deepEqual(Array.from(model.topUpPackages, (item) => [item.amount, item.creditsLabel]), [
    [100, "3 рендера"], [200, "7 рендеров"], [500, "20 рендеров"], [1000, "45 рендеров"],
  ]);
  app.bridge.selectPackage(500);
  assert.equal(app.bridge.snapshot().selectedPackage.durationLabel, "30 дней");
});

test("Wallet keeps pending operational state separate from paid and failed history, and expands history", () => {
  const app = runtime();
  const entries = Array.from({ length: 12 }, (_, index) => ({
    invoiceId: index + 1, amount: 500, credits: 20, createdAt: "28.09.2026, 12:00:00",
    createdAtMs: Date.now(), status: index === 0 ? "pending" : index === 1 ? "paid" : "failed",
  }));
  app.state.payments = entries;
  let model = app.bridge.snapshot();
  assert.equal(model.latestPendingPayment.amountLabel, "500 ₽");
  assert.deepEqual(Array.from(model.paymentHistory.slice(0, 3), (item) => item.statusLabel), ["В ожидании", "Оплачено", "Сбой"]);
  assert.equal(model.paymentHistory.length, 10);
  assert.equal(model.hasMoreHistory, true);
  app.bridge.showMoreHistory();
  model = app.bridge.snapshot();
  assert.equal(model.paymentHistory.length, 12);
  assert.equal(model.hasMoreHistory, false);
  app.state.payments[0].status = "paid";
  assert.equal(app.bridge.snapshot().latestPendingPayment, null);
});

test("Wallet preserves receipt email after validation and sends unchanged web payment contract", async () => {
  const app = runtime();
  app.bridge.selectPackage(500);
  app.bridge.setReceiptEmail("bad-address");
  assert.equal(app.bridge.snapshot().emailError, "Введите корректный email");
  assert.equal(app.bridge.snapshot().receiptEmail, "bad-address");
  app.bridge.setReceiptEmail("nikolai@example.test");
  await app.bridge.createPayment();
  const request = app.calls.find((call) => call.url === "/payments/topups");
  assert.ok(request);
  assert.deepEqual(JSON.parse(request.options.body), {
    amount_rub: "500.00", email: "nikolai@example.test", pricing_version: "credits-v1",
    source_screen: "cabinet", client_channel: "web", return_to: "/app/wallet",
  });
  assert.equal(app.redirects[0], "https://provider.test/invoice");
  assert.equal(app.state.balance, 25, "cabinet response remains the balance authority");
});

test("Web payment always returns to Wallet, even when the current application route differs", async () => {
  for (const [pathname, search, expected] of [
    ["/app/wallet", "", "/app/wallet"],
    ["/app", "", "/app/wallet"],
    ["/app/wallet", "?market=ru&utm_source=x&payment=success", "/app/wallet?market=ru&utm_source=x"],
  ]) {
    const app = runtime({ pathname, search, applicationRoute: true });
    assert.deepEqual({ ...app.paymentReturnContext() }, { client_channel: "web", return_to: expected });
    app.bridge.selectPackage(100);
    app.bridge.setReceiptEmail("nikolai@example.test");
    await app.bridge.createPayment();
    const request = app.calls.find((call) => call.url === "/payments/topups");
    assert.equal(JSON.parse(request.options.body).return_to, expected);
  }
});

test("Telegram payment return keeps /t/ and a redirect result does not mark an invoice paid", () => {
  const app = runtime({ telegram: true, pathname: "/t/", search: "?payment=success" });
  assert.deepEqual({ ...app.paymentReturnContext() }, { client_channel: "telegram", return_to: "/t/" });
  app.state.payments = [{ invoiceId: 4, amount: 100, credits: 3, status: "pending", createdAtMs: Date.now() }];
  app.handlePaymentReturn();
  assert.equal(app.state.payments[0].status, "pending");
  assert.match(app.state.walletMessage, /Проверяем оплату/);
});

test("Legacy website success and fail returns select Wallet without an early cabinet request", () => {
  for (const paymentState of ["success", "fail"]) {
    const app = runtime({ pathname: "/app", search: `?payment=${paymentState}&invoice_id=53`, applicationRoute: true });
    app.state.balance = 25;
    app.state.payments = [{ invoiceId: 53, amount: 100, credits: 3, status: "pending", createdAtMs: Date.now() }];
    app.handlePaymentReturn();
    assert.equal(app.state.view, "wallet");
    assert.equal(app.location.pathname, "/app/wallet");
    assert.equal(app.location.search, "");
    assert.equal(app.state.paymentReturnState, paymentState);
    assert.equal(app.state.balance, 25);
    assert.equal(app.state.payments[0].status, "pending");
    assert.equal(app.calls.length, 0, "return handler must wait for normal auth/bootstrap cabinet loading");
    if (paymentState === "fail") assert.match(app.state.walletMessage, /Платеж не завершен/);
    else assert.match(app.state.walletMessage, /Проверяем оплату/);
  }
});

test("Website success return keeps pending until the cabinet confirms payment", async () => {
  const app = runtime({ pathname: "/app", search: "?payment=success", applicationRoute: true });
  app.state.balance = 25;
  app.handlePaymentReturn();
  app.setFetch(async () => ({ ok: true, json: async () => ({
    balance: 25, credit_packages: [], payments: [{
      invoice_id: 53, amount: 100, credits_granted: 3, status: "pending",
      created_at: new Date().toISOString(),
    }],
  }) }));
  await app.loadCabinet();
  assert.equal(app.state.balance, 25);
  assert.equal(app.state.payments[0].status, "pending");
  assert.ok(app.bridge.snapshot().latestPendingPayment);
  app.clearPendingRefreshTimer();
});

test("Website success return takes paid status and new balance only from cabinet", async () => {
  const app = runtime({ pathname: "/app", search: "?payment=success", applicationRoute: true });
  app.state.balance = 25;
  app.handlePaymentReturn();
  assert.equal(app.state.balance, 25);
  app.setFetch(async () => ({ ok: true, json: async () => ({
    balance: 28, credit_packages: [], payments: [{
      invoice_id: 53, amount: 100, credits_granted: 3, status: "paid",
      created_at: new Date().toISOString(),
    }],
  }) }));
  await app.loadCabinet();
  assert.equal(app.state.balance, 28);
  assert.equal(app.state.payments[0].status, "paid");
  assert.equal(app.bridge.snapshot().latestPendingPayment, null);
});

test("Cancelled and expired invoices retain the existing failed mapping without a pending island", () => {
  const app = runtime();
  app.state.payments = ["cancelled", "expired"].map((status, index) => ({
    invoiceId: index + 1, amount: 200, credits: 7,
    createdAt: "28.09.2026, 12:00:00", createdAtMs: Date.now(), status,
  }));
  const model = app.bridge.snapshot();
  assert.equal(model.latestPendingPayment, null);
  assert.deepEqual(Array.from(model.paymentHistory, (item) => item.statusLabel), ["Сбой", "Сбой"]);
  assert.deepEqual(Array.from(model.paymentHistory, (item) => item.tone), ["warning", "warning"]);
});

test("Cabinet pending guidance appears only in the pending island", async () => {
  const app = runtime();
  app.setFetch(async () => ({ ok: true, json: async () => ({
    balance: 25, credit_packages: [], payments: [{
      invoice_id: 9, amount: 500, credits_granted: 20, status: "pending",
      created_at: new Date().toISOString(),
    }],
  }) }));
  await app.loadCabinet();
  const model = app.bridge.snapshot();
  assert.equal(model.message, "");
  assert.equal(model.cabinetLoaded, true);
  assert.match(model.latestPendingPayment.message, /Оплата создана/);
  app.clearPendingRefreshTimer();
});

test("Successful return waits for cabinet confirmation and failed return does not discard history", async () => {
  const app = runtime({ search: "?payment=success" });
  app.state.payments = [{ invoiceId: 4, amount: 100, credits: 3, status: "pending", createdAtMs: Date.now() }];
  app.handlePaymentReturn();
  assert.equal(app.bridge.snapshot().messageTone, "neutral");
  await app.loadCabinet();
  assert.equal(app.state.balance, 25);
  const failed = runtime({ search: "?payment=fail" });
  failed.state.payments = [{ invoiceId: 5, amount: 200, credits: 7, status: "failed", createdAtMs: Date.now() }];
  failed.handlePaymentReturn();
  assert.match(failed.bridge.snapshot().message, /Платеж не завершен/);
  assert.equal(failed.bridge.snapshot().paymentHistory.length, 1);
});

test("Wallet presentation contains no network, timer, balance calculation or provider URL construction", () => {
  const viewSource = fs.readFileSync(new URL("../vnext/views/wallet.js", import.meta.url), "utf8");
  for (const forbidden of [/\bfetch\s*\(/u, /\bsetTimeout\s*\(/u, /\bpayment_url\b/u, /\bcredits\s*\+/u, /\bbalance\s*\+/u]) {
    assert.doesNotMatch(viewSource, forbidden);
  }
  assert.match(viewSource, /!authenticated \|\| !model\.cabinetLoaded \? "" : historyRows/u);
});

test("Initial cabinet loading and failure do not claim that payment history is empty", async () => {
  const app = runtime();
  assert.equal(app.bridge.snapshot().cabinetLoaded, false);

  let resolveRequest;
  app.setFetch(() => new Promise((resolve) => { resolveRequest = resolve; }));
  const pending = app.loadCabinet();
  assert.equal(app.bridge.snapshot().cabinetLoaded, false);
  assert.equal(app.bridge.snapshot().cabinetError, "");
  resolveRequest({ ok: false, status: 503, statusText: "Service Unavailable", json: async () => ({ detail: "Cabinet unavailable" }) });
  await pending;

  const failed = app.bridge.snapshot();
  assert.equal(failed.cabinetLoaded, false);
  assert.match(failed.cabinetError, /Cabinet unavailable/u);
  assert.deepEqual(Array.from(failed.paymentHistory), []);
});

test("Successful empty cabinet establishes authoritative empty history", async () => {
  const app = runtime();
  app.setFetch(async () => ({ ok: true, json: async () => ({ balance: 25, payments: [], credit_packages: [] }) }));
  await app.loadCabinet();
  assert.equal(app.bridge.snapshot().cabinetLoaded, true);
  assert.deepEqual(Array.from(app.bridge.snapshot().paymentHistory), []);
  app.clearPendingRefreshTimer();
});

test("Refresh failure preserves loaded payment history and its loaded provenance", async () => {
  const app = runtime();
  const payment = {
    invoice_id: 71, amount: 500, credits_granted: 20, status: "paid",
    created_at: "2026-09-27T18:00:00Z", paid_at: "2026-09-27T18:01:00Z",
  };
  app.setFetch(async () => ({ ok: true, json: async () => ({ balance: 25, payments: [payment], credit_packages: [] }) }));
  await app.loadCabinet();
  const historyBefore = Array.from(app.bridge.snapshot().paymentHistory, (item) => ({ ...item }));
  assert.equal(app.bridge.snapshot().cabinetLoaded, true);

  app.setFetch(async () => ({ ok: false, status: 503 }));
  await app.loadCabinet();
  const afterFailure = app.bridge.snapshot();
  assert.equal(afterFailure.cabinetLoaded, true);
  assert.ok(afterFailure.cabinetError);
  assert.deepEqual(Array.from(afterFailure.paymentHistory, (item) => ({ ...item })), historyBefore);
  app.clearPendingRefreshTimer();
});

test("A later refresh error retains a previously authoritative empty-history state", async () => {
  const app = runtime();
  app.setFetch(async () => ({ ok: true, json: async () => ({ balance: 25, payments: [], credit_packages: [] }) }));
  await app.loadCabinet();
  app.setFetch(async () => ({ ok: false, status: 503 }));
  await app.loadCabinet();
  assert.equal(app.bridge.snapshot().cabinetLoaded, true);
  assert.deepEqual(Array.from(app.bridge.snapshot().paymentHistory), []);
  app.clearPendingRefreshTimer();
});

test("Full application session reset clears cabinet loaded provenance", () => {
  const app = runtime();
  app.state.walletCabinetLoaded = true;
  app.resetApplicationSessionState();
  assert.equal(app.state.walletCabinetLoaded, false);
});

test("Cabinet error retains the last known balance and auth loss hides old account data", async () => {
  const app = runtime();
  app.state.balance = 25;
  app.setFetch(async () => ({ ok: false, status: 503 }));
  await app.loadCabinet();
  assert.equal(app.state.balance, 25);
  assert.ok(app.bridge.snapshot().cabinetError);
  app.state.frontendAuthState = { authority: "supabase", status: "AUTHENTICATED", protectedApiReady: false };
  const expired = app.bridge.snapshot();
  assert.equal(expired.authenticated, false);
  assert.equal(expired.balance, null);
  assert.equal(expired.latestPendingPayment, null);
  assert.equal(expired.paymentHistory.length, 0);
});
