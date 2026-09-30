import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const replaceStateMock = vi.fn();
const windowState = {
  location: { hash: "", pathname: "/live/s1", search: "" },
  history: { replaceState: replaceStateMock },
};

vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("window", windowState);

async function load() {
  vi.resetModules();
  return import("@/lib/live-handoff-client");
}

beforeEach(() => {
  windowState.location.hash = "#handoff=tok123";
  replaceStateMock.mockImplementation(() => {
    windowState.location.hash = "";
  });
  fetchMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("prepareHandoffAccess", () => {
  it("strips the fragment before decoding or fetching", async () => {
    const { prepareHandoffAccess } = await load();
    await prepareHandoffAccess("s1");
    expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/live/s1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/live/handoffs/s1/access");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(init.body)).toEqual({ token: "tok123" });
    expect(url).not.toContain("tok123");
  });

  it("does nothing when no handoff fragment is present", async () => {
    windowState.location.hash = "#other";
    const { prepareHandoffAccess } = await load();
    await prepareHandoffAccess("s1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the fragment cannot be stripped", async () => {
    replaceStateMock.mockImplementation(() => {
      throw new Error("denied");
    });
    const { prepareHandoffAccess } = await load();
    await expect(prepareHandoffAccess("s1")).rejects.toThrow("Invitation could not be activated");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails sanitized on malformed, oversized, or empty tokens — fragment stripped, no fetch, no token in errors", async () => {
    for (const hash of ["#handoff=%E0%A4%A", "#handoff=" + "x".repeat(300), "#handoff="]) {
      windowState.location.hash = hash;
      const { prepareHandoffAccess } = await load();
      let thrown: unknown;
      try {
        await prepareHandoffAccess("s1");
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe("Invitation could not be activated");
      expect(windowState.location.hash).toBe("");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(String(thrown)).not.toContain("x".repeat(300));
      vi.clearAllMocks();
    }
  });

  it("throws a generic error on non-OK and network failures without leaking the token", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { prepareHandoffAccess } = await load();
    await expect(prepareHandoffAccess("s1")).rejects.toThrow("Invitation could not be activated");

    windowState.location.hash = "#handoff=tok123";
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(prepareHandoffAccess("s1")).rejects.toThrow("Invitation could not be activated");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain("tok123");
    }
  });

  it("dedupes simultaneous calls per share", async () => {
    let release!: (value: { ok: boolean }) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const { prepareHandoffAccess } = await load();
    const first = prepareHandoffAccess("s1");
    const second = prepareHandoffAccess("s1");
    expect(second).toBe(first);
    release({ ok: true });
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
