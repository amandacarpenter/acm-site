import type { DocumentTaskStatus } from "@shared/schema";

export type CreditFetch = (url: string, options: RequestInit) => Promise<Response>;
export async function documentRequest(fetcher: CreditFetch, url: string, options: RequestInit = { method: "GET" }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try { return await fetcher(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
export async function readDocumentJob(response: Response): Promise<DocumentTaskStatus> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.job) throw new Error(data.error || `Couldn't check the document (HTTP ${response.status}).`);
  return data.job;
}
export async function waitForDocument(fetcher: CreditFetch, initial: DocumentTaskStatus,
  onStatus: (status: DocumentTaskStatus) => void, signal?: AbortSignal): Promise<Response> {
  let job = initial, failures = 0;
  const started = Date.now();
  while (!signal?.aborted) {
    onStatus(job);
    if (job.state === "ready") {
      const result = await documentRequest(fetcher, `/api/remedy-docs/jobs/${job.id}/result`);
      if (!result.ok) {
        const data = await result.json().catch(() => ({}));
        throw new Error(data.error || `Couldn't retrieve the finished file (HTTP ${result.status}). Check this job again rather than uploading again.`);
      }
      return result;
    }
    if (["failed", "expired", "interrupted"].includes(job.state)) {
      throw new Error(`${job.error || "The recovery window for this document has ended."} Reference: ${job.id}`);
    }
    // Stop only client polling, never resubmit or cancel paid work on a network
    // failure. The signed-in user can reconnect to the same job without a charge.
    if (Date.now() - started > 35 * 60_000) throw new Error(`This job is taking longer than expected. Check its status again; do not upload it again. Reference: ${job.id}`);
    await new Promise(resolve => setTimeout(resolve, 2500));
    if (signal?.aborted) break;
    try {
      const response = await documentRequest(fetcher, `/api/remedy-docs/jobs/${job.id}`);
      if (response.status === 401 || response.status === 404) {
        throw Object.assign(new Error(response.status === 401 ? "Please sign in again, then check your document status." : "Document job no longer available. Please contact support before resubmitting."), { permanent: true });
      }
      job = await readDocumentJob(response);
      failures = 0;
    } catch (err: any) {
      if (err.permanent || ++failures >= 5) throw new Error(`${err.message || "Connection interrupted"}. Your job may still be processing. Reference: ${job.id}`);
      onStatus({ ...job, stage: "Reconnecting to your document job; no need to upload again" });
    }
  }
  throw new DOMException("Stopped checking document status", "AbortError");
}
