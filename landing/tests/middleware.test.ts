import assert from 'node:assert/strict';
import test from 'node:test';
import middleware, { config } from '../middleware';

test('middleware rewrites only localized public paths and keeps query parameters', () => {
  assert.deepEqual(config.matcher.slice(0, 3), ['/', '/catalog', '/catalog/']);
  const response = middleware(new Request('https://dreamwheels.pro/catalog?utm_source=qa&market=global'));
  assert.equal(response.headers.get('x-middleware-rewrite'), 'https://dreamwheels.pro/localized/en/catalog?utm_source=qa&market=global');
  assert.equal(middleware(new Request('https://dreamwheels.pro/app/new')).headers.get('x-middleware-next'), '1');
  assert.equal(middleware(new Request('https://dreamwheels.pro/api/backend/health')).headers.get('x-middleware-next'), '1');
});

test('direct locale paths are noindex, and a candidate host header cannot affect production', () => {
  assert.equal(middleware(new Request('https://preview.vercel.app/en/catalog')).headers.get('x-robots-tag'), 'noindex, follow');
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = 'production';
    const response = middleware(new Request('https://preview.vercel.app/', { headers: { 'x-dw-candidate-host': 'dreamwheels.pro' } }));
    assert.equal(response.headers.get('x-middleware-next'), '1');
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});


test('RU aliases receive Russian HTML without rewriting application or API routes', () => {
  for (const host of ['dream-wheels.ru', 'www.dream-wheels.ru']) {
    assert.equal(middleware(new Request(`https://${host}/catalog?utm_source=store`)).headers.get('x-middleware-rewrite'), `https://${host}/localized/ru/catalog?utm_source=store`);
    for (const path of ['/app/new', '/t/', '/api/backend/health']) {
      assert.equal(middleware(new Request(`https://${host}${path}`)).headers.get('x-middleware-next'), '1');
    }
  }
});

test('internal release pages are noindex only on direct requests', () => {
  assert.equal(middleware(new Request('https://dreamwheels.pro/localized/en/catalog')).headers.get('x-robots-tag'), 'noindex, follow');
  assert.equal(middleware(new Request('https://dreamwheels.pro/catalog')).headers.get('x-robots-tag'), null);
});
