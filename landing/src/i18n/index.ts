import { en } from './en';
import { ru } from './ru';
import { getLocaleFromHostname, localeDomains, localePreviewPrefixes } from './domains';
import type { Dictionary, Locale } from './types';

export type { Dictionary, Locale } from './types';
export { getLocaleFromHostname, localeDomains, localePreviewPrefixes } from './domains';
export const dictionaries: Record<Locale, Dictionary> = { ru, en };
export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];

const publicQueryKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'market'];

export function getNavigationUrl(locale: Locale, pathname: string, preview = false): string {
  return preview ? getLocalizedUrl({ locale, pathname, preview: true }) : pathname;
}

export function getPreviewLocale(pathname: string): Locale | undefined {
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  if (pathname === '/ru' || pathname.startsWith('/ru/')) return 'ru';
  return undefined;
}

export function stripPreviewPrefix(pathname: string): string {
  const locale = getPreviewLocale(pathname);
  if (!locale) return pathname || '/';
  return pathname.slice(localePreviewPrefixes[locale].length) || '/';
}

export function resolveLocale({ hostname, pathname = '/', search = '', domainRoutingEnabled = false }: { hostname: string; pathname?: string; search?: string; domainRoutingEnabled?: boolean }): Locale {
  // Preview paths are explicit and remain available without changing production routing.
  const preview = getPreviewLocale(pathname);
  if (preview) return preview;
  const hostLocale = getLocaleFromHostname(hostname);
  const isProductionHost = hostLocale !== undefined;
  if (!isProductionHost) {
    const override = new URLSearchParams(search).get('locale');
    if (override === 'ru' || override === 'en') return override;
  }
  return domainRoutingEnabled ? hostLocale ?? 'ru' : 'ru';
}

export function getLocalizedUrl({ locale, pathname, search = '', preview = false }: { locale: Locale; pathname: string; search?: string; preview?: boolean }): string {
  const normalized = stripPreviewPrefix(pathname).replace(/^\/?/, '/');
  const incoming = new URLSearchParams(search);
  const query = new URLSearchParams();
  for (const key of publicQueryKeys) {
    const value = incoming.get(key);
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  const targetPath = preview ? `${localePreviewPrefixes[locale]}${normalized}` : normalized;
  return `${preview ? '' : localeDomains[locale]}${targetPath}${suffix}`;
}

export function getCanonicalUrl(locale: Locale, pathname: string): string {
  return getLocalizedUrl({ locale, pathname: new URL(pathname, localeDomains[locale]).pathname });
}
