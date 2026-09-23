import type { Locale } from './types.js';

export const localeDomains: Record<Locale, string> = {
  ru: 'https://колесамечты.рф',
  en: 'https://dreamwheels.pro',
};

const localeHosts = {
  ru: new URL(localeDomains.ru).hostname,
  en: new URL(localeDomains.en).hostname,
};

export const localePreviewPrefixes: Record<Locale, string> = { ru: '/ru', en: '/en' };

export function getLocaleFromHostname(hostname: string): Locale | undefined {
  if (!hostname) return undefined;
  const host = new URL(`https://${hostname.toLowerCase().replace(/\.$/, '')}`).hostname;
  if (host === localeHosts.en || host === `www.${localeHosts.en}`) return 'en';
  if (host === localeHosts.ru || host === `www.${localeHosts.ru}`) return 'ru';
  return undefined;
}
