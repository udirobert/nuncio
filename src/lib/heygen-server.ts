import { getAvatars, getVoices } from "@/lib/heygen";
import type { HeyGenAvatar, HeyGenVoice } from "@/lib/heygen";
import { ServerCache } from "@/lib/server-cache";
import { recordHit, recordMiss } from "@/lib/cache-metrics";

const CACHE_KEY_AVATARS = "heygen_avatars";
const CACHE_KEY_VOICES = "heygen_voices";

const NS = "heygen";

/**
 * Fetch avatars with server-side caching.
 * Cache lives in `.data/cache/` (or `NUNCIO_CACHE_DIR`), TTL 1 hour.
 * Falls back to a live fetch on cache miss or error.
 */
export async function getCachedAvatars(): Promise<HeyGenAvatar[]> {
  const cache = ServerCache.getInstance();
  const hit = await cache.get<HeyGenAvatar[]>(CACHE_KEY_AVATARS);
  if (hit !== null) {
    recordHit(NS, "avatars");
    return hit;
  }
  recordMiss(NS, "avatars");
  return cache.getOrSet(CACHE_KEY_AVATARS, () => getAvatars());
}

/**
 * Fetch voices with server-side caching.
 * Cache lives in `.data/cache/` (or `NUNCIO_CACHE_DIR`), TTL 1 hour.
 * Falls back to a live fetch on cache miss or error.
 */
export async function getCachedVoices(): Promise<HeyGenVoice[]> {
  const cache = ServerCache.getInstance();
  const hit = await cache.get<HeyGenVoice[]>(CACHE_KEY_VOICES);
  if (hit !== null) {
    recordHit(NS, "voices");
    return hit;
  }
  recordMiss(NS, "voices");
  return cache.getOrSet(CACHE_KEY_VOICES, () => getVoices());
}
