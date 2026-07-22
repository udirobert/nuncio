import { describe, it, expect, vi, afterEach } from "vitest";
import type Redis from "ioredis";
import {
  checkRateLimitWithClient,
  getClientId,
  RateLimitConfig,
} from "./rate-limit";

function mockRequest(headers: Record<string, string>): Request {
  const req = new Request("http://localhost:3000");
  for (const [key, value] of Object.entries(headers)) {
    req.headers.set(key, value);
  }
  return req;
}

/** Minimal fake Redis that replicates the INCR/EXPIRE/TTL contract. */
class MockRedis {
  private data = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly throwOnEval = false) {}

  async eval(
    _script: string,
    _numKeys: number,
    key: string,
    windowSeconds: string
  ): Promise<[number, number]> {
    if (this.throwOnEval) {
      throw new Error("Redis unavailable");
    }

    const now = Date.now();
    const windowMs = Number(windowSeconds) * 1000;
    const existing = this.data.get(key);

    let count: number;
    let expiresAt: number;
    if (!existing || now > existing.expiresAt) {
      count = 1;
      expiresAt = now + windowMs;
    } else {
      count = existing.count + 1;
      expiresAt = existing.expiresAt;
    }

    this.data.set(key, { count, expiresAt });
    const ttl = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    return [count, ttl];
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }
}

const testConfig: RateLimitConfig = { maxRequests: 3, windowSeconds: 60 };

describe("getClientId", () => {
  it("prefers x-forwarded-for", () => {
    const req = mockRequest({
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      "x-real-ip": "9.10.11.12",
    });
    expect(getClientId(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = mockRequest({ "x-real-ip": "9.10.11.12" });
    expect(getClientId(req)).toBe("9.10.11.12");
  });

  it("returns anonymous when no headers are present", () => {
    const req = mockRequest({});
    expect(getClientId(req)).toBe("anonymous");
  });
});

describe("in-memory rate limiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and reports remaining", async () => {
    const result = await checkRateLimitWithClient(
      "client-1",
      "test",
      testConfig,
      undefined
    );
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetIn).toBe(60);
  });

  it("blocks after the limit is exceeded", async () => {
    const id = `client-${crypto.randomUUID()}`;

    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimitWithClient(id, "test", testConfig, undefined);
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkRateLimitWithClient(id, "test", testConfig, undefined);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window expires", async () => {
    vi.useFakeTimers();
    const id = `client-${crypto.randomUUID()}`;
    const shortWindow: RateLimitConfig = { maxRequests: 1, windowSeconds: 1 };

    const first = await checkRateLimitWithClient(id, "test", shortWindow, undefined);
    expect(first.allowed).toBe(true);

    const second = await checkRateLimitWithClient(id, "test", shortWindow, undefined);
    expect(second.allowed).toBe(false);

    vi.advanceTimersByTime(1100);

    const third = await checkRateLimitWithClient(id, "test", shortWindow, undefined);
    expect(third.allowed).toBe(true);
  });
});

describe("Redis-backed rate limiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and reports remaining", async () => {
    const client = new MockRedis();
    const result = await checkRateLimitWithClient(
      "redis-client-1",
      "test",
      testConfig,
      client as unknown as Redis
    );
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetIn).toBe(60);
  });

  it("blocks after the limit is exceeded", async () => {
    const client = new MockRedis();
    const id = `redis-client-${crypto.randomUUID()}`;

    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimitWithClient(id, "test", testConfig, client as unknown as Redis);
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkRateLimitWithClient(id, "test", testConfig, client as unknown as Redis);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the Redis window expires", async () => {
    vi.useFakeTimers();
    const client = new MockRedis();
    const id = `redis-client-${crypto.randomUUID()}`;
    const shortWindow: RateLimitConfig = { maxRequests: 1, windowSeconds: 1 };

    const first = await checkRateLimitWithClient(id, "test", shortWindow, client as unknown as Redis);
    expect(first.allowed).toBe(true);
    expect(first.resetIn).toBe(1);

    const second = await checkRateLimitWithClient(id, "test", shortWindow, client as unknown as Redis);
    expect(second.allowed).toBe(false);

    vi.advanceTimersByTime(1100);

    const third = await checkRateLimitWithClient(id, "test", shortWindow, client as unknown as Redis);
    expect(third.allowed).toBe(true);
    expect(third.resetIn).toBe(1);
  });

  it("falls back to in-memory when Redis throws", async () => {
    const client = new MockRedis(true);
    const id = `redis-client-${crypto.randomUUID()}`;

    const result = await checkRateLimitWithClient(id, "test", testConfig, client as unknown as Redis);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});

describe("production checkRateLimit", () => {
  const originalEnv = process.env.NUNCIO_RATE_LIMIT_STORE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NUNCIO_RATE_LIMIT_STORE;
    } else {
      process.env.NUNCIO_RATE_LIMIT_STORE = originalEnv;
    }
    vi.doUnmock("ioredis");
  });

  it("uses Redis when NUNCIO_RATE_LIMIT_STORE=redis is set", async () => {
    vi.doMock("ioredis", () => ({
      default: class {
        eval = vi.fn().mockResolvedValue([1, 42]);
        connect = vi.fn().mockResolvedValue(undefined);
      },
    }));

    process.env.NUNCIO_RATE_LIMIT_STORE = "redis";
    // The file imports `ioredis` at the top, so we must reset modules before
    // re-importing so that rate-limit.ts re-evaluates and creates the Redis client.
    vi.resetModules();
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit("production-client", "test", testConfig);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetIn).toBe(42);
  });
});
