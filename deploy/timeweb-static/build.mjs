import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicConfig } from '../../webapp/scripts/build-public-config.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const webappRoot = path.join(repositoryRoot, 'webapp');
export const outputRoot = path.join(repositoryRoot, 'dist/timeweb');
export const productionApiBaseUrl = 'https://dream-wheels-ai-prod-vnext.onrender.com';

const rootFiles = [
  'index.html', 'app.js', 'style.css', 'startup.js', 'app-route.mjs',
  'favicon.ico', 'favicon.svg', 'cover.jpg',
];
const authFiles = ['harness-config.js', 'app-auth.bundle.js'];
export const artifactEntries = Object.freeze([...rootFiles, ...authFiles.map((file) => `auth/${file}`), 'assets/', 'vnext/']);
const deniedSegments = new Set(['node_modules', 'tests', 'test', '__tests__', 'lib', 'scripts']);

export function isPublicTreePath(relativePath, treeName) {
  const segments = relativePath.split(/[\\/]+/u).filter(Boolean);
  if (!segments.length || segments.some((segment) => segment.startsWith('.'))) return false;
  const lower = segments.map((segment) => segment.toLowerCase());
  if (lower.some((segment) => deniedSegments.has(segment))) return false;
  // vnext/api contains browser modules imported by bootstrap.js, not backend routes.
  if (lower.some((segment) => segment === 'api') && !(treeName === 'vnext' && lower[0] === 'api')) return false;
  const name = lower.at(-1);
  return !(
    name === 'readme' || name.startsWith('readme.') || name.startsWith('package') ||
    name.startsWith('.env') || /(?:^|[._-])tests?(?:[._-]|$)/u.test(name) ||
    /\.(?:test|spec)\.[^.]+$/u.test(name)
  );
}

export function resolveBuildSha(env, gitSha) {
  const sha = env.APP_BUILD_SHA || gitSha;
  if (!/^[a-f0-9]{40}$/iu.test(sha || '')) {
    throw new Error('APP_BUILD_SHA must be a full 40-character commit SHA');
  }
  return sha.toLowerCase();
}

export function deploymentConfig() {
  return { apiBaseUrl: productionApiBaseUrl };
}

export function renderIndex(source, buildSha) {
  if (!source.includes('<head>') || !source.includes('<script src="/auth/harness-config.js"></script>')) {
    throw new Error('Unexpected webapp index structure');
  }
  const withRobots = source.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow">');
  const withDeploymentConfig = withRobots.replace(
    '<script src="/auth/harness-config.js"></script>',
    '<script src="/deployment-config.js"></script>\n    <script src="/auth/harness-config.js"></script>',
  );
  return withDeploymentConfig.replaceAll('__BUILD_ID__', buildSha);
}

export function renderDeploymentConfig(config) {
  const serialized = JSON.stringify(config).replaceAll('<', '\\u003c');
  return `globalThis.__DREAM_WHEELS_DEPLOYMENT_CONFIG__ = Object.freeze(${serialized});\n`;
}

export function renderHarnessConfig(config) {
  return `// Generated public config; no server credentials.\nglobalThis.__DREAM_WHEELS_SUPABASE_CONFIG__ = Object.freeze(${JSON.stringify(config.supabase)});\nglobalThis.__DREAM_WHEELS_AUTH_CONFIG__ = Object.freeze(${JSON.stringify(config.auth)});\n`;
}

export async function copyPublicTree(source, destination, treeName, relative = '') {
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const childRelative = relative ? path.join(relative, entry.name) : entry.name;
    if (!isPublicTreePath(childRelative, treeName)) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, childRelative);
    if (entry.isDirectory()) {
      await copyPublicTree(sourcePath, destination, treeName, childRelative);
    } else if (entry.isFile()) {
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

async function copyFile(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

export async function build({ env = process.env, root = repositoryRoot, output = outputRoot } = {}) {
  const appRoot = path.join(root, 'webapp');
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const buildSha = resolveBuildSha(env, gitSha);

  execFileSync('npm', ['ci'], { cwd: appRoot, stdio: 'inherit' });
  execFileSync('npm', ['run', 'build'], { cwd: appRoot, stdio: 'inherit' });

  const config = publicConfig(env);
  config.auth.analyticsEndpoint = `${productionApiBaseUrl}/analytics/events`;

  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  for (const file of rootFiles) await copyFile(path.join(appRoot, file), path.join(output, file));
  for (const file of authFiles) await copyFile(path.join(appRoot, 'auth', file), path.join(output, 'auth', file));
  await fs.writeFile(path.join(output, 'auth/harness-config.js'), renderHarnessConfig(config));
  await copyPublicTree(path.join(appRoot, 'assets'), path.join(output, 'assets'), 'assets');
  await copyPublicTree(path.join(appRoot, 'vnext'), path.join(output, 'vnext'), 'vnext');

  const html = renderIndex(await fs.readFile(path.join(appRoot, 'index.html'), 'utf8'), buildSha);
  await fs.writeFile(path.join(output, 'index.html'), html);
  await fs.writeFile(path.join(output, '404.html'), html);
  await fs.writeFile(path.join(output, 'deployment-config.js'), renderDeploymentConfig(deploymentConfig()));
  await fs.writeFile(path.join(output, 'version.json'), `${JSON.stringify({ build: buildSha }, null, 2)}\n`);
  await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  console.log(`Built static Timeweb artifact at ${output} (${buildSha})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
