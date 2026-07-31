import { describe, it, expect, vi, afterEach } from "vitest";
import { resolvePublicOrigin, absoluteUrl } from "./url";

function mockRequest(
  url: string,
  headers: Record<string, string> = {},
): Request {
  const req = new Request(url);
  for (const [key, value] of Object.entries(headers)) {
    req.headers.set(key, value);
  }
  return req;
}

describe("resolvePublicOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns APP_URL when set (highest priority)", () => {
    vi.stubEnv("APP_URL", "https://nuncio.persidian.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    const req = mockRequest("http://localhost:3000", {
      "x-forwarded-host": "wrong.example.com",
    });
    expect(resolvePublicOrigin(req)).toBe("https://nuncio.persidian.com");
  });

  it("strips trailing slash from APP_URL", () => {
    vi.stubEnv("APP_URL", "https://nuncio.persidian.com/");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(resolvePublicOrigin()).toBe("https://nuncio.persidian.com");
  });

  it("falls back to NEXT_PUBLIC_APP_URL when APP_URL unset", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.nuncio.dev");
    expect(resolvePublicOrigin()).toBe("https://staging.nuncio.dev");
  });

  it("uses X-Forwarded-Host + X-Forwarded-Proto when no env var", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const req = mockRequest("http://localhost:3000", {
      "x-forwarded-host": "nuncio.persidian.com",
      "x-forwarded-proto": "https",
    });
    expect(resolvePublicOrigin(req)).toBe("https://nuncio.persidian.com");
  });

  it("defaults X-Forwarded-Proto to https when missing", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const req = mockRequest("http://localhost:3000", {
      "x-forwarded-host": "nuncio.persidian.com",
    });
    expect(resolvePublicOrigin(req)).toBe("https://nuncio.persidian.com");
  });

  it("takes first value from comma-separated forwarded headers", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const req = mockRequest("http://localhost:3000", {
      "x-forwarded-host": "nuncio.persidian.com, internal.proxy",
      "x-forwarded-proto": "https, http",
    });
    expect(resolvePublicOrigin(req)).toBe("https://nuncio.persidian.com");
  });

  it("falls back to localhost:3000 in dev with no env or headers", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(resolvePublicOrigin()).toBe("http://localhost:3000");
    expect(resolvePublicOrigin(mockRequest("http://localhost:3000"))).toBe(
      "http://localhost:3000",
    );
  });
});

describe("absoluteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds absolute URL from env var", () => {
    vi.stubEnv("APP_URL", "https://nuncio.persidian.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(absoluteUrl("/studio")).toBe(
      "https://nuncio.persidian.com/studio",
    );
  });

  it("builds absolute URL from forwarded headers", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const req = mockRequest("http://localhost:3000", {
      "x-forwarded-host": "nuncio.persidian.com",
      "x-forwarded-proto": "https",
    });
    expect(absoluteUrl("/api/auth/verify?token=abc", req)).toBe(
      "https://nuncio.persidian.com/api/auth/verify?token=abc",
    );
  });

  it("prepends slash if missing", () => {
    vi.stubEnv("APP_URL", "https://nuncio.persidian.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(absoluteUrl("studio")).toBe(
      "https://nuncio.persidian.com/studio",
    );
  });
});
