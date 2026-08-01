import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveSessionRecord } from "@/lib/storage";

const sessionRecords = new Map<string, LiveSessionRecord>();
const transactions: Array<{ reservationId?: string; reason: string; amount: number; type: string }> = [];

vi.mock("@/lib/storage", () => ({
  getLiveSessionStorageProvider: () => ({
    create: async (record: LiveSessionRecord) => {
      sessionRecords.set(record.id, record);
      return record;
    },
    createIfNoOpen: async (record: LiveSessionRecord) => {
      const hasOpen = Array.from(sessionRecords.values()).some(
        (existing) => existing.shareId === record.shareId
          && (existing.status === "pending" || existing.status === "active"),
      );
      if (hasOpen) return null;
      sessionRecords.set(record.id, record);
      return record;
    },
    get: async (id: string) => sessionRecords.get(id) || null,
    update: async (record: LiveSessionRecord) => {
      sessionRecords.set(record.id, record);
    },
    listOpen: async () => Array.from(sessionRecords.values()).filter((record) => record.status === "pending" || record.status === "active"),
  }),
  getAccountStorageProvider: () => ({
    getCreditSummary: async () => ({
      workspace: { id: "ws-1" },
      balance: 0,
      transactions,
    }),
    appendCreditTransaction: async (input: { reservationId?: string; reason: string; amount: number; type: string }) => {
      transactions.push(input);
      return { id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString() };
    },
  }),
}));

import {
  createLiveSessionRecord,
  expireStaleLiveSessions,
  hashLiveSessionToken,
  reconcileLiveSession,
} from "./live-session";

beforeEach(() => {
  sessionRecords.clear();
  transactions.length = 0;
});

function record(overrides: Partial<LiveSessionRecord> = {}): LiveSessionRecord {
  return {
    id: "session-1",
    shareId: "share-1",
    workspaceId: "ws-1",
    reservationId: "reservation-1",
    syncTokenHash: hashLiveSessionToken("sync-secret"),
    provider: "anam",
    reservedCredits: 5,
    chargedCredits: 5,
    creditsEnforced: true,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("LiveLink session lifecycle", () => {
  it("stores only the hash of the sync token", async () => {
    const created = await createLiveSessionRecord({
      shareId: "share-1",
      workspaceId: "ws-1",
      reservationId: "reservation-1",
      syncTokenHash: hashLiveSessionToken("sync-secret"),
      reservedCredits: 5,
      creditsEnforced: true,
    });

    expect(created).not.toBeNull();
    expect(created?.syncTokenHash).toBe(hashLiveSessionToken("sync-secret"));
    expect(created?.syncTokenHash).not.toBe("sync-secret");
  });

  it("does not create a second open session for the same share", async () => {
    const first = await createLiveSessionRecord({
      shareId: "share-1",
      workspaceId: "ws-1",
      syncTokenHash: hashLiveSessionToken("first"),
      reservedCredits: 5,
      creditsEnforced: true,
    });
    const second = await createLiveSessionRecord({
      shareId: "share-1",
      workspaceId: "ws-1",
      syncTokenHash: hashLiveSessionToken("second"),
      reservedCredits: 5,
      creditsEnforced: true,
    });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("refunds all credits on a provider start failure", async () => {
    const initial = record({ status: "pending", startedAt: undefined });
    sessionRecords.set(initial.id, initial);

    const updated = await reconcileLiveSession({
      record: initial,
      durationMs: 0,
      reason: "start_failed",
    });

    expect(updated.status).toBe("failed");
    expect(updated.chargedCredits).toBe(0);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ type: "refund", amount: 5 });
  });

  it("keeps normal browser-reported duration conservative for billing", async () => {
    const initial = record();
    sessionRecords.set(initial.id, initial);

    const updated = await reconcileLiveSession({
      record: initial,
      durationMs: 1,
      reason: "manual",
    });

    expect(updated.status).toBe("ended");
    expect(updated.durationMs).toBe(1);
    expect(updated.chargedCredits).toBe(5);
    expect(transactions[0]).toMatchObject({ type: "adjustment", amount: 0 });
  });

  it("settles a session only once when sync is retried", async () => {
    const initial = record();
    sessionRecords.set(initial.id, initial);

    await Promise.all([
      reconcileLiveSession({ record: initial, durationMs: 2_000, reason: "manual" }),
      reconcileLiveSession({ record: initial, durationMs: 2_000, reason: "manual" }),
    ]);

    expect(transactions).toHaveLength(1);
  });

  it("expires stale open sessions", async () => {
    const initial = record({ status: "active" });
    sessionRecords.set(initial.id, initial);

    const expired = await expireStaleLiveSessions(new Date("2026-01-01T00:06:00.000Z"));

    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe("expired");
    expect(expired[0].chargedCredits).toBe(5);
  });
});
