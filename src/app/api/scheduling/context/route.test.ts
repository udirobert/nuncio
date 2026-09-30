import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SchedulingRecord } from "@/lib/storage/types";

const BOOKING_URL = "https://cal.com/alex/30min";
const CONTEXT_SECRET = "ctxsec-test";

const shareState = vi.hoisted(() => ({ share: null as Record<string, unknown> | null }));
const storage = vi.hoisted(() => ({
  created: [] as SchedulingRecord[],
  create: vi.fn(async (record: SchedulingRecord) => {
    storage.created.push(record);
    return record;
  }),
  sessions: new Map<string, { shareId: string; workspaceId?: string; status: string; syncTokenHash: string }>(),
  getSession: vi.fn(async (id: string) => storage.sessions.get(id) ?? null),
}));

vi.mock("@/lib/share-store", () => ({
  getShareRecord: vi.fn(async () => shareState.share),
}));

vi.mock("@/lib/storage", () => ({
  getSchedulingStorageProvider: () => storage,
  getLiveSessionStorageProvider: () => ({ get: storage.getSession }),
}));

const handoffAuth = vi.hoisted(() => ({ allowed: true }));

vi.mock("@/lib/live-handoff", async () => {
  const actual = await vi.importActual<typeof import("@/lib/live-handoff")>("@/lib/live-handoff");
  return {
    ...actual,
    authorizeHandoffShare: vi.fn(async () => handoffAuth.allowed),
  };
});

const rateLimitState = vi.hoisted(() => ({ allowed: true }));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: rateLimitState.allowed, remaining: 9, resetIn: 60 })),
  getClientId: vi.fn(() => "test-client"),
}));

function stubConfig() {
  vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
  vi.stubEnv("NUNCIO_LIVELINK_WORKSPACE_IDS", "ws-1");
  vi.stubEnv("NUNCIO_CALCOM_WEBHOOK_SECRET", "whsec");
  vi.stubEnv("NUNCIO_CALCOM_WORKSPACE_ID", "ws-1");
  vi.stubEnv("NUNCIO_CALCOM_EVENT_TYPE_ID", "42");
  vi.stubEnv("NUNCIO_CALCOM_BOOKING_URL", BOOKING_URL);
  vi.stubEnv("NUNCIO_SCHEDULING_CONTEXT_SECRET", CONTEXT_SECRET);
}

function seedShare(overrides: Record<string, unknown> = {}) {
  shareState.share = {
    id: "share-1",
    workspaceId: "ws-1",
    deliveryMode: "livelink",
    senderName: "Alex",
    bookingUrl: BOOKING_URL,
    ...overrides,
  };
}

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://example.com/api/scheduling/context", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  handoffAuth.allowed = true;
  rateLimitState.allowed = true;
  shareState.share = null;
  storage.created = [];
  storage.create.mockClear();
  storage.sessions.clear();
  storage.getSession.mockClear();
});

