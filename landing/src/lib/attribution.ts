const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'market'];

export function getAppTargetFromUrl(currentUrl: string, path = '/app/new') {
  const current = new URL(currentUrl);
  const target = new URL(`https://dreamwheels.pro${path}`);
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
