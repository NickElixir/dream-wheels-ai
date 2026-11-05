import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function verifyLanding({ site, sha, profile, fetcher = fetch }) {
  const origin = new URL(site);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || !/^[a-f0-9]{40}$/u.test(sha)) throw new Error('Invalid landing origin or source SHA');
  if (!['landing-ru-test', 'landing-ru-production'].includes(profile)) throw new Error('Invalid landing profile');
  if (!origin.hostname.endsWith('.twc1.net') && !['www.dream-wheels.ru', 'dream-wheels.ru', 'landing-test.dream-wheels.ru'].includes(origin.hostname)) throw new Error('Unexpected landing host');
  const request = async (file, method = 'GET') => {
    const response = await fetcher(new URL(file, origin), { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'cache-control': 'no-cache' } });
    if (response.status !== 200) throw new Error(`Landing ${method} failed: ${file} (${response.status})`);
    return response;
  };
  const version = await (await request('/version.json')).json();
  if (version.build !== sha || version.profile !== profile || version.locale !== 'ru' || version.webappOrigin !== 'https://app.dream-wheels.ru') throw new Error('Landing version/profile does not match');
  const manifest = await (await request('/release-manifest.json')).json();
  if (manifest.build !== sha || manifest.profile !== profile || !Array.isArray(manifest.files) || manifest.files.length > 2000) throw new Error('Landing manifest mismatch');
  const checks = {};
  for (const [route, file] of [['/', 'index.html'], ['/catalog/', 'catalog/index.html']]) {
    const response = await request(route);
    if (!/(?:no-cache|no-store|max-age=0\b)/iu.test(response.headers.get('cache-control') ?? '')) throw new Error('Landing HTML must revalidate');
    const html = await response.text();
    const entry = manifest.files.find((item) => item.path === file);
    const canonical = `https://www.dream-wheels.ru${route === '/' ? '/' : '/catalog'}`;
    if (!entry || createHash('sha256').update(html).digest('hex') !== entry.sha256) throw new Error(`Served page differs from manifest: ${route}`);
    if (!html.includes('lang="ru"') || !html.includes(`rel="canonical" href="${canonical}"`)) throw new Error('Landing metadata mismatch');
    if (/name="robots"[^>]*noindex/iu.test(html) !== (profile === 'landing-ru-test')) throw new Error('Landing robots policy mismatch');
    if (/<(?:script|link|img|source|iframe)\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|\.vercel\.app)/iu.test(html)) throw new Error('External resource dependency in RU HTML');
    if (!html.includes('https://dreamwheels.pro') || !html.includes('https://app.dream-wheels.ru/')) throw new Error('Language/application links missing');
    if (route === '/' && !html.includes('https://app.dream-wheels.ru/new')) throw new Error('New application CTA missing');
    checks[route] = 'pass';
  }
  const resources = manifest.files.filter((item) => /\.(?:css|js|mjs|png|jpe?g|avif|webp|svg|woff2|mp4)$/iu.test(item.path));
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < resources.length) {
      const resource = resources[next++];
      if (!/^(?:_astro|assets|fonts)\//u.test(resource.path) && resource.path !== 'favicon.svg') throw new Error('Unexpected artifact resource path');
      const response = await request(`/${resource.path}`, 'HEAD');
      const contentType = response.headers.get('content-type') ?? '';
      if (resource.path.startsWith('assets/') && /immutable/iu.test(response.headers.get('cache-control') ?? '')) throw new Error('Unversioned public images must not be immutable');
      const ext = resource.path.split('.').at(-1).toLowerCase();
      const types = { css: /text\/css/u, js: /(?:java|ecma)script/u, mjs: /(?:java|ecma)script/u, woff2: /(?:font\/woff2|application\/font-woff2)/u, avif: /image\/avif/u, webp: /image\/webp/u, png: /image\/png/u, jpg: /image\/jpeg/u, jpeg: /image\/jpeg/u, svg: /image\/svg\+xml/u, mp4: /video\/mp4/u };
      if (!types[ext]?.test(contentType)) throw new Error(`Unexpected MIME for ${resource.path}`);
    }
  }));
  return { ok: true, site: origin.origin, sha, profile, checks, resourceChecks: resources.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const values = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, list) => i % 2 === 0 ? [...pairs, [value.replace(/^--/u, ''), list[i + 1]]] : pairs, []));
  verifyLanding(values).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
}
