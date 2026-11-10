import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const entryScripts = /<script src="\/app\.js\?v=[^"]+" type="module"><\/script>\s*<script src="\/vnext\/bootstrap\.js\?v=[^"]+" type="module"><\/script>/u;

export async function bundleStartupJs(html, sourceRoot, outputRoot = sourceRoot) {
  if (!entryScripts.test(html)) throw new Error('WebApp startup scripts missing');
  const { outputFiles, metafile } = await build({
    stdin: { contents: 'import "./app.js";\nimport "./vnext/bootstrap.js";', resolveDir: sourceRoot, sourcefile: 'startup.js' },
    outdir: outputRoot,
    splitting: true,
    entryNames: 'startup.[hash]',
    chunkNames: 'startup-chunk.[hash]',
    metafile: true,
    bundle: true,
    format: 'esm',
    target: 'es2020',
    minify: true,
    write: false,
  });
  const entry = Object.entries(metafile.outputs).find(([, output]) => output.entryPoint && basename(output.entryPoint) === 'startup.js');
  if (!entry) throw new Error('WebApp startup bundle entry missing');
  const filename = basename(entry[0]);
  await Promise.all(outputFiles.map((file) => writeFile(file.path, file.contents)));
  return html.replace(entryScripts, `<script src="/${filename}" type="module"></script>`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const index = join(root, 'index.html');
  await writeFile(index, await bundleStartupJs(await readFile(index, 'utf8'), root));
}
