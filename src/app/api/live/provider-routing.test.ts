import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveSessionRecord, WorkspaceAccount } from "@/lib/storage/types";

const liveSessionStore = vi.hoisted(() => ({
  created: [] as LiveSessionRecord[],
  createIfNoOpen: vi.fn(async (r: LiveSessionRecord) => { liveSessionStore.created.push(r); return r; }),
  get: vi.fn(async (id: string) => {
    void id;
    return null as LiveSessionRecord | null;
  }),
  update: vi.fn(async (record: LiveSessionRecord) => {
    void record;
  }),
  listOpen: vi.fn(async () => []),
  listForCleanup: vi.fn(async () => []),
}));

const accountStore = vi.hoisted(() => ({
  workspace: null as WorkspaceAccount | null,
  getWorkspace: vi.fn(async () => accountStore.workspace),
  getCreditSummary: vi.fn(async () => ({ workspace: {}, balance: 100, transactions: [] })),
  appendCreditTransaction: vi.fn(async () => ({})),
  upsertUserByEmail: vi.fn(async () => ({ id: "u" })),
  upsertWorkspaceForUser: vi.fn(async () => ({})),
}));

const anam = vi.hoisted(() => ({ createAnamSessionToken: vi.fn(async () => ({ sessionToken: "anam-tok" })) }));

const livekit = vi.hoisted(() => ({
  isLiveKitConfigured: vi.fn(() => true),
  createSynthesiaSession: vi.fn(async () => ({
    serverUrl: "wss://lk.example", participantToken: "lk-tok", roomName: "nuncio-live-x", dispatchId: "d1",
  })),
  cleanupSynthesiaSession: vi.fn(async () => true),
}));

vi.mock("@/lib/share-store", () => ({
  getShareRecord: vi.fn(async () => null),
}));

vi.mock("@/lib/auth/session", () => ({
  readAccountSession: vi.fn(() => null),
}));

vi.mock("@/lib/storage", () => ({
  getAccountStorageProvider: vi.fn(() => accountStore),
  getLiveSessionStorageProvider: vi.fn(() => liveSessionStore),
}));

vi.mock("@/lib/anam", () => anam);
vi.mock("@/lib/livekit", () => livekit);

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 2, resetIn: 60 })),
  getClientId: vi.fn(() => "test-client"),
  RATE_LIMITS: { live: { maxRequests: 3, windowSeconds: 60 } },
}));

import { POST as createLiveSession } from "./session/route";
import { getShareRecord } from "@/lib/share-store";

const SHARE = {
  id: "share-1",
  workspaceId: "ws-1",
  senderEmail: "owner@example.com",
  deliveryMode: "livelink",
};

function req() {
  return new Request("http://x/api/live/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shareId: "share-1" }),
  }) as never;
}

