import { getStore } from "@netlify/blobs";

// Job state stored in Netlify Blobs. Keyed by jobId, scoped to a "kind"
// (analyze, render, etc.) so different long-running pipelines don't collide.

export type JobStatus = "pending" | "running" | "done" | "error";

export interface Job<TPayload, TResult> {
  id: string;
  kind: string;
  userId: string;
  status: JobStatus;
  payload: TPayload;
  result?: TResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const jobsStore = () => getStore({ name: "ai-jobs" });

function blobKey(kind: string, jobId: string): string {
  return `${kind}/${jobId}`;
}

export async function createJob<TPayload>(
  kind: string,
  userId: string,
  payload: TPayload,
): Promise<Job<TPayload, never>> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job: Job<TPayload, never> = {
    id,
    kind,
    userId,
    status: "pending",
    payload,
    createdAt: now,
    updatedAt: now,
  };
  await jobsStore().setJSON(blobKey(kind, id), job);
  return job;
}

export async function getJob<TPayload, TResult>(
  kind: string,
  jobId: string,
): Promise<Job<TPayload, TResult> | null> {
  const data = await jobsStore().get(blobKey(kind, jobId), { type: "json" });
  return (data as Job<TPayload, TResult> | null) ?? null;
}

export async function updateJob<TPayload, TResult>(
  kind: string,
  jobId: string,
  patch: Partial<Pick<Job<TPayload, TResult>, "status" | "result" | "error">>,
): Promise<void> {
  const existing = await getJob<TPayload, TResult>(kind, jobId);
  if (!existing) throw new Error(`Job ${jobId} not found`);
  const next: Job<TPayload, TResult> = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await jobsStore().setJSON(blobKey(kind, jobId), next);
}

// Trigger a Netlify background function for a kind+job. Background functions
// (any file in netlify/functions/ ending in `-background`) return 202 and
// run async with a 15-minute timeout.
export async function triggerBackground(
  kind: string,
  jobId: string,
): Promise<void> {
  const url = process.env.URL ?? process.env.DEPLOY_URL;
  if (!url) {
    throw new Error("Cannot determine site URL — URL env var missing");
  }
  // Fire-and-forget. Netlify returns 202 immediately, runs the worker async.
  await fetch(`${url}/.netlify/functions/${kind}-background`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}
