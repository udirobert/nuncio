import type { ShareRecord } from "@/lib/artifacts";
import { getProofStorageProvider, getShareStorageProvider } from "@/lib/storage";
import type { ShareRecordInput } from "@/lib/storage";

export async function createShareRecord(input: ShareRecordInput): Promise<ShareRecord> {
  const shareProvider = getShareStorageProvider();
  const record = await shareProvider.create(input);

  const proofProvider = getProofStorageProvider();
  if (proofProvider) {
    try {
      const proof = await proofProvider.publish(record);
      if (proof) {
        record.proof = proof;
        await shareProvider.update(record);
      }
    } catch (error) {
      console.warn("[storage] Proof publishing failed:", error);
    }
  }

  return record;
}

export async function getShareRecord(id: string): Promise<ShareRecord | null> {
  return getShareStorageProvider().get(id);
}

export async function updateShareRecord(id: string, updates: Partial<Pick<ShareRecord, "videoUrl" | "videoId" | "trace">>): Promise<ShareRecord | null> {
  const shareProvider = getShareStorageProvider();
  const existing = await shareProvider.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  await shareProvider.update(updated);
  return updated;
}