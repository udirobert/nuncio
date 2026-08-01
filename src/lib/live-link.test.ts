import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateLiveSessionCharge,
  isLiveLinkAllowed,
  isLiveLinkEnabled,
  LIVE_SESSION_MAX_CREDITS,
  LIVE_SESSION_MAX_DURATION_MS,
} from "./live-link";

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
    vi.stubEnv("NUNCIO_LIVELINK_WORKSPACE_IDS", "ws-1");
    expect(isLiveLinkEnabled()).toBe(true);

    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "TRUE");
    expect(isLiveLinkEnabled()).toBe(false);
  });

  it("fails closed until a workspace or sender is explicitly allowlisted", () => {
    vi.stubEnv("NUNCIO_LIVELINK_ENABLED", "true");
    expect(isLiveLinkAllowed({ workspaceId: "ws-1" })).toBe(false);

    vi.stubEnv("NUNCIO_LIVELINK_WORKSPACE_IDS", "ws-1, ws-2");
    expect(isLiveLinkAllowed({ workspaceId: "WS-1" })).toBe(true);
    expect(isLiveLinkAllowed({ workspaceId: "ws-other" })).toBe(false);

    vi.stubEnv("NUNCIO_LIVELINK_WORKSPACE_IDS", "");
    vi.stubEnv("NUNCIO_LIVELINK_SENDER_EMAILS", "pilot@example.com");
    expect(isLiveLinkAllowed({ senderEmail: "PILOT@example.com" })).toBe(true);
    expect(isLiveLinkAllowed({ senderEmail: "other@example.com" })).toBe(false);
  });

  it("keeps the pilot session cap at five minutes", () => {
    expect(LIVE_SESSION_MAX_DURATION_MS).toBe(5 * 60 * 1000);
    expect(LIVE_SESSION_MAX_CREDITS).toBe(5);
  });
});

describe("calculateLiveSessionCharge", () => {
  it("charges whole minutes and caps at the pilot maximum", () => {
    expect(calculateLiveSessionCharge(0)).toBe(0);
    expect(calculateLiveSessionCharge(1)).toBe(1);
    expect(calculateLiveSessionCharge(60_000)).toBe(1);
    expect(calculateLiveSessionCharge(60_001)).toBe(2);
    expect(calculateLiveSessionCharge(30 * 60_000)).toBe(LIVE_SESSION_MAX_CREDITS);
  });
});
