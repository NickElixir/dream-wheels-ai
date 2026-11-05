import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationRouteContext, safeApplicationReturnPath } from '../webapp/app-route.mjs';

test('new and legacy create links open the same view and keep approved auth-return parameters', () => {
  for (const path of ['/new', '/new/', '/app/new', '/create']) {
    const url = new URL(`${path}?utm_source=landing&token=private`, 'https://app.dream-wheels.ru');
    assert.equal(applicationRouteContext(url, url.origin)?.view, 'create');
    assert.equal(safeApplicationReturnPath(url, url.origin), `${path.replace(/\/$/u, '')}?utm_source=landing`);
  }
});