describe("GET /api/scheduling/context", () => {
  it("reports tracked for a share matching the pilot config", async () => {
    stubConfig();
    seedShare();
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("https://example.com/api/scheduling/context?shareId=share-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tracked: true });
  });

  it("reports untracked without config, unauthorized access, or mismatched share", async () => {
    stubConfig();
    seedShare();
    const { GET } = await import("./route");
    handoffAuth.allowed = false;
    expect(await (await GET(new NextRequest("https://example.com/api/scheduling/context?shareId=share-1"))).json()).toEqual({ tracked: false });
    handoffAuth.allowed = true;
    seedShare({ bookingUrl: "https://cal.com/alex/other" });
    expect(await (await GET(new NextRequest("https://example.com/api/scheduling/context?shareId=share-1"))).json()).toEqual({ tracked: false });
    seedShare();
    shareState.share = null;
    expect(await (await GET(new NextRequest("https://example.com/api/scheduling/context?shareId=share-1"))).json()).toEqual({ tracked: false });
    vi.unstubAllEnvs();
    expect(await (await GET(new NextRequest("https://example.com/api/scheduling/context?shareId=share-1"))).json()).toEqual({ tracked: false });
  });
});

describe("POST /api/scheduling/context", () => {
  it("fails closed with 404 when the pilot config is absent", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    const { POST } = await import("./route");
    const res = await POST(req({ shareId: "share-1" }));
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized access and cross-origin mutation", async () => {
    stubConfig();
    seedShare();
    const { POST } = await import("./route");
    handoffAuth.allowed = false;
    expect((await POST(req({ shareId: "share-1" })))).toMatchObject({ status: 404 });
    handoffAuth.allowed = true;
    const crossOrigin = new NextRequest("https://example.com/api/scheduling/context", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example.com" },
      body: JSON.stringify({ shareId: "share-1" }),
    });
    const res = await POST(crossOrigin);
    expect([403, 404]).toContain(res.status);
    expect(storage.created).toHaveLength(0);
  });

  it("returns 429 when rate limited", async () => {
    stubConfig();
    seedShare();
    rateLimitState.allowed = false;
    const { POST } = await import("./route");
    const res = await POST(req({ shareId: "share-1" }));
    expect(res.status).toBe(429);
  });

  it("rejects liveBrief without consent and oversized bodies", async () => {
    stubConfig();
    seedShare();
    const { POST } = await import("./route");
    expect((await POST(req({ shareId: "share-1", liveBrief: { goal: "g", discussed: "d", openQuestions: "o", reason: "r" } })))).toMatchObject({ status: 400 });
    expect((await POST(req({ shareId: "share-1", liveBrief: { goal: "g", discussed: "d", openQuestions: "o", reason: "r" }, briefConsent: false })))).toMatchObject({ status: 400 });
    const big = { shareId: "share-1", pad: "x".repeat(17 * 1024) };
    expect((await POST(req(big)))).toMatchObject({ status: 400 });
    expect(storage.created).toHaveLength(0);
  });

  it("rejects brief consent against a closed or unbound session", async () => {
    stubConfig();
    seedShare();
    const { hashLiveSessionToken } = await import("@/lib/live-session");
    storage.sessions.set("sess-closed", {
      shareId: "share-1",
      workspaceId: "ws-1",
      status: "ended",
      syncTokenHash: hashLiveSessionToken("tok"),
    });
    const { POST } = await import("./route");
    const res = await POST(req({
      shareId: "share-1",
      briefConsent: true,
      liveSessionId: "sess-closed",
      syncToken: "tok",
      liveBrief: { goal: "g", discussed: "d", openQuestions: "o", reason: "r" },
    }));
    expect(res.status).toBe(400);
  });

  it("creates a correlation context for a matching share", async () => {
    stubConfig();
    seedShare();
    const { POST } = await import("./route");
    const res = await POST(req({ shareId: "share-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.contextToken).toBe("string");
    const { verifySchedulingContextToken } = await import("@/lib/scheduling-server");
    expect(verifySchedulingContextToken(data.contextToken, CONTEXT_SECRET)).toBe(storage.created[0].id);
    expect(storage.created[0]).toMatchObject({ shareId: "share-1", workspaceId: "ws-1", status: "started", eventTypeId: 42 });
    expect(storage.created[0].reviewedBrief).toBeUndefined();
  });

  it("rejects cross-workspace shares and mismatched booking URLs", async () => {
    stubConfig();
    seedShare({ workspaceId: "ws-other" });
    const { POST } = await import("./route");
    expect((await POST(req({ shareId: "share-1" }))).status).toBe(404);
    seedShare({ bookingUrl: "https://cal.com/alex/different" });
    expect((await POST(req({ shareId: "share-1" }))).status).toBe(404);
    seedShare({ bookingUrl: "http://cal.com/alex/30min" });
    expect((await POST(req({ shareId: "share-1" }))).status).toBe(404);
  });

  it("rejects brief consent without a valid live session proof", async () => {
    stubConfig();
    seedShare();
    const { POST } = await import("./route");
    const res = await POST(req({ shareId: "share-1", briefConsent: true, liveSessionId: "sess-1", syncToken: "tok", liveBrief: { goal: "g", discussed: "d", openQuestions: "o", reason: "r" } }));
    expect(res.status).toBe(400);
    expect(storage.created).toHaveLength(0);
  });

  it("stores a reviewed brief only with consent and a bound live session", async () => {
    stubConfig();
    seedShare();
    const { hashLiveSessionToken } = await import("@/lib/live-session");
    storage.sessions.set("sess-1", {
      shareId: "share-1",
      workspaceId: "ws-1",
      status: "active",
      syncTokenHash: hashLiveSessionToken("tok"),
    });
    const { POST } = await import("./route");
    const res = await POST(req({
      shareId: "share-1",
      briefConsent: true,
      liveSessionId: "sess-1",
      syncToken: "tok",
      liveBrief: { goal: "pricing", discussed: "plans", openQuestions: "timeline", reason: "evaluate" },
    }));
    expect(res.status).toBe(200);
    expect(storage.created[0].reviewedBrief).toMatchObject({ goal: "pricing", source: "recipient_reviewed" });
  });
});
