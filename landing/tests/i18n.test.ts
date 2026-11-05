import assert from 'node:assert/strict';
import test from 'node:test';
import { dictionaries, getCanonicalUrl, getLocalizedUrl, getNavigationUrl, getLocaleFromHostname, resolveLocale, stripPreviewPrefix } from '../src/i18n';
import { domainI18nEnabled } from '../src/i18n/config';
import { getCandidateHostname, getInternalLocalePath } from '../src/i18n/routing';

const keys = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) => keys(nested, prefix ? `${prefix}.${key}` : key)).sort();
};

test('RU and EN dictionaries have the same keys and eight FAQ entries', () => {
  assert.deepEqual(keys(dictionaries.ru), keys(dictionaries.en));
  assert.equal(dictionaries.ru.faq.questions.length, 8);
  assert.equal(dictionaries.en.faq.questions.length, 8);
  dictionaries.en.faq.questions.forEach(({ question, answer }) => {
    assert.ok(question.length > 0);
    assert.ok(answer.length > 0);
  });
});

test('footer email uses the international contact only for EN', () => {
  assert.equal(dictionaries.en.footer.email, 'dreamwheelai@gmail.com');
  assert.equal(dictionaries.ru.footer.email, 'dreamwheelsai@yandex.ru');
  assert.equal(dictionaries.en.footer.privacy, 'Privacy Policy');
  assert.equal(dictionaries.en.footer.agreement, 'Terms of Service');
});

test('host resolver fixes RU/EN by domain and accepts the existing www alias', () => {
  assert.equal(resolveLocale({ hostname: 'dreamwheels.pro', domainRoutingEnabled: true }), 'en');
  assert.equal(resolveLocale({ hostname: 'dream-wheels.ru', domainRoutingEnabled: true }), 'ru');
  assert.equal(resolveLocale({ hostname: 'www.dream-wheels.ru', domainRoutingEnabled: true }), 'ru');
  assert.equal(domainI18nEnabled, true);
  assert.equal(resolveLocale({ hostname: 'dreamwheels.pro', domainRoutingEnabled: domainI18nEnabled }), 'en');
  assert.equal(resolveLocale({ hostname: 'preview.vercel.app' }), 'ru');
  assert.equal(resolveLocale({ hostname: 'preview.vercel.app', pathname: '/en/catalog' }), 'en');
  assert.equal(resolveLocale({ hostname: 'localhost', search: '?locale=en' }), 'en');
  assert.equal(resolveLocale({ hostname: 'dreamwheels.pro', search: '?locale=en' }), 'ru');
});

test('equivalent URLs preserve path and query but omit preview locale parameter', () => {
  assert.equal(getLocalizedUrl({ locale: 'en', pathname: '/', search: '?utm_source=test' }), 'https://dreamwheels.pro/?utm_source=test');
  assert.equal(getLocalizedUrl({ locale: 'ru', pathname: '/catalog', search: '?utm_source=test&market=ru' }), 'https://www.dream-wheels.ru/catalog?utm_source=test&market=ru');
  assert.equal(getLocalizedUrl({ locale: 'en', pathname: '/ru/catalog', search: '?locale=ru&utm_source=test', preview: true }), '/en/catalog?utm_source=test');
  assert.equal(stripPreviewPrefix('/en/catalog'), '/catalog');
  assert.equal(getCanonicalUrl('en', '/catalog?utm_source=test'), 'https://dreamwheels.pro/catalog');
  assert.equal(getCanonicalUrl('ru', '/?utm_campaign=test'), 'https://www.dream-wheels.ru/');
});

test('only public Landing and Catalog paths are internally rewritten for known hosts', () => {
  const mappings = [
    ['dreamwheels.pro', '/', '/localized/en/'],
    ['dreamwheels.pro', '/catalog', '/localized/en/catalog'],
    ['dream-wheels.ru', '/', '/localized/ru/'],
    ['dream-wheels.ru', '/catalog', '/localized/ru/catalog'],
    ['www.dream-wheels.ru', '/catalog/', '/localized/ru/catalog'],
  ];
  for (const [host, path, expected] of mappings) {
    assert.equal(getInternalLocalePath(host, path), expected);
  }
  for (const path of ['/app/', '/app/new', '/app/history', '/t/', '/t/new', '/api/backend/health', '/en/', '/ru/catalog']) {
    assert.equal(getInternalLocalePath('dreamwheels.pro', path), undefined);
  }
  assert.equal(getInternalLocalePath('unknown.vercel.app', '/'), undefined);
});

test('candidate host override is limited to Vercel previews and recognized domains', () => {
  assert.equal(getCandidateHostname(new URL('https://preview.vercel.app/'), 'dreamwheels.pro', true), 'dreamwheels.pro');
  assert.equal(getCandidateHostname(new URL('https://preview.vercel.app/'), 'dream-wheels.ru', true), 'dream-wheels.ru');
  assert.equal(getCandidateHostname(new URL('https://preview.vercel.app/'), 'other.example', true), 'preview.vercel.app');
  assert.equal(getCandidateHostname(new URL('https://preview.vercel.app/'), 'dreamwheels.pro', false), 'preview.vercel.app');
  assert.equal(getCandidateHostname(new URL('https://dreamwheels.pro/'), 'dream-wheels.ru', true), 'dreamwheels.pro');
});


test('production domain locale cannot be changed by the preview query override', () => {
  assert.equal(resolveLocale({ hostname: 'dreamwheels.pro', search: '?locale=ru', domainRoutingEnabled: true }), 'en');
  assert.equal(resolveLocale({ hostname: 'www.dream-wheels.ru', search: '?locale=en', domainRoutingEnabled: true }), 'ru');
  assert.equal(getLocaleFromHostname('WWW.DREAM-WHEELS.RU.'), 'ru');
  assert.equal(getLocaleFromHostname('dreamwheels.pro.evil.test'), undefined);
  assert.equal(getLocaleFromHostname('колесамечты.рф'), undefined);
});

test('locale switching only transfers public attribution fields', () => {
  assert.equal(getLocalizedUrl({ locale: 'en', pathname: '/ru/catalog', search: '?locale=ru&token=secret&next=https://evil.test&utm_source=retailer&market=ru' }), 'https://dreamwheels.pro/catalog?utm_source=retailer&market=ru');
});

test('local preview navigation preserves the page language and public navigation uses clean paths', () => {
  assert.equal(getNavigationUrl('en', '/catalog', true), '/en/catalog');
  assert.equal(getNavigationUrl('en', '/', true), '/en/');
  assert.equal(getNavigationUrl('ru', '/catalog', true), '/ru/catalog');
  assert.equal(getNavigationUrl('en', '/catalog'), '/catalog');
  assert.equal(getCanonicalUrl('ru', '/catalog'), 'https://www.dream-wheels.ru/catalog');
});
