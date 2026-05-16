import type { ShareRecord } from "@/lib/artifacts";

export type ShareRecordInput = Omit<ShareRecord, "id" | "createdAt">;

export interface ProofPublishResult {
  provider: string;
  uri?: string;
  gatewayUrl?: string;
  storageKey?: string;
}

export interface ShareStorageProvider {
  readonly name: string;
  create(input: ShareRecordInput): Promise<ShareRecord>;
  get(id: string): Promise<ShareRecord | null>;
  update(record: ShareRecord): Promise<void>;
  list(options?: { limit?: number; industry?: string; privacy?: string }): Promise<ShareRecord[]>;
}

export interface ProofStorageProvider {
  readonly name: string;
  publish(record: ShareRecord): Promise<ProofPublishResult | null>;
}