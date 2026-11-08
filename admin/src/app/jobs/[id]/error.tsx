"use client";

import Link from "next/link";

export default function JobError({ reset }: { reset: () => void }) {
  return <main className="admin-container job-page">
    <Link className="text-link" href="/">← Back to jobs</Link>
    <section className="admin-panel job-error">
      <h2>Job details unavailable</h2>
      <p>Could not load this job. Please retry.</p>
      <button className="admin-button mt-4" onClick={reset}>Retry</button>
    </section>
  </main>;
}
