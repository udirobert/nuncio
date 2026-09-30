import { createHmac, timingSafeEqual } from "node:crypto";
import { parseEventTimestamp, type SchedulingProviderEvent } from "@/lib/scheduling-server";
import type { SchedulingStatus } from "@/lib/storage/types";

export const CALCOM_MAX_BODY_BYTES = 64 * 1024;

const ACCEPTED_EVENTS = new Set([
  "BOOKING_CREATED",
  "BOOKING_REQUESTED",
  "BOOKING_CANCELLED",
  "BOOKING_RESCHEDULED",
  "BOOKING_REJECTED",
]);

export type CalcomParseResult =
  | { kind: "event"; event: SchedulingProviderEvent; contextToken: string }
  | { kind: "ignored" }
  | { kind: "invalid" };

export function verifyCalcomSignature(raw: string, signature: string, secret: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseCalcomWebhook(raw: string, config: { eventTypeId: number }): CalcomParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "invalid" };
  }
  const envelope = parsed as {
    triggerEvent?: unknown;
    createdAt?: unknown;
    payload?: Record<string, unknown> | null;
  };
  if (!envelope || typeof envelope !== "object") return { kind: "invalid" };
  const triggerEvent = envelope.triggerEvent;
  const payload = envelope.payload;
  if (typeof triggerEvent !== "string" || !payload || typeof payload !== "object") {
    return { kind: "invalid" };
  }
  if (!ACCEPTED_EVENTS.has(triggerEvent)) return { kind: "ignored" };
  if (payload.eventTypeId !== config.eventTypeId) return { kind: "ignored" };

  const uid = payload.uid;
  if (typeof uid !== "string" || !uid || uid.length > 128) return { kind: "invalid" };

  const eventAt = parseEventTimestamp(envelope.createdAt);
  if (!eventAt) return { kind: "invalid" };

  const startsAt = parseEventTimestamp(payload.startTime);
  const endsAt = parseEventTimestamp(payload.endTime);
  if (triggerEvent !== "BOOKING_CANCELLED" && triggerEvent !== "BOOKING_REJECTED") {
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
      return { kind: "invalid" };
    }
  }

  const metadata = payload.metadata;
  const contextToken =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).nuncioContext
      : undefined;

  const requiresConfirmation = payload.requiresConfirmation === true;
  const accepted = typeof payload.status === "string" && payload.status.toUpperCase() === "ACCEPTED";

  let status: SchedulingStatus;
  switch (triggerEvent) {
    case "BOOKING_REQUESTED":
      status = "requested";
      break;
    case "BOOKING_CREATED":
    case "BOOKING_RESCHEDULED":
      status = accepted && !requiresConfirmation ? "confirmed" : "requested";
      break;
    default:
      status = "cancelled";
      break;
  }

  return {
    kind: "event",
    contextToken: typeof contextToken === "string" ? contextToken : "",
    event: {
      providerBookingUid: uid,
      eventTypeId: config.eventTypeId,
      status,
      eventAt,
      eventType: triggerEvent,
      startsAt: startsAt ?? undefined,
      endsAt: endsAt ?? undefined,
      previousBookingUid:
        typeof payload.rescheduleUid === "string" && payload.rescheduleUid
          ? payload.rescheduleUid
          : undefined,
    },
  };
}
