import type { AccountStorageProvider, BatchStorageProvider, ProofStorageProvider, ShareStorageProvider, TokenStorageProvider } from "./types";
import { FileShareStorageProvider } from "./file-provider";
import { FileAccountStorageProvider } from "./file-account-provider";
import { FileBatchStorageProvider } from "./file-batch-provider";
import { FileTokenStorageProvider } from "./file-token-provider";
import { TursoShareStorageProvider } from "./turso-provider";
import { TursoAccountStorageProvider } from "./turso-account-provider";
import { TursoBatchStorageProvider } from "./turso-batch-provider";
import { TursoTokenStorageProvider } from "./turso-token-provider";
import { GroveProofStorageProvider } from "./grove-provider";

let shareProvider: ShareStorageProvider | null = null;
let proofProvider: ProofStorageProvider | null = null;
let accountProvider: AccountStorageProvider | null = null;
let tokenProvider: TokenStorageProvider | null = null;
let batchProvider: BatchStorageProvider | null = null;

export type {
  AccountStorageProvider,
  AccountUser,
  BatchStorageProvider,
  CreditAccountSummary,
  CreditTransactionRecord,
  MagicLinkToken,
  ProofPublishResult,
  ProofStorageProvider,
  ShareListOptions,
  ShareRecordInput,
  ShareStorageProvider,
  TokenStorageProvider,
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

export function getTokenStorageProvider(): TokenStorageProvider {
  if (tokenProvider) return tokenProvider;

  if (process.env.TURSO_DATABASE_URL) {
    tokenProvider = new TursoTokenStorageProvider();
    console.log("[storage] Using Turso token storage");
    return tokenProvider;
  }

  tokenProvider = new FileTokenStorageProvider();
  console.log("[storage] Using file token storage");
  return tokenProvider;
}

export function getBatchStorageProvider(): BatchStorageProvider {
  if (batchProvider) return batchProvider;

  if (process.env.TURSO_DATABASE_URL) {
    batchProvider = new TursoBatchStorageProvider();
    console.log("[storage] Using Turso batch storage");
    return batchProvider;
  }

  batchProvider = new FileBatchStorageProvider();
  console.log("[storage] Using file batch storage");
  return batchProvider;
}

export function resetStorageProvidersForTests(): void {
  shareProvider = null;
  proofProvider = null;
  accountProvider = null;
  tokenProvider = null;
  batchProvider = null;
}
