/**
 * Rate limiter with Redis backing and in-memory fallback.
 *
 * - Set `NUNCIO_RATE_LIMIT_STORE=redis` to persist limits across restarts
 *   and share them between instances.
 * - Defaults to in-memory storage so the app works locally without Redis.
 */

import Redis from "ioredis";

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/** Default limits per route type */
export const RATE_LIMITS = {
  /** Enrichment — costs TinyFish credits */
  enrich: { maxRequests: 10, windowSeconds: 60 },
  /** Script generation — costs Anthropic tokens */
  script: { maxRequests: 10, windowSeconds: 60 },
  /** Video render — costs HeyGen credits (expensive) */
  video: { maxRequests: 3, windowSeconds: 60 },
  /** Translation — costs HeyGen credits */
  translate: { maxRequests: 5, windowSeconds: 60 },
  /** Transcription — costs Speechmatics credits */
  transcribe: { maxRequests: 10, windowSeconds: 60 },
  /** Live avatar session — costs Anam credits */
  live: { maxRequests: 3, windowSeconds: 60 },
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds until reset
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const KEY_PREFIX = "nuncio:rate:";
const memoryStore = new Map<string, RateLimitEntry>();

function getRedisClient(): Redis | null {
  if (process.env.NUNCIO_RATE_LIMIT_STORE !== "redis") return null;

  try {
    const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    // Fire-and-forget connect — ioredis queues commands until ready.
    client.connect().catch(() => {});
    return client;
  } catch {
    return null;
  }
}

const redisClient = getRedisClient();

// Lua script atomically increments a counter, sets expiry on the first
// increment in the window, and returns the current count plus TTL.
const RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {current, ttl}
`;

async function checkRateLimitRedis(
  identifier: string,
  route: string,
  config: RateLimitConfig,
  client: Redis
): Promise<RateLimitResult | null> {
  try {
    const key = `${KEY_PREFIX}${route}:${identifier}`;
    const result = (await client.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      String(config.windowSeconds)
    )) as [number, number];

    const count = Number(result[0]);
    const ttl = Number(result[1]);

    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetIn: ttl > 0 ? ttl : config.windowSeconds,
    };
  } catch (error) {
    console.error("[rate-limit] Redis check failed, falling back to memory:", error);
    return null;
  }
}

function checkRateLimitMemory(
  identifier: string,
  route: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${route}:${identifier}`;
  const now = Date.now();
  const entry = memoryStore.get(key);

  // No existing entry or window expired — allow and start fresh
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowSeconds,
    };
  }

  // Within window — check count
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // Increment and allow
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Check if a request is allowed under the rate limit, using a specific
 * Redis client or falling back to in-memory when no client is provided.
 *
 * Prefer `checkRateLimit` in production code; this variant is exposed mainly
 * for testing.
 */
export async function checkRateLimitWithClient(
  identifier: string,
  route: string,
  config: RateLimitConfig,
  client?: Redis
): Promise<RateLimitResult> {
  if (client) {
    const redisResult = await checkRateLimitRedis(identifier, route, config, client);
    if (redisResult) return redisResult;
  }

  return checkRateLimitMemory(identifier, route, config);
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * Uses Redis when `NUNCIO_RATE_LIMIT_STORE=redis` is set; otherwise uses an
 * in-memory store. If Redis is enabled but unavailable, it falls back to the
 * in-memory store.
 */
export async function checkRateLimit(
  identifier: string,
  route: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimitWithClient(identifier, route, config, redisClient ?? undefined);
}

/**
 * Extract a client identifier from the request.
 * Uses X-Forwarded-For header (for proxied requests) or falls back to a default.
 */
export function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "anonymous";
}
