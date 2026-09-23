import assert from 'node:assert/strict';
import test from 'node:test';
import { dictionaries, getCanonicalUrl, getLocalizedUrl, resolveLocale, stripPreviewPrefix } from '../src/i18n';
import { domainI18nEnabled } from '../src/i18n/config';

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
  assert.equal(resolveLocale({ hostname: 'dreamwheels.pro', domainRoutingEnabled: domainI18nEnabled }), 'ru');
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
});
