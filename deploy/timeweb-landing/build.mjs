import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedCatalogTarget } from '../../scripts/catalog/verify-build.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const profiles = Object.freeze({
  'landing-ru-test': { preview: true },
  'landing-ru-production': { preview: false },
});
const allowed = ['index.html', 'catalog', '_astro', 'assets', 'fonts', 'favicon.svg'];

export function releaseSettings(env, gitSha = '') {
  const profile = env.TIMEWEB_LANDING_PROFILE;
  if (!Object.hasOwn(profiles, profile ?? '')) throw new Error('TIMEWEB_LANDING_PROFILE must identify a landing profile');
  const sha = env.LANDING_BUILD_SHA || gitSha;
  if (!/^[a-f0-9]{40}$/iu.test(sha ?? '')) throw new Error('A full LANDING_BUILD_SHA or Git SHA is required');
  if (env.LANDING_BUILD_SHA && gitSha && env.LANDING_BUILD_SHA.toLowerCase() !== gitSha.toLowerCase()) throw new Error('LANDING_BUILD_SHA differs from Git HEAD');
  return { profile, build: sha.toLowerCase(), locale: 'ru', canonicalOrigin: 'https://www.dream-wheels.ru', webappOrigin: 'https://app.dream-wheels.ru', preview: profiles[profile].preview };
}

export function publicHtml(html, config) {
  if (!html.includes('lang="ru"') || !html.includes('https://www.dream-wheels.ru')) throw new Error('RU metadata missing');
  if (/<(?:script|link|img|source|video|iframe)\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|\.vercel\.app)/iu.test(html)) throw new Error('Landing HTML depends on external hosting');
  if (!html.includes('https://app.dream-wheels.ru/')) throw new Error('Application origin missing');
  if (/name="robots"[^>]*noindex/iu.test(html)) throw new Error('Production source page contains noindex');
  return config.preview ? html.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>') : html;
}

export function legacyBridge() {
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Переход в приложение</title></head><body><p><a href="https://app.dream-wheels.ru/">Открыть приложение</a></p><script>const u=new URL(location.href);if(/^\\/(?:app|t)(?:\\/|$)/.test(u.pathname)){const aliases={"/app":"/","/app/new":"/new","/app/history":"/history","/app/wallet":"/balance","/app/settings":"/account","/app/support":"/help","/app/photo-guide":"/help/photos","/app/docs":"/documents"};const p=aliases[u.pathname.replace(/\\/$/,"")]||u.pathname;location.replace("https://app.dream-wheels.ru"+p+u.search+u.hash);}</script></body></html>';
}

async function hashFiles(directory, relative = '') {
  const records = [];
  for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) throw new Error('Unexpected hidden file or symlink');
    if (entry.isDirectory()) records.push(...await hashFiles(directory, name));
    else {
      const data = await fs.readFile(path.join(directory, name));
      records.push({ path: name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
  }
  return records.sort((a, b) => a.path.localeCompare(b.path));
}

export async function prepareArtifact(source, output, config) {
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  for (const entry of allowed) await fs.cp(path.join(source, entry), path.join(output, entry), { recursive: true });
  for (const page of ['index.html', 'catalog/index.html']) {
    const file = path.join(output, page);
    const html = await fs.readFile(file, 'utf8');
    if (page === 'index.html' && !html.includes('https://app.dream-wheels.ru/new')) throw new Error('Short application CTA missing');
    await fs.writeFile(file, publicHtml(html, config));
  }
  const bridge = legacyBridge();
  for (const route of ['app', 'app/new', 'app/history', 'app/wallet', 'app/settings', 'app/support', 'app/photo-guide', 'app/docs', 'app/render-detail', 'app/fitment', 't', 't/new']) {
    await fs.mkdir(path.join(output, route), { recursive: true });
    await fs.writeFile(path.join(output, route, 'index.html'), bridge);
  }
  await fs.writeFile(path.join(output, '404.html'), bridge.replace('Переход в приложение', 'Страница не найдена'));
  await fs.writeFile(path.join(output, 'robots.txt'), config.preview ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /t\n');
  await fs.writeFile(path.join(output, 'version.json'), JSON.stringify(config, null, 2) + '\n');
  const manifest = { ...config, files: await hashFiles(output) };
  await fs.writeFile(path.join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

async function build() {
  let gitSha = '';
  try { gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* Timeweb can omit .git. */ }
  const config = releaseSettings(process.env, gitSha);
  const catalogTarget = expectedCatalogTarget(process.env);
  execFileSync(path.join(root, 'landing/node_modules/.bin/tsx'), [path.join(root, 'landing/scripts/build-handoff.ts'), '--target', catalogTarget], {
    cwd: root, stdio: 'inherit',
  });
  const staging = path.join(root, 'landing/dist-timeweb-source');
  execFileSync(process.execPath, [path.join(root, 'landing/node_modules/astro/bin/astro.mjs'), 'build', '--outDir', staging], {
    cwd: path.join(root, 'landing'), stdio: 'inherit',
    env: { ...process.env, PUBLIC_LANDING_LOCALE: 'ru', PUBLIC_LANDING_HOSTING: 'timeweb' },
  });
  const manifest = await prepareArtifact(staging, path.join(root, 'dist/landing-timeweb'), config);
  console.log(JSON.stringify({ ok: true, profile: config.profile, build: config.build, files: manifest.files.length }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
