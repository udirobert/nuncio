import { afterEach, describe, expect, it, vi } from "vitest";
import { isLiveLinkEnabled, LIVE_SESSION_MAX_DURATION_MS } from "./live-link";

describe("LiveLink configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled unless explicitly enabled", () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "false");
    expect(isLiveLinkEnabled()).toBe(false);

    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "");
    expect(isLiveLinkEnabled()).toBe(false);
  });

  it("enables the experiment only for the literal true value", () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    expect(isLiveLinkEnabled()).toBe(true);

    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "TRUE");
    expect(isLiveLinkEnabled()).toBe(false);
  });

  it("keeps the pilot session cap at five minutes", () => {
    expect(LIVE_SESSION_MAX_DURATION_MS).toBe(5 * 60 * 1000);
  });
});
