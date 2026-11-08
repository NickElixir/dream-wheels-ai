"use client";
/* eslint-disable @next/next/no-img-element -- Protected media must bypass the public image optimizer. */
import { useState } from "react";

export function JobPreview({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <div className="job-preview">{url && !failed
    ? <img src={attempt ? `${url}${url.includes("?") ? "&" : "?"}attempt=${attempt}` : url}
        alt="Generated result preview" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : url ? <button type="button" className="admin-button" aria-label="Retry result preview" onClick={() => {
        setAttempt((value) => value + 1);
        setFailed(false);
      }}>Retry</button>
    : <span className="muted">No preview</span>}</div>;
}
