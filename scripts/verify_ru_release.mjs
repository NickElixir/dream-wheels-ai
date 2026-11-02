#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const profiles = Object.freeze({
  'ru-test': {
    siteOrigin: 'https://app-test.dream-wheels.ru',
    apiBaseUrl: 'https://gateway-test.dreamwheels.deno.net/api/backend',
    environment: 'test',
  },
  'ru-production': {
    siteOrigin: 'https://app.dream-wheels.ru',
    apiBaseUrl: 'https://gateway.dreamwheels.deno.net/api/backend',
    environment: 'production',
  },
});

export function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!['--profile', '--sha', '--gateway-sha', '--base-url'].includes(key) || !args[index + 1]) {
      throw new Error(`Invalid argument: ${key || '(missing)'}`);
    }
    const name = { "--gateway-sha": "gatewaySha", "--base-url": "baseUrl" }[key] || key.slice(2);
    values[name] = args[index + 1];
    index += 1;
  }
  return values;
}

function parseDeploymentConfig(source) {
  const match = source.match(/__DREAM_WHEELS_DEPLOYMENT_CONFIG__\s*=\s*Object\.freeze\((\{[^;]+\})\);/u);
  if (!match) throw new Error('deployment-config.js has an unexpected format');
  return JSON.parse(match[1]);
}

