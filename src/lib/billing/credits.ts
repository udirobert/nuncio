import { getClientId } from "@/lib/rate-limit";

export type CreditAction =
  | "profile.research"
  | "script.generate"
  | "canvas.build"
  | "video.render"
  | "video.translate"
  | "captions.generate"
  | "preview.generate";

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
  "video.render": 5,
  "video.translate": 2,
  "captions.generate": 1,
  "preview.generate": 0,
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

  return {
    workspaceId: `anon:${getClientId(request)}`,
    anonymous: true,
  };
}

export function getCreditBalance(subject: CreditSubject): number {
  return ensureLedger(subject.workspaceId).balance;
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
    };
    reservations.set(id, reservation);
    return reservation;
  }

  const account = ensureLedger(input.subject.workspaceId);
  if (account.balance < amount) {
    throw new InsufficientCreditsError(amount, account.balance);
  }

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

  const reservation: CreditReservation = {
    id,
    subject: input.subject,
    action: input.action,
    amount,
    reason: input.reason,
    flowId: input.flowId,
    provider: input.provider,
    status: "reserved",
    balanceAfter: account.balance,
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

  reservation.status = "refunded";
  reservation.balanceAfter = account.balance;
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
