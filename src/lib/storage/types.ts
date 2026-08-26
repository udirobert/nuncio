import type { ShareRecord } from "@/lib/artifacts";
import type { Batch } from "@/lib/batch/types";

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
  lastSenderBrief?: string;
  lastSenderName?: string;
  senderBusiness?: string;
  senderBrand?: string;
  senderPersonality?: string;
  senderAudience?: string;
  senderOffer?: string;
  senderProofPoints?: string;
  /** Sender playbook for live / agentic conversations. */
  playbookWants?: string;
  playbookOffer?: string;
  playbookWiggleRoom?: string;
  playbookConstraints?: string;
  /** Sender's scheduling link (e.g. Calendly) — the twin points warm prospects here. */
  bookingUrl?: string;
  /** Preferred delivery mode: recorded video or live avatar link. */
  deliveryMode?: "video" | "livelink";
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
  /** Stable key for an operation that must be applied at most once. */
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreditAccountSummary {
  workspace: WorkspaceAccount;
  balance: number;
  transactions: CreditTransactionRecord[];
}

export type LiveSessionStatus = "pending" | "active" | "ended" | "expired" | "failed";

/**
 * Live-session instrumentation (STRATEGY Phase 1 scoreboard).
 * Question topics are stored as classified bucket labels only — never raw
 * transcript text — so prospect conversations stay private.
 */
export interface LiveSessionMetrics {
  /** Completed recipient utterances. */
  userTurns: number;
  /** Completed twin utterances. */
  agentTurns: number;
  /** Classified question-topic buckets raised by the recipient (labels only). */
  questionTopics: string[];
  /** Recipient clicked the sender's booking link. */
  bookingClicked: boolean;
  /** A booking link was available to click. */
  bookingUrlPresent: boolean;
  /** Drop-off marker: last notable client-side event before sync. */
  lastEvent?: string;
  /** When the recipient first spoke (ISO) — separates bounces from engagement. */
  firstUserTurnAt?: string;
  /** Last telemetry write (ISO). */
  updatedAt: string;
}

export interface LiveSessionRecord {
  id: string;
  shareId: string;
  workspaceId?: string;
  reservationId?: string;
  syncTokenHash: string;
  provider?: string;
  reservedCredits: number;
  chargedCredits: number;
  creditsEnforced: boolean;
  status: LiveSessionStatus;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  terminalReason?: string;
  /** STRATEGY Phase 1 instrumentation: turns, question topics, booking, drop-off. */
  metrics?: LiveSessionMetrics;
}

export interface LiveSessionStorageProvider {
  readonly name: string;
  create(record: LiveSessionRecord): Promise<LiveSessionRecord>;
  /** Create a session only when the share has no pending/active session. */
  createIfNoOpen(record: LiveSessionRecord): Promise<LiveSessionRecord | null>;
  get(id: string): Promise<LiveSessionRecord | null>;
  update(record: LiveSessionRecord): Promise<void>;
  listOpen(): Promise<LiveSessionRecord[]>;
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

export interface MagicLinkToken {
  token: string;
  email: string;
  expiresAt: number;
}

export interface TokenStorageProvider {
  readonly name: string;
  create(email: string, expiresAt: number): Promise<string>;
  consume(token: string): Promise<string | null>;
}

export interface BatchRecord {
  id: string;
  record_json: string;
  created_at: string;
}

export interface BatchStorageProvider {
  readonly name: string;
  create(batch: Batch): Promise<void>;
  get(id: string): Promise<Batch | null>;
  list(): Promise<Batch[]>;
  update(record: Batch): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface BandActivityEvent {
  id: string;
  sessionId: string;
  agent: string;
  eventType: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface BandActivityStorageProvider {
  readonly name: string;
  addEvent(event: BandActivityEvent): Promise<void>;
  getEvents(sessionId: string): Promise<BandActivityEvent[]>;
}

export interface MediaStorageProvider {
  readonly name: string;
  upload(
    key: string,
    buffer: Buffer | Uint8Array,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string>;
  getPublicUrl(key: string): string;
  /** Generate a time-limited presigned download URL for a private object. Optional. */
  getSignedUrl?(key: string, expiresIn?: number): Promise<string>;
  /** Resolve a stored asset URL to a presigned URL if it belongs to this store. Optional. */
  signAssetUrl?(url: string, expiresIn?: number): Promise<string>;
  /** List object keys under a prefix (for building per-share asset manifests). Optional. */
  listKeys?(prefix: string): Promise<string[]>;
}
