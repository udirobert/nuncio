"use client";

const MAX_TOKEN_CHARS = 256;
const EXCHANGE_TIMEOUT_MS = 10_000;
const inFlight = new Map<string, Promise<void>>();

export function prepareHandoffAccess(shareId: string): Promise<void> {
  const existing = inFlight.get(shareId);
  if (existing) return existing;

  const work = (async () => {
    if (typeof window === "undefined") return;
    const rawHash = window.location.hash;
    const match = rawHash.match(/^#handoff=([^&]*)/);
    if (!match) return;

    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      throw new Error("Invitation could not be activated");
    }
    if (window.location.hash) {
      throw new Error("Invitation could not be activated");
    }

    let token: string;
    try {
      token = decodeURIComponent(match[1]);
    } catch {
      throw new Error("Invitation could not be activated");
    }
    if (!token || token.length > MAX_TOKEN_CHARS) {
      throw new Error("Invitation could not be activated");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXCHANGE_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/live/handoffs/${encodeURIComponent(shareId)}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Invitation could not be activated");
      }
    } catch {
      throw new Error("Invitation could not be activated");
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    if (inFlight.get(shareId) === work) inFlight.delete(shareId);
  });
  inFlight.set(shareId, work);
  return work;
}
