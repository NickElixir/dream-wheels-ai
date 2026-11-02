import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, verifyRelease } from './verify_ru_release.mjs';

const sha = 'a'.repeat(40);
const gatewaySha = 'b'.repeat(40);
const origins = {
  'ru-test': 'https://app-test.dream-wheels.ru',
  'ru-production': 'https://app.dream-wheels.ru',
};
const apiBases = {
  'ru-test': 'https://gateway-test.dreamwheels.deno.net/api/backend',
  'ru-production': 'https://gateway.dreamwheels.deno.net/api/backend',
};

function mockFetch(options = {}) {
  const requested = [];
  const profile = options.profile ?? 'ru-test';
  const environment = profile === 'ru-production' ? 'production' : 'test';
  const siteOrigin = origins[profile];
  const apiBaseUrl = apiBases[profile];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    const request = { url: url.href, method: init.method || 'GET', headers, signal: init.signal };
    requested.push(request);
    if (url.pathname === '/version.json') {
      return Response.json({
        build: options.versionBuild ?? sha,
        profile: options.versionProfile ?? profile,
        environment: options.versionEnvironment ?? environment,
        apiBaseUrl: options.versionApiBaseUrl ?? apiBaseUrl,
      });
    }
    if (url.pathname === '/deployment-config.js') {
      const config = {
        profile: options.configProfile ?? profile,
        environment: options.configEnvironment ?? environment,
        apiBaseUrl: options.configApiBaseUrl ?? apiBaseUrl,
        websiteTelegramLoginEnabled: options.telegramLoginEnabled ?? false,
      };
      return new Response(`globalThis.__DREAM_WHEELS_DEPLOYMENT_CONFIG__ = Object.freeze(${JSON.stringify(config)});`);
    }
    if (url.pathname === '/' && url.origin === siteOrigin) {
      const telegramMarkup = options.telegramMarkup ?? '';
      const deploymentScript = options.deploymentScript ?? `<script src="/deployment-config.js?v=${sha}"></script>`;
      const harnessScript = options.harnessScript ?? `<script src="/auth/harness-config.js?v=${sha}"></script>`;
      const bundleScript = options.bundleScript ?? `<script src="/auth/app-auth.bundle.js?v=${sha}"></script>`;
      return new Response(`<meta name="robots" content="noindex, nofollow">${deploymentScript}${harnessScript}${bundleScript}${sha}${telegramMarkup}`);
    }
    if (url.pathname === '/health') {
      return Response.json({
        ok: options.healthOk ?? true,
        service: options.healthService ?? 'dream-wheels-gateway',
        environment: options.healthEnvironment ?? environment,
        build: options.healthBuild ?? gatewaySha,
      }, { status: options.healthStatus ?? 200, headers: options.revisionHeaders ?? { 'x-gateway-revision': 'rev-123' } });
    }
    if (url.pathname === '/upstream-health') {
      return Response.json({
        ok: options.upstreamOk ?? true,
        upstreamStatus: options.upstreamStatus ?? 200,
      }, { status: options.upstreamHttpStatus ?? 200 });
    }
    if (url.pathname === '/api/backend/auth/me' && request.method === 'OPTIONS') {
      return new Response(null, {
        status: options.preflightStatus ?? 204,
        headers: {
          'access-control-allow-origin': options.preflightOrigin ?? headers.get('origin') ?? '',
          'access-control-allow-methods': options.preflightMethods ?? 'GET, POST, OPTIONS',
          'access-control-allow-headers': options.preflightHeaders ?? 'authorization, content-type',
        },
      });
    }
    if (url.pathname === '/api/backend/auth/me' && headers.has('origin')) {
      return new Response('', { status: headers.get('origin') === 'https://invalid-origin.example' ? (options.badOriginStatus ?? 403) : (options.noTokenStatus ?? 401) });
    }
    return new Response('', { status: 404 });
  };
  return requested;
}

