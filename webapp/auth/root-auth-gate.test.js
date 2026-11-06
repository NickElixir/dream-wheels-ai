import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {applicationRouteContext, applicationRouteRequiresAuth, isApplicationRoute, safeApplicationReturnPath} from '../app-route.mjs';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const initialize = source.slice(source.indexOf('function initializeApplicationRoute()'), source.indexOf('async function bootstrapAuthenticatedApplication()'));
function entry(path, telegram = false) {
  const state = {applicationAuthRequired:false};
  const window = {location:new URL(path, 'https://app.dream-wheels.ru'), history:{replaceState(_, __, target) {window.location = new URL(target, window.location);}}};
  runInNewContext(initialize + '; initializeApplicationRoute();', {state, window, HAS_TG:telegram, URLSearchParams, applicationRouteContext, applicationRouteRequiresAuth, isApplicationRoute, safeApplicationReturnPath});
  return {state, window};
}
test('cold new and legacy entries require auth and preserve the intended create route', () => {
  for (const path of ['/new', '/app/new', '/create']) {
    const {state, window} = entry(path + '?utm_source=catalog&token=secret');
    assert.equal(state.applicationAuthRequired, true);
    assert.equal(state.applicationRoute.view, 'create');
    assert.equal(state.applicationAuthReturnPath, '/new?utm_source=catalog');
    assert.equal(window.location.pathname, '/new');
    assert.equal(window.location.search, '?utm_source=catalog');
  }
});
test('root is protected, public legacy support canonicalizes, Telegram entry stays untouched', () => {
  assert.equal(entry('/').state.applicationAuthRequired, true);
  const support = entry('/app/support');
  assert.equal(support.window.location.pathname, '/help');
  assert.equal(support.state.applicationAuthRequired, false);
  const telegram = entry('/app/new', true);
  assert.equal(telegram.state.applicationAuthRequired, false);
  assert.equal(telegram.window.location.pathname, '/app/new');
});
