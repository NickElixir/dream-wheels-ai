const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'market'];
const ruDomain = new URL('https://колесамечты.рф').hostname;

export function getAppTargetFromUrl(currentUrl: string, path = '/app/new') {
  const current = new URL(currentUrl);
  const targetOrigin = current.hostname === ruDomain || current.hostname === `www.${ruDomain}` ? current.origin : 'https://dreamwheels.pro';
  const target = new URL(path, targetOrigin);
  attributionKeys.forEach((key) => {
    const value = current.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  });
  return target.toString();
}

export function getAppTarget(path = '/app/new') {
  if (typeof window === 'undefined') return `https://dreamwheels.pro${path}`;
  return getAppTargetFromUrl(window.location.href, path);
}