async function withMock(options, callback) {
  const previousFetch = globalThis.fetch;
  const requested = mockFetch(options);
  try {
    await callback(requested);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test('verifies site metadata, gateway identity/build, upstream health, CORS and protected boundary', async (t) => {
  for (const profile of ['ru-test', 'ru-production']) await t.test(profile, async () => withMock({ profile }, async (requested) => {
    const report = await verifyRelease({ profile, sha, gatewaySha });
    assert.equal(report.ok, true);
    assert.equal(report.gatewaySHA, gatewaySha);
    assert.deepEqual(report.revisionHeaders, { 'x-gateway-revision': 'rev-123' });
    assert.deepEqual(Object.keys(report.checks.html), [
      'buildStamp', 'deploymentConfigLoaded', 'harnessConfigVersioned', 'authBundleVersioned', 'noIndex', 'noTelegramDomains', 'noTelegramAuthButton',
    ]);
    assert.deepEqual(report.checks.protectedAuthBoundary, { missingToken: '401', untrustedOrigin: '403' });
    assert.deepEqual(requested.map(({ method, url }) => [method, new URL(url).pathname]), [
      ['GET', '/version.json'], ['GET', '/deployment-config.js'], ['GET', '/'], ['GET', '/health'],
      ['GET', '/upstream-health'], ['OPTIONS', '/api/backend/auth/me'], ['GET', '/api/backend/auth/me'], ['GET', '/api/backend/auth/me'],
    ]);
    assert.ok(requested.every(({ headers }) => !headers.has('authorization')));
    assert.ok(requested.filter(({ method, url }) => method === 'GET' && !new URL(url).pathname.endsWith('/auth/me'))
      .every(({ headers }) => headers.get('cache-control') === 'no-cache'));
    const configRequest = requested.find(({ url }) => new URL(url).pathname === '/deployment-config.js');
    assert.equal(new URL(configRequest.url).searchParams.get('v'), sha);
    assert.equal(requested.find(({ method }) => method === 'OPTIONS').headers.get('access-control-request-method'), 'GET');
    assert.doesNotMatch(JSON.stringify(report), /publishable|turnstile|bearer|secret/iu);
  }));
});

test('fails closed for each mismatched website version field', async (t) => {
  const cases = [
    ['build SHA', { versionBuild: 'c'.repeat(40) }, /version\.json build SHA/u],
    ['profile', { versionProfile: 'ru-production' }, /version\.json profile/u],
    ['environment', { versionEnvironment: 'production' }, /version\.json environment/u],
    ['API target', { versionApiBaseUrl: 'https://evil.example/api/backend' }, /version\.json API target/u],
  ];
  for (const [name, options, error] of cases) {
    await t.test(name, async () => withMock(options, async () => {
      await assert.rejects(verifyRelease({ profile: 'ru-test', sha, gatewaySha }), error);
    }));
  }
});

test('fails closed for deployment config and HTML safety mismatches', async (t) => {
  const cases = [
    ['deployment profile', { configProfile: 'ru-production' }, /deployment profile/u],
    ['deployment environment', { configEnvironment: 'production' }, /deployment environment/u],
    ['deployment API target', { configApiBaseUrl: 'https://evil.example/api/backend' }, /deployment API target/u],
    ['Telegram website login flag', { telegramLoginEnabled: true }, /Telegram login/u],
    ['deployment config cache key', { deploymentScript: '<script src="/deployment-config.js"></script>' }, /HTML is missing release markers/u],
    ['auth harness cache key', { harnessScript: '<script src="/auth/harness-config.js"></script>' }, /HTML is missing release markers/u],
    ['auth bundle cache key', { bundleScript: '<script src="/auth/app-auth.bundle.js"></script>' }, /HTML is missing release markers/u],
    ['Telegram domain', { telegramMarkup: '<a href="https://telegram.org">x</a>' }, /HTML is missing release markers/u],
    ['Telegram auth button', { telegramMarkup: '<button data-auth-telegram></button>' }, /HTML is missing release markers/u],
  ];
  for (const [name, options, error] of cases) {
    await t.test(name, async () => withMock(options, async () => {
      await assert.rejects(verifyRelease({ profile: 'ru-test', sha, gatewaySha }), error);
    }));
  }
});

test('fails closed for gateway identity, environment and build mismatches', async (t) => {
  const cases = [
    ['service', { healthService: 'other-service' }, /unexpected service/u],
    ['environment', { healthEnvironment: 'production' }, /environment does not match/u],
    ['build SHA', { healthBuild: 'c'.repeat(40) }, /build SHA does not match/u],
  ];
  for (const [name, options, error] of cases) {
    await t.test(name, async () => withMock(options, async () => {
      await assert.rejects(verifyRelease({ profile: 'ru-test', sha, gatewaySha }), error);
    }));
  }
});

test('requires successful upstream health and browser/API boundaries', async (t) => {
  const cases = [
    ['upstream response', { upstreamHttpStatus: 502 }, /HTTP 502/u],
    ['upstream status field', { upstreamStatus: 503 }, /upstream health check failed/u],
    ['upstream ok flag', { upstreamOk: false }, /upstream health check failed/u],
    ['preflight status', { preflightStatus: 403 }, /browser preflight/u],
    ['preflight origin', { preflightOrigin: 'https://invalid-origin.example' }, /browser preflight/u],
    ['preflight method', { preflightMethods: 'POST, OPTIONS' }, /browser preflight/u],
    ['preflight authorization header', { preflightHeaders: 'content-type' }, /browser preflight/u],
    ['missing-token boundary', { noTokenStatus: 200 }, /missing token/u],
    ['bad-origin boundary', { badOriginStatus: 200 }, /untrusted origin/u],
  ];
  for (const [name, options, error] of cases) {
    await t.test(name, async () => withMock(options, async () => {
      await assert.rejects(verifyRelease({ profile: 'ru-test', sha, gatewaySha }), error);
    }));
  }
});

test('defaults gateway SHA to site SHA and rejects invalid targets before fetching', async () => {
  await withMock({ healthBuild: sha }, async () => {
    const report = await verifyRelease({ profile: 'ru-test', sha });
    assert.equal(report.gatewaySHA, sha);
  });

  await withMock({}, async () => {
    await assert.rejects(verifyRelease({ profile: 'unknown', sha }), /profile/u);
    await assert.rejects(verifyRelease({ profile: 'ru-test', sha: 'latest' }), /SHA/u);
    await assert.rejects(verifyRelease({ profile: 'ru-test', sha, gatewaySha: 'latest' }), /gateway-sha/u);
    await assert.rejects(verifyRelease({ profile: 'ru-test', sha, baseUrl: 'https://example.com' }), /base URL/u);
  });
});



test('CLI arguments map gateway SHA and site URL into verifier options', () => {
  assert.deepEqual(parseArgs(['--profile', 'ru-test', '--sha', sha, '--gateway-sha', 'b'.repeat(40), '--base-url', 'https://app-test.dream-wheels.ru']), { profile:'ru-test', sha, gatewaySha:'b'.repeat(40), baseUrl:'https://app-test.dream-wheels.ru' });
});
