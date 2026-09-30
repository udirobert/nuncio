import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallRequestRecord, WorkspaceAccount } from "@/lib/storage/types";
import { CALL_REQUEST_PENDING_TTL_MS } from "@/lib/call-request";

const callRequestStore = vi.hoisted(() => ({
  records: new Map<string, CallRequestRecord>(),
  createIfNoOpen: vi.fn(),
  get: vi.fn(),
  getByRoomName: vi.fn(async () => null as CallRequestRecord | null),
  hasAcceptedRoom: vi.fn(async () => false),
  listForCleanup: vi.fn(async () => [] as CallRequestRecord[]),
  transition: vi.fn(),
  listByWorkspace: vi.fn(async () => [] as CallRequestRecord[]),
}));

const liveSessionStore = vi.hoisted(() => ({
  get: vi.fn(async () => null),
  update: vi.fn(async () => {}),
  listOpen: vi.fn(async () => []),
  listForCleanup: vi.fn(async () => []),
}));

const accountStore = vi.hoisted(() => ({
  workspace: null as WorkspaceAccount | null,
  getWorkspace: vi.fn(async () => accountStore.workspace),
  updateWorkspace: vi.fn(async (_id: string, updates: Partial<WorkspaceAccount>) => {
    if (accountStore.workspace) accountStore.workspace = { ...accountStore.workspace, ...updates } as WorkspaceAccount;
    return accountStore.workspace;
  }),
}));

const livekit = vi.hoisted(() => ({
  createCallRoom: vi.fn(async (name: string) => ({ name })),
  deleteRoom: vi.fn(async () => {}),
  removeRoomParticipant: vi.fn(async () => {}),
  listRoomParticipants: vi.fn(async () => ({ roomExists: false, participantIdentities: [] as string[] })),
  cleanupSynthesiaSession: vi.fn(async () => true),
  mintCallParticipantToken: vi.fn(async (input: { identity: string; roomName: string; ttlSeconds: number }) => {
    void input;
    return "lk-token";
  }),
  isCallRequestInfraConfigured: vi.fn(() => true),
  getLiveKitConfig: vi.fn(() => ({ url: "wss://lk.example", apiKey: "k", apiSecret: "s" })),
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
  getCallRequestStorageProvider: vi.fn(() => callRequestStore),
  getHandoffStorageProvider: vi.fn(() => ({
    get: vi.fn(async () => null),
    listByWorkspace: vi.fn(async () => []),
    revoke: vi.fn(async () => null),
    create: vi.fn(async () => {}),
  })),
}));

vi.mock("@/lib/livekit", () => livekit);

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 2, resetIn: 60 })),
  getClientId: vi.fn(() => "test-client"),
  RATE_LIMITS: { live: { maxRequests: 3, windowSeconds: 60 } },
}));

import { POST as createCallRequest, GET as listCallRequests } from "./call-requests/route";
import { GET as getCallRequest, PATCH as patchCallRequest } from "./call-requests/[id]/route";
import { POST as joinCallRequest } from "./call-requests/[id]/join/route";
import { POST as cancelCallRequest } from "./call-requests/[id]/cancel/route";
import { getShareRecord } from "@/lib/share-store";
import { readAccountSession } from "@/lib/auth/session";

