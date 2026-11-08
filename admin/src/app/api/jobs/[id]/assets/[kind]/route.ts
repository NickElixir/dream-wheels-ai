import { adminAuthHeaders, checkAdminAuth } from "@/lib/admin-auth";
import { getJobDetails, resolveJobAsset } from "@/lib/job-data";
import { isJobId, isMediaKind, MediaError, signAsset } from "@/lib/job-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string; kind: string }> }) {
  const status = checkAdminAuth(request.headers.get("authorization"));
  const headers = { ...adminAuthHeaders(status), "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff" };
  if (status !== 200) return new Response(status === 401 ? "Authentication required" : "Admin auth is not configured", { status, headers });
  const { id, kind } = await context.params;
  if (!isJobId(id) || !isMediaKind(kind)) return new Response("Not found", { status: 404, headers });
  try {
    const job = await getJobDetails(id);
    const asset = job && resolveJobAsset(job, kind);
    if (!asset) return new Response("File not attached", { status: 404, headers });
    const url = await signAsset(asset, { url: process.env.SUPABASE_STORAGE_URL || "",
      key: process.env.SUPABASE_SERVICE_ROLE_KEY || "" });
    return new Response(null, { status: 307, headers: { ...headers, Location: url } });
  } catch (error) {
    if (error instanceof MediaError) return new Response(error.message, { status: error.status, headers });
    console.error("admin_job_media_failed", { job_id: id, kind });
    return new Response("Image access unavailable. Please retry.", { status: 503, headers });
  }
}
