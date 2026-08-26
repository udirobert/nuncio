import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/share-store", () => ({
  createShareRecord: vi.fn(async (input: Record<string, unknown>) => ({
    id: "share-test",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...input,
  })),
  getShareRecord: vi.fn(async () => null),
}));

vi.mock("@/lib/auth/session", () => ({
  readAccountSession: vi.fn(() => null),
}));

vi.mock("@/lib/storage", () => ({
  getAccountStorageProvider: vi.fn(() => ({
    getWorkspace: vi.fn(async () => null),
  })),
  getBandActivityProvider: vi.fn(() => ({
    getEvents: vi.fn(async () => []),
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 2, resetIn: 60 })),
  getClientId: vi.fn(() => "test-client"),
  RATE_LIMITS: { live: { maxRequests: 3, windowSeconds: 60 } },
}));

import { POST as createShare } from "../share/route";
import { POST as createLiveSession } from "./session/route";
import { POST as runPipeline } from "../pipeline/route";
import { createShareRecord, getShareRecord } from "@/lib/share-store";
import { readAccountSession } from "@/lib/auth/session";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("LiveLink route gates", () => {
  it("rejects LiveLink share creation when the experiment is disabled", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    const response = await createShare(jsonRequest("http://localhost/api/share", { deliveryMode: "livelink" }) as never);
    expect(response.status).toBe(404);
    expect(createShareRecord).not.toHaveBeenCalled();
  });

  it("keeps recorded video share creation available when LiveLink is disabled", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    const response = await createShare(jsonRequest("http://localhost/api/share", { videoUrl: "https://video.test/a.mp4" }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).shareUrl).toBe("/v/share-test");
  });

  it("rejects live session token creation before provider configuration or fetch", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    const response = await createLiveSession(jsonRequest("http://localhost/api/live/session", { shareId: "share-test" }) as never);
    expect(response.status).toBe(404);
  });

  it("rejects LiveLink pipeline mode before pipeline work starts", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    const response = await runPipeline(jsonRequest("http://localhost/api/pipeline", {
      url: "https://example.com/profile",
      deliveryMode: "livelink",
    }) as never);
    const text = await response.text();
    expect(text).toContain("LiveLink is not enabled");
  });

  it("defaults share creation to a live link when the pilot allows it and no video exists", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    vi.stubEnv("NUNCIO_LIVELINK_SENDER_EMAILS", "pilot@example.com");
    vi.mocked(readAccountSession).mockReturnValueOnce({
      workspaceId: "ws-1",
      email: "pilot@example.com",
    } as never);

    const response = await createShare(jsonRequest("http://localhost/api/share", {}) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).shareUrl).toBe("/live/share-test");
    expect(createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryMode: "livelink" }),
    );
  });

  it("keeps video the default when LiveLink is disabled and no deliveryMode is given", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    const response = await createShare(jsonRequest("http://localhost/api/share", {}) as never);
    expect(response.status).toBe(400);
    expect(createShareRecord).not.toHaveBeenCalled();
  });

  it("treats a supplied videoUrl as an explicit recorded-video share", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    vi.stubEnv("NUNCIO_LIVELINK_SENDER_EMAILS", "pilot@example.com");
    vi.mocked(readAccountSession).mockReturnValueOnce({
      workspaceId: "ws-1",
      email: "pilot@example.com",
    } as never);

    const response = await createShare(
      jsonRequest("http://localhost/api/share", { videoUrl: "https://video.test/a.mp4" }) as never,
    );
    expect(response.status).toBe(200);
    expect(createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryMode: "video" }),
    );
  });

  it("rejects legacy sender-only live shares before any provider or credit work", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    vi.stubEnv("NUNCIO_LIVELINK_SENDER_EMAILS", "pilot@example.com");
    vi.mocked(getShareRecord).mockResolvedValueOnce({
      id: "legacy-share",
      deliveryMode: "livelink",
      senderEmail: "pilot@example.com",
    } as never);

    const response = await createLiveSession(
      jsonRequest("http://localhost/api/live/session", { shareId: "legacy-share" }) as never,
    );

    expect(response.status).toBe(404);
  });
});

describe("Pipeline deliveryMode defaults", () => {
  it("runs as video when LiveLink is disabled and no deliveryMode is given", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    const response = await runPipeline(jsonRequest("http://localhost/api/pipeline", {
      url: "https://example.com/profile",
    }) as never);
    const text = await response.text();
    expect(text).not.toContain("LiveLink is not enabled");
  });

  it("defaults to livelink for an allowlisted sender when no deliveryMode is given", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    vi.stubEnv("NUNCIO_LIVELINK_SENDER_EMAILS", "pilot@example.com");
    vi.mocked(readAccountSession).mockReturnValueOnce({
      workspaceId: "ws-1",
      email: "pilot@example.com",
    } as never);

    const response = await runPipeline(jsonRequest("http://localhost/api/pipeline", {
      url: "https://example.com/profile",
    }) as never);
    const text = await response.text();
    expect(text).not.toContain("LiveLink is not enabled");
  });

  it("respects an explicit video deliveryMode when the pilot is enabled", async () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    vi.stubEnv("NUNCIO_LIVELINK_SENDER_EMAILS", "pilot@example.com");
    const response = await runPipeline(jsonRequest("http://localhost/api/pipeline", {
      url: "https://example.com/profile",
      deliveryMode: "video",
    }) as never);
    const text = await response.text();
    expect(text).not.toContain("LiveLink is not enabled");
  });
});

