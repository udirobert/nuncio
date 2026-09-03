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
  recordLiveSessionTelemetry,
  type LiveSessionTelemetryMetrics,
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

  it("charges based on actual duration, capped at reserved max", async () => {
    const initial = record();
    sessionRecords.set(initial.id, initial);

    const updated = await reconcileLiveSession({
      record: initial,
      durationMs: 1,
      reason: "manual",
    });

    expect(updated.status).toBe("ended");
    expect(updated.durationMs).toBe(1);
    // Rounds up to 1 minute of usage; refunded the rest of the 5-credit reservation.
    expect(updated.chargedCredits).toBe(1);
    expect(transactions[0]).toMatchObject({ type: "refund", amount: 4 });
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

  it("expires idle active sessions and refunds unused credits", async () => {
    const initial = record({
      status: "active",
      metrics: {
        userTurns: 1,
        agentTurns: 1,
        questionTopics: [],
        bookingClicked: false,
        bookingUrlPresent: true,
        lastEvent: "conversation",
        firstUserTurnAt: "2026-01-01T00:00:05.000Z",
        updatedAt: "2026-01-01T00:00:10.000Z",
      },
    });
    sessionRecords.set(initial.id, initial);

    const expired = await expireStaleLiveSessions(new Date("2026-01-01T00:04:00.000Z"));

    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe("expired");
    expect(expired[0].terminalReason).toBe("idle_timeout");
    // 4 minutes of idle usage rounded up to 4 credits.
    expect(expired[0].chargedCredits).toBe(4);
  });
});

describe("LiveLink session telemetry", () => {
  function metrics(overrides: Partial<LiveSessionTelemetryMetrics> = {}): LiveSessionTelemetryMetrics {
    return {
      userTurns: 1,
      agentTurns: 1,
      questionTopics: ["pricing"],
      bookingClicked: false,
      bookingUrlPresent: true,
      lastEvent: "first_user_turn",
      firstUserTurnAt: "2026-01-01T00:00:05.000Z",
      ...overrides,
    };
  }

  it("flips a pending session to active and stores metrics on the first heartbeat", async () => {
    const initial = record({ status: "pending", startedAt: undefined });
    sessionRecords.set(initial.id, initial);

    const updated = await recordLiveSessionTelemetry({
      record: initial,
      metrics: metrics(),
      durationMs: 5_000,
      now: new Date("2026-01-01T00:00:10.000Z"),
    });

    expect(updated.status).toBe("active");
    expect(updated.startedAt).toBe("2026-01-01T00:00:10.000Z");
    expect(updated.durationMs).toBe(5_000);
    expect(updated.metrics).toMatchObject({
      userTurns: 1,
      agentTurns: 1,
      questionTopics: ["pricing"],
      bookingUrlPresent: true,
      lastEvent: "first_user_turn",
      firstUserTurnAt: "2026-01-01T00:00:05.000Z",
      updatedAt: "2026-01-01T00:00:10.000Z",
    });
    expect(sessionRecords.get(initial.id)?.metrics?.userTurns).toBe(1);
    expect(transactions).toHaveLength(0);
  });

  it("is a no-op for a terminal session", async () => {
    const initial = record({
      status: "ended",
      endedAt: "2026-01-01T00:01:00.000Z",
      terminalReason: "manual",
    });
    sessionRecords.set(initial.id, initial);

    const updated = await recordLiveSessionTelemetry({
      record: initial,
      metrics: metrics({ userTurns: 9 }),
      durationMs: 9_000,
    });

    expect(updated).toBe(initial);
    expect(sessionRecords.get(initial.id)).toBe(initial);
    expect(sessionRecords.get(initial.id)?.metrics).toBeUndefined();
  });

  it("merges metrics into the terminal record during reconcile", async () => {
    const initial = record({
      metrics: {
        userTurns: 5,
        agentTurns: 2,
        questionTopics: ["product"],
        bookingClicked: false,
        bookingUrlPresent: true,
        lastEvent: "conversation",
        firstUserTurnAt: "2026-01-01T00:00:05.000Z",
        updatedAt: "2026-01-01T00:00:10.000Z",
      },
    });
    sessionRecords.set(initial.id, initial);

    const updated = await reconcileLiveSession({
      record: initial,
      durationMs: 60_000,
      reason: "manual",
      metrics: metrics({
        userTurns: 4,
        agentTurns: 6,
        questionTopics: ["pricing"],
        bookingClicked: true,
        lastEvent: "ended:manual",
      }),
      now: new Date("2026-01-01T00:02:00.000Z"),
    });

    expect(updated.status).toBe("ended");
    expect(updated.metrics).toMatchObject({
      userTurns: 5, // max of stored/terminal wins
      agentTurns: 6,
      questionTopics: ["product", "pricing"],
      bookingClicked: true,
      lastEvent: "ended:manual",
      firstUserTurnAt: "2026-01-01T00:00:05.000Z",
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
  });

  it("unions topics, keeps max turns, and preserves the first user-turn timestamp across heartbeats", async () => {
    const initial = record({ status: "active" });
    sessionRecords.set(initial.id, initial);

    const first = await recordLiveSessionTelemetry({
      record: initial,
      metrics: metrics({ userTurns: 2, agentTurns: 2 }),
      now: new Date("2026-01-01T00:00:10.000Z"),
    });
    const second = await recordLiveSessionTelemetry({
      record: first,
      metrics: metrics({
        userTurns: 1,
        agentTurns: 3,
        questionTopics: ["security"],
        bookingClicked: true,
        lastEvent: "booking_clicked",
        firstUserTurnAt: "2026-01-01T00:09:00.000Z",
      }),
      now: new Date("2026-01-01T00:01:00.000Z"),
    });

    expect(second.metrics?.userTurns).toBe(2);
    expect(second.metrics?.agentTurns).toBe(3);
    expect(second.metrics?.questionTopics).toEqual(["pricing", "security"]);
    expect(second.metrics?.bookingClicked).toBe(true);
    expect(second.metrics?.firstUserTurnAt).toBe("2026-01-01T00:00:05.000Z");
    expect(second.metrics?.lastEvent).toBe("booking_clicked");
    expect(second.metrics?.updatedAt).toBe("2026-01-01T00:01:00.000Z");
  });
});
