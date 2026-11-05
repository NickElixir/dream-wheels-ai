import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { releaseSettings, prepareArtifact, publicHtml, legacyBridge } from './build.mjs';

const sha = 'a'.repeat(40);
const html = '<html lang="ru"><head><link rel="canonical" href="https://www.dream-wheels.ru/"></head><body><a href="https://app.dream-wheels.ru/new">Создать</a></body></html>';
test('profiles fail closed; public and test robots policies differ', () => {
  assert.throws(() => releaseSettings({ TIMEWEB_LANDING_PROFILE: 'ru-test' }, sha));
  assert.throws(() => releaseSettings({ TIMEWEB_LANDING_PROFILE: 'landing-ru-test', LANDING_BUILD_SHA: 'b'.repeat(40) }, sha));
  assert.match(publicHtml(html, releaseSettings({ TIMEWEB_LANDING_PROFILE: 'landing-ru-test' }, sha)), /noindex/u);
  assert.doesNotMatch(publicHtml(html, releaseSettings({ TIMEWEB_LANDING_PROFILE: 'landing-ru-production' }, sha)), /noindex/u);
  assert.throws(() => publicHtml(html.replace('</head>', '<script src="https://a.vercel.app/a.js"></script></head>'), { preview: false }));
});
test('artifact excludes dev/source and keeps distinct directory pages and a checksum manifest', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'landing-artifact-'));
  try {
    const source = path.join(root, 'source'), out = path.join(root, 'out');
    for (const folder of ['catalog', '_astro', 'assets', 'fonts', 'dev', 'localized']) await fs.mkdir(path.join(source, folder), { recursive: true });
    await fs.writeFile(path.join(source, 'index.html'), html);
    await fs.writeFile(path.join(source, 'catalog/index.html'), html);
    await fs.writeFile(path.join(source, 'favicon.svg'), '<svg/>');
    await fs.writeFile(path.join(source, '.env'), 'private');
    const manifest = await prepareArtifact(source, out, releaseSettings({ TIMEWEB_LANDING_PROFILE: 'landing-ru-test' }, sha));
    assert.equal(manifest.build, sha);
    assert.ok(manifest.files.some((file) => file.path === 'catalog/index.html' && /^[a-f0-9]{64}$/u.test(file.sha256)));
    await assert.rejects(fs.access(path.join(out, '.env')));
    await assert.rejects(fs.access(path.join(out, 'dev')));
    await assert.rejects(fs.access(path.join(out, 'localized')));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('legacy bridge preserves query/hash without accepting a foreign redirect target', () => {
  const source = legacyBridge().match(/<script>([\s\S]*)<\/script>/u)[1];
  for (const [url, expected] of [
    ['https://www.dream-wheels.ru/app/new?utm_source=x#photo', 'https://app.dream-wheels.ru/new?utm_source=x#photo'],
    ['https://www.dream-wheels.ru/t/start?x=1#hash', 'https://app.dream-wheels.ru/t/start?x=1#hash'],
    ['https://www.dream-wheels.ru/missing?next=https://evil.test', null],
  ]) {
    let redirected = null;
    vm.runInNewContext(source, { URL, location: { href: url, replace(value) { redirected = value; } } });
    assert.equal(redirected, expected);
  }
});
