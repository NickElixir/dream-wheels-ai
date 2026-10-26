import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../webapp/startup.js', import.meta.url), 'utf8');
function startup(language = 'ru') {
  const listeners = new Map(), nodes = new Map();
  const root = { dataset: { uiStartup: 'loading' } };
  let timeout, cleared = false;
  const window = {
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const document = { documentElement: root, querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {});
    return nodes.get(selector);
  } };
  vm.runInNewContext(source, { window, document, navigator: { language },
    setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() { cleared = true; } });
  return { root, nodes, listeners, window, expire: () => timeout(), cleared: () => cleared };
}
test('only a mounted surface reveals the app; slow startup never reveals legacy HTML', () => {
  const s = startup();
  assert.equal(s.root.dataset.uiStartup, 'loading');
  s.listeners.get('error')({ target: { tagName: 'IMG' } });
  assert.equal(s.root.dataset.uiStartup, 'loading');
  s.listeners.get('dreamwheels:surfaceready')();
  assert.equal(s.root.dataset.uiStartup, 'loading');
  s.listeners.get('dreamwheels:runtimeready')();
  assert.equal(s.root.dataset.uiStartup, undefined);
  assert.equal(s.cleared(), true);
  assert.equal(s.listeners.has('error'), false);
  assert.equal(s.listeners.has('load'), false);
  s.expire();
  assert.equal(s.root.dataset.uiStartup, undefined);
});
test('failed module and timeout expose retry without exposing the legacy screen; late success recovers', () => {
  for (const fail of [s => s.expire(), s => s.listeners.get('error')({ target: { tagName: 'SCRIPT', type: 'module' } })]) {
    const s = startup(); fail(s);
    assert.equal(s.root.dataset.uiStartup, 'error');
    s.listeners.get('dreamwheels:surfaceready')();
    assert.equal(s.root.dataset.uiStartup, 'error');
    s.listeners.get('dreamwheels:runtimeready')();
    assert.equal(s.root.dataset.uiStartup, undefined);
  }
});
test('runtime readiness alone does not expose the unmounted legacy surface', () => {
  const s = startup();
  s.listeners.get('dreamwheels:runtimeready')();
  assert.equal(s.root.dataset.uiStartup, 'loading');
  s.listeners.get('dreamwheels:surfaceready')();
  assert.equal(s.root.dataset.uiStartup, undefined);
});
test('English startup has a matching loading label and recovery action', () => {
  const s = startup('en-US');
  assert.equal(s.nodes.get('[data-startup-label]').textContent, 'Opening app…');
  assert.equal(s.nodes.get('[data-startup-error]').textContent, 'Could not open the app');
  assert.equal(s.nodes.get('[data-startup-retry]').textContent, 'Retry');
});
for (const errorAlreadyVisible of [false, true]) test(`late Telegram RU overrides browser EN, error visible: ${errorAlreadyVisible}`, () => {
  const s = startup('en-US');
  if (errorAlreadyVisible) s.expire();
  s.window.Telegram = { WebApp: { initDataUnsafe: { user: { language_code: 'ru' } } } };
  s.listeners.get('load')({ target: { tagName: 'SCRIPT', src: 'https://telegram.org/js/telegram-web-app.js' } });
  s.listeners.get('error')({ target: { tagName: 'SCRIPT', type: 'module' } });
  assert.equal(s.nodes.get('[data-startup-label]').textContent, 'Открываем приложение…');
  assert.equal(s.nodes.get('[data-startup-error]').textContent, 'Не удалось открыть приложение');
  assert.equal(s.nodes.get('[data-startup-retry]').textContent, 'Повторить');
  assert.equal(s.root.dataset.uiStartup, 'error');
});
