import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShareRecord } from "@/lib/artifacts";

const shareStore = vi.hoisted(() => ({
  records: new Map<string, ShareRecord>(),
  get: vi.fn(async (id: string) => shareStore.records.get(id) || null),
}));

const sessionState = vi.hoisted(() => ({
  session: null as { userId: string; workspaceId: string } | null,
}));

vi.mock("@/lib/share-store", () => ({
  getShareRecord: vi.fn(async (id: string) => shareStore.records.get(id) || null),
  updateShareRecord: vi.fn(async (id: string, updates: Partial<ShareRecord>) => {
    const current = shareStore.records.get(id);
    if (!current) return null;
    const updated = { ...current, ...updates };
    shareStore.records.set(id, updated);
    return updated;
  }),
}));

vi.mock("@/lib/live-handoff", () => ({
  getActiveHandoffForShare: vi.fn(async () => ({ record: null, protected: false })),
}));

vi.mock("@/lib/auth/session", () => ({
  readAccountSession: vi.fn(() => sessionState.session),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, resetIn: 60 })),
  getClientId: vi.fn(() => "test-client"),
  RATE_LIMITS: { shareView: { maxRequests: 30, windowSeconds: 60 } },
}));

vi.mock("@/lib/funnel", () => ({
  captureFunnelEvent: vi.fn(),
}));

import { POST as recordView } from "./route";

const SHARE: ShareRecord = {
  id: "share-1",
  workspaceId: "ws-1",
  recipientName: "Maya Chen",
  deliveryMode: "video",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function post() {
  return new NextRequest("https://nuncio.test/api/share/share-1/view", { method: "POST" });
}

describe("POST /api/share/[id]/view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shareStore.records.clear();
    shareStore.records.set(SHARE.id, { ...SHARE });
    sessionState.session = null;
  });

  it("records the first view", async () => {
    const res = await recordView(post(), { params: Promise.resolve({ id: "share-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counted).toBe(true);

    const stored = shareStore.records.get("share-1");
    expect(stored?.firstViewedAt).toBeTruthy();
    expect(stored?.viewCount).toBe(1);
  });

  it("counts repeat views but keeps the first-viewed timestamp", async () => {
    const first = "2026-01-02T00:00:00.000Z";
    shareStore.records.set("share-1", { ...SHARE, firstViewedAt: first, viewCount: 1 });

    const res = await recordView(post(), { params: Promise.resolve({ id: "share-1" }) });
    expect(res.status).toBe(200);

    const stored = shareStore.records.get("share-1");
    expect(stored?.viewCount).toBe(2);
    expect(stored?.firstViewedAt).toBe(first);
  });

  it("never counts the sender's own view", async () => {
    sessionState.session = { userId: "user-1", workspaceId: "ws-1" };

    const res = await recordView(post(), { params: Promise.resolve({ id: "share-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counted).toBe(false);

    const stored = shareStore.records.get("share-1");
    expect(stored?.viewCount).toBeUndefined();
    expect(stored?.firstViewedAt).toBeUndefined();
  });

  it("404s for a share that does not exist", async () => {
    const res = await recordView(post(), { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });
});
