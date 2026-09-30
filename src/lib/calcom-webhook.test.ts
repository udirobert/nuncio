import { describe, expect, it } from "vitest";
import { parseCalcomWebhook, verifyCalcomSignature, CALCOM_MAX_BODY_BYTES } from "./calcom-webhook";
import { createHmac } from "node:crypto";

const EVENT_TYPE_ID = 42;
const SECRET = "whsec-test";

function body(overrides: Record<string, unknown> = {}, payload: Record<string, unknown> = {}) {
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
      metadata: { nuncioContext: "ctx-1.abc" },
      ...payload,
    },
    ...overrides,
  });
}

describe("parseCalcomWebhook", () => {
  it("orders by envelope createdAt, never payload startTime", () => {
    const res = parseCalcomWebhook(body({}, { startTime: "1999-01-01T00:00:00.000Z" }), { eventTypeId: EVENT_TYPE_ID });
    expect(res).toMatchObject({ kind: "event", event: { eventAt: "2026-01-02T00:00:00.000Z", startsAt: "1999-01-01T00:00:00.000Z" } });
  });

  it("rejects missing or invalid envelope createdAt", () => {
    expect(parseCalcomWebhook(body({ createdAt: undefined }), { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "invalid" });
    expect(parseCalcomWebhook(body({ createdAt: "not-a-date" }), { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "invalid" });
  });

  it("requires valid start < end for created events", () => {
    expect(parseCalcomWebhook(body({}, { startTime: "2026-01-02T11:00:00.000Z", endTime: "2026-01-02T10:00:00.000Z" }), { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "invalid" });
    expect(parseCalcomWebhook(body({}, { endTime: undefined }), { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "invalid" });
  });

  it("allows cancellation without meeting times", () => {
    const res = parseCalcomWebhook(body({ triggerEvent: "BOOKING_CANCELLED" }, { startTime: undefined, endTime: undefined, status: "CANCELLED" }), { eventTypeId: EVENT_TYPE_ID });
    expect(res).toMatchObject({ kind: "event", event: { status: "cancelled", eventType: "BOOKING_CANCELLED" } });
  });

  it("ignores unrelated trigger events and other event types", () => {
    expect(parseCalcomWebhook(body({ triggerEvent: "FORM_SUBMITTED" }), { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "ignored" });
    expect(parseCalcomWebhook(body({}, { eventTypeId: 7 }), { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "ignored" });
  });

  it("rejects overlong uids and malformed payloads", () => {
    expect(parseCalcomWebhook(body({}, { uid: "u".repeat(200) }), { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "invalid" });
    expect(parseCalcomWebhook("{oops", { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "invalid" });
    expect(parseCalcomWebhook("[]", { eventTypeId: EVENT_TYPE_ID })).toEqual({ kind: "invalid" });
  });

  it("maps requested vs confirmed and exposes the context token", () => {
    const res = parseCalcomWebhook(body({}, { status: "PENDING", requiresConfirmation: true }), { eventTypeId: EVENT_TYPE_ID });
    expect(res).toMatchObject({ kind: "event", contextToken: "ctx-1.abc", event: { status: "requested" } });
  });
});

describe("verifyCalcomSignature", () => {
  it("accepts a valid hex HMAC and rejects malformed signatures", () => {
    const raw = body();
    const sig = createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
    expect(verifyCalcomSignature(raw, sig, SECRET)).toBe(true);
    expect(verifyCalcomSignature(raw, "zz".repeat(32), SECRET)).toBe(false);
    expect(verifyCalcomSignature(raw, sig.slice(0, 63), SECRET)).toBe(false);
    expect(verifyCalcomSignature(raw, "0".repeat(64), SECRET)).toBe(false);
    expect(verifyCalcomSignature(raw + " ", sig, SECRET)).toBe(false);
  });
});

describe("CALCOM_MAX_BODY_BYTES", () => {
  it("is 64 KiB", () => {
    expect(CALCOM_MAX_BODY_BYTES).toBe(64 * 1024);
  });
});
