import type { ShareRecord } from "@/lib/artifacts";

const records = new Map<string, ShareRecord>();

function createId(): string {
  return crypto.randomUUID().slice(0, 12);
}

export function createShareRecord(
  input: Omit<ShareRecord, "id" | "createdAt">
): ShareRecord {
  const record: ShareRecord = {
    ...input,
    id: createId(),
    createdAt: new Date().toISOString(),
  };

  records.set(record.id, record);
  return record;
}

export function getShareRecord(id: string): ShareRecord | null {
  return records.get(id) || null;
}