import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applySchedulingEvent,
  getCalcomPilotConfig,
  mintSchedulingContextToken,
  verifySchedulingContextToken,
  type SchedulingProviderEvent,
} from "./scheduling-server";
import type { SchedulingRecord } from "@/lib/storage/types";

const SECRET = "test-context-secret";

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeRecord(overrides: Partial<SchedulingRecord> = {}): SchedulingRecord {
  return {
    id: "ctx-1",
    shareId: "share-1",
    workspaceId: "ws-1",
    provider: "calcom",
    eventTypeId: 42,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "started",
    version: 0,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SchedulingProviderEvent> = {}): SchedulingProviderEvent {
  return {
    providerBookingUid: "uid-1",
    eventTypeId: 42,
    status: "confirmed",
    eventAt: "2026-01-02T00:00:00.000Z",
    eventType: "BOOKING_CREATED",
    ...overrides,
  };
}

describe("getCalcomPilotConfig", () => {
  it("returns null when unconfigured", () => {
    expect(getCalcomPilotConfig()).toBeNull();
  });

  it("parses full config and rejects non-integer event types", () => {
    vi.stubEnv("NUNCIO_CALCOM_WEBHOOK_SECRET", "s");
    vi.stubEnv("NUNCIO_CALCOM_WORKSPACE_ID", "ws-1");
    vi.stubEnv("NUNCIO_CALCOM_EVENT_TYPE_ID", "42");
    vi.stubEnv("NUNCIO_CALCOM_BOOKING_URL", "https://cal.com/x/y");
    vi.stubEnv("NUNCIO_SCHEDULING_CONTEXT_SECRET", "cs");
    expect(getCalcomPilotConfig()).toMatchObject({ workspaceId: "ws-1", eventTypeId: 42 });
    vi.stubEnv("NUNCIO_CALCOM_EVENT_TYPE_ID", "abc");
    expect(getCalcomPilotConfig()).toBeNull();
  });
});

describe("scheduling context token", () => {
  it("round-trips a minted token and rejects tampering", () => {
    const token = mintSchedulingContextToken("ctx-9", SECRET);
    expect(verifySchedulingContextToken(token, SECRET)).toBe("ctx-9");
    expect(verifySchedulingContextToken(`${token}x`, SECRET)).toBeNull();
    expect(verifySchedulingContextToken(`other.${token.split(".")[1]}`, SECRET)).toBeNull();
    expect(verifySchedulingContextToken("garbage", SECRET)).toBeNull();
    expect(verifySchedulingContextToken(`ctx-9.${"0".repeat(64)}`, SECRET)).toBeNull();
  });
});

describe("applySchedulingEvent", () => {
  it("applies an initial confirmed event", () => {
    const next = applySchedulingEvent(makeRecord(), makeEvent());
    expect(next).toMatchObject({ status: "confirmed", providerBookingUid: "uid-1", version: 1 });
  });

  it("applies requested status and stays monotonic on duplicates", () => {
    const requested = applySchedulingEvent(makeRecord(), makeEvent({ status: "requested", eventType: "BOOKING_REQUESTED" }))!;
    expect(requested.status).toBe("requested");
    const dup = applySchedulingEvent(requested, makeEvent({ status: "requested", eventType: "BOOKING_REQUESTED" }));
    expect(dup).toBeNull();
    const older = applySchedulingEvent(requested, makeEvent({ status: "confirmed", eventAt: "2026-01-01T12:00:00.000Z" }));
    expect(older).toBeNull();
  });

  it("equal timestamps prefer stronger terminal-safe states", () => {
    const requested = applySchedulingEvent(makeRecord(), makeEvent({ status: "requested" }))!;
    const confirmed = applySchedulingEvent(requested, makeEvent({ status: "confirmed" }));
    expect(confirmed!.status).toBe("confirmed");
    const cancelled = applySchedulingEvent(confirmed!, makeEvent({ status: "cancelled", eventType: "BOOKING_CANCELLED" }));
    expect(cancelled!.status).toBe("cancelled");
  });

  it("allows cancel-first and never resurrects a cancelled record", () => {
    const cancelled = applySchedulingEvent(
      makeRecord(),
      makeEvent({ status: "cancelled", eventType: "BOOKING_CANCELLED", eventAt: "2026-01-03T00:00:00.000Z" }),
    )!;
    expect(cancelled.status).toBe("cancelled");
    const resurrect = applySchedulingEvent(
      cancelled,
      makeEvent({ status: "confirmed", eventAt: "2026-01-04T00:00:00.000Z" }),
    );
    expect(resurrect).toBeNull();
  });

  it("accepts a rescheduled new uid only when previousBookingUid links back", () => {
    const confirmed = applySchedulingEvent(makeRecord(), makeEvent())!;
    const badReschedule = applySchedulingEvent(
      confirmed,
      makeEvent({ providerBookingUid: "uid-2", eventType: "BOOKING_RESCHEDULED", eventAt: "2026-01-03T00:00:00.000Z" }),
    );
    expect(badReschedule).toBeNull();
    const rescheduled = applySchedulingEvent(
      confirmed,
      makeEvent({ providerBookingUid: "uid-2", eventType: "BOOKING_RESCHEDULED", previousBookingUid: "uid-1", eventAt: "2026-01-03T00:00:00.000Z" }),
    );
    expect(rescheduled).toMatchObject({ providerBookingUid: "uid-2", status: "confirmed" });
  });

  it("rejects events bound to a different event type", () => {
    expect(applySchedulingEvent(makeRecord(), makeEvent({ eventTypeId: 99 }))).toBeNull();
  });

  it("allows a verified reschedule to a new uid after the old uid was cancelled", () => {
    const cancelled = applySchedulingEvent(
      makeRecord({ status: "confirmed", providerBookingUid: "uid-1", lastProviderEventAt: "2026-01-02T00:00:00.000Z" }),
      makeEvent({ status: "cancelled", eventType: "BOOKING_CANCELLED", eventAt: "2026-01-03T00:00:00.000Z" }),
    )!;
    expect(cancelled.status).toBe("cancelled");
    const rescheduled = applySchedulingEvent(
      cancelled,
      makeEvent({ providerBookingUid: "uid-2", eventType: "BOOKING_RESCHEDULED", previousBookingUid: "uid-1", eventAt: "2026-01-04T00:00:00.000Z", startsAt: "2025-12-30T09:00:00.000Z" }),
    );
    expect(rescheduled).toMatchObject({ providerBookingUid: "uid-2", status: "confirmed", startsAt: "2025-12-30T09:00:00.000Z" });
  });

  it("does not let later events for the old uid mutate a rescheduled record", () => {
    const rescheduled = applySchedulingEvent(
      makeRecord({ status: "confirmed", providerBookingUid: "uid-1", lastProviderEventAt: "2026-01-02T00:00:00.000Z" }),
      makeEvent({ providerBookingUid: "uid-2", eventType: "BOOKING_RESCHEDULED", previousBookingUid: "uid-1", eventAt: "2026-01-03T00:00:00.000Z" }),
    )!;
    const oldCancel = applySchedulingEvent(
      rescheduled,
      makeEvent({ providerBookingUid: "uid-1", status: "cancelled", eventType: "BOOKING_CANCELLED", eventAt: "2026-01-05T00:00:00.000Z" }),
    );
    expect(oldCancel).toBeNull();
    expect(rescheduled.providerBookingUid).toBe("uid-2");
  });

  it("does not regress a rescheduled record on an older CREATED for the old uid", () => {
    const rescheduled = applySchedulingEvent(
      makeRecord({ status: "confirmed", providerBookingUid: "uid-1", lastProviderEventAt: "2026-01-02T00:00:00.000Z" }),
      makeEvent({ providerBookingUid: "uid-2", eventType: "BOOKING_RESCHEDULED", previousBookingUid: "uid-1", eventAt: "2026-01-03T00:00:00.000Z" }),
    )!;
    expect(applySchedulingEvent(rescheduled, makeEvent({ providerBookingUid: "uid-1", eventAt: "2026-01-01T00:00:00.000Z" }))).toBeNull();
  });

  it("rejects a uid change that is not a verified reschedule", () => {
    const confirmed = applySchedulingEvent(makeRecord(), makeEvent())!;
    expect(applySchedulingEvent(
      confirmed,
      makeEvent({ providerBookingUid: "uid-2", eventType: "BOOKING_CREATED", previousBookingUid: "uid-1", eventAt: "2026-01-03T00:00:00.000Z" }),
    )).toBeNull();
  });
});