async function get(url, { timeoutMs = 15_000 } = {}) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json,text/html,*/*', 'cache-control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${new URL(url).pathname}`);
  return response;
}

export async function verifyRelease({ profile, sha, gatewaySha: suppliedGatewaySha, baseUrl }) {
  const expected = profiles[profile];
  if (!expected) throw new Error('profile must be ru-test or ru-production');
  if (!/^[a-f0-9]{40}$/iu.test(sha || '')) throw new Error('sha must be a full commit SHA');
  const gatewaySha = suppliedGatewaySha || sha;
  if (!/^[a-f0-9]{40}$/iu.test(gatewaySha || '')) throw new Error('gateway-sha must be a full commit SHA');

  const site = new URL(baseUrl || expected.siteOrigin);
  if (site.protocol !== 'https:' || site.origin !== expected.siteOrigin || site.pathname !== '/' || site.search || site.hash || site.username || site.password) {
    throw new Error(`base URL must be ${expected.siteOrigin}`);
  }

  const versionResponse = await get(new URL('/version.json', site));
  const version = await versionResponse.json();
  if (version.build !== sha.toLowerCase()) throw new Error('version.json build SHA does not match');
  if (version.profile !== profile) throw new Error('version.json profile does not match');
  if (version.environment !== expected.environment) throw new Error('version.json environment does not match');
  if (version.apiBaseUrl !== expected.apiBaseUrl) throw new Error('version.json API target does not match profile');

  const deploymentConfigUrl = new URL('/deployment-config.js', site);
  deploymentConfigUrl.searchParams.set('v', sha.toLowerCase());
  const configResponse = await get(deploymentConfigUrl);
  const configText = await configResponse.text();
  const config = parseDeploymentConfig(configText);
  if (config.profile !== profile) throw new Error('deployment profile does not match');
  if (config.environment !== expected.environment) throw new Error('deployment environment does not match profile');
  if (config.apiBaseUrl !== expected.apiBaseUrl) throw new Error('deployment API target does not match profile');
  if (config.websiteTelegramLoginEnabled !== false) throw new Error('website Telegram login must be disabled');

  const htmlResponse = await get(new URL('/', site));
  const html = await htmlResponse.text();
  const htmlChecks = {
    buildStamp: html.includes(sha.toLowerCase()),
    deploymentConfigLoaded: html.includes(`<script src="/deployment-config.js?v=${sha.toLowerCase()}"></script>`),
    harnessConfigVersioned: html.includes(`<script src="/auth/harness-config.js?v=${sha.toLowerCase()}"></script>`),
    authBundleVersioned: html.includes(`<script src="/auth/app-auth.bundle.js?v=${sha.toLowerCase()}"></script>`),
    noIndex: /<meta name="robots" content="noindex, nofollow">/u.test(html),
    noTelegramDomains: !/(?:telegram\.org|t\.me)/iu.test(html),
    noTelegramAuthButton: !/(?:data-auth-telegram|auth-dialog-telegram)/iu.test(html),
  };
  if (Object.values(htmlChecks).some((passed) => !passed)) throw new Error('served HTML is missing release markers');


  const healthUrl = new URL('/health', new URL(expected.apiBaseUrl).origin);
  const healthResponse = await get(healthUrl);
  const health = await healthResponse.json();
  if (health.ok !== true || health.service !== 'dream-wheels-gateway') {
    throw new Error('Deno gateway health response has an unexpected service or status');
  }
  if (health.environment !== expected.environment) throw new Error('Deno gateway environment does not match profile');
  if (health.build !== gatewaySha.toLowerCase()) throw new Error('Deno gateway build SHA does not match');

  const upstreamHealthResponse = await get(new URL('/upstream-health', new URL(expected.apiBaseUrl).origin), { timeoutMs: 65_000 });
  const upstreamHealth = await upstreamHealthResponse.json();
  if (upstreamHealthResponse.status !== 200 || upstreamHealth.ok !== true || upstreamHealth.upstreamStatus !== 200) {
    throw new Error('Deno gateway upstream health check failed');
  }

  const gatewayOrigin = new URL(expected.apiBaseUrl).origin;
  const allowedOrigin = expected.siteOrigin;
  const preflightResponse = await fetch(`${gatewayOrigin}/api/backend/auth/me`, {
    method: 'OPTIONS',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: {
      Origin: allowedOrigin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  if (preflightResponse.status !== 204
      || preflightResponse.headers.get('access-control-allow-origin') !== allowedOrigin
      || !preflightResponse.headers.get('access-control-allow-methods')?.split(',').map((method) => method.trim()).includes('GET')
      || !preflightResponse.headers.get('access-control-allow-headers')?.split(',').map((header) => header.trim().toLowerCase()).includes('authorization')) {
    throw new Error('Deno gateway rejected the expected browser preflight');
  }

  const noTokenResponse = await fetch(`${gatewayOrigin}/api/backend/auth/me`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Origin: allowedOrigin },
  });
  if (noTokenResponse.status !== 401) throw new Error('Protected auth/me route did not reject a missing token');

  const badOriginResponse = await fetch(`${gatewayOrigin}/api/backend/auth/me`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Origin: 'https://invalid-origin.example' },
  });
  if (badOriginResponse.status !== 403) throw new Error('Protected auth/me route did not reject an untrusted origin');

  const revisionHeaders = {};
  for (const name of ['x-gateway-revision', 'x-revision', 'x-revision-sha', 'x-build-sha']) {
    const value = healthResponse.headers.get(name);
    if (value && /^[A-Za-z0-9._-]{1,120}$/u.test(value)) revisionHeaders[name] = value;
  }

  return {
    ok: true,
    profile,
    sha: sha.toLowerCase(),
    site: site.origin,
    apiBaseUrl: expected.apiBaseUrl,
    gatewaySHA: health.build,
    revisionHeaders,
    checks: {
      versionJson: 'pass',
      deploymentConfig: 'pass',
      html: htmlChecks,
      gatewayHealth: 'pass',
      upstreamHealth: 'pass',
      browserPreflight: 'pass',
      protectedAuthBoundary: { missingToken: '401', untrustedOrigin: '403' },
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let report;
  try {
    const args = parseArgs(process.argv.slice(2));
    report = await verifyRelease(args);
  } catch (error) {
    report = { ok: false, error: error instanceof Error ? error.message : 'verification failed' };
    process.exitCode = 1;
  }
  if (report) console.log(JSON.stringify(report));
}
