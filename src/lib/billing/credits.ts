import { getClientId } from "@/lib/rate-limit";
import { getAccountStorageProvider } from "@/lib/storage";
import { readAccountSession } from "@/lib/auth/session";

export type CreditAction =
  | "profile.research"
  | "script.generate"
  | "canvas.build"
  | "soundscape.generate"
  | "video.render"
  | "video.translate"
  | "captions.generate"
  | "preview.generate"
  | "research.deep"
  | "research.premium"
  | "angle.generation"
  | "source.attribution"
  | "live.session";

export type CreditTransactionType = "grant" | "debit" | "refund" | "adjustment";

export interface CreditSubject {
  workspaceId: string;
  userId?: string;
  anonymous: boolean;
}

export interface CreditReservation {
  id: string;
  subject: CreditSubject;
  action: CreditAction;
  amount: number;
  reason: string;
  flowId?: string;
  provider?: string;
  status: "reserved" | "committed" | "refunded" | "shadow";
  balanceAfter?: number;
}

const COSTS: Record<CreditAction, number> = {
  "profile.research": 1,
  "script.generate": 1,
  "canvas.build": 1,
  "soundscape.generate": 1,
  "video.render": 8,
  "video.translate": 2,
  "captions.generate": 1,
  "preview.generate": 0,
  "research.deep": 3,
  "research.premium": 5,
  "angle.generation": 1,
  "source.attribution": 0,
  "live.session": 5,
};

const reservations = new Map<string, CreditReservation>();
const anonWorkspaceCache = new Map<string, string>();

export function creditsEnforced(): boolean {
  return process.env.NUNCIO_CREDITS_ENFORCED === "true";
}

export function estimateCreditCost(action: CreditAction, quantity = 1): number {
  return COSTS[action] * Math.max(0, quantity);
}

export function getCreditSubject(request: Request): CreditSubject {
  const workspaceId = request.headers.get("x-nuncio-workspace-id");
  const userId = request.headers.get("x-nuncio-user-id") || undefined;

  if (workspaceId) {
    return { workspaceId, userId, anonymous: !userId };
  }

  const session = readAccountSession(request);
  if (session) {
    return { workspaceId: session.workspaceId, userId: session.userId, anonymous: false };
  }

  return { workspaceId: `anon:${getClientId(request)}`, anonymous: true };
}

async function ensureAnonymousWorkspace(anonId: string): Promise<string> {
  const cached = anonWorkspaceCache.get(anonId);
  if (cached) return cached;

  const provider = getAccountStorageProvider();
  const existing = await provider.getWorkspace(anonId);
  if (existing) {
    anonWorkspaceCache.set(anonId, anonId);
    return anonId;
  }

  const now = new Date().toISOString();
  const anonUser = await provider.upsertUserByEmail(`anon-${anonId.slice(5)}@anonymous.local`, {
    id: anonId,
  });

  await provider.upsertWorkspaceForUser(anonUser, {
    id: anonId,
    name: "Anonymous trial",
    plan: "free",
  });

  const trialCredits = Number(process.env.NUNCIO_TRIAL_CREDITS || 10);
  const grantAmount = Number.isFinite(trialCredits) ? trialCredits : 10;
  await provider.appendCreditTransaction({
    workspaceId: anonId,
    userId: anonId,
    type: "grant",
    amount: grantAmount,
    reason: "anonymous_trial_grant",
  });

  anonWorkspaceCache.set(anonId, anonId);
  return anonId;
}

export async function getCreditBalance(subject: CreditSubject): Promise<number> {
  if (subject.anonymous) {
    await ensureAnonymousWorkspace(subject.workspaceId);
  }
  const summary = await getAccountStorageProvider().getCreditSummary(subject.workspaceId);
  return summary?.balance || 0;
}

export async function reserveCredits(input: {
  subject: CreditSubject;
  action: CreditAction;
  amount?: number;
  reason: string;
  flowId?: string;
  provider?: string;
}): Promise<CreditReservation> {
  const amount = input.amount ?? estimateCreditCost(input.action);
  const id = crypto.randomUUID();

  if (input.subject.anonymous) {
    await ensureAnonymousWorkspace(input.subject.workspaceId);
  }

  if (!creditsEnforced()) {
    const reservation: CreditReservation = {
      id,
      subject: input.subject,
      action: input.action,
      amount,
      reason: input.reason,
      flowId: input.flowId,
      provider: input.provider,
      status: "shadow",
      balanceAfter: await getCreditBalance(input.subject),
    };
    reservations.set(id, reservation);
    return reservation;
  }

  const currentBalance = await getCreditBalance(input.subject);
  if (currentBalance < amount) {
    throw new InsufficientCreditsError(amount, currentBalance);
  }

  await getAccountStorageProvider().appendCreditTransaction({
    workspaceId: input.subject.workspaceId,
    userId: input.subject.userId,
    type: "debit",
    amount,
    action: input.action,
    reason: input.reason,
    flowId: input.flowId,
    provider: input.provider,
    reservationId: id,
  });

  const balanceAfter = currentBalance - amount;
  const reservation: CreditReservation = {
    id,
    subject: input.subject,
    action: input.action,
    amount,
    reason: input.reason,
    flowId: input.flowId,
    provider: input.provider,
    status: "reserved",
    balanceAfter,
  };
  reservations.set(id, reservation);
  return reservation;
}

export async function commitCreditReservation(id: string): Promise<void> {
  const reservation = reservations.get(id);
  if (!reservation || reservation.status === "shadow") return;
  reservation.status = "committed";
}

export async function refundCreditReservation(id: string, reason = "provider_failure"): Promise<void> {
  const reservation = reservations.get(id);
  if (!reservation || reservation.status !== "reserved") return;

  await getAccountStorageProvider().appendCreditTransaction({
    workspaceId: reservation.subject.workspaceId,
    userId: reservation.subject.userId,
    type: "refund",
    amount: reservation.amount,
    action: reservation.action,
    reason,
    flowId: reservation.flowId,
    provider: reservation.provider,
    reservationId: id,
  });

  reservation.balanceAfter = await getCreditBalance(reservation.subject);
  reservation.status = "refunded";
}

export async function grantCredits(input: {
  workspaceId: string;
  userId?: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await getAccountStorageProvider().appendCreditTransaction({
    workspaceId: input.workspaceId,
    userId: input.userId,
    type: "grant",
    amount: input.amount,
    reason: input.reason,
    metadata: input.metadata,
  });
}

export async function mergeAnonymousCredits(input: {
  anonWorkspaceId: string;
  targetWorkspaceId: string;
  targetUserId?: string;
}): Promise<number> {
  const provider = getAccountStorageProvider();
  const anonSummary = await provider.getCreditSummary(input.anonWorkspaceId);
  if (!anonSummary || anonSummary.balance <= 0) return 0;

  await provider.appendCreditTransaction({
    workspaceId: input.targetWorkspaceId,
    userId: input.targetUserId,
    type: "grant",
    amount: anonSummary.balance,
    reason: "anonymous_credits_merged",
    metadata: { sourceWorkspaceId: input.anonWorkspaceId },
  });

  await provider.appendCreditTransaction({
    workspaceId: input.anonWorkspaceId,
    type: "debit",
    amount: anonSummary.balance,
    reason: "anonymous_credits_transferred",
    metadata: { targetWorkspaceId: input.targetWorkspaceId },
  });

  return anonSummary.balance;
}

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number
  ) {
    super(`Insufficient credits — ${required} required, ${available} available.`);
    this.name = "InsufficientCreditsError";
  }
}
