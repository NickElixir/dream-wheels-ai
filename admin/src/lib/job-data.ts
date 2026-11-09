import { query } from "@/lib/db";
import { isJobId, legacyAsset, legacyResult, type AssetReference, type MediaKind } from "@/lib/job-media";

export type JobDetails = {
  id: string;
  user_id: number;
  username: string | null;
  telegram_user_id: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  processing_seconds: number | null;
  sentiment: string | null;
  reason: string | null;
  error_code: string | null;
  error_message: string | null;
  generation_provider: string | null;
  provider_request_id: string | null;
  generation_latency_ms: number | null;
  car_asset_id: string | null;
  rim_asset_id: string | null;
  result_asset_id: string | null;
  car_image_url: string | null;
  wheel_image_url: string | null;
  output_image_url: string | null;
  car: AssetReference | null;
  wheel: AssetReference | null;
  result: AssetReference | null;
};

export async function getJobDetails(id: string, runQuery: typeof query = query): Promise<JobDetails | null> {
  if (!isJobId(id)) return null;
  const rows = await runQuery<JobDetails>(`
    SELECT j.id::text, j.user_id, j.status, j.created_at::text, j.completed_at::text,
      ROUND(EXTRACT(EPOCH FROM (j.completed_at - j.created_at)))::int AS processing_seconds,
      j.error_code, j.error_message, j.generation_provider, j.provider_request_id,
      j.generation_latency_ms, j.car_asset_id::text, j.rim_asset_id::text,
      j.result_asset_id::text, j.car_image_url, j.wheel_image_url, j.output_image_url,
      u.username, u.telegram_user_id::text, rf.sentiment, rf.reason,
      CASE WHEN car.id IS NOT NULL THEN to_jsonb(car) END AS car,
      CASE WHEN wheel.id IS NOT NULL THEN to_jsonb(wheel) END AS wheel,
      CASE WHEN result.id IS NOT NULL THEN to_jsonb(result) END AS result
    FROM jobs j
    LEFT JOIN users u ON u.id = j.user_id
    LEFT JOIN render_feedback rf ON rf.render_job_id = j.id AND rf.owner_user_id = j.user_id
    LEFT JOIN assets car ON car.id = j.car_asset_id
      AND car.owner_user_id = j.user_id AND car.kind = 'car_original' AND car.bucket = 'raw'
    LEFT JOIN assets wheel ON wheel.id = j.rim_asset_id
      AND wheel.owner_user_id = j.user_id AND wheel.kind = 'rim_original' AND wheel.bucket = 'raw'
    LEFT JOIN assets result ON result.id = j.result_asset_id
      AND result.owner_user_id = j.user_id AND result.kind = 'result' AND result.bucket = 'results'
    WHERE j.id = $1::uuid
  `, [id]);
  return rows[0] ?? null;
}

export function resolveJobAsset(job: JobDetails, kind: MediaKind): AssetReference | null {
  if (kind === "car_original") {
    return job.car ?? (!job.car_asset_id ? legacyAsset(job.id, kind, job.car_image_url) : null);
  }
  if (kind === "rim_original") {
    return job.wheel ?? (!job.rim_asset_id ? legacyAsset(job.id, kind, job.wheel_image_url) : null);
  }
  return job.result ?? (!job.result_asset_id
    ? legacyResult(job.output_image_url, process.env.SUPABASE_STORAGE_URL || "") : null);
}
