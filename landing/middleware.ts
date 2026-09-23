import { next, rewrite } from '@vercel/functions';
import { domainI18nEnabled } from './src/i18n/config.js';
import { getCandidateHostname, getInternalLocalePath } from './src/i18n/routing.js';

export const config = {
  matcher: ['/', '/catalog', '/catalog/', '/en', '/en/:path*', '/ru', '/ru/:path*'],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);

  // The locale paths are pre-rendered rewrite targets, not indexable public URLs.
  if (/^\/(?:en|ru)(?:\/|$)/.test(url.pathname)) {
    return next({ headers: { 'X-Robots-Tag': 'noindex, follow' } });
  }

  if (!domainI18nEnabled) return next();
  const hostname = getCandidateHostname(url, request.headers.get('x-dw-candidate-host'), process.env.VERCEL_ENV === 'preview');
  const target = getInternalLocalePath(hostname, url.pathname);
  if (!target) return next();

  url.pathname = target;
  return rewrite(url);
}
