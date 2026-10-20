import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShareRecord } from "@/lib/artifacts";
import type { WorkspaceAccount } from "@/lib/storage/types";

const shareStore = vi.hoisted(() => ({
  records: new Map<string, ShareRecord>(),
  get: vi.fn(async (id: string) => shareStore.records.get(id) || null),
  update: vi.fn(async (record: ShareRecord) => {
    shareStore.records.set(record.id, record);
  }),
}));

const accountStore = vi.hoisted(() => ({
  workspace: null as WorkspaceAccount | null,
  getWorkspace: vi.fn(async () => accountStore.workspace),
}));

const email = vi.hoisted(() => ({
  sendLiveInviteEmail: vi.fn(async (params: {
    to: string;
    senderName: string;
    liveUrl: string;
    canAnswer?: string;
    bookingUrl?: string;
  }) => {
    void params;
  }),
}));

vi.mock("@/lib/storage", () => ({
  getShareStorageProvider: vi.fn(() => shareStore),
  getAccountStorageProvider: vi.fn(() => accountStore),
}));

vi.mock("@/lib/email", () => email);

vi.mock("@/lib/live-link", () => ({
  isLiveLinkAllowed: vi.fn(() => true),
}));

vi.mock("@/lib/live-handoff", () => ({
  getHandoffOptions: vi.fn(() => ({ twin: true, callRequestsEnabled: false, acceptingCalls: false, bookingUrl: null })),
}));

vi.mock("@/lib/governance/service", () => ({
  checkPre: vi.fn(async () => ({ decision: "allow" })),
  applyPost: vi.fn(async (_subject: unknown, _tool: string, payload: unknown) => ({
    value: payload,
    decision: { decision: "allow", patternIds: [], ruleIds: [] },
    removed: [],
  })),
}));

vi.mock("@/lib/funnel", () => ({
  captureFunnelEvent: vi.fn(),
}));

import { POST as liveInvite } from "./route";

function request(body: unknown, token = "agent-token") {
  return new NextRequest("https://nuncio.test/api/agent/live-invite", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const WORKSPACE: WorkspaceAccount = {
  id: "ws-1",
  ownerUserId: "user-1",
  name: "Northwind",
  lastSenderName: "Alex Rivera",
  bookingUrl: "https://cal.com/alex/intro",
  senderCanAnswer: "Onboarding cleanup and pilots — no pricing.",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SHARE: ShareRecord = {
  id: "share-1",
  workspaceId: "ws-1",
  recipientName: "Maya Chen",
  senderName: "Alex Rivera",
  deliveryMode: "video",
  videoUrl: "https://example.com/video.mp4",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("POST /api/agent/live-invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NUNCIO_AGENT_TOKEN", "agent-token");
    vi.stubEnv("NUNCIO_AGENT_WORKSPACE_ID", "ws-1");
    accountStore.workspace = { ...WORKSPACE };
    shareStore.records.clear();
    shareStore.records.set(SHARE.id, { ...SHARE });
  });

  it("rejects an unauthenticated caller", async () => {
    const res = await liveInvite(request({ shareId: "share-1", prospectEmail: "maya@example.com" }, "wrong"));
    expect(res.status).toBe(401);
    expect(email.sendLiveInviteEmail).not.toHaveBeenCalled();
  });

  it("refuses a share from another workspace", async () => {
    shareStore.records.set(SHARE.id, { ...SHARE, workspaceId: "ws-other" });
    const res = await liveInvite(request({ shareId: "share-1", prospectEmail: "maya@example.com" }));
    expect(res.status).toBe(404);
    expect(email.sendLiveInviteEmail).not.toHaveBeenCalled();
  });

  it("requires a prospect email", async () => {
    const res = await liveInvite(request({ shareId: "share-1" }));
    expect(res.status).toBe(400);
  });

  it("upgrades the share to a live link and emails the prospect", async () => {
    const res = await liveInvite(request({ shareId: "share-1", prospectEmail: "maya@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailed).toBe(true);
    expect(body.liveUrl).toContain("/live/share-1");

    const stored = shareStore.records.get("share-1");
    expect(stored?.deliveryMode).toBe("livelink");
    // The recorded video stays as the fallback artifact.
    expect(stored?.videoUrl).toBe("https://example.com/video.mp4");

    expect(email.sendLiveInviteEmail).toHaveBeenCalledTimes(1);
    const sent = email.sendLiveInviteEmail.mock.calls[0][0];
    expect(sent.to).toBe("maya@example.com");
    expect(sent.liveUrl).toContain("/live/share-1");
    expect(sent.canAnswer).toBe(WORKSPACE.senderCanAnswer);
  });
});
