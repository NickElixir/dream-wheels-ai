# Deferred EN Landing legacy redirects

Proposed release isolation, pending owner approval. The frontend-only source gate
rejects the landing/vercel.json hosting configuration added in #347. Restore the
existing main configuration for the WebApp-only release; do not weaken the gate.

Deferred addition: temporary redirects for /app, /app/new, /app/history,
/app/wallet, /app/settings, /app/support, /app/photo-guide and /app/docs from the
EN marketing domain to root routes on app.dreamwheels.pro. Original implementation
remains available in commit 548e3f1791ecf452e92e3ff8d57ce7352cf66969.

Legacy /app/* compatibility on the WebApp subdomains remains intact. No changes
to Auth Gate, /new, timeout/retry, backend, database or current production hosting.
Landing hosting redirect publication needs a separately reviewed release mode.
This PR does not publish a landing or apply hosting settings.
