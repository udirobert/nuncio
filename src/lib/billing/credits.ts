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
  // Phase 9: Premium research actions
  | "research.deep"
  | "research.premium"
  | "angle.generation"
  | "source.attribution";

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

interface LedgerState {
  balance: number;
  transactions: {
    id: string;
    type: CreditTransactionType;
    amount: number;
    action?: CreditAction;
    reason: string;
    createdAt: string;
    reservationId?: string;
  }[];
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
  // Phase 9: Premium research
  "research.deep": 3,        // Firecrawl + EXA deep research
  "research.premium": 5,     // Full multi-provider research
  "angle.generation": 1,     // Additional angle suggestions
  "source.attribution": 0,   // Free (just a UI pass)
};

const ledger = new Map<string, LedgerState>();
const reservations = new Map<string, CreditReservation>();

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
    return {
      workspaceId,
      userId,
      anonymous: !userId,
    };
  }

  const session = readAccountSession(request);
  if (session) {
    return {
      workspaceId: session.workspaceId,
      userId: session.userId,
      anonymous: false,
    };
  }

  return {
    workspaceId: `anon:${getClientId(request)}`,
    anonymous: true,
  };
}

export async function getCreditBalance(subject: CreditSubject): Promise<number> {
  if (subject.workspaceId.startsWith("anon:")) {
    return ensureLedger(subject.workspaceId).balance;
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

  if (input.subject.workspaceId.startsWith("anon:")) {
    const account = ensureLedger(input.subject.workspaceId);
    account.balance -= amount;
    account.transactions.push({
      id: crypto.randomUUID(),
      type: "debit",
      amount,
      action: input.action,
      reason: input.reason,
      createdAt: new Date().toISOString(),
      reservationId: id,
    });
  } else {
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
  }

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

  if (reservation.subject.workspaceId.startsWith("anon:")) {
    const account = ensureLedger(reservation.subject.workspaceId);
    account.balance += reservation.amount;
    account.transactions.push({
      id: crypto.randomUUID(),
      type: "refund",
      amount: reservation.amount,
      action: reservation.action,
      reason,
      createdAt: new Date().toISOString(),
      reservationId: id,
    });
    reservation.balanceAfter = account.balance;
  } else {
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
  }

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

/*
 * Legacy in-memory ledger remains only for anonymous/demo subjects.
 */
function ensureLedger(workspaceId: string): LedgerState {
  const existing = ledger.get(workspaceId);
  if (existing) return existing;

  const initialCredits = Number(process.env.NUNCIO_TRIAL_CREDITS || 10);
  const created: LedgerState = {
    balance: Number.isFinite(initialCredits) ? initialCredits : 10,
    transactions: [
      {
        id: crypto.randomUUID(),
        type: "grant",
        amount: Number.isFinite(initialCredits) ? initialCredits : 10,
        reason: "trial_grant",
        createdAt: new Date().toISOString(),
      },
    ],
  };
  ledger.set(workspaceId, created);
  return created;
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
