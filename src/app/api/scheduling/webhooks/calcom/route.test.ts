import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mintSchedulingContextToken } from "@/lib/scheduling-server";
import type { SchedulingRecord } from "@/lib/storage/types";

const SECRET = "whsec-test";
const CONTEXT_SECRET = "ctxsec-test";
const EVENT_TYPE_ID = 42;
const BOOKING_URL = "https://cal.com/alex/30min";

const storage = vi.hoisted(() => ({
  records: new Map<string, SchedulingRecord>(),
  applyProviderEvent: vi.fn(async (id: string, event: { status: string }) => {
    const record = storage.records.get(id);
    if (!record) return null;
    const next = { ...record, status: event.status as SchedulingRecord["status"], version: record.version + 1 };
    storage.records.set(id, next);
    return next;
  }),
  get: vi.fn(async (id: string) => storage.records.get(id) ?? null),
}));

vi.mock("@/lib/storage", () => ({
  getSchedulingStorageProvider: () => storage,
}));

const shareState = vi.hoisted(() => ({
  share: null as { id: string; workspaceId: string } | null,
}));

vi.mock("@/lib/share-store", () => ({
  getShareRecord: vi.fn(async () => shareState.share),
}));

function stubConfig() {
  vi.stubEnv("NUNCIO_CALCOM_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("NUNCIO_CALCOM_WORKSPACE_ID", "ws-1");
  vi.stubEnv("NUNCIO_CALCOM_EVENT_TYPE_ID", String(EVENT_TYPE_ID));
  vi.stubEnv("NUNCIO_CALCOM_BOOKING_URL", BOOKING_URL);
  vi.stubEnv("NUNCIO_SCHEDULING_CONTEXT_SECRET", CONTEXT_SECRET);
}

afterEach(() => {
  vi.unstubAllEnvs();
  storage.records.clear();
  storage.applyProviderEvent.mockClear();
  storage.get.mockClear();
  shareState.share = null;
});

function signedRequest(body: string, signature?: string) {
  const sig = signature ?? createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
  return new NextRequest("https://example.com/api/scheduling/webhooks/calcom", {
    method: "POST",
    headers: { "x-cal-signature-256": sig, "content-type": "application/json" },
    body,
  });
}

function envelope(overrides: Record<string, unknown> = {}, payload: Record<string, unknown> = {}) {
  return JSON.stringify({
    triggerEvent: "BOOKING_CREATED",
    createdAt: "2026-01-02T00:00:00.000Z",
    payload: {
      uid: "uid-1",
      eventTypeId: EVENT_TYPE_ID,
      startTime: "2026-01-02T10:00:00.000Z",
      endTime: "2026-01-02T10:30:00.000Z",
      status: "ACCEPTED",
      requiresConfirmation: false,
      metadata: {},
      ...payload,
    },
    ...overrides,
  });
}

function seedRecord(overrides: Partial<SchedulingRecord> = {}): SchedulingRecord {
  shareState.share = { id: "share-1", workspaceId: "ws-1" };
  const record: SchedulingRecord = {
    id: "ctx-1",
    shareId: "share-1",
    workspaceId: "ws-1",
    provider: "calcom",
    eventTypeId: EVENT_TYPE_ID,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "started",
    version: 0,
    ...overrides,
  };
  storage.records.set(record.id, record);
  return record;
}

describe("POST /api/scheduling/webhooks/calcom", () => {
  it("fails closed with 404 when unconfigured", async () => {
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope()));
    expect(res.status).toBe(404);
  });

  it("rejects an invalid signature with 401", async () => {
    stubConfig();
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope(), "0".repeat(64)));
    expect(res.status).toBe(401);
  });

  it("rejects malformed JSON with 400", async () => {
    stubConfig();
    const { POST } = await import("./route");
    const res = await POST(signedRequest("{nope"));
    expect(res.status).toBe(400);
  });

  it("rejects oversize bodies with 413", async () => {
    stubConfig();
    const { POST } = await import("./route");
    const big = envelope({}, { uid: "u".repeat(65 * 1024) });
    const res = await POST(signedRequest(big));
    expect(res.status).toBe(413);
  });

  it("acknowledges unsupported trigger events without applying", async () => {
    stubConfig();
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({ triggerEvent: "PAYMENT_FAILED" })));
    expect(res.status).toBe(200);
    expect(storage.applyProviderEvent).not.toHaveBeenCalled();
  });

  it("ignores events for other event types", async () => {
    stubConfig();
    seedRecord();
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({}, { eventTypeId: 999 })));
    expect(res.status).toBe(200);
    expect(storage.applyProviderEvent).not.toHaveBeenCalled();
  });

  it("ignores events without a valid context token", async () => {
    stubConfig();
    seedRecord();
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({}, { metadata: { nuncioContext: "bad.token" } })));
    expect(res.status).toBe(200);
    expect(storage.applyProviderEvent).not.toHaveBeenCalled();
  });

  it("ignores contexts from a different workspace", async () => {
    stubConfig();
    const record = seedRecord({ workspaceId: "other-ws" });
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({}, { metadata: { nuncioContext: token } })));
    expect(res.status).toBe(200);
    expect(storage.applyProviderEvent).not.toHaveBeenCalled();
  });

  it("maps BOOKING_CREATED ACCEPTED to confirmed", async () => {
    stubConfig();
    const record = seedRecord();
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({}, { metadata: { nuncioContext: token } })));
    expect(res.status).toBe(200);
    expect(storage.records.get(record.id)?.status).toBe("confirmed");
  });

  it("maps BOOKING_CREATED pending confirmation to requested", async () => {
    stubConfig();
    const record = seedRecord();
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({}, { metadata: { nuncioContext: token }, status: "PENDING", requiresConfirmation: true })));
    expect(res.status).toBe(200);
    expect(storage.records.get(record.id)?.status).toBe("requested");
  });

  it("maps BOOKING_REQUESTED to requested", async () => {
    stubConfig();
    const record = seedRecord();
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({ triggerEvent: "BOOKING_REQUESTED" }, { metadata: { nuncioContext: token } })));
    expect(res.status).toBe(200);
    expect(storage.records.get(record.id)?.status).toBe("requested");
  });

  it("maps BOOKING_CANCELLED to cancelled", async () => {
    stubConfig();
    const record = seedRecord({ status: "confirmed", providerBookingUid: "uid-1", lastProviderEventAt: "2026-01-01T00:00:00.000Z" });
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({ triggerEvent: "BOOKING_CANCELLED", createdAt: "2026-01-03T00:00:00.000Z" }, { metadata: { nuncioContext: token }, status: "CANCELLED" })));
    expect(res.status).toBe(200);
    expect(storage.records.get(record.id)?.status).toBe("cancelled");
  });

  it("requires a valid hex signature before comparison", async () => {
    stubConfig();
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope(), "not-hex-signature"));
    expect(res.status).toBe(401);
  });

  it("rejects a missing envelope createdAt with 400", async () => {
    stubConfig();
    const { POST } = await import("./route");
    const res = await POST(signedRequest(JSON.stringify({
      triggerEvent: "BOOKING_CREATED",
      payload: { uid: "uid-1", eventTypeId: EVENT_TYPE_ID, status: "ACCEPTED", startTime: "2026-01-02T10:00:00.000Z", endTime: "2026-01-02T10:30:00.000Z", metadata: {} },
    })));
    expect(res.status).toBe(400);
  });

  it("acknowledges valid events whose share linkage fails without applying", async () => {
    stubConfig();
    const record = seedRecord();
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    shareState.share = { id: "share-1", workspaceId: "other-ws" };
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({}, { metadata: { nuncioContext: token } })));
    expect(res.status).toBe(200);
    expect(storage.applyProviderEvent).not.toHaveBeenCalled();
  });

  it("applies events when the share still links to the record workspace", async () => {
    stubConfig();
    const record = seedRecord({ status: "cancelled", providerBookingUid: "uid-1", lastProviderEventAt: "2026-01-01T00:00:00.000Z" });
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    shareState.share = { id: "share-1", workspaceId: "ws-1" };
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope(
      { triggerEvent: "BOOKING_RESCHEDULED", createdAt: "2026-01-03T00:00:00.000Z" },
      { metadata: { nuncioContext: token }, uid: "uid-2", rescheduleUid: "uid-1", startTime: "2026-01-01T09:00:00.000Z", endTime: "2026-01-01T09:30:00.000Z" },
    )));
    expect(res.status).toBe(200);
    expect(storage.applyProviderEvent).toHaveBeenCalledWith(record.id, expect.objectContaining({ eventType: "BOOKING_RESCHEDULED", providerBookingUid: "uid-2", previousBookingUid: "uid-1" }));
  });

  it("returns 500 when the share lookup fails inside the storage boundary", async () => {
    stubConfig();
    const record = seedRecord();
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    const { getShareRecord } = await import("@/lib/share-store");
    vi.mocked(getShareRecord).mockRejectedValueOnce(new Error("share store down"));
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({}, { metadata: { nuncioContext: token } })));
    expect(res.status).toBe(500);
  });

  it("returns 500 when storage fails", async () => {
    stubConfig();
    const record = seedRecord();
    const token = mintSchedulingContextToken(record.id, CONTEXT_SECRET);
    storage.applyProviderEvent.mockRejectedValueOnce(new Error("db down"));
    const { POST } = await import("./route");
    const res = await POST(signedRequest(envelope({}, { metadata: { nuncioContext: token } })));
    expect(res.status).toBe(500);
  });
});
