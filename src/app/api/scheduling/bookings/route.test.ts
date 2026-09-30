import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SchedulingRecord } from "@/lib/storage/types";

const sessionState = vi.hoisted(() => ({
  session: null as { userId: string; workspaceId: string } | null,
}));

const ownerState = vi.hoisted(() => ({ isOwner: false }));

const storage = vi.hoisted(() => ({
  records: [] as SchedulingRecord[],
  listByWorkspace: vi.fn(async (workspaceId: string) =>
    storage.records.filter((r) => r.workspaceId === workspaceId)),
}));

const shares = vi.hoisted(() => ({
  byId: new Map<string, { workspaceId: string; recipientName?: string }>(),
  get: vi.fn(async (id: string) => shares.byId.get(id) ?? null),
}));

vi.mock("@/lib/auth/session", () => ({
  readAccountSession: vi.fn(() => sessionState.session),
}));

vi.mock("@/lib/call-request", () => ({
  isWorkspaceOwner: vi.fn(async () => ownerState.isOwner),
}));

vi.mock("@/lib/storage", () => ({
  getSchedulingStorageProvider: () => storage,
  getShareStorageProvider: () => shares,
}));

function req() {
  return new NextRequest("https://example.com/api/scheduling/bookings");
}

function makeRecord(overrides: Partial<SchedulingRecord> = {}): SchedulingRecord {
  return {
    id: "ctx-1",
    shareId: "share-1",
    workspaceId: "ws-1",
    provider: "calcom",
    eventTypeId: 42,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "confirmed",
    version: 1,
    ...overrides,
  };
}

afterEach(() => {
  sessionState.session = null;
  ownerState.isOwner = false;
  storage.records = [];
  shares.byId.clear();
  vi.clearAllMocks();
});

describe("GET /api/scheduling/bookings", () => {
  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("./route");
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(storage.listByWorkspace).not.toHaveBeenCalled();
  });

  it("returns 401 for a non-owner session", async () => {
    sessionState.session = { userId: "u-2", workspaceId: "ws-1" };
    const { GET } = await import("./route");
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(storage.listByWorkspace).not.toHaveBeenCalled();
  });

  it("lists owner-scoped bookings without context tokens and resolves recipients", async () => {
    sessionState.session = { userId: "u-1", workspaceId: "ws-1" };
    ownerState.isOwner = true;
    storage.records = [
      makeRecord({ reviewedBrief: { goal: "g", discussed: "d", openQuestions: "o", reason: "r", source: "recipient_reviewed", sharedAt: "2026-01-01T00:00:00.000Z" } }),
      makeRecord({ id: "ctx-2", shareId: "share-2", workspaceId: "ws-2", status: "cancelled" }),
    ];
    shares.byId.set("share-1", { workspaceId: "ws-1", recipientName: "Pat" });
    const { GET } = await import("./route");
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.bookings).toHaveLength(1);
    expect(body.bookings[0].recipient).toBe("Pat");
    expect(body.bookings[0].reviewedBrief.goal).toBe("g");
    expect(JSON.stringify(body)).not.toContain("nuncioContext");
    expect(JSON.stringify(body)).not.toMatch(/[0-9a-f]{64}/);
    expect(storage.listByWorkspace).toHaveBeenCalledWith("ws-1", 50);
  });

  it("cross-workspace sessions return no rows", async () => {
    sessionState.session = { userId: "u-1", workspaceId: "ws-9" };
    ownerState.isOwner = true;
    storage.records = [makeRecord()];
    const { GET } = await import("./route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.bookings).toHaveLength(0);
  });
});
