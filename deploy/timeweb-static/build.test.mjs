import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {
  artifactEntries,
  copyPublicTree,
  deploymentConfig,
  denoTestApiBaseUrl,
  isPublicTreePath,
  productionApiBaseUrl,
  renderDeploymentConfig,
  renderHarnessConfig,
  renderIndex,
  renderAppScript,
  resolveBuildSha,
} from './build.mjs';

const sha = 'a'.repeat(40);

test('build identifier must be a full commit SHA', () => {
  assert.equal(resolveBuildSha({ APP_BUILD_SHA: sha }, sha.toUpperCase()), sha);
  assert.equal(resolveBuildSha({}, 'b'.repeat(40)), 'b'.repeat(40));
  assert.throws(() => resolveBuildSha({ APP_BUILD_SHA: sha }, 'b'.repeat(40)), /match/u);
  assert.equal(resolveBuildSha({ APP_BUILD_SHA: sha }, ''), sha);
  assert.throws(() => resolveBuildSha({}, ''), /required when Git metadata/u);
  assert.throws(() => resolveBuildSha({ APP_BUILD_SHA: 'latest' }, sha), /40-character/u);
});

test('named RU profiles map to their fixed API targets', () => {
  assert.deepEqual(deploymentConfig({ TIMEWEB_PROFILE: 'ru-production' }), {
    profile: 'ru-production', apiBaseUrl: productionApiBaseUrl, environment: 'production', websiteTelegramLoginEnabled: false,
  });
  assert.deepEqual(deploymentConfig({ TIMEWEB_PROFILE: 'ru-test' }), {
    profile: 'ru-test', apiBaseUrl: denoTestApiBaseUrl, environment: 'test', websiteTelegramLoginEnabled: false,
  });
  assert.match(renderDeploymentConfig(deploymentConfig({ TIMEWEB_PROFILE: 'ru-production' })), /gateway\.dreamwheels\.deno\.net\/api\/backend/u);
  assert.throws(() => deploymentConfig({ TIMEWEB_PROFILE: 'ru-production', TIMEWEB_API_TARGET: 'deno-test' }), /TIMEWEB_API_TARGET is no longer supported/u);
  assert.throws(() => deploymentConfig({ TIMEWEB_PROFILE: 'unknown' }), /TIMEWEB_PROFILE/u);
});

test('build profile is required and legacy API target is rejected', () => {
  assert.throws(() => deploymentConfig(), /TIMEWEB_PROFILE is required/u);
  assert.throws(() => deploymentConfig({ TIMEWEB_PROFILE: '' }), /TIMEWEB_PROFILE is required/u);
  assert.throws(() => deploymentConfig({ TIMEWEB_API_TARGET: 'deno-test' }), /TIMEWEB_API_TARGET is no longer supported/u);
  assert.throws(() => deploymentConfig({ TIMEWEB_PROFILE: 'ru-test', TIMEWEB_API_TARGET: '' }), /TIMEWEB_API_TARGET is no longer supported/u);
});

test('generated auth config uses the direct production analytics endpoint and contains no server env', () => {
  const text = renderHarnessConfig({
    supabase: { url: 'https://sample.supabase.co', publishableKey: 'sb_publishable_public' },
    auth: { analyticsEndpoint: `${productionApiBaseUrl}/analytics/events`, turnstileSiteKey: 'public-site-key' },
  });
  assert.match(text, /https:\/\/gateway\.dreamwheels\.deno\.net\/api\/backend\/analytics\/events/u);
  assert.doesNotMatch(text, /SERVICE_ROLE|BOT_TOKEN|SECRET|PRIVATE_KEY/u);
});

test('built HTML has noindex metadata and build-versioned config/auth scripts', () => {
  const html = renderIndex('<html data-app-build="__BUILD_ID__"><head></head><body><script src="/auth/harness-config.js"></script><script src="/auth/app-auth.bundle.js"></script><script src="/app.js?v=__BUILD_ID__"></script></body></html>', sha);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/u);
  assert.match(html, new RegExp(`data-app-build="${sha}"`, 'u'));
  assert.ok(html.indexOf(`/deployment-config.js?v=${sha}`) < html.indexOf(`/auth/harness-config.js?v=${sha}`));
  assert.match(html, new RegExp(`/auth/app-auth\\.bundle\\.js\\?v=${sha}`, 'u'));
  assert.doesNotMatch(html, /__BUILD_ID__/u);
});

test('Timeweb HTML removes website Telegram login while retaining email auth', async () => {
  const source = await fs.readFile(new URL('../../webapp/index.html', import.meta.url), 'utf8');
  const html = renderIndex(source, sha);
  assert.doesNotMatch(html, /telegram\.org/u);
  assert.doesNotMatch(html, /data-auth-telegram/u);
  assert.doesNotMatch(html, /class="auth-dialog-divider"/u);
  assert.match(html, /data-auth-email-form/u);
  assert.match(html, /data-auth-email\b/u);
  assert.match(html, /data-auth-send/u);
});

