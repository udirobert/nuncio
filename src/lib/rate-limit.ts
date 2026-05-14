/**
 * Simple in-memory rate limiter.
 * Prevents abuse of API routes that consume external credits.
 *
 * Uses a sliding window approach per IP address.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

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
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds until reset
}

/**
 * Check if a request is allowed under the rate limit.
 */
export function checkRateLimit(
  identifier: string,
  route: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${route}:${identifier}`;
  const now = Date.now();
  const entry = store.get(key);

  // No existing entry or window expired — allow and start fresh
  if (!entry || now > entry.resetAt) {
    store.set(key, {
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
