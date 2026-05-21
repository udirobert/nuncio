import type { Batch, CreateBatchInput } from "./types";

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
    jobs: input.urls.map((url, i) => ({
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
