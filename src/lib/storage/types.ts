import type { ShareRecord } from "@/lib/artifacts";

export type ShareRecordInput = Omit<ShareRecord, "id" | "createdAt">;

export interface ShareListOptions {
  limit?: number;
  industry?: string;
  privacy?: string;
  workspaceId?: string;
}

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
  list(options?: ShareListOptions): Promise<ShareRecord[]>;
  findByCustomerId(customerId: string): Promise<ShareRecord | null>;
}

export interface ProofStorageProvider {
  readonly name: string;
  publish(record: ShareRecord): Promise<ProofPublishResult | null>;
}

export interface AccountUser {
  id: string;
  email: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceAccount {
  id: string;
  ownerUserId?: string;
  name: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePlanType?: string;
  plan?: "free" | "pro" | "studio";
  createdAt: string;
  updatedAt: string;
}

export type CreditTransactionType = "grant" | "debit" | "refund" | "adjustment";

export interface CreditTransactionRecord {
  id: string;
  workspaceId: string;
  userId?: string;
  type: CreditTransactionType;
  amount: number;
  action?: string;
  reason: string;
  flowId?: string;
  provider?: string;
  reservationId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreditAccountSummary {
  workspace: WorkspaceAccount;
  balance: number;
  transactions: CreditTransactionRecord[];
}

export interface AccountStorageProvider {
  readonly name: string;
  upsertUserByEmail(email: string, updates?: Partial<AccountUser>): Promise<AccountUser>;
  getUserByEmail(email: string): Promise<AccountUser | null>;
  getUserByStripeCustomerId(customerId: string): Promise<AccountUser | null>;
  updateUser(id: string, updates: Partial<AccountUser>): Promise<AccountUser | null>;
  upsertWorkspaceForUser(user: AccountUser, updates?: Partial<WorkspaceAccount>): Promise<WorkspaceAccount>;
  getWorkspace(id: string): Promise<WorkspaceAccount | null>;
  getWorkspaceByStripeCustomerId(customerId: string): Promise<WorkspaceAccount | null>;
  updateWorkspace(id: string, updates: Partial<WorkspaceAccount>): Promise<WorkspaceAccount | null>;
  getCreditSummary(workspaceId: string): Promise<CreditAccountSummary | null>;
  appendCreditTransaction(input: Omit<CreditTransactionRecord, "id" | "createdAt">): Promise<CreditTransactionRecord>;
}
