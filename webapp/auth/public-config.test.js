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
test('both canonical production Vercel domains allow the reviewed auth flow', () => {
  const old = globalThis.location;
  try {
    for (const hostname of ['dream-wheels-ai-webapp.vercel.app', 'dream-wheels-ai-webapp-nicks-projects-bd58cb33.vercel.app', 'dream-wheels-ai-webapp-staging.vercel.app']) {
      globalThis.location = { hostname };
      assert.equal(isMainWebAppAuthEnabled({ mainWebAppEnabled: true }), true);
    }
    globalThis.location = { hostname: 'untrusted.example' };
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
    await fs.mkdir(path.join(folder, 'scripts'));
    await fs.mkdir(path.join(folder, 'auth'));
    await fs.copyFile(new URL('../scripts/build-public-config.mjs', import.meta.url), path.join(folder, 'scripts/build.mjs'));
    const run = spawnSync(process.execPath, [path.join(folder, 'scripts/build.mjs')], { env: { ...process.env, ...production }, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const script = await fs.readFile(path.join(folder, 'auth/harness-config.js'), 'utf8');
    assert.ok(script.includes(production.SUPABASE_URL));
    assert.ok(!script.includes('hnawojlnfoaccinlgjyn'));
    assert.ok(!script.includes('must-never-export'));
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});
