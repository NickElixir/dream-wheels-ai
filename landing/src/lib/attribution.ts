const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'market'];
const ruHosts = new Set(['dream-wheels.ru', 'www.dream-wheels.ru', new URL('https://колесамечты.рф').hostname]);
const timeweb = import.meta.env?.PUBLIC_LANDING_HOSTING === 'timeweb';

export function getStaticAppTarget() {
  return timeweb ? 'https://app.dream-wheels.ru/new' : 'https://app.dreamwheels.pro/new';
}

export function getLoginTarget() {
  return timeweb ? 'https://app.dream-wheels.ru/' : 'https://app.dreamwheels.pro/';
}

export function getAppTargetFromUrl(currentUrl: string, path?: string, hosting = timeweb ? 'timeweb' : 'vercel') {
  const current = new URL(currentUrl);
  const targetOrigin = hosting === 'timeweb' ? 'https://app.dream-wheels.ru' : ruHosts.has(current.hostname) ? 'https://app.dream-wheels.ru' : 'https://app.dreamwheels.pro';
  const target = new URL(path ?? '/new', targetOrigin);
  attributionKeys.forEach((key) => {
    const value = current.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  });
  return target.toString();
}

export function getAppTarget(path?: string) {
  if (typeof window === 'undefined') return path ? new URL(path, getStaticAppTarget()).toString() : getStaticAppTarget();
  const target = new URL(getAppTargetFromUrl(window.location.href, path));
  target.searchParams.set("registration_source", window.location.pathname.includes("/catalog") ? "catalog" : "landing");
  target.searchParams.set("registration_locale", document.documentElement.lang === "ru" ? "ru" : "en");
  return target.toString();
}
