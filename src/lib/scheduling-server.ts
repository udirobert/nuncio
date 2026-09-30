import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveSchedulingProvider } from "@/lib/scheduling";
import type { SchedulingRecord, SchedulingStatus } from "@/lib/storage/types";

export interface CalcomPilotConfig {
  webhookSecret: string;
  workspaceId: string;
  eventTypeId: number;
  bookingUrl: string;
  contextSecret: string;
}

export function getCalcomPilotConfig(): CalcomPilotConfig | null {
  const webhookSecret = process.env.NUNCIO_CALCOM_WEBHOOK_SECRET;
  const workspaceId = process.env.NUNCIO_CALCOM_WORKSPACE_ID;
  const eventTypeRaw = process.env.NUNCIO_CALCOM_EVENT_TYPE_ID;
  const bookingUrl = process.env.NUNCIO_CALCOM_BOOKING_URL;
  const contextSecret = process.env.NUNCIO_SCHEDULING_CONTEXT_SECRET;
  if (!webhookSecret || !workspaceId || !eventTypeRaw || !bookingUrl || !contextSecret) return null;
  const eventTypeId = Number(eventTypeRaw);
  if (!Number.isSafeInteger(eventTypeId) || eventTypeId <= 0) return null;
  const provider = resolveSchedulingProvider(bookingUrl.trim());
  if (provider?.id !== "calcom") return null;
  return { webhookSecret, workspaceId, eventTypeId, bookingUrl: provider.url, contextSecret };
}

export function mintSchedulingContextToken(id: string, secret: string): string {
  return `${id}.${createHmac("sha256", secret).update(id).digest("hex")}`;
}

export function verifySchedulingContextToken(token: string, secret: string): string | null {
  if (typeof token !== "string" || token.length > 300) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const id = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^[0-9a-f]{64}$/.test(mac)) return null;
  const expected = createHmac("sha256", secret).update(id).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export function parseEventTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

const STATUS_RANK: Record<SchedulingStatus, number> = {
  started: 0,
  requested: 1,
  confirmed: 2,
  cancelled: 3,
};

export interface SchedulingProviderEvent {
  providerBookingUid: string;
  eventTypeId: number;
  status: SchedulingStatus;
  eventAt: string;
  eventType: string;
  startsAt?: string;
  endsAt?: string;
  previousBookingUid?: string;
}

export function applySchedulingEvent(
  record: SchedulingRecord,
  event: SchedulingProviderEvent,
): SchedulingRecord | null {
  if (event.eventTypeId !== record.eventTypeId) return null;

  const storedUid = record.providerBookingUid;
  const sameUid = !storedUid || storedUid === event.providerBookingUid;
  let uidChange = false;
  if (!sameUid) {
    if (
      event.eventType === "BOOKING_RESCHEDULED"
      && event.previousBookingUid === storedUid
    ) {
      uidChange = true;
    } else {
      return null;
    }
  }

  if (record.status === "cancelled" && !uidChange) return null;

  const lastAt = record.lastProviderEventAt;
  if (lastAt && !uidChange) {
    const cmp = event.eventAt.localeCompare(lastAt);
    if (cmp < 0) return null;
    if (cmp === 0 && STATUS_RANK[event.status] <= STATUS_RANK[record.status]) return null;
  }
  if (lastAt && uidChange && event.eventAt.localeCompare(lastAt) < 0) return null;

  return {
    ...record,
    providerBookingUid: event.providerBookingUid,
    status: event.status,
    lastProviderEvent: event.eventType,
    lastProviderEventAt: event.eventAt,
    startsAt: event.startsAt ?? record.startsAt,
    endsAt: event.endsAt ?? record.endsAt,
    version: (record.version ?? 0) + 1,
  };
}