function enableAll() {
  vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
  vi.stubEnv("NUNCIO_LIVELINK_WORKSPACE_IDS", "ws-1");
  vi.stubEnv("NUNCIO_CREDITS_ENFORCED", "false");
  vi.stubEnv("NUNCIO_SYNTHESIA_WORKER_ENABLED", "true");
  vi.stubEnv("NUNCIO_LIVE_WORKER_TOKEN", "worker-tok");
  vi.stubEnv("ANAM_API_KEY", "anam-key");
  vi.stubEnv("ANAM_AVATAR_ID", "anam-av");
  vi.stubEnv("ANAM_VOICE_ID", "anam-voice");
  accountStore.workspace = {
    id: "ws-1", ownerUserId: "user-1", name: "w",
    synthesiaAvatarId: "av_sender", liveVoiceId: "el-voice",
    createdAt: "", updatedAt: "",
  } as WorkspaceAccount;
  livekit.isLiveKitConfigured.mockReturnValue(true);
  liveSessionStore.get.mockImplementation(async (id: string) =>
    liveSessionStore.created.find((r) => r.id === id) ?? null);
  liveSessionStore.update.mockImplementation(async (r: LiveSessionRecord) => {
    const i = liveSessionStore.created.findIndex((x) => x.id === r.id);
    if (i >= 0) liveSessionStore.created[i] = r;
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  accountStore.workspace = null;
  liveSessionStore.created = [];
});

describe("POST /api/live/session provider routing", () => {
  it("blocks before provider work when the pilot gate is closed", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    const res = await createLiveSession(req());
    expect(res.status).toBe(404);
    expect(livekit.createSynthesiaSession).not.toHaveBeenCalled();
    expect(anam.createAnamSessionToken).not.toHaveBeenCalled();
  });

  it("prefers Synthesia and returns the LiveKit connection payload", async () => {
    enableAll();
    vi.mocked(getShareRecord).mockResolvedValue(SHARE as never);
    const res = await createLiveSession(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("synthesia");
    expect(body.serverUrl).toBe("wss://lk.example");
    expect(body.participantToken).toBe("lk-tok");
    expect(body.syncToken).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("apiSecret");
    expect(livekit.createSynthesiaSession).toHaveBeenCalledWith(
      expect.objectContaining({ avatarId: "av_sender", voiceId: "el-voice" }),
    );
    expect(liveSessionStore.created[0].provider).toBe("synthesia");
    expect(anam.createAnamSessionToken).not.toHaveBeenCalled();
  });

  it("falls back to Anam when Synthesia config is missing", async () => {
    enableAll();
    livekit.isLiveKitConfigured.mockReturnValue(false);
    vi.mocked(getShareRecord).mockResolvedValue(SHARE as never);
    const res = await createLiveSession(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("anam");
    expect(body.sessionToken).toBe("anam-tok");
    expect(livekit.createSynthesiaSession).not.toHaveBeenCalled();
    expect(livekit.cleanupSynthesiaSession).not.toHaveBeenCalled();
    expect(liveSessionStore.created[0].provider).toBe("anam");
    expect(liveSessionStore.update.mock.calls.at(-1)?.[0]).toMatchObject({ provider: "anam", transport: "anam-sdk", reuseHumanRoom: false });
  });

  it("falls back to Anam once after Synthesia startup failure, with cleanup first", async () => {
    enableAll();
    vi.mocked(getShareRecord).mockResolvedValue(SHARE as never);
    livekit.createSynthesiaSession.mockRejectedValueOnce(new Error("avatar never joined"));
    const order: string[] = [];
    livekit.cleanupSynthesiaSession.mockImplementationOnce(async () => { order.push("cleanup"); return true; });
    anam.createAnamSessionToken.mockImplementationOnce(async () => { order.push("anam"); return { sessionToken: "anam-tok" }; });
    const res = await createLiveSession(req());
    expect(res.status).toBe(200);
    expect((await res.json()).provider).toBe("anam");
    expect(order).toEqual(["cleanup", "anam"]);
    const updated = liveSessionStore.update.mock.calls.at(-1)?.[0];
    expect(updated?.provider).toBe("anam");
  });

  it("refuses the fallback when Synthesia cleanup cannot be confirmed", async () => {
    enableAll();
    vi.mocked(getShareRecord).mockResolvedValue(SHARE as never);
    livekit.createSynthesiaSession.mockRejectedValueOnce(new Error("avatar never joined"));
    livekit.cleanupSynthesiaSession.mockResolvedValueOnce(false);
    const res = await createLiveSession(req());
    expect(res.status).toBe(500);
    expect(anam.createAnamSessionToken).not.toHaveBeenCalled();
    // conservative: the session is not refunded — reservation retained for reconciliation
    const updated = liveSessionStore.update.mock.calls.at(-1)?.[0];
    expect(updated?.chargedCredits).toBe(updated?.reservedCredits);
  });

  it("returns a safe error when no provider is configured at all", async () => {
    enableAll();
    livekit.isLiveKitConfigured.mockReturnValue(false);
    delete accountStore.workspace!.anamAvatarId;
    vi.stubEnv("ANAM_AVATAR_ID", "");
    vi.stubEnv("ANAM_VOICE_ID", "");
    vi.mocked(getShareRecord).mockResolvedValue({ ...SHARE, anamAvatarId: undefined, anamVoiceId: undefined } as never);
    const res = await createLiveSession(req());
    expect(res.status).toBe(503);
    expect(anam.createAnamSessionToken).not.toHaveBeenCalled();
  });

  it("respects NUNCIO_LIVE_PRIMARY_PROVIDER=anam and never touches LiveKit", async () => {
    enableAll();
    vi.stubEnv("NUNCIO_LIVE_PRIMARY_PROVIDER", "anam");
    vi.mocked(getShareRecord).mockResolvedValue(SHARE as never);
    const res = await createLiveSession(req());
    expect(res.status).toBe(200);
    expect((await res.json()).provider).toBe("anam");
    expect(livekit.createSynthesiaSession).not.toHaveBeenCalled();
  });
});
