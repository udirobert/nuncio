import { describe, expect, it, vi, afterEach } from "vitest";
import { updatePendingIds, notifyNewCallRequest } from "./call-request-notifications";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("updatePendingIds", () => {
  it("establishes a baseline on the first load without fresh alerts", () => {
    const { seen, fresh } = updatePendingIds(null, [
      { id: "r1", status: "pending" },
      { id: "r2", status: "pending" },
    ]);
    expect(fresh).toEqual([]);
    expect(seen.has("r1")).toBe(true);
    expect(seen.has("r2")).toBe(true);
  });

  it("flags only genuinely new pending ids", () => {
    const { seen } = updatePendingIds(null, [{ id: "r1", status: "pending" }]);
    const next = updatePendingIds(seen, [
      { id: "r1", status: "pending" },
      { id: "r2", status: "pending" },
      { id: "r3", status: "accepted" },
    ]);
    expect(next.fresh).toEqual(["r2"]);
  });

  it("keeps a lifetime union so reappearing ids do not re-alert", () => {
    const first = updatePendingIds(null, [{ id: "r1", status: "pending" }]);
    const second = updatePendingIds(first.seen, [{ id: "r2", status: "pending" }]);
    expect(second.fresh).toEqual(["r2"]);
    const third = updatePendingIds(second.seen, [
      { id: "r1", status: "pending" },
      { id: "r2", status: "pending" },
    ]);
    expect(third.fresh).toEqual([]);
  });
});

describe("notifyNewCallRequest", () => {
  it("does nothing without granted permission", () => {
    const ctor = vi.fn();
    vi.stubGlobal("Notification", Object.assign(ctor, { permission: "granted" }));
    notifyNewCallRequest({ count: 1, tag: "t", permissionGranted: false });
    expect(ctor).not.toHaveBeenCalled();
  });

  it("constructs one generic notification per fresh batch", () => {
    const ctor = vi.fn().mockReturnValue({ onclick: null });
    vi.stubGlobal("Notification", Object.assign(ctor, { permission: "granted" }));
    notifyNewCallRequest({ count: 3, tag: "t", permissionGranted: true });
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith("New call request", expect.objectContaining({ tag: "t" }));
  });

  it("swallows a throwing Notification constructor", () => {
    const ctor = vi.fn(() => { throw new Error("denied"); });
    vi.stubGlobal("Notification", Object.assign(ctor, { permission: "granted" }));
    expect(() => notifyNewCallRequest({ count: 1, tag: "t", permissionGranted: true })).not.toThrow();
  });
});
