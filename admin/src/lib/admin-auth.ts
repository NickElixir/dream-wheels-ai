export function checkAdminAuth(header: string | null): number {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return 503;
  if (!header?.startsWith("Basic ")) return 401;
  try {
    const credentials = atob(header.slice(6));
    const separator = credentials.indexOf(":");
    if (separator < 0) return 401;
    return credentials.slice(0, separator) === username &&
      credentials.slice(separator + 1) === password ? 200 : 401;
  } catch {
    return 401;
  }
}

export function adminAuthHeaders(status: number): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="Dream Wheels Admin"' } : {}),
  };
}
