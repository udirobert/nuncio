import type { AccountStorageProvider, ProofStorageProvider, ShareStorageProvider } from "./types";
import { FileShareStorageProvider } from "./file-provider";
import { FileAccountStorageProvider } from "./file-account-provider";
import { TursoShareStorageProvider } from "./turso-provider";
import { TursoAccountStorageProvider } from "./turso-account-provider";
import { GroveProofStorageProvider } from "./grove-provider";

let shareProvider: ShareStorageProvider | null = null;
let proofProvider: ProofStorageProvider | null = null;
let accountProvider: AccountStorageProvider | null = null;

export type {
  AccountStorageProvider,
  AccountUser,
  CreditAccountSummary,
  CreditTransactionRecord,
  ProofPublishResult,
  ProofStorageProvider,
  ShareListOptions,
  ShareRecordInput,
  ShareStorageProvider,
  WorkspaceAccount,
} from "./types";

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

export function getAccountStorageProvider(): AccountStorageProvider {
  if (accountProvider) return accountProvider;

  if (process.env.TURSO_DATABASE_URL) {
    accountProvider = new TursoAccountStorageProvider();
    console.log("[storage] Using Turso account storage");
    return accountProvider;
  }

  accountProvider = new FileAccountStorageProvider();
  console.log("[storage] Using file account storage");
  return accountProvider;
}

export function resetStorageProvidersForTests(): void {
  shareProvider = null;
  proofProvider = null;
  accountProvider = null;
}
