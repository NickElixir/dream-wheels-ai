import assert from 'node:assert/strict';
import test from 'node:test';
import { dictionaries, getCanonicalUrl, getLocalizedUrl, resolveLocale, stripPreviewPrefix } from '../src/i18n';
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

test('host resolver supports Unicode and punycode, with deterministic safe fallback', () => {
  assert.equal(resolveLocale({ hostname: 'dreamwheels.pro', domainRoutingEnabled: true }), 'en');
  assert.equal(resolveLocale({ hostname: 'колесамечты.рф', domainRoutingEnabled: true }), 'ru');
  assert.equal(resolveLocale({ hostname: 'xn--80ajbrfik0am3c5b.xn--p1ai', domainRoutingEnabled: true }), 'ru');
  assert.equal(domainI18nEnabled, true);
  assert.equal(resolveLocale({ hostname: 'dreamwheels.pro', domainRoutingEnabled: domainI18nEnabled }), 'en');
  assert.equal(resolveLocale({ hostname: 'preview.vercel.app' }), 'ru');
  assert.equal(resolveLocale({ hostname: 'preview.vercel.app', pathname: '/en/catalog' }), 'en');
  assert.equal(resolveLocale({ hostname: 'localhost', search: '?locale=en' }), 'en');
  assert.equal(resolveLocale({ hostname: 'dreamwheels.pro', search: '?locale=en' }), 'ru');
});

test('equivalent URLs preserve path and query but omit preview locale parameter', () => {
  assert.equal(getLocalizedUrl({ locale: 'en', pathname: '/', search: '?utm_source=test' }), 'https://dreamwheels.pro/?utm_source=test');
  assert.equal(getLocalizedUrl({ locale: 'ru', pathname: '/catalog', search: '?utm_source=test&market=ru' }), 'https://колесамечты.рф/catalog?utm_source=test&market=ru');
  assert.equal(getLocalizedUrl({ locale: 'en', pathname: '/ru/catalog', search: '?locale=ru&utm_source=test', preview: true }), '/en/catalog?utm_source=test');
  assert.equal(stripPreviewPrefix('/en/catalog'), '/catalog');
  assert.equal(getCanonicalUrl('en', '/catalog?utm_source=test'), 'https://dreamwheels.pro/catalog');
  assert.equal(getCanonicalUrl('ru', '/?utm_campaign=test'), 'https://колесамечты.рф/');
});

test('only public Landing and Catalog paths are internally rewritten for known hosts', () => {
  const mappings = [
    ['dreamwheels.pro', '/', '/en/'],
    ['dreamwheels.pro', '/catalog', '/en/catalog'],
    ['колесамечты.рф', '/', '/ru/'],
    ['колесамечты.рф', '/catalog', '/ru/catalog'],
    ['xn--80ajbrfik0am3c5b.xn--p1ai', '/catalog/', '/ru/catalog'],
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
  assert.equal(getCandidateHostname(new URL('https://preview.vercel.app/'), 'колесамечты.рф', true), 'колесамечты.рф');
  assert.equal(getCandidateHostname(new URL('https://preview.vercel.app/'), 'other.example', true), 'preview.vercel.app');
  assert.equal(getCandidateHostname(new URL('https://preview.vercel.app/'), 'dreamwheels.pro', false), 'preview.vercel.app');
  assert.equal(getCandidateHostname(new URL('https://dreamwheels.pro/'), 'колесамечты.рф', true), 'dreamwheels.pro');
});
