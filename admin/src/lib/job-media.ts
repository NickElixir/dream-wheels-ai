export const mediaKinds = ["car_original", "rim_original", "result"] as const;
export type MediaKind = typeof mediaKinds[number];
export type AssetReference = {
  id: string | null;
  bucket: string;
  storage_key: string;
  content_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
};

export function isJobId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function isMediaKind(kind: string): kind is MediaKind {
  return mediaKinds.some((value) => value === kind);
}

export function mediaPath(id: string, kind: MediaKind): string {
  return `/api/jobs/${encodeURIComponent(id)}/assets/${kind}`;
}

export function safeReturnPath(value?: string): string {
  // Only dashboard query strings are accepted, never an arbitrary return URL.
  if (!value?.startsWith("/?")) return "/";
  const params = new URLSearchParams(value.slice(2));
  const safe = new URLSearchParams();
  for (const key of ["status", "feedback", "days", "user"]) {
    const item = params.get(key);
    if (item) safe.set(key, item);
  }
  return `/?${safe.toString()}`;
}

export function legacyAsset(jobId: string, kind: MediaKind, value: string | null): AssetReference | null {
  if (!isJobId(jobId) || !value || kind === "result") return null;
  const name = kind === "car_original" ? "car" : "wheel";
  // Only the historical uploader's exact job-local keys; never fetch external URLs.
  if (!new RegExp(`^${jobId}/${name}\\.(jpg|jpeg|png|webp)$`, "i").test(value)) return null;
  return { id: null, bucket: "raw", storage_key: value, content_type: null,
    size_bytes: null, width: null, height: null };
}

export function storageBase(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
      url.username || url.password || url.port || url.search || url.hash ||
      !["", "/", "/storage/v1", "/storage/v1/"].includes(url.pathname)) {
    throw new Error("Invalid storage configuration");
  }
  return `${url.origin}/storage/v1`;
}

export function legacyResult(value: string | null, base: string): AssetReference | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const prefix = `${storageBase(base)}/object/public/results/`;
    if (!url.href.startsWith(prefix) || url.search || url.hash) return null;
    const key = decodeURIComponent(url.href.slice(prefix.length));
    if (!validStorageKey(key)) return null;
    return { id: null, bucket: "results", storage_key: key, content_type: null,
      size_bytes: null, width: null, height: null };
  } catch {
    return null;
  }
}

export function validStorageKey(key: string): boolean {
  return key.length > 0 && !key.includes("\\") && !/[\x00-\x1f\x7f]/.test(key) &&
    key.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

export class MediaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function signAsset(
  asset: AssetReference,
  config: { url: string; key: string },
  request: typeof fetch = fetch,
): Promise<string> {
  if (!["raw", "results"].includes(asset.bucket) || !validStorageKey(asset.storage_key)) {
    throw new MediaError(404, "File not available");
  }
  if (!config.url || !config.key) throw new MediaError(503, "Image access is not configured");
  let base: string;
  try { base = storageBase(config.url); }
  catch { throw new MediaError(503, "Image access is not configured"); }
  const path = `${asset.bucket}/${asset.storage_key.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const response = await request(`${base}/object/sign/${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${config.key}`, apikey: config.key,
        "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 }), cache: "no-store",
      redirect: "error", signal: AbortSignal.timeout(15000),
    });
    // Storage versions can report a missing object as 400 or 404.
    if (!response.ok) {
      if (response.status === 404) throw new MediaError(404, "File not found");
      if (response.status === 400) {
        const body = await response.json();
        if (String(body.statusCode) === "404" || body.error === "not_found") {
          throw new MediaError(404, "File not found");
        }
      }
      throw new MediaError(502, "Image service unavailable. Please retry.");
    }
    const body = await response.json();
    if (typeof body.signedURL !== "string") throw new Error("Invalid response");
    const signed = new URL(`${base}${body.signedURL}`);
    if (signed.origin !== new URL(base).origin ||
        signed.pathname !== `/storage/v1/object/sign/${path}` || !signed.searchParams.get("token")) {
      throw new Error("Invalid response");
    }
    return signed.href;
  } catch (error) {
    if (error instanceof MediaError) throw error;
    // Do not propagate network errors: they can contain credentials or signed URLs.
    throw new MediaError(502, "Image service unavailable. Please retry.");
  }
}
