/**
 * Viral-loop invite reference grammar — shared by the browser (validate before
 * storing) and the server (validate before persisting attribution). Same pure
 * module pattern as `src/lib/live-topics.ts`.
 *
 * Accepted shapes: `share-{shareId}[-header][-cta{a|b}]`, `live-{shareId}`.
 */

export const MAX_REF_LENGTH = 120;

export const VIRAL_REF_PATTERN = /^(share|live)-[A-Za-z0-9_-]{1,110}$/;

export function isViralRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const ref = value.trim();
  return ref.length <= MAX_REF_LENGTH && VIRAL_REF_PATTERN.test(ref);
}

export function normalizeViralRef(value: unknown): string | null {
  return isViralRef(value) ? value.trim() : null;
}
