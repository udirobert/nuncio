import type { Batch, BatchJob, CreateBatchInput } from "./types";

const batches = new Map<string, Batch>();

export function createBatch(input: CreateBatchInput): Batch {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const batch: Batch = {
    id,
    name: input.name,
    senderBrief: input.senderBrief,
    senderName: input.senderName,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    completedCount: 0,
    failedCount: 0,
    jobs: input.urls.map((url) => ({
      id: crypto.randomUUID(),
      url,
      recipientName: extractName(url),
      status: "queued",
    })),
  };

  batches.set(id, batch);
  return batch;
}

export function getBatch(id: string): Batch | undefined {
  return batches.get(id);
}

export function listBatches(): Batch[] {
  return Array.from(batches.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function updateJob(
  batchId: string,
  jobId: string,
  updates: Partial<BatchJob>,
): void {
  const batch = batches.get(batchId);
  if (!batch) return;
  const job = batch.jobs.find((j) => j.id === jobId);
  if (!job) return;
  Object.assign(job, updates);
  batch.completedCount = batch.jobs.filter((j) => j.status === "completed").length;
  batch.failedCount = batch.jobs.filter((j) => j.status === "failed").length;
  batch.updatedAt = new Date().toISOString();
}

export function deleteBatch(batchId: string): boolean {
  return batches.delete(batchId);
}

export function updateBatchStatus(batchId: string, status: Batch["status"]): void {
  const batch = batches.get(batchId);
  if (!batch) return;
  batch.status = status;
  batch.updatedAt = new Date().toISOString();
}

function extractName(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    if (segments.length > 0) {
      return segments[segments.length - 1].replace(/[-_]/g, " ");
    }
  } catch {
    // ignore
  }
  return undefined;
}
