import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { localeDomains } from '../src/i18n/domains.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = [];
for (const locale of ['ru', 'en']) {
  const directory = `dist-domains/${locale}`;
  const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', directory], {
    cwd: root,
    env: { ...process.env, PUBLIC_LANDING_LOCALE: locale },
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
  const pages = [];
  for (const [path, file] of [['/', 'index.html'], ['/catalog', 'catalog/index.html']]) {
    const html = await readFile(new URL(`../${directory}/${file}`, import.meta.url), 'utf8');
    const canonical = `${localeDomains[locale]}${path}`;
    if (!html.includes(`lang="${locale}"`) || !html.includes(`rel="canonical" href="${canonical}"`) || /name="robots" content="noindex/.test(html)) {
      throw new Error(`Invalid public ${locale} page: ${file}`);
    }
    pages.push({ path, sha256: createHash('sha256').update(html).digest('hex') });
  }
  release.push({ locale, origin: localeDomains[locale], directory, pages });
}
await writeFile(new URL('../dist-domains/manifest.json', import.meta.url), JSON.stringify({ release }, null, 2) + '\n');
console.log('Local domain artifacts ready. Nothing has been published.');
