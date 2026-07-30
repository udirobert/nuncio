import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("genblaze-client", () => {
  beforeEach(() => {
    vi.stubGlobal("console", { log: vi.fn(), warn: vi.fn(), error: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadClient() {
    return import("./genblaze-client");
  }

  it("reports not configured when GENBLAZE_WORKER_URL is unset", async () => {
    vi.stubEnv("GENBLAZE_WORKER_URL", "");
    const { isGenblazeWorkerConfigured } = await loadClient();
    expect(isGenblazeWorkerConfigured()).toBe(false);
  });

  it("reports configured when GENBLAZE_WORKER_URL is set", async () => {
    vi.stubEnv("GENBLAZE_WORKER_URL", "http://localhost:8100");
    const { isGenblazeWorkerConfigured } = await loadClient();
    expect(isGenblazeWorkerConfigured()).toBe(true);
  });

  it("returns null from genblazeTts when worker is unconfigured", async () => {
    vi.stubEnv("GENBLAZE_WORKER_URL", "");
    const { genblazeTts } = await loadClient();
    const result = await genblazeTts("hello", "share-1");
    expect(result).toBeNull();
  });

  it("returns null from genblazeSoundscape when worker is unconfigured", async () => {
    vi.stubEnv("GENBLAZE_WORKER_URL", "");
    const { genblazeSoundscape } = await loadClient();
    const result = await genblazeSoundscape("ambient office", "share-1");
    expect(result).toBeNull();
  });

  it("returns null from genblazeThumbnail when worker is unconfigured", async () => {
    vi.stubEnv("GENBLAZE_WORKER_URL", "");
    const { genblazeThumbnail } = await loadClient();
    const result = await genblazeThumbnail("thumbnail prompt", "share-1");
    expect(result).toBeNull();
  });

  it("calls worker endpoint and returns result on success", async () => {
    vi.stubEnv("GENBLAZE_WORKER_URL", "http://localhost:8100");
    const mockResult = {
      asset: { url: "https://b2.example.com/tts.mp3", sha256: "abc123", content_type: "audio/mpeg", manifest_uri: "ipfs://manifest" },
      provider: "genblaze",
      pipeline: "nuncio-tts",
      elapsed_ms: 450,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResult), { status: 200 })
    );

    const { genblazeTts } = await loadClient();
    const result = await genblazeTts("hello world", "share-42", "voice-id");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:8100/generate",
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toEqual(mockResult);
    fetchSpy.mockRestore();
  });

  it("returns null gracefully when worker is unreachable", async () => {
    vi.stubEnv("GENBLAZE_WORKER_URL", "http://localhost:9999");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const { genblazeTts } = await loadClient();
    const result = await genblazeTts("hello", "share-1");
    expect(result).toBeNull();
  });
});
