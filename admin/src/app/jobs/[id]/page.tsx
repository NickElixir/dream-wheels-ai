import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyId } from "@/components/job-controls";
import { JobGallery, type GalleryImage } from "@/components/job-gallery";
import { getJobDetails, resolveJobAsset } from "@/lib/job-data";
import { mediaPath, safeReturnPath, type MediaKind } from "@/lib/job-media";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export default async function JobPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const back = safeReturnPath((await searchParams).returnTo);
  const job = await getJobDetails(id);
  if (!job) notFound();
  const specs: { kind: MediaKind; title: string }[] = [
    { kind: "car_original", title: "Original car" },
    { kind: "result", title: "Generated result" },
    { kind: "rim_original", title: "Original wheel" },
  ];
  const images: GalleryImage[] = specs.map(({ kind, title }) => {
    const asset = resolveJobAsset(job, kind);
    const metadata = asset ? [asset.content_type?.replace("image/", "").toUpperCase(),
      asset.width && asset.height ? `${asset.width} × ${asset.height}` : null,
      asset.size_bytes ? `${(Number(asset.size_bytes) / 1024 / 1024).toFixed(1)} MB` : null,
    ].filter(Boolean).join(" · ") : "";
    return { kind, title, url: asset ? mediaPath(id, kind) : null,
      metadata: metadata || (asset ? "Original file · metadata not recorded" : ""),
      emptyMessage: kind !== "result" ? "Source file not attached" :
        job.status === "failed" ? "Generation failed" :
        ["queued", "processing"].includes(job.status) ? "Result is not ready yet" : "Result not attached" };
  });
  const date = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : "Not recorded";
  const rows = [
    ["Feedback", job.sentiment || "Unrated"], ["Reason", job.reason?.replaceAll("_", " ") || "—"],
    ["Created", date(job.created_at)], ["Completed", date(job.completed_at)],
    ["Completion time", job.processing_seconds !== null ? `${job.processing_seconds}s` : "—"],
    ["Source references", `Car ${images[0].url ? "attached" : "not attached"} / Wheel ${images[2].url ? "attached" : "not attached"}`],
  ];
  return <main className="admin-container job-page">
    <Link className="text-link" href={back}>← Back to jobs</Link>
    <header className="job-heading">
      <p className="muted">Dream Wheels AI / Job details</p>
      <div className="heading-row"><h1>Job {id.slice(0, 8)}…{id.slice(-4)}</h1><CopyId id={id} /></div>
      <div className="job-meta"><span className={`status-badge status-${job.status}`}>{job.status}</span>
        <span>{job.username ? `@${job.username}` : `User #${job.user_id}`}</span>
        <span>{date(job.created_at)}</span>
        <span>{job.processing_seconds !== null ? `${job.processing_seconds}s` : "In progress / not recorded"}</span>
      </div>
    </header>
    {job.error_message && <section className="admin-panel job-error"><h2>Generation error</h2>
      <p>{job.error_code}</p><p className="whitespace-pre-wrap break-words">{job.error_message}</p></section>}
    <JobGallery images={images} information={<section className="admin-panel job-information">
      <h2>Job information</h2><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="muted">File references do not guarantee that a stored object is still available.</p>
    </section>} />
    <details className="admin-panel technical-details"><summary>Technical details</summary>
      <dl>{[
        ["Job ID", job.id], ["User ID", String(job.user_id)], ["Telegram ID", job.telegram_user_id],
        ["Generation provider", job.generation_provider], ["Provider request ID", job.provider_request_id],
        ["Provider latency", job.generation_latency_ms !== null ? `${job.generation_latency_ms} ms` : null],
        ["Car asset ID", job.car_asset_id], ["Wheel asset ID", job.rim_asset_id], ["Result asset ID", job.result_asset_id],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not recorded"}</dd></div>)}</dl>
    </details>
  </main>;
}
