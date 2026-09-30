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
  /** Anam custom avatar ID for live AI twin sessions. */
  anamAvatarId?: string;
  /** Anam custom voice ID for live AI twin sessions. */
  anamVoiceId?: string;
  /** Synthesia Interactive Avatar ID (av_*), primary live twin provider. */
  synthesiaAvatarId?: string;
  /** ElevenLabs voice ID used by the Synthesia/LiveKit twin. */
  liveVoiceId?: string;
  /** Explicit expiring sender availability for human call requests (ISO). Never inferred. */
  callAvailabilityUntil?: string;
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
  transport?: string;
  reuseHumanRoom?: boolean;
  /** LiveKit room name for Synthesia sessions; reused by an accepted human call. */
  roomName?: string;
  /** Set only after the LiveKit room's absence is confirmed post-teardown. */
  roomClosedAt?: string;
  /** True when room teardown could not be verified; retried by the cleanup pass. */
  cleanupError?: boolean;
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
  /** Recent terminal sessions for a workspace (scoreboard read path), newest first. */
  listRecent(input: { workspaceId: string; limit?: number }): Promise<LiveSessionRecord[]>;
  /** Terminal Synthesia sessions whose room is not confirmed closed — cleanup retry set. */
  listForCleanup(): Promise<LiveSessionRecord[]>;
}

export type CallRequestStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";

/**
 * An owner-approved human call request on a live share. The recipient holds a
 * random capability (stored hashed); it is returned once at creation and never
 * appears in URLs or list payloads. No transcripts or contact data are stored.
 */
export interface CallRequestRecord {
  id: string;
  shareId: string;
  workspaceId: string;
  recipientTokenHash: string;
  status: CallRequestStatus;
  createdAt: string;
  /** Current expiry: pending TTL from creation, extended on accept. */
  expiresAt: string;
  acceptedAt?: string;
  /** LiveKit room backing the accepted call. */
  roomName?: string;
  /** Synthesia twin session whose room was reused for the call, if any. */
  liveSessionId?: string;
  /** Optimistic-concurrency counter; absent on legacy records (treated as 0). */
  version?: number;
  /** LiveKit identity minted for the owner side of the accepted call. */
  ownerIdentity?: string;
  /** LiveKit identity minted for the recipient side of the accepted call. */
  recipientIdentity?: string;
  /** True once the backing LiveKit room is confirmed created (or reused). */
  roomReady?: boolean;
  /** Confirmed room teardown time; absent while a room may still exist. */
  roomClosedAt?: string;
  /** Cleanup could not be confirmed; flagged for the cron cleanup pass. */
  cleanupError?: boolean;
  /** Server-observed room presence — first/last-seen timestamps only. */
  connection?: import("@/lib/call-connection").CallConnectionMetrics;
  liveBrief?: import("@/lib/live-call-brief").LiveCallBrief & {
    source: "recipient_reviewed";
    sharedAt: string;
  };
}

export interface CallRequestStorageProvider {
  readonly name: string;
  /**
   * Atomically create a request only when the share has no non-expired
   * pending/accepted request. `now` bounds what counts as expired.
   */
  createIfNoOpen(record: CallRequestRecord, now?: Date): Promise<CallRequestRecord | null>;
  get(id: string): Promise<CallRequestRecord | null>;
  /**
   * Latest record bound to a room name — including terminal states. Used by
   * webhook/cleanup paths that must not guess room ownership.
   */
  getByRoomName(roomName: string): Promise<CallRequestRecord | null>;
  /**
   * Records whose room may still need teardown: expired open records or
   * terminal records with a roomName and no confirmed roomClosedAt.
   */
  listForCleanup(now?: Date, workspaceId?: string): Promise<CallRequestRecord[]>;
  /**
   * Whether any accepted, non-expired request is bound to this room — the
   * protection check that keeps a shared room alive during a human call.
   */
  hasAcceptedRoom(roomName: string, now?: Date): Promise<boolean>;
  /**
   * Compare-and-swap: update only when the stored status is in `from`. When
   * `now` is provided the transition also requires the stored record to be
   * non-expired. When `expectedVersion` is provided the stored record's
   * version (absent = 0) must equal it. Returns the updated record or null
   * when the CAS lost.
   */
  transition(
    id: string,
    from: CallRequestStatus[],
    next: CallRequestRecord,
    now?: Date,
    expectedVersion?: number,
  ): Promise<CallRequestRecord | null>;
  /** Records for a workspace, newest first, without token hashes. */
  listByWorkspace(workspaceId: string, limit?: number): Promise<Omit<CallRequestRecord, "recipientTokenHash">[]>;
}

export interface HandoffRecord {
  id: string;
  shareId: string;
  workspaceId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  tokenHash: string;
  context: {
    summary: string;
    interests: string[];
    unansweredQuestions: string[];
  };
  recommendedNextStep: "call" | "twin" | "book";
}

export interface HandoffStorageProvider {
  readonly name: string;
  create(record: HandoffRecord): Promise<void>;
  get(id: string): Promise<HandoffRecord | null>;
  revoke(id: string, workspaceId: string, now: Date): Promise<HandoffRecord | null>;
  listByWorkspace(workspaceId: string, limit?: number): Promise<HandoffRecord[]>;
}

export type SchedulingStatus = "started" | "requested" | "confirmed" | "cancelled";

export interface SchedulingRecord {
  id: string;
  shareId: string;
  workspaceId: string;
  provider: string;
  eventTypeId: number;
  createdAt: string;
  status: SchedulingStatus;
  providerBookingUid?: string;
  lastProviderEventAt?: string;
  lastProviderEvent?: string;
  startsAt?: string;
  endsAt?: string;
  reviewedBrief?: {
    goal: string;
    discussed: string;
    openQuestions: string;
    reason: string;
    source: "recipient_reviewed";
    sharedAt: string;
  };
  version: number;
}

export interface SchedulingStorageProvider {
  readonly name: string;
  create(record: SchedulingRecord): Promise<SchedulingRecord>;
  get(id: string): Promise<SchedulingRecord | null>;
  applyProviderEvent(
    id: string,
    event: import("@/lib/scheduling-server").SchedulingProviderEvent,
  ): Promise<SchedulingRecord | null>;
  listByWorkspace(workspaceId: string, limit?: number): Promise<SchedulingRecord[]>;
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
