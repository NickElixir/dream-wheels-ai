import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { posix, join } from 'node:path';

const stylesheetBlock = /(?:^    <link rel="stylesheet" href="\/(?:style\.css|vnext\/styles\/[\w-]+\.css)\?v=__BUILD_ID__(?:&surface=pr5)?">\n)+/mu;

export function bundleStartupCss(html, sourceRoot, outputRoot = sourceRoot) {
  const block = html.match(stylesheetBlock)?.[0];
  if (!block) {
    const existing = html.match(/<link rel="stylesheet" href="\/(startup\.[a-f0-9]{16}\.css)">/u);
    if (existing && cssFilename(readFileSync(join(outputRoot, existing[1]))) === existing[1]) return html;
    throw new Error('WebApp startup stylesheet block missing');
  }
  const files = [...block.matchAll(/href="\/([^?]+)\?/gu)].map((match) => match[1]);
  if (files[0] !== 'style.css' || files.length !== 11 || new Set(files).size !== files.length) {
    throw new Error('Unexpected WebApp startup stylesheet list');
  }
  const css = files.map((file) => readFileSync(join(sourceRoot, file), 'utf8')
    .replace(/url\(\s*(["']?)(\.{1,2}\/[^"')]+)\1\s*\)/gu, (_, quote, relative) =>
      `url(${quote}${posix.resolve('/', posix.dirname(file), relative)}${quote})`)).join('\n');
  const filename = cssFilename(css);
  writeFileSync(join(outputRoot, filename), css);
  return html.replace(block, `    <link rel="stylesheet" href="/${filename}">\n`);
}

function cssFilename(css) {
  return `startup.${createHash('sha256').update(css).digest('hex').slice(0, 16)}.css`;
}
