import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { RedisCache } from "./redis-cache";

const CACHE_DIR = process.env.NUNCIO_CACHE_DIR || path.join(process.cwd(), ".data", "cache");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ── Provider interface ───────────────────────────────────────────────

/** Cache provider interface. Both the file and Redis implementations satisfy this. */
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttlMinutes?: number): Promise<void>;
  getOrSet<T>(key: string, fetch: () => Promise<T>, ttlMinutes?: number): Promise<T>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ── File-based implementation ─────────────────────────────────────────

class FileCache implements CacheProvider {
  /**
   * Get a cached value. Returns `null` if the key doesn't exist or the TTL has expired.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await readFile(this.filePath(key), "utf8");
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expiresAt) {
        this.delete(key).catch(() => {});
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Set a cached value with an optional TTL (default 60 minutes).
   */
  async set<T>(key: string, data: T, ttlMinutes?: number): Promise<void> {
    const ttl = (ttlMinutes ?? 60) * 60 * 1000;
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttl,
    };
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(this.filePath(key), JSON.stringify(entry), "utf8");
  }

  private inflight = new Map<string, Promise<unknown>>();

  /**
   * Get a cached value, or compute and cache it if missing/expired.
   *
   * Concurrent calls for the same key are deduplicated — only one `fetch`
   * runs at a time. Subsequent callers await the same promise.
   */
  async getOrSet<T>(key: string, fetch: () => Promise<T>, ttlMinutes?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetch()
      .then(async (data) => {
        await this.set(key, data, ttlMinutes);
        return data;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Delete a cached value by replacing it with a tombstone.
   */
  async delete(key: string): Promise<void> {
    try {
      await writeFile(this.filePath(key), JSON.stringify({ data: null, expiresAt: 0 }), "utf8");
    } catch {
      // ignore
    }
  }

  /**
   * Clear all cached entries by deleting the entire cache directory.
   */
  async clear(): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true });
    try {
      await rm(CACHE_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  private filePath(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(CACHE_DIR, `${safe}.json`);
  }
}

// ── Facade — selects file or Redis based on env var ───────────────────

/**
 * Server-side cache facade.
 *
 * - Default: file-based cache in `.data/cache/`
 * - `NUNCIO_CACHE=redis` → uses Redis (set `REDIS_URL` for custom connection)
 *
 * Default TTL: 1 hour. Pass `ttlMinutes` to `set`/`getOrSet` for shorter-lived entries.
 */
export class ServerCache {
  private static instance: CacheProvider;

  static getInstance(): CacheProvider {
    if (!ServerCache.instance) {
      if (process.env.NUNCIO_CACHE === "redis") {
        ServerCache.instance = new RedisCache();
      } else {
        ServerCache.instance = new FileCache();
      }
    }
    return ServerCache.instance;
  }
}
