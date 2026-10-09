/**
 * Server-side PostHog capture — the counterpart to `src/lib/analytics.ts`
 * (which is client-only, posthog-js).
 *
 * Opt-in like Sentry: no-op until `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is set.
 * Fire-and-forget with a short timeout so analytics never block or fail a
 * request. Uses the public capture endpoint directly instead of pulling in
 * `posthog-node` — we only need `capture`.
 *
 * Privacy rule: properties are usage-only. Never put prospect URLs, sender
 * briefs, drafted text, or other user content in these events.
 *
 * Events captured from here (client-side events live in analytics.ts):
 * - mcp_connect      — plugin completed initialize or tools/list
 * - mcp_tool_call    — research_and_draft invoked (REST or JSON-RPC bridge)
 * - signed_up        — new workspace created on magic-link verify
 * - referred_signup  — signup attributed to a ?ref= invite
 */

import { createHash, randomUUID } from "node:crypto";
import { getClientId } from "@/lib/rate-limit";

const CAPTURE_TIMEOUT_MS = 2000;

function posthogConfig(): { apiKey: string; host: string } | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!apiKey) return null;
  const host = process.env.NUNCIO_POSTHOG_API_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST;
  return { apiKey, host: (host || "https://us.i.posthog.com").replace(/\/+$/, "") };
}

export function isServerAnalyticsEnabled(): boolean {
  return posthogConfig() !== null;
}

export function captureServerEvent(input: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): void {
  const config = posthogConfig();
  if (!config) return;

  fetch(`${config.host}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: config.apiKey,
      event: input.event,
      distinct_id: input.distinctId,
      properties: {
        $lib: "nuncio-server",
        ...input.properties,
      },
    }),
    signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    cache: "no-store",
  }).catch((error) => {
    console.error(`[analytics-server] capture failed for ${input.event}:`, error);
  });
}

/**
 * Stable, non-reversible id for unauthenticated MCP/REST traffic.
 * Salted SHA-256 of the client IP so PostHog never sees a raw address.
 * Unidentifiable ("anonymous") clients get a one-off id, so they never
 * pollute the return-user metric with false repeats.
 */
export function mcpDistinctId(request: Request): string {
  const clientId = getClientId(request);
  if (clientId === "anonymous") return `mcp-anon-${randomUUID()}`;
  const salt = process.env.NUNCIO_ANALYTICS_SALT || "nuncio";
  const hash = createHash("sha256").update(`${salt}:${clientId}`).digest("hex").slice(0, 32);
  return `mcp-${hash}`;
}
