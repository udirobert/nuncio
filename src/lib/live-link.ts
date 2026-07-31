/**
 * Configuration shared by the LiveLink server routes and browser page.
 *
 * The server gate is intentionally opt-in: a missing or non-true value keeps
 * the Anam path unavailable while recorded HeyGen video remains unaffected.
 */

export const LIVE_SESSION_MAX_DURATION_MS = 5 * 60 * 1000;

export function isLiveLinkEnabled(): boolean {
  return process.env.NUNCIO_LIVELINK_ENABLED === "true";
}
