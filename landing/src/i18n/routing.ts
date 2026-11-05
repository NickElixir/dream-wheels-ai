import { getLocaleFromHostname } from './domains.js';

export function getInternalLocalePath(hostname: string, pathname: string): string | undefined {
  if (pathname !== '/' && pathname !== '/catalog' && pathname !== '/catalog/') return undefined;
  const locale = getLocaleFromHostname(hostname);
  if (!locale) return undefined;
  return pathname === '/' ? `/localized/${locale}/` : `/localized/${locale}/catalog`;
}

export function getCandidateHostname(requestUrl: URL, header: string | null, isPreviewDeployment: boolean): string {
  // The override works only on preview deployments and preview hosts.
  if (!isPreviewDeployment || !requestUrl.hostname.endsWith('.vercel.app') || !header) return requestUrl.hostname;
  return getLocaleFromHostname(header) ? header : requestUrl.hostname;
}
