export function accountPresentation(account = {}, locale = "ru") {
  const identifier = String(account.accountIdentifier || "").trim() || (locale === "ru" ? "Аккаунт" : "Account");
  const local = identifier.replace(/^@/, "").split("@")[0];
  const parts = local.split(/[\s._-]+/u).filter(Boolean);
  const initials = account.accountIdentifier ? (parts.length > 1 ? parts.slice(0, 2).map(part => Array.from(part)[0]).join("") : Array.from(local).slice(0, 2).join("")).toLocaleUpperCase(locale) : "DW";
  const balance = account.balance;
  const known = typeof balance === "number" && Number.isFinite(balance) && balance >= 0;
  const unit = locale === "en" ? balance === 1 ? "render" : "renders" : ({one:"рендер",few:"рендера",many:"рендеров",other:"рендера"}[new Intl.PluralRules("ru").select(balance)]);
  const subtitle = known ? `${balance.toLocaleString(locale)} ${unit}` : account.error ? locale === "ru" ? "Баланс недоступен" : "Balance unavailable" : locale === "ru" ? "Загружаем баланс" : "Loading balance";
  return { identifier, initials, subtitle };
}
