const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'market'];
const ruDomain = new URL('https://колесамечты.рф').hostname;
const timeweb = import.meta.env?.PUBLIC_LANDING_HOSTING === 'timeweb';

export function getStaticAppTarget() {
  return timeweb ? 'https://app.dream-wheels.ru/new' : 'https://dreamwheels.pro/app/new';
}

export function getLoginTarget() {
  return timeweb ? 'https://app.dream-wheels.ru/' : getStaticAppTarget();
}

export function getAppTargetFromUrl(currentUrl: string, path?: string, hosting = timeweb ? 'timeweb' : 'vercel') {
  const current = new URL(currentUrl);
  const targetOrigin = hosting === 'timeweb' ? 'https://app.dream-wheels.ru' : current.hostname === ruDomain || current.hostname === `www.${ruDomain}` ? current.origin : 'https://dreamwheels.pro';
  const target = new URL(path ?? (hosting === 'timeweb' ? '/new' : '/app/new'), targetOrigin);
  attributionKeys.forEach((key) => {
    const value = current.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  });
  return target.toString();
}

export function getAppTarget(path?: string) {
  if (typeof window === 'undefined') return path ? new URL(path, getStaticAppTarget()).toString() : getStaticAppTarget();
  return getAppTargetFromUrl(window.location.href, path);
}
