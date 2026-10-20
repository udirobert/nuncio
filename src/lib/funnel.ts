import { createHash } from "node:crypto";
import { captureServerEvent } from "@/lib/analytics-server";

/**
 * The first-touch funnel.
 *
 * The product's promise is that a link turns into a conversation and a
 * conversation turns into a meeting. Until now the only signal was
 * `booking_clicked` — a click, not a meeting. The inbox already computes a
 * relationship state per link (`sent → opened → talking → booked`), so the
 * funnel can be captured at the moment each transition actually happens.
 *
 * Privacy:
 * - Properties are usage-only. No prospect names, no sender briefs, no
 *   drafted text, no share ids.
 * - The identity is a salted hash of the workspace id, not an email, so the
 *   funnel measures workspaces rather than people.
 * - The per-send link between the steps is a salted hash of the share id.
 *   A share id can be a bearer capability (invitation-protected links), so
 *   it is never sent raw.
 */

export type FunnelEvent =
  | "first_touch_sent"
  | "first_touch_opened"
  | "first_touch_talked"
  | "first_touch_booked";

/** Allowlisted property keys. Anything else is dropped. */
const ALLOWED_PROPERTIES = new Set([
  "touch",
  "delivery_mode",
  "mode",
  "transport",
  "source",
]);

function salt(): string {
  return process.env.NUNCIO_ANALYTICS_SALT || "nuncio";
}

/** Stable, non-reversible id for a workspace. */
export function funnelDistinctId(workspaceId?: string | null): string | null {
  if (!workspaceId) return null;
  const hash = createHash("sha256")
    .update(`${salt()}:ws:${workspaceId}`)
    .digest("hex")
    .slice(0, 32);
  return `ws-${hash}`;
}

/** Stable, non-reversible id for a single first touch. */
export function funnelTouchId(shareId?: string | null): string | undefined {
  if (!shareId) return undefined;
  return `t-${createHash("sha256")
    .update(`${salt()}:touch:${shareId}`)
    .digest("hex")
    .slice(0, 24)}`;
}

/**
 * Capture a funnel step. No-op without analytics configured, and never throws
 * — a failed capture must not break the request that caused it.
 */
export function captureFunnelEvent(input: {
  workspaceId?: string | null;
  shareId?: string | null;
  event: FunnelEvent;
  properties?: Record<string, unknown>;
}): void {
  const distinctId = funnelDistinctId(input.workspaceId);
  if (!distinctId) return;

  const touch = funnelTouchId(input.shareId);
  const properties: Record<string, unknown> = {};
  if (touch) properties.touch = touch;
  for (const [key, value] of Object.entries(input.properties ?? {})) {
    if (ALLOWED_PROPERTIES.has(key) && value !== undefined && value !== null) {
      properties[key] = value;
    }
  }

  captureServerEvent({ distinctId, event: input.event, properties });
}
