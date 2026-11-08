"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CopyId({ id }: { id: string }) {
  const [state, setState] = useState("Copy ID");
  return <button className="admin-button" type="button" aria-label={`Copy job ID ${id}`} onClick={async () => {
    try { await navigator.clipboard.writeText(id); setState("Copied"); }
    catch { setState("Copy failed"); }
    window.setTimeout(() => setState("Copy ID"), 2000);
  }}><span role="status">{state}</span></button>;
}

export function Refresh() {
  const router = useRouter();
  return <button className="admin-button" type="button" onClick={() => router.refresh()}>↻ Refresh</button>;
}
