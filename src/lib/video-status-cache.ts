/**
 * In-memory cache for HeyGen webhook-delivered video status.
 * Falls through to HeyGen API polling if no cached status exists.
 * TTL: 10 minutes (videos not claimed in that time are evicted).
 */

interface CachedVideoStatus {
  status: "completed" | "failed";
  videoUrl?: string;
  failureMessage?: string;
  timestamp: number;
}

const cache = new Map<string, CachedVideoStatus>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export function setVideoStatus(videoId: string, status: CachedVideoStatus["status"], videoUrl?: string, failureMessage?: string) {
  cache.set(videoId, { status, videoUrl, failureMessage, timestamp: Date.now() });
  // Schedule cleanup
  setTimeout(() => cache.delete(videoId), TTL_MS);
}

export function getVideoStatusFromCache(videoId: string): CachedVideoStatus | null {
  const entry = cache.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(videoId);
    return null;
  }
  return entry;
}
