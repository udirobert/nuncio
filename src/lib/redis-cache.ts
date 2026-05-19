import Redis from "ioredis";

const TTL_SECONDS = 60 * 60; // 1 hour
const KEY_PREFIX = "nuncio:cache:";

/**
 * Redis-backed cache provider.
 *
 * Activated by setting `NUNCIO_CACHE=redis` (and optionally `REDIS_URL`).
 * Shares the same interface as the file-based cache in server-cache.ts.
 */
export class RedisCache {
  private client: Redis;
  private inflight = new Map<string, Promise<unknown>>();

  constructor() {
    this.client = new Redis(
      process.env.REDIS_URL || "redis://localhost:6379",
      {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
      },
    );
    // Fire-and-forget connect — don't block the constructor.
    // Commands are queued by ioredis until the connection is ready.
    this.client.connect().catch(() => {});
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(KEY_PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlMinutes?: number): Promise<void> {
    const raw = JSON.stringify(data);
    const ttlSeconds = (ttlMinutes ?? 60) * 60;
    await this.client.setex(KEY_PREFIX + key, ttlSeconds, raw);
  }

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

  async delete(key: string): Promise<void> {
    await this.client.del(KEY_PREFIX + key).catch(() => {});
  }

  async clear(): Promise<void> {
    try {
      let cursor: string = "0";
      do {
        const result: [string, string[]] = await this.client.scan(
          cursor,
          "MATCH",
          KEY_PREFIX + "*",
          "COUNT",
          100,
        );
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== "0");
    } catch {
      // ignore
    }
  }
}
