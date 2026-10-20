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
    workspaceId: input.workspaceId,
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

/**
 * Does this batch belong to the caller?
 *
 * A batch holds a prospect list, the sender's brief, the creator's email and
 * a webhook URL — none of which may be readable by another account. Batches
 * created before workspace scoping carry no `workspaceId`, so they fall back
 * to the creator's email.
 */
export function batchBelongsToWorkspace(
  batch: Batch | null | undefined,
  workspaceId: string,
  email?: string,
): boolean {
  if (!batch) return false;
  if (batch.workspaceId) return batch.workspaceId === workspaceId;
  if (batch.creatorEmail && email) {
    return batch.creatorEmail.toLowerCase() === email.toLowerCase();
  }
  return false;
}

/** Every batch the workspace owns. */
export async function listBatchesForWorkspace(
  workspaceId: string,
  email?: string,
): Promise<Batch[]> {
  const all = await listBatches();
  return all.filter((batch) => batchBelongsToWorkspace(batch, workspaceId, email));
}

/** A batch only if the workspace owns it. */
export async function getBatchForWorkspace(
  id: string,
  workspaceId: string,
  email?: string,
): Promise<Batch | undefined> {
  const batch = await getBatch(id);
  return batchBelongsToWorkspace(batch, workspaceId, email) ? batch : undefined;
}

/** Delete a batch only if the workspace owns it. Returns false otherwise. */
export async function deleteBatchForWorkspace(
  id: string,
  workspaceId: string,
  email?: string,
): Promise<boolean> {
  const batch = await getBatchForWorkspace(id, workspaceId, email);
  if (!batch) return false;
  await deleteBatch(id);
  return true;
}

/** Strip the fields the owner never needs back (email, webhook URL). */
export function publicBatchView(batch: Batch): Omit<Batch, "creatorEmail" | "webhookUrl"> {
  const view = { ...batch } as Partial<Batch>;
  delete view.creatorEmail;
  delete view.webhookUrl;
  return view as Omit<Batch, "creatorEmail" | "webhookUrl">;
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
