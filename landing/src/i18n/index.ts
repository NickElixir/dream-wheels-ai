import { en } from './en';
import { ru } from './ru';
import type { Dictionary, Locale } from './types';

export type { Dictionary, Locale } from './types';
export const dictionaries: Record<Locale, Dictionary> = { ru, en };
export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];

export const localeDomains: Record<Locale, string> = {
  ru: 'https://колесамечты.рф',
  en: 'https://dreamwheels.pro',
};
const localeHosts = { ru: new URL(localeDomains.ru).hostname, en: new URL(localeDomains.en).hostname };

export const localePreviewPrefixes: Record<Locale, string> = { ru: '/ru', en: '/en' };

export function getLocaleFromHostname(hostname: string): Locale | undefined {
  if (!hostname) return undefined;
  const host = new URL(`https://${hostname.toLowerCase().replace(/\.$/, '')}`).hostname;
  if (host === localeHosts.en || host === `www.${localeHosts.en}`) return 'en';
  if (host === localeHosts.ru || host === `www.${localeHosts.ru}`) return 'ru';
  return undefined;
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
  const query = new URLSearchParams(search);
  query.delete('locale');
  const suffix = query.size ? `?${query.toString()}` : '';
  const targetPath = preview ? `${localePreviewPrefixes[locale]}${normalized}` : normalized;
  return `${preview ? '' : localeDomains[locale]}${targetPath}${suffix}`;
}

export function getCanonicalUrl(locale: Locale, pathname: string): string {
  return getLocalizedUrl({ locale, pathname: new URL(pathname, localeDomains[locale]).pathname });
}