test('disabled website Telegram login short-circuits resource warmup before network or script access', async () => {
  const app = await fs.readFile(new URL('../../webapp/app.js', import.meta.url), 'utf8');
  const warmupStart = app.indexOf('function warmWebsiteLoginResources() {');
  const warmupEnd = app.indexOf('\n\nwarmWebsiteLoginResources();', warmupStart);
  assert.ok(warmupStart >= 0 && warmupEnd > warmupStart);
  let requests = 0;
  let scripts = 0;
  const context = {
    Promise,
    fetch() { requests += 1; },
    document: { createElement() { scripts += 1; } },
  };
  vm.runInNewContext(`
    const WEBSITE_TELEGRAM_LOGIN_ENABLED = false;
    function isWebsiteTelegramLoginEnabled() { return WEBSITE_TELEGRAM_LOGIN_ENABLED; }
    ${app.slice(warmupStart, warmupEnd)}
    warmWebsiteLoginResources();
  `, context);
  assert.equal(requests, 0);
  assert.equal(scripts, 0);
  assert.match(app, /function loadTelegramLoginLibrary\(\) \{\s*if \(!isWebsiteTelegramLoginEnabled\(\)\) return Promise\.reject/u);
  assert.match(app, /async function fetchWebsiteLoginNonce\(\{ force = false \} = \{\}\) \{\s*if \(!isWebsiteTelegramLoginEnabled\(\)\) throw/u);
});

test('artifact copy plan includes runtime files and excludes server and development trees', () => {
  assert.deepEqual(artifactEntries, [
    'index.html', 'app.js', 'style.css', 'startup.js', 'app-route.mjs', 'favicon.ico', 'favicon.svg', 'cover.jpg',
    'auth/harness-config.js', 'auth/app-auth.bundle.js', 'auth/registration-touch.mjs', 'assets/', 'vnext/',
  ]);
  assert.ok(!artifactEntries.some((entry) => /(?:api|lib|scripts|tests|package|\.env)/u.test(entry)));
});

test('recursive public tree filter rejects metadata, tests, secrets, dependencies, and symlink candidates', async () => {
  assert.equal(isPublicTreePath('fonts/ibm-plex-sans.woff2', 'assets'), true);
  assert.equal(isPublicTreePath('api/legacy-navigation.js', 'assets'), false);
  assert.equal(isPublicTreePath('api/legacy-navigation.js', 'vnext'), true);
  for (const rejected of ['.env', '.env.production', 'README.md', 'package.json', 'tests/example.js', 'button.test.js', 'node_modules/lib/index.js', 'lib/server.js', 'scripts/build.js']) {
    assert.equal(isPublicTreePath(rejected, 'assets'), false, rejected);
  }

  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'timeweb-static-filter-'));
  try {
    const source = path.join(temp, 'assets');
    await fs.mkdir(path.join(source, 'fonts'), { recursive: true });
    await fs.mkdir(path.join(source, 'tests'));
    await fs.writeFile(path.join(source, 'fonts/runtime.woff2'), 'font');
    await fs.writeFile(path.join(source, 'tests/private.fixture'), 'fixture');
    await fs.writeFile(path.join(source, '.env'), 'secret');
    await fs.writeFile(path.join(temp, 'outside.js'), 'private');
    await fs.symlink(path.join(temp, 'outside.js'), path.join(source, 'linked.js'));
    await fs.writeFile(path.join(source, 'package.json'), '{}');
    await fs.writeFile(path.join(source, 'README.md'), 'private');
    await fs.writeFile(path.join(source, 'runtime.js'), 'window.runtime = true;');
    const output = path.join(temp, 'output');
    await copyPublicTree(source, output, 'assets');
    assert.equal(await fs.readFile(path.join(output, 'runtime.js'), 'utf8'), 'window.runtime = true;');
    await assert.rejects(fs.access(path.join(output, 'tests/private.fixture')));
    await assert.rejects(fs.access(path.join(output, '.env')));
    await assert.rejects(fs.access(path.join(output, 'linked.js')));
    await assert.rejects(fs.access(path.join(output, 'package.json')));
    await assert.rejects(fs.access(path.join(output, 'README.md')));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('new app artifact requests the routing module with its release SHA', async () => {
  const app = await fs.readFile(new URL('../../webapp/app.js', import.meta.url), 'utf8');
  const first = renderAppScript(app, sha);
  const nextSha = 'b'.repeat(40);
  const next = renderAppScript(app, nextSha);
  assert.ok(first.includes(`from "./app-route.mjs?v=${sha}"`));
  assert.ok(next.includes(`from "./app-route.mjs?v=${nextSha}"`));
  assert.ok(!next.includes(`from "./app-route.mjs?v=${sha}"`));
  assert.throws(() => renderAppScript(app, 'invalid'), /Invalid routing build SHA/);
  assert.throws(() => renderAppScript('unrelated', sha), /Routing dependency missing/);
});
