import type { ProofStorageProvider, ShareStorageProvider } from "./types";
import { FileShareStorageProvider } from "./file-provider";
import { TursoShareStorageProvider } from "./turso-provider";
import { GroveProofStorageProvider } from "./grove-provider";

let shareProvider: ShareStorageProvider | null = null;
let proofProvider: ProofStorageProvider | null = null;

export type { ProofPublishResult, ProofStorageProvider, ShareRecordInput, ShareStorageProvider } from "./types";

export function getShareStorageProvider(): ShareStorageProvider {
  if (shareProvider) return shareProvider;

  if (process.env.TURSO_DATABASE_URL) {
    shareProvider = new TursoShareStorageProvider();
    console.log("[storage] Using Turso share storage");
    return shareProvider;
  }

  shareProvider = new FileShareStorageProvider();
  console.log("[storage] Using file share storage");
  return shareProvider;
}

export function getProofStorageProvider(): ProofStorageProvider | null {
  if (proofProvider) return proofProvider;

  if (process.env.GROVE_ENABLED === "true") {
    proofProvider = new GroveProofStorageProvider();
    console.log("[storage] Using Grove proof storage");
    return proofProvider;
  }

  return null;
}

export function resetStorageProvidersForTests(): void {
  shareProvider = null;
  proofProvider = null;
}