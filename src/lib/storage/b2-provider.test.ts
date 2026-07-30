import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isB2Configured } from "./b2-provider";
import { getMediaStorageProvider, resetStorageProvidersForTests } from "./index";

describe("B2 storage provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubGlobal("console", { log: vi.fn(), warn: vi.fn(), error: vi.fn() });
    resetStorageProvidersForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetStorageProvidersForTests();
  });

  it("reports not configured when env vars are missing", () => {
    vi.stubEnv("B2_KEY_ID", "");
    vi.stubEnv("B2_APPLICATION_KEY", "");
    vi.stubEnv("B2_ENDPOINT", "");
    vi.stubEnv("B2_BUCKET_NAME", "");
    expect(isB2Configured()).toBe(false);
  });

  it("reports configured when all env vars are present", () => {
    vi.stubEnv("B2_KEY_ID", "test-key");
    vi.stubEnv("B2_APPLICATION_KEY", "test-secret");
    vi.stubEnv("B2_ENDPOINT", "https://s3.us-west-004.backblazeb2.com");
    vi.stubEnv("B2_BUCKET_NAME", "test-bucket");
    expect(isB2Configured()).toBe(true);
  });

  it("returns null from getMediaStorageProvider when unconfigured", () => {
    vi.stubEnv("B2_KEY_ID", "");
    vi.stubEnv("B2_APPLICATION_KEY", "");
    vi.stubEnv("B2_ENDPOINT", "");
    vi.stubEnv("B2_BUCKET_NAME", "");
    expect(getMediaStorageProvider()).toBeNull();
  });

  it("returns B2 provider when configured", () => {
    vi.stubEnv("B2_KEY_ID", "test-key");
    vi.stubEnv("B2_APPLICATION_KEY", "test-secret");
    vi.stubEnv("B2_ENDPOINT", "https://s3.us-west-004.backblazeb2.com");
    vi.stubEnv("B2_BUCKET_NAME", "test-bucket");
    const provider = getMediaStorageProvider();
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe("b2");
  });

  it("constructs correct public URL", () => {
    vi.stubEnv("B2_KEY_ID", "test-key");
    vi.stubEnv("B2_APPLICATION_KEY", "test-secret");
    vi.stubEnv("B2_ENDPOINT", "https://s3.us-west-004.backblazeb2.com");
    vi.stubEnv("B2_BUCKET_NAME", "nuncio-media");
    vi.stubEnv("B2_PUBLIC_URL", "");
    const provider = getMediaStorageProvider()!;
    expect(provider.getPublicUrl("videos/abc/video.mp4")).toBe(
      "https://s3.us-west-004.backblazeb2.com/nuncio-media/videos/abc/video.mp4"
    );
  });

  it("uses B2_PUBLIC_URL override when set", () => {
    vi.stubEnv("B2_KEY_ID", "test-key");
    vi.stubEnv("B2_APPLICATION_KEY", "test-secret");
    vi.stubEnv("B2_ENDPOINT", "https://s3.us-west-004.backblazeb2.com");
    vi.stubEnv("B2_BUCKET_NAME", "nuncio-media");
    vi.stubEnv("B2_PUBLIC_URL", "https://cdn.nuncio.app/");
    const provider = getMediaStorageProvider()!;
    expect(provider.getPublicUrl("audio/x/sfx.mp3")).toBe(
      "https://cdn.nuncio.app/audio/x/sfx.mp3"
    );
  });
});
