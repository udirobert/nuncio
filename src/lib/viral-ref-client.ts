/**
 * Viral-loop referral reference (STRATEGY S6).
 *
 * The landing page reads `?ref=share-…` / `?ref=live-…` once, but the signup
 * magic link can be opened later (or in a mail client), so the ref must
 * survive in localStorage until the first authenticated dashboard load posts
 * it to /api/account/attribution. First-touch wins; 30-day expiry; cleared
 * after attribution.
 */

import { normalizeViralRef } from "@/lib/viral-ref";

const REF_KEY = "nuncio_ref";
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function rememberViralRef(ref: string): void {
  if (typeof window === "undefined") return;
  // Only store well-formed invites — anything else can never be attributed and
  // would sit in storage being re-posted on every dashboard load.
  if (!normalizeViralRef(ref)) return;
  try {
    if (window.localStorage.getItem(REF_KEY)) return; // first-touch wins
    window.localStorage.setItem(REF_KEY, JSON.stringify({ ref, at: Date.now() }));
  } catch {
    // Storage unavailable (private mode) — attribution degrades to PostHog only.
  }
}

export function readViralRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ref?: string; at?: number };
    const ref = normalizeViralRef(parsed.ref);
    if (!ref) {
      window.localStorage.removeItem(REF_KEY);
      return null;
    }
    if (typeof parsed.at === "number" && Date.now() - parsed.at > REF_TTL_MS) {
      window.localStorage.removeItem(REF_KEY);
      return null;
    }
    return ref;
  } catch {
    return null;
  }
}

export function clearViralRef(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REF_KEY);
  } catch {
    // ignore
  }
}
