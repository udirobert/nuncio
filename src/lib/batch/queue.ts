import type { Batch, BatchJob, CreateBatchInput } from "./types";
import { getBatchStorageProvider } from "@/lib/storage";

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

export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  const provider = getBatchStorageProvider();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const batch: Batch = {
    id,
    name: input.name,
    senderBrief: input.senderBrief,
    senderName: input.senderName,
    creatorEmail: input.creatorEmail,
    webhookUrl: input.webhookUrl,
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

  await provider.create(batch);
  return batch;
}

export async function getBatch(id: string): Promise<Batch | undefined> {
  const provider = getBatchStorageProvider();
  const batch = await provider.get(id);
  return batch || undefined;
}

export async function listBatches(): Promise<Batch[]> {
  const provider = getBatchStorageProvider();
  return provider.list();
}

export async function updateJob(
  batchId: string,
  jobId: string,
  updates: Partial<BatchJob>,
): Promise<void> {
  const provider = getBatchStorageProvider();
  const batch = await provider.get(batchId);
  if (!batch) return;
  const job = batch.jobs.find((j) => j.id === jobId);
  if (!job) return;
  Object.assign(job, updates);
  batch.completedCount = batch.jobs.filter((j) => j.status === "completed").length;
  batch.failedCount = batch.jobs.filter((j) => j.status === "failed").length;
  batch.updatedAt = new Date().toISOString();
  await provider.update(batch);
}

export async function deleteBatch(batchId: string): Promise<boolean> {
  const provider = getBatchStorageProvider();
  await provider.delete(batchId);
  return true;
}

export async function updateBatchStatus(batchId: string, status: Batch["status"]): Promise<void> {
  const provider = getBatchStorageProvider();
  const batch = await provider.get(batchId);
  if (!batch) return;
  batch.status = status;
  batch.updatedAt = new Date().toISOString();
  await provider.update(batch);
}
