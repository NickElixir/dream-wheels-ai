// Local release candidate. Publishing remains a separate, approved operation.
export const domainI18nEnabled = true;

// Static hosts receive their own root HTML; no runtime middleware is required.
export const buildLocale = import.meta.env?.PUBLIC_LANDING_LOCALE === 'en' ? 'en' : 'ru';
