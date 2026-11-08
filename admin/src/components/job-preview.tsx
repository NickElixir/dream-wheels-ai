"use client";
/* eslint-disable @next/next/no-img-element -- Protected media must bypass the public image optimizer. */
import { useState } from "react";

export function JobPreview({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  return <div className="job-preview">{url && !failed
    ? <img src={url} alt="Generated result preview" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="muted">No preview</span>}</div>;
}
