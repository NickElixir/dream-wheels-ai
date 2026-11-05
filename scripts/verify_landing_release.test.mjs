import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyLanding } from './verify_landing_release.mjs';
const sha = 'a'.repeat(40);
function fixture({ preview = true, mime = 'text/css', cache = 'no-cache' } = {}) {
  const profile = preview ? 'landing-ru-test' : 'landing-ru-production';
  const pages = Object.fromEntries(['/', '/catalog/'].map(route => [route, `<html lang="ru"><link rel="canonical" href="https://www.dream-wheels.ru${route === '/' ? '/' : '/catalog'}">${preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<a href="https://dreamwheels.pro">EN</a><a href="https://app.dream-wheels.ru/new">Create</a></html>`]));
  const files = Object.entries(pages).map(([route, html]) => ({path: route === '/' ? 'index.html' : 'catalog/index.html', sha256: createHash('sha256').update(html).digest('hex')}));
  files.push({path: '_astro/site.css', sha256: 'b'.repeat(64)});
  const fetcher = async url => {
    if (url.pathname === '/version.json') return Response.json({build: sha, profile, locale:'ru', webappOrigin:'https://app.dream-wheels.ru'});
    if (url.pathname === '/release-manifest.json') return Response.json({build:sha, profile, files});
    return new Response(pages[url.pathname] ?? '', {headers: {'cache-control':cache,'content-type': url.pathname.endsWith('.css') ? mime : 'text/html'}});
  };
  return {site:'https://landing-test.dream-wheels.ru', sha, profile, fetcher};
}
test('both release profiles verify their exact served pages and resources', async () => {
  for (const preview of [true,false]) assert.equal((await verifyLanding(fixture({preview}))).resourceChecks, 1);
});
test('wrong resource MIME and stale HTML cache policy fail release', async () => {
  await assert.rejects(verifyLanding(fixture({mime:'text/html'})), /MIME/);
  await assert.rejects(verifyLanding(fixture({cache:'public, max-age=3600'})), /revalidate/);
});
test('wrong version, unexpected hosts and wrong preview policy fail release', async () => {
  await assert.rejects(verifyLanding({...fixture(), sha:'c'.repeat(40)}), /version/);
  await assert.rejects(verifyLanding({...fixture(), site:'https://example.com'}), /host/);
  await assert.rejects(verifyLanding({...fixture(), profile:'landing-ru-production'}), /version/);
});
