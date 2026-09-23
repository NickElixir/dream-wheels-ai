import assert from 'node:assert/strict';
import test from 'node:test';
import middleware, { config } from '../middleware';

test('middleware rewrites only localized public paths and keeps query parameters', () => {
  assert.deepEqual(config.matcher.slice(0, 3), ['/', '/catalog', '/catalog/']);
  const response = middleware(new Request('https://dreamwheels.pro/catalog?utm_source=qa&market=global'));
  assert.equal(response.headers.get('x-middleware-rewrite'), 'https://dreamwheels.pro/en/catalog?utm_source=qa&market=global');
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
