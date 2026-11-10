import test from 'node:test';
import assert from 'node:assert/strict';
import { publicConfig } from '../scripts/build-public-config.mjs';
import { isMainWebAppAuthEnabled } from './app-auth.js';

const production = { EXPECTED_SUPABASE_URL: 'https://qmgyccghsbdpehiybjae.supabase.co', SUPABASE_URL: 'https://qmgyccghsbdpehiybjae.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', TURNSTILE_SITE_KEY: 'public-test', SUPABASE_SERVICE_ROLE_KEY: 'must-never-export' };
test('public config pins the target project and excludes all server credentials', () => {
  const result = publicConfig(production);
  assert.equal(result.supabase.url, production.SUPABASE_URL);
  assert.equal(JSON.stringify(result).includes('must-never-export'), false);
  assert.throws(() => publicConfig({ ...production, SUPABASE_URL: 'https://hnawojlnfoaccinlgjyn.supabase.co' }));
  assert.throws(() => publicConfig({ ...production, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }));
  assert.throws(() => publicConfig({ ...production, TURNSTILE_SITE_KEY: '' }));
});
test('approved production, staging, and test domains allow the reviewed auth flow', () => {
  const old = globalThis.location;
  try {
    for (const hostname of ['app.dreamwheels.pro', 'app.dream-wheels.ru', 'app-test.dream-wheels.ru', 'dream-wheels-ai-webapp.vercel.app', 'dream-wheels-ai-webapp-nicks-projects-bd58cb33.vercel.app', 'dream-wheels-ai-webapp-staging.vercel.app']) {
      globalThis.location = { hostname };
      assert.equal(isMainWebAppAuthEnabled({ mainWebAppEnabled: true }), true);
    }
    globalThis.location = { hostname: 'untrusted.example' };
    assert.equal(isMainWebAppAuthEnabled({ mainWebAppEnabled: true }), false);
    globalThis.location = { hostname: 'another-test.dream-wheels.ru' };
    assert.equal(isMainWebAppAuthEnabled({ mainWebAppEnabled: true }), false);
  } finally { globalThis.location = old; }
});

test('CLI emits the real browser script without reusing staging URL in production', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-public-config-'));
  try {
    await fs.mkdir(path.join(folder, 'webapp/scripts'),{recursive:true});
    await fs.mkdir(path.join(folder, 'scripts/catalog'),{recursive:true});
    await fs.mkdir(path.join(folder, 'landing/src/data'),{recursive:true});
    await fs.mkdir(path.join(folder, 'webapp/vnext'),{recursive:true});
    await fs.copyFile(new URL('../../scripts/catalog/verify-build.mjs',import.meta.url),path.join(folder,'scripts/catalog/verify-build.mjs'));
    for(const name of ['catalog-storage','catalog-publications','catalog-asset-registry','catalog-reconciliation','catalog-primary-skus'])await fs.copyFile(new URL(`../../landing/src/data/${name}.json`,import.meta.url),path.join(folder,`landing/src/data/${name}.json`));
    await fs.copyFile(new URL('../vnext/catalog-data.mjs',import.meta.url),path.join(folder,'webapp/vnext/catalog-data.mjs'));
    await fs.copyFile(new URL('../vnext/catalog-assets.mjs',import.meta.url),path.join(folder,'webapp/vnext/catalog-assets.mjs'));
    await fs.mkdir(path.join(folder, 'webapp/auth'));
    await fs.copyFile(new URL('../scripts/build-public-config.mjs', import.meta.url), path.join(folder, 'webapp/scripts/build.mjs'));
    for (const file of ['index.html', 'style.css', 'scripts/bundle-css.mjs']) {
      await fs.copyFile(new URL(`../${file}`, import.meta.url), path.join(folder, 'webapp', file));
    }
    await fs.cp(new URL('../vnext/styles', import.meta.url), path.join(folder, 'webapp/vnext/styles'), { recursive: true });
    const run = spawnSync(process.execPath, [path.join(folder, 'webapp/scripts/build.mjs')], { env: { ...process.env, ...production }, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const html = await fs.readFile(path.join(folder, 'webapp/index.html'), 'utf8');
    const links = [...html.matchAll(/rel="stylesheet" href="\/([^"]+)"/gu)];
    assert.equal(links.length, 1);
    assert.match(links[0][1], /^startup\.[a-f0-9]{16}\.css$/u);
    const css = await fs.readFile(path.join(folder, 'webapp', links[0][1]), 'utf8');
    assert.ok(css.includes('url("/assets/fonts/ibm-plex-sans-latin.woff2")'));
    const script = await fs.readFile(path.join(folder, 'webapp/auth/harness-config.js'), 'utf8');
    assert.ok(script.includes(production.SUPABASE_URL));
    assert.ok(!script.includes('hnawojlnfoaccinlgjyn'));
    assert.ok(!script.includes('must-never-export'));
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});
