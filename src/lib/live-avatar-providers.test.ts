import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLiveAvatarAdapter,
  isLiveTwinReady,
  resolvePrimaryProvider,
  resolveStartAttempts,
} from "./live-avatar-providers";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubSynthesiaReady() {
  vi.stubEnv("LIVEKIT_URL", "wss://lk.example.com");
  vi.stubEnv("LIVEKIT_API_KEY", "key");
  vi.stubEnv("LIVEKIT_API_SECRET", "secret");
  vi.stubEnv("NUNCIO_SYNTHESIA_WORKER_ENABLED", "true");
  vi.stubEnv("NUNCIO_LIVE_WORKER_TOKEN", "worker-token");
  vi.stubEnv("SYNTHESIA_AVATAR_ID", "av_abc123");
  vi.stubEnv("ELEVENLABS_VOICE_ID", "voice123");
}

function stubAnamReady() {
  vi.stubEnv("ANAM_API_KEY", "anam-key");
  vi.stubEnv("ANAM_AVATAR_ID", "anam-avatar");
  vi.stubEnv("ANAM_VOICE_ID", "anam-voice");
}

const share = {};
const context = { workspace: null, share };

describe("live avatar provider registry", () => {
  it("resolves supported adapter ids and rejects unknown ones", () => {
    expect(getLiveAvatarAdapter("synthesia")?.id).toBe("synthesia");
    expect(getLiveAvatarAdapter("anam")?.transport).toBe("anam-sdk");
    expect(getLiveAvatarAdapter("tavus")).toBeNull();
  });

  it("never resolves inherited prototype properties as adapters", () => {
    expect(getLiveAvatarAdapter("constructor")).toBeNull();
    expect(getLiveAvatarAdapter("hasOwnProperty")).toBeNull();
    expect(getLiveAvatarAdapter("__proto__")).toBeNull();
    expect(getLiveAvatarAdapter("toString")).toBeNull();
  });

  it("defaults to synthesia primary and fails closed on unknown env values", () => {
    expect(resolvePrimaryProvider()?.id).toBe("synthesia");
    vi.stubEnv("NUNCIO_LIVE_PRIMARY_PROVIDER", "anam");
    expect(resolvePrimaryProvider()?.id).toBe("anam");
    vi.stubEnv("NUNCIO_LIVE_PRIMARY_PROVIDER", "tavus");
    expect(resolvePrimaryProvider()).toBeNull();
  });

  it("synthesia primary falls back to anam; anam primary tries only anam", () => {
    stubSynthesiaReady();
    stubAnamReady();
    expect(resolveStartAttempts(resolvePrimaryProvider()!, context).map((a) => a.adapter.id)).toEqual(["synthesia", "anam"]);
    vi.stubEnv("NUNCIO_LIVE_PRIMARY_PROVIDER", "anam");
    expect(resolveStartAttempts(resolvePrimaryProvider()!, context).map((a) => a.adapter.id)).toEqual(["anam"]);
  });

  it("synthesia unready still allows anam when anam is ready", () => {
    stubAnamReady();
    expect(resolveStartAttempts(resolvePrimaryProvider()!, context).map((a) => a.adapter.id)).toEqual(["anam"]);
  });

  it("nothing ready produces no attempts and twin is not ready", () => {
    expect(resolveStartAttempts(resolvePrimaryProvider()!, context)).toHaveLength(0);
    expect(isLiveTwinReady(context)).toBe(false);
  });

  it("twin readiness parity: same inputs gate handoff options and session start", () => {
    stubSynthesiaReady();
    expect(isLiveTwinReady(context)).toBe(true);
    vi.stubEnv("NUNCIO_SYNTHESIA_WORKER_ENABLED", "false");
    expect(isLiveTwinReady(context)).toBe(false);
  });

  it("anam readiness requires an API key plus avatar and voice ids", () => {
    stubAnamReady();
    vi.stubEnv("NUNCIO_LIVE_PRIMARY_PROVIDER", "anam");
    expect(isLiveTwinReady(context)).toBe(true);
    vi.stubEnv("ANAM_AVATAR_ID", "");
    vi.stubEnv("ANAM_VOICE_ID", "anam-voice");
    expect(isLiveTwinReady(context)).toBe(false);
  });
});
