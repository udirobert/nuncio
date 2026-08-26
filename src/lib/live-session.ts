import { createHash } from "node:crypto";
import {
  getLiveSessionStorageProvider,
  getAccountStorageProvider,
} from "@/lib/storage";
import {
  calculateLiveSessionCharge,
  LIVE_SESSION_MAX_DURATION_MS,
} from "@/lib/live-link";
import type { LiveSessionMetrics, LiveSessionRecord } from "@/lib/storage";

export type LiveSessionEndReason =
  | "manual"
  | "provider_closed"
  | "max_duration"
  | "unload"
  | "start_failed"
  | "expired";

const reconciliationLocks = new Map<string, Promise<LiveSessionRecord>>();

export function hashLiveSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseLiveSessionDuration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(value, LIVE_SESSION_MAX_DURATION_MS);
}

export async function createLiveSessionRecord(input: {
  shareId: string;
  workspaceId?: string;
  reservationId?: string;
  syncTokenHash: string;
  reservedCredits: number;
  creditsEnforced: boolean;
}): Promise<LiveSessionRecord | null> {
  const record: LiveSessionRecord = {
    id: crypto.randomUUID(),
    shareId: input.shareId,
    workspaceId: input.workspaceId,
    reservationId: input.reservationId,
    syncTokenHash: input.syncTokenHash,
    provider: "anam",
    reservedCredits: input.reservedCredits,
    chargedCredits: input.reservedCredits,
    creditsEnforced: input.creditsEnforced,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  return getLiveSessionStorageProvider().createIfNoOpen(record);
}

export async function markLiveSessionActive(record: LiveSessionRecord, now = new Date()): Promise<LiveSessionRecord> {
  if (record.status !== "pending") return record;
  const updated: LiveSessionRecord = {
    ...record,
    status: "active",
    startedAt: record.startedAt || now.toISOString(),
  };
  await getLiveSessionStorageProvider().update(updated);
  return updated;
}

export type LiveSessionTelemetryMetrics = Omit<LiveSessionMetrics, "updatedAt">;

/**
 * Merge incoming client telemetry into the stored metrics. Client turn
 * counters are monotonic so max wins; topics are unioned; booking flags are
 * ORed; lastEvent is overwritten; the first user-turn timestamp is first-wins.
 */
function mergeLiveSessionMetrics(
  existing: LiveSessionMetrics | undefined,
  incoming: LiveSessionTelemetryMetrics,
  now: Date,
): LiveSessionMetrics {
  return {
    userTurns: Math.max(existing?.userTurns ?? 0, incoming.userTurns),
    agentTurns: Math.max(existing?.agentTurns ?? 0, incoming.agentTurns),
    questionTopics: Array.from(new Set([
      ...(existing?.questionTopics ?? []),
      ...incoming.questionTopics,
    ])),
    bookingClicked: Boolean(existing?.bookingClicked) || Boolean(incoming.bookingClicked),
    bookingUrlPresent: Boolean(existing?.bookingUrlPresent) || Boolean(incoming.bookingUrlPresent),
    lastEvent: incoming.lastEvent ?? existing?.lastEvent,
    firstUserTurnAt: existing?.firstUserTurnAt ?? incoming.firstUserTurnAt,
    updatedAt: now.toISOString(),
  };
}

/**
 * Record a mid-session telemetry heartbeat (STRATEGY Phase 1 instrumentation).
 * The first heartbeat flips a pending session to active; terminal sessions are
 * left untouched. durationMs is stored as telemetry only — it does not end the
 * session and never touches credits.
 */
export async function recordLiveSessionTelemetry(input: {
  record: LiveSessionRecord;
  metrics: LiveSessionTelemetryMetrics;
  durationMs?: number;
  now?: Date;
}): Promise<LiveSessionRecord> {
  const { record } = input;
  if (record.status === "ended" || record.status === "expired" || record.status === "failed") {
    return record;
  }

  const now = input.now || new Date();
  const current = await markLiveSessionActive(record, now);
  const updated: LiveSessionRecord = {
    ...current,
    metrics: mergeLiveSessionMetrics(current.metrics, input.metrics, now),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
  };
  await getLiveSessionStorageProvider().update(updated);
  return updated;
}

/**
 * Reconcile a session exactly once. Client duration is retained as telemetry,
 * but only provider/server-authoritative terminal reasons can reduce a charge:
 * start failures refund all credits; normal browser syncs remain conservatively
 * charged at the reserved maximum until a trusted provider duration exists.
 */
export async function reconcileLiveSession(input: {
  record: LiveSessionRecord;
  durationMs: number;
  reason: LiveSessionEndReason;
  metrics?: LiveSessionTelemetryMetrics;
  now?: Date;
}): Promise<LiveSessionRecord> {
  const existing = reconciliationLocks.get(input.record.id);
  if (existing) return existing;

  const operation = reconcileLiveSessionUnlocked(input).finally(() => {
    reconciliationLocks.delete(input.record.id);
  });
  reconciliationLocks.set(input.record.id, operation);
  return operation;
}

async function reconcileLiveSessionUnlocked(input: {
  record: LiveSessionRecord;
  durationMs: number;
  reason: LiveSessionEndReason;
  metrics?: LiveSessionTelemetryMetrics;
  now?: Date;
}): Promise<LiveSessionRecord> {
  const { record } = input;
  const current = await getLiveSessionStorageProvider().get(record.id);
  if (!current) return record;
  if (current.status === "ended" || current.status === "expired" || current.status === "failed") {
    return current;
  }

  const durationMs = Math.min(Math.max(0, input.durationMs), LIVE_SESSION_MAX_DURATION_MS);
  const chargedCredits = input.reason === "start_failed"
    ? 0
    : input.reason === "expired"
      ? Math.min(current.reservedCredits, calculateLiveSessionCharge(LIVE_SESSION_MAX_DURATION_MS))
      : current.reservedCredits;
  const terminalStatus = input.reason === "expired"
    ? "expired"
    : input.reason === "start_failed"
      ? "failed"
      : "ended";
  const now = input.now || new Date();

  if (current.creditsEnforced && current.workspaceId && current.reservationId) {
    const provider = getAccountStorageProvider();
    const summary = await provider.getCreditSummary(current.workspaceId);
    const alreadySettled = summary?.transactions.some(
      (transaction) =>
        transaction.reservationId === current.reservationId &&
        transaction.reason.startsWith("live_session_reconcile:"),
    );

    if (!alreadySettled) {
      const refund = Math.max(0, current.reservedCredits - chargedCredits);
      await provider.appendCreditTransaction({
        workspaceId: current.workspaceId,
        type: refund > 0 ? "refund" : "adjustment",
        amount: refund,
        action: "live.session",
        reason: `live_session_reconcile:${input.reason}`,
        provider: current.provider,
        reservationId: current.reservationId,
        idempotencyKey: `live-session-reconcile:${current.reservationId}`,
        metadata: { clientDurationMs: durationMs, chargedCredits },
      });
    }
  }

  const updated: LiveSessionRecord = {
    ...current,
    status: terminalStatus,
    chargedCredits,
    startedAt: current.startedAt || (durationMs > 0 ? current.createdAt : undefined),
    endedAt: now.toISOString(),
    durationMs,
    terminalReason: input.reason,
    metrics: input.metrics
      ? mergeLiveSessionMetrics(current.metrics, input.metrics, now)
      : current.metrics,
  };
  await getLiveSessionStorageProvider().update(updated);
  return updated;
}

export async function expireStaleLiveSessions(now = new Date()): Promise<LiveSessionRecord[]> {
  const provider = getLiveSessionStorageProvider();
  const open = await provider.listOpen();
  const expired: LiveSessionRecord[] = [];

  for (const record of open) {
    const reference = new Date(record.startedAt || record.createdAt).getTime();
    if (!Number.isFinite(reference)) continue;
    if (now.getTime() - reference < LIVE_SESSION_MAX_DURATION_MS) continue;
    expired.push(await reconcileLiveSession({
      record,
      durationMs: LIVE_SESSION_MAX_DURATION_MS,
      reason: "expired",
      now,
    }));
  }

  return expired;
}
