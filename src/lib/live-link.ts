/**
 * Configuration shared by the LiveLink server routes and browser page.
 *
 * The server gate is intentionally opt-in: a missing or non-true value keeps
 * the Anam path unavailable while recorded HeyGen video remains unaffected.
 */

export const LIVE_SESSION_MAX_DURATION_MS = 5 * 60 * 1000;
export const LIVE_SESSION_MAX_CREDITS = 5;
export const LIVE_SESSION_CREDITS_PER_MINUTE = 1;

function csvEnv(name: string): string[] {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isLiveLinkEnabled(): boolean {
  return process.env.NUNCIO_LIVELINK_ENABLED === "true";
}

/**
 * LiveLink is globally opt-in, with optional pilot allowlists. If either
 * allowlist is configured, a request must match at least one configured
 * workspace or sender email entry.
 */
export function isLiveLinkAllowed(input: {
  workspaceId?: string;
  senderEmail?: string;
}): boolean {
  if (!isLiveLinkEnabled()) return false;

  const workspaceIds = csvEnv("NUNCIO_LIVELINK_WORKSPACE_IDS");
  const senderEmails = csvEnv("NUNCIO_LIVELINK_SENDER_EMAILS");
  // A global flag alone is not sufficient for a paid pilot. Require an
  // explicit workspace or sender entry whenever LiveLink is enabled.
  if (workspaceIds.length === 0 && senderEmails.length === 0) return false;

  const workspaceMatches = Boolean(input.workspaceId && workspaceIds.includes(input.workspaceId.toLowerCase()));
  const senderMatches = Boolean(input.senderEmail && senderEmails.includes(input.senderEmail.trim().toLowerCase()));
  return workspaceMatches || senderMatches;
}

/** Calculate the billable credits for a completed or expired session. */
export function calculateLiveSessionCharge(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  const minutes = Math.ceil(durationMs / 60_000);
  return Math.min(LIVE_SESSION_MAX_CREDITS, minutes * LIVE_SESSION_CREDITS_PER_MINUTE);
}
