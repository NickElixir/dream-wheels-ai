import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function publicConfig(env) {
  const expected = env.EXPECTED_SUPABASE_URL;
  const url = (env.SUPABASE_URL || '').replace(/\/$/u, '');
  if (!expected || url !== expected) throw new Error('Supabase project does not match the deployment environment');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/u.test(parsed.hostname) || parsed.pathname !== '/') {
    throw new Error('Invalid public Supabase origin');
  }
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
  if (!key) throw new Error('Missing browser publishable key');
  if (!key.startsWith('sb_publishable_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { throw new Error('Invalid browser key'); }
    if (payload.role !== 'anon' || payload.ref !== parsed.hostname.split('.')[0]) throw new Error('Browser key has an invalid role or project');
  }
  const turnstileSiteKey = env.TURNSTILE_SITE_KEY || (url === 'https://hnawojlnfoaccinlgjyn.supabase.co' ? '0x4AAAAAAEpc6oyj1KFbS7FR' : '');
  if (!turnstileSiteKey) throw new Error('Missing public Turnstile site key');
  return {
    supabase: { url, publishableKey: key },
    auth: { site: 'ru', otpLength: 6, resendWindowSeconds: 60, turnstileSiteKey,
      analyticsEndpoint: '/api/backend/analytics/events', mainWebAppEnabled: true },
  };
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const config = publicConfig(process.env);
  const target = new URL('../auth/harness-config.js', import.meta.url);
  fs.writeFileSync(target, `// Generated public config; no server credentials.\nglobalThis.__DREAM_WHEELS_SUPABASE_CONFIG__ = Object.freeze(${JSON.stringify(config.supabase)});\nglobalThis.__DREAM_WHEELS_AUTH_CONFIG__ = Object.freeze(${JSON.stringify(config.auth)});\n`);
}
