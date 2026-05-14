/**
 * Simple in-memory cache with TTL.
 * Prevents duplicate API calls for the same input within a time window.
 *
 * Used for:
 * - TinyFish enrichment (same URL within 30 min → cached)
 * - Claude synthesis (same enrichment data → cached)
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMinutes: number = 30, maxSize: number = 100) {
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Generate a cache key from an array of URLs (sorted for consistency).
   */
  static urlsKey(urls: string[]): string {
    return urls.slice().sort().join("|");
  }

  /** Current cache size */
  get size(): number {
    return this.store.size;
  }

  /** Clear all entries */
  clear(): void {
    this.store.clear();
  }
}