const OWNER_SESSION = { userId: "user-1", workspaceId: "ws-1", email: "owner@example.com" };
const WORKSPACE: WorkspaceAccount = {
  id: "ws-1",
  ownerUserId: "user-1",
  name: "Owner",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SHARE = {
  id: "share-1",
  workspaceId: "ws-1",
  senderEmail: "owner@example.com",
  senderName: "Sam",
  deliveryMode: "livelink",
};

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function enableLive() {
  vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
  vi.stubEnv("NUNCIO_LIVELINK_WORKSPACE_IDS", "ws-1");
  livekit.isCallRequestInfraConfigured.mockReturnValue(true);
}

function openShare(overrides: Record<string, unknown> = {}) {
  vi.mocked(getShareRecord).mockResolvedValue({ ...SHARE, ...overrides } as never);
}

function ownerWorkspace(overrides: Partial<WorkspaceAccount> = {}) {
  accountStore.workspace = {
    ...WORKSPACE,
    callAvailabilityUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  callRequestStore.get.mockImplementation(async (id: string) => callRequestStore.records.get(id) || null);
  callRequestStore.transition.mockImplementation(
    async (id: string, from: string[], next: CallRequestRecord, now?: Date, expectedVersion?: number) => {
      const current = callRequestStore.records.get(id);
      if (!current || !from.includes(current.status)) return null;
      if (now && new Date(current.expiresAt).getTime() <= now.getTime()) return null;
      if (expectedVersion !== undefined && (current.version ?? 0) !== expectedVersion) return null;
      callRequestStore.records.set(id, next);
      return next;
    },
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  accountStore.workspace = null;
  callRequestStore.records.clear();
});

describe("POST /api/live/call-requests", () => {
  it("404s when LiveLink is off before touching storage", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    const res = await createCallRequest(jsonRequest("http://x/api/live/call-requests", { shareId: "share-1" }) as never);
    expect(res.status).toBe(404);
    expect(callRequestStore.createIfNoOpen).not.toHaveBeenCalled();
  });

  it("404s for non-allowlisted or non-livelink shares", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    vi.stubEnv("NUNCIO_LIVELINK_WORKSPACE_IDS", "ws-1");
    openShare({ workspaceId: "other-ws", senderEmail: "nobody@example.com" });
    const res = await createCallRequest(jsonRequest("http://x/api/live/call-requests", { shareId: "share-1" }) as never);
    expect(res.status).toBe(404);
  });

  it("rejects when sender availability is off", async () => {
    enableLive();
    openShare();
    ownerWorkspace({ callAvailabilityUntil: undefined });
    const res = await createCallRequest(jsonRequest("http://x/api/live/call-requests", { shareId: "share-1" }) as never);
    expect(res.status).toBe(409);
    expect(callRequestStore.createIfNoOpen).not.toHaveBeenCalled();
  });

  it("rejects when LiveKit is not configured", async () => {
    enableLive();
    livekit.isCallRequestInfraConfigured.mockReturnValue(false);
    openShare();
    ownerWorkspace();
    const res = await createCallRequest(jsonRequest("http://x/api/live/call-requests", { shareId: "share-1" }) as never);
    expect(res.status).toBe(404);
  });

  it("rejects when a liveSessionId proof is invalid", async () => {
    enableLive();
    openShare();
    ownerWorkspace();
    liveSessionStore.get.mockResolvedValueOnce({
      id: "ls-1", shareId: "share-1", status: "active", provider: "synthesia", syncTokenHash: "other-hash",
    } as never);
    const res = await createCallRequest(jsonRequest("http://x/api/live/call-requests", { shareId: "share-1", liveSessionId: "ls-1", syncToken: "bad" }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 409 when an open request already exists and never leaks the existing token", async () => {
    enableLive();
    openShare();
    ownerWorkspace();
    callRequestStore.createIfNoOpen.mockResolvedValueOnce(null);
    const res = await createCallRequest(jsonRequest("http://x/api/live/call-requests", { shareId: "share-1" }) as never);
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).not.toContain("recipientToken");
  });

  it("creates a pending request and returns the capability token once", async () => {
    enableLive();
    openShare();
    ownerWorkspace();
    callRequestStore.createIfNoOpen.mockImplementationOnce(async (record: CallRequestRecord) => record);
    const res = await createCallRequest(jsonRequest("http://x/api/live/call-requests", { shareId: "share-1" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBeTruthy();
    expect(body.recipientToken).toBeTruthy();
    expect(body.status).toBe("pending");
    expect(new Date(body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(CALL_REQUEST_PENDING_TTL_MS);
    const stored = callRequestStore.createIfNoOpen.mock.calls[0][0] as CallRequestRecord;
    expect(stored.recipientTokenHash).not.toBe(body.recipientToken);
    expect(stored.recipientTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("accepts a valid live session sync proof and records the session id", async () => {
    enableLive();
    openShare();
    ownerWorkspace();
    const { createHash } = await import("node:crypto");
    liveSessionStore.get.mockResolvedValueOnce({
      id: "ls-1", shareId: "share-1", status: "active", provider: "synthesia",
      syncTokenHash: createHash("sha256").update("good-token").digest("hex"),
    } as never);
    callRequestStore.createIfNoOpen.mockImplementationOnce(async (record: CallRequestRecord) => record);
    const res = await createCallRequest(jsonRequest("http://x/api/live/call-requests", { shareId: "share-1", liveSessionId: "ls-1", syncToken: "good-token" }) as never);
    expect(res.status).toBe(200);
    const stored = callRequestStore.createIfNoOpen.mock.calls[0][0] as CallRequestRecord;
    expect(stored.liveSessionId).toBe("ls-1");
  });
});

describe("GET /api/live/call-requests (owner list)", () => {
  it("requires authentication", async () => {
    const res = await listCallRequests(new Request("http://x/api/live/call-requests") as never);
    expect(res.status).toBe(401);
  });

  it("lists only the owner's workspace requests without token hashes", async () => {
    vi.mocked(readAccountSession).mockReturnValue(OWNER_SESSION as never);
    ownerWorkspace();
    callRequestStore.listByWorkspace.mockResolvedValueOnce([
      { id: "cr-1", shareId: "share-1", workspaceId: "ws-1", status: "pending", createdAt: "", expiresAt: "" },
    ] as never);
    const res = await listCallRequests(new Request("http://x/api/live/call-requests") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests[0].id).toBe("cr-1");
    expect(JSON.stringify(body)).not.toContain("recipientTokenHash");
  });
});

describe("GET /api/live/call-requests/[id]", () => {
  const record: CallRequestRecord = {
    id: "cr-1", shareId: "share-1", workspaceId: "ws-1", recipientTokenHash: "h",
    status: "pending", createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  it("404s without proof", async () => {
    enableLive();
    callRequestStore.records.set(record.id, record);
    const res = await getCallRequest(new Request("http://x/api/live/call-requests/cr-1") as never, { params: Promise.resolve({ id: "cr-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns status and expiry only for a valid bearer token", async () => {
    enableLive();
    const { createHash } = await import("node:crypto");
    callRequestStore.records.set(record.id, { ...record, recipientTokenHash: createHash("sha256").update("tok").digest("hex") });
    const res = await getCallRequest(
      new Request("http://x/api/live/call-requests/cr-1", { headers: { authorization: "Bearer tok" } }) as never,
      { params: Promise.resolve({ id: "cr-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["expiresAt", "id", "roomReady", "status"].sort());
  });

  it("allows the same-workspace owner", async () => {
    enableLive();
    vi.mocked(readAccountSession).mockReturnValue(OWNER_SESSION as never);
    accountStore.workspace = WORKSPACE;
    callRequestStore.records.set(record.id, record);
    const res = await getCallRequest(new Request("http://x/api/live/call-requests/cr-1") as never, { params: Promise.resolve({ id: "cr-1" }) });
    expect(res.status).toBe(200);
  });

  it("rejects an authenticated non-owner of the workspace", async () => {
    enableLive();
    vi.mocked(readAccountSession).mockReturnValue({ ...OWNER_SESSION, userId: "intruder" } as never);
    callRequestStore.get.mockResolvedValueOnce(record);
    accountStore.workspace = { ...WORKSPACE, ownerUserId: "user-1" };
    const res = await getCallRequest(new Request("http://x/api/live/call-requests/cr-1") as never, { params: Promise.resolve({ id: "cr-1" }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/live/call-requests/[id]", () => {
  const record: CallRequestRecord = {
    id: "cr-1", shareId: "share-1", workspaceId: "ws-1", recipientTokenHash: "h",
    status: "pending", createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  it("rejects non-owners", async () => {
    enableLive();
    callRequestStore.records.set(record.id, record);
    const res = await patchCallRequest(jsonRequest("http://x/cr-1", { action: "accept" }) as never, { params: Promise.resolve({ id: "cr-1" }) });
    expect(res.status).toBe(404);
  });

  it("rejects recipients holding the capability token", async () => {
    enableLive();
    callRequestStore.records.set(record.id, record);
    const res = await patchCallRequest(
      new Request("http://x/cr-1", { method: "PATCH", headers: { authorization: "Bearer tok", "content-type": "application/json" }, body: JSON.stringify({ action: "accept" }) }) as never,
      { params: Promise.resolve({ id: "cr-1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("accepts once — a racing second action loses the CAS", async () => {
    enableLive();
    openShare();
    vi.mocked(readAccountSession).mockReturnValue(OWNER_SESSION as never);
    accountStore.workspace = WORKSPACE;
    callRequestStore.records.set(record.id, record);
    const first = await patchCallRequest(jsonRequest("http://x/cr-1", { action: "accept" }) as never, { params: Promise.resolve({ id: "cr-1" }) });
    const second = await patchCallRequest(jsonRequest("http://x/cr-1", { action: "decline" }) as never, { params: Promise.resolve({ id: "cr-1" }) });
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(livekit.createCallRoom).toHaveBeenCalledTimes(1);
  });

  it("reuses the live synthesia room instead of creating a new one", async () => {
    enableLive();
    openShare();
    vi.mocked(readAccountSession).mockReturnValue(OWNER_SESSION as never);
    accountStore.workspace = WORKSPACE;
    callRequestStore.records.set(record.id, { ...record, liveSessionId: "ls-1" });
    liveSessionStore.get.mockResolvedValueOnce({ id: "ls-1", shareId: "share-1", workspaceId: "ws-1", status: "active", provider: "synthesia", roomName: "nuncio-live-ls-1" } as never);
    livekit.listRoomParticipants.mockResolvedValueOnce({ roomExists: true, participantIdentities: ["guest-ls-1"] });
    const res = await patchCallRequest(jsonRequest("http://x/cr-1", { action: "accept" }) as never, { params: Promise.resolve({ id: "cr-1" }) });
    expect(res.status).toBe(200);
    expect(livekit.createCallRoom).not.toHaveBeenCalled();
    const patched = callRequestStore.transition.mock.calls[0][2] as CallRequestRecord;
    expect(patched.roomName).toBe("nuncio-live-ls-1");
    expect(patched.recipientIdentity).toBe("guest-ls-1");
    expect(patched.ownerIdentity).toBe("owner-user-1");
    expect(patched.roomReady).toBe(true);
  });
});

describe("POST /api/live/call-requests/[id]/join", () => {
  const accepted: CallRequestRecord = {
    id: "cr-1", shareId: "share-1", workspaceId: "ws-1", recipientTokenHash: "h",
    status: "accepted", createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    acceptedAt: new Date().toISOString(), roomName: "nuncio-call-cr-1",
    roomReady: true, ownerIdentity: "owner-user-1", recipientIdentity: "recipient-cr-1",
  };

  it("mints a scoped recipient token with bearer proof", async () => {
    enableLive();
    const { createHash } = await import("node:crypto");
    openShare();
    callRequestStore.records.set(accepted.id, { ...accepted, recipientTokenHash: createHash("sha256").update("tok").digest("hex") });
    const res = await joinCallRequest(
      new Request("http://x/join", { method: "POST", headers: { authorization: "Bearer tok" } }) as never,
      { params: Promise.resolve({ id: "cr-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("recipient");
    expect(body.roomName).toBe("nuncio-call-cr-1");
    const mintArgs = livekit.mintCallParticipantToken.mock.calls[0][0] as unknown as { identity: string; roomName: string };
    expect(mintArgs.identity).toBe("recipient-cr-1");
  });

  it("mints an owner identity for the authenticated owner", async () => {
    enableLive();
    vi.mocked(readAccountSession).mockReturnValue(OWNER_SESSION as never);
    accountStore.workspace = WORKSPACE;
    openShare();
    callRequestStore.records.set(accepted.id, accepted);
    const res = await joinCallRequest(new Request("http://x/join", { method: "POST" }) as never, { params: Promise.resolve({ id: "cr-1" }) });
    expect(res.status).toBe(200);
    const mintArgs = livekit.mintCallParticipantToken.mock.calls[0][0] as unknown as { identity: string };
    expect(mintArgs.identity).toBe("owner-user-1");
  });

  it("rejects join on pending/declined/cancelled/expired", async () => {
    enableLive();
    for (const status of ["pending", "declined", "cancelled"] as const) {
      const { createHash } = await import("node:crypto");
      openShare();
      callRequestStore.records.set(accepted.id, { ...accepted, status, recipientTokenHash: createHash("sha256").update("tok").digest("hex") });
      const res = await joinCallRequest(
        new Request("http://x/join", { method: "POST", headers: { authorization: "Bearer tok" } }) as never,
        { params: Promise.resolve({ id: "cr-1" }) },
      );
      expect(res.status).toBe(409);
    }
  });
});

describe("POST /api/live/call-requests/[id]/cancel", () => {
  it("recipient can cancel their own pending request via capability", async () => {
    enableLive();
    const { createHash } = await import("node:crypto");
    const record: CallRequestRecord = {
      id: "cr-1", shareId: "share-1", workspaceId: "ws-1",
      recipientTokenHash: createHash("sha256").update("tok").digest("hex"),
      status: "pending", createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    callRequestStore.records.set(record.id, record);
    const res = await cancelCallRequest(
      new Request("http://x/cancel", { method: "POST", headers: { authorization: "Bearer tok" } }) as never,
      { params: Promise.resolve({ id: "cr-1" }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("cancelled");
  });
});
