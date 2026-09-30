import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShareRecord } from "@/lib/artifacts";
import type { ShareListOptions } from "@/lib/storage/types";

const shareStore = vi.hoisted(() => ({
  records: [] as ShareRecord[],
  list: vi.fn(async (_options: ShareListOptions) => {
    void _options;
    return shareStore.records;
  }),
}));

const sessionState = vi.hoisted(() => ({
  session: null as { userId: string; workspaceId: string } | null,
}));

vi.mock("@/lib/share-store", () => ({
  listShares: shareStore.list,
}));

vi.mock("@/lib/auth/session", () => ({
  readAccountSession: vi.fn(() => sessionState.session),
}));

import { GET } from "./route";

function makeShare(input: Partial<ShareRecord>): ShareRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    workspaceId: "ws-1",
    senderEmail: "owner@example.com",
    ...input,
  } as ShareRecord;
}

function req() {
  return new NextRequest("http://localhost/api/videos/recent?limit=20");
}

afterEach(() => {
  shareStore.records = [];
  sessionState.session = null;
});

describe("GET /api/videos/recent firstTouches projection", () => {
  it("returns empty arrays unauthenticated", async () => {
    const res = await GET(req());
    const data = await res.json();
    expect(data.videos).toEqual([]);
    expect(data.firstTouches).toEqual([]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("projects a recorded share into videos and firstTouches", async () => {
    sessionState.session = { userId: "u1", workspaceId: "ws-1" };
    const share = makeShare({
      recipientName: "Maya",
      senderName: "Alex",
      deliveryMode: "video",
      privacy: "private",
      videoUrl: "https://cdn.example.com/v.mp4",
      videoId: "vid_1",
    });
    shareStore.records = [share];

    const res = await GET(req());
    const data = await res.json();
    expect(data.videos).toHaveLength(1);
    expect(data.videos[0].id).toBe(share.id);
    expect(data.firstTouches).toHaveLength(1);
    expect(data.firstTouches[0]).toMatchObject({
      id: share.id,
      recipientName: "Maya",
      senderName: "Alex",
      deliveryMode: "video",
      hasRecordedVideo: true,
      invitationProtected: false,
    });
  });

  it("projects a live share into firstTouches only", async () => {
    sessionState.session = { userId: "u1", workspaceId: "ws-1" };
    shareStore.records = [
      makeShare({
        recipientName: "Maya",
        senderName: "Alex",
        deliveryMode: "livelink",
        privacy: "private",
        handoffId: "h1",
      }),
    ];

    const res = await GET(req());
    const data = await res.json();
    expect(data.videos).toEqual([]);
    expect(data.firstTouches).toHaveLength(1);
    expect(data.firstTouches[0]).toMatchObject({
      deliveryMode: "livelink",
      hasRecordedVideo: false,
      invitationProtected: true,
    });
  });

  it("clamps limit to 1..50 and defaults to 20", async () => {
    sessionState.session = { userId: "u1", workspaceId: "ws-1" };
    shareStore.records = [];
    for (const [q, expected] of [["-1", 1], ["500", 50], ["abc", 20], ["7", 7]] as const) {
      shareStore.list.mockClear();
      await GET(new NextRequest(`http://localhost/api/videos/recent?limit=${q}`));
      expect(shareStore.list).toHaveBeenCalledWith({ workspaceId: "ws-1", limit: expected });
    }
  });

  it("omits private fields from the projection", async () => {
    sessionState.session = { userId: "u1", workspaceId: "ws-1" };
    shareStore.records = [
      makeShare({
        recipientName: "Maya",
        handoffId: "h1",
        workspaceId: "ws-secret",
        senderEmail: "secret@example.com",
      }),
    ];

    const res = await GET(req());
    const data = await res.json();
    const ft = data.firstTouches[0];
    expect(ft.workspaceId).toBeUndefined();
    expect(ft.senderEmail).toBeUndefined();
    expect(ft.handoffId).toBeUndefined();
    expect(ft.recipientToken).toBeUndefined();
    expect(ft.videoUrl).toBeUndefined();
  });
});
