import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveSessionRecord } from "@/lib/storage";

const sessionRecords = new Map<string, LiveSessionRecord>();

vi.mock("@/lib/share-store", () => ({
  getShareRecord: vi.fn(async (id: string) => ({
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    deliveryMode: "livelink",
    bookingUrl: "https://cal.example.com/sender",
  })),
}));

vi.mock("@/lib/storage", () => ({
  getLiveSessionStorageProvider: () => ({
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
    listOpen: async () => Array.from(sessionRecords.values()).filter(
      (record) => record.status === "pending" || record.status === "active",
    ),
  }),
  getAccountStorageProvider: () => ({
    getCreditSummary: async () => null,
    appendCreditTransaction: vi.fn(),
  }),
}));

import { POST as syncLiveSession } from "./sync/route";
import { createLiveSessionRecord, hashLiveSessionToken } from "@/lib/live-session";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedSession(): Promise<LiveSessionRecord> {
  const created = await createLiveSessionRecord({
    shareId: "share-1",
    workspaceId: "ws-1",
    syncTokenHash: hashLiveSessionToken("sync-secret"),
    reservedCredits: 0,
    creditsEnforced: false,
  });
  if (!created) throw new Error("failed to seed live session");
  return created;
}

beforeEach(() => {
  sessionRecords.clear();
  vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("LiveLink session sync", () => {
  it("heartbeats telemetry without a reason and does not end the session", async () => {
    const session = await seedSession();

    const response = await syncLiveSession(jsonRequest("http://localhost/api/live/sync", {
      sessionId: session.id,
      shareId: "share-1",
      syncToken: "sync-secret",
      durationMs: 15_000,
      metrics: {
        userTurns: 2,
        agentTurns: 5000,
        questionTopics: ["pricing", "bogus", "pricing"],
        lastEvent: "conversation",
        firstUserTurnAt: "2026-01-01T00:00:05.000Z",
      },
    }) as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.heartbeated).toBe(true);
    expect(body.status).toBe("active");

    const stored = sessionRecords.get(session.id);
    expect(stored?.status).toBe("active");
    expect(stored?.terminalReason).toBeUndefined();
    expect(stored?.endedAt).toBeUndefined();
    expect(stored?.durationMs).toBe(15_000);
    expect(stored?.metrics?.userTurns).toBe(2);
    expect(stored?.metrics?.agentTurns).toBe(1000); // clamped
    expect(stored?.metrics?.questionTopics).toEqual(["pricing"]); // filtered + deduped
    expect(stored?.metrics?.bookingUrlPresent).toBe(true); // derived from the share
    expect(stored?.metrics?.firstUserTurnAt).toBe("2026-01-01T00:00:05.000Z");
  });

  it("persists metrics on a terminal sync", async () => {
    const session = await seedSession();

    const response = await syncLiveSession(jsonRequest("http://localhost/api/live/sync", {
      sessionId: session.id,
      shareId: "share-1",
      syncToken: "sync-secret",
      durationMs: 45_000,
      reason: "manual",
      metrics: {
        userTurns: 3,
        agentTurns: 4,
        questionTopics: ["security"],
        bookingClicked: true,
        lastEvent: "ended:manual",
      },
    }) as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ended");

    const stored = sessionRecords.get(session.id);
    expect(stored?.status).toBe("ended");
    expect(stored?.metrics).toMatchObject({
      userTurns: 3,
      agentTurns: 4,
      questionTopics: ["security"],
      bookingClicked: true,
      bookingUrlPresent: true,
      lastEvent: "ended:manual",
    });
    expect(stored?.metrics?.updatedAt).toBeDefined();
  });

  it("rejects a bad sync token", async () => {
    const session = await seedSession();

    const response = await syncLiveSession(jsonRequest("http://localhost/api/live/sync", {
      sessionId: session.id,
      shareId: "share-1",
      syncToken: "wrong-secret",
      metrics: { userTurns: 1 },
    }) as never);

    expect(response.status).toBe(403);
    expect(sessionRecords.get(session.id)?.metrics).toBeUndefined();
  });

  it("ignores junk metrics but still completes the sync", async () => {
    const session = await seedSession();

    const response = await syncLiveSession(jsonRequest("http://localhost/api/live/sync", {
      sessionId: session.id,
      shareId: "share-1",
      syncToken: "sync-secret",
      durationMs: 2_000,
      metrics: {
        userTurns: "lots",
        questionTopics: "pricing",
        lastEvent: 42,
        firstUserTurnAt: "not-a-date",
      },
    }) as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.heartbeated).toBe(true);

    const stored = sessionRecords.get(session.id);
    expect(stored?.status).toBe("active");
    expect(stored?.metrics?.userTurns).toBe(0);
    expect(stored?.metrics?.questionTopics).toEqual([]);
    expect(stored?.metrics?.firstUserTurnAt).toBeUndefined();
    expect(stored?.metrics?.bookingUrlPresent).toBe(true);
  });
});
