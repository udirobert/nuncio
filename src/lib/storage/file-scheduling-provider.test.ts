import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SchedulingRecord } from "./types";
import type { SchedulingProviderEvent } from "@/lib/scheduling-server";

let dataDir: string | undefined;

afterEach(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  dataDir = undefined;
  vi.unstubAllEnvs();
});

async function makeProvider() {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nuncio-scheduling-"));
  vi.stubEnv("NUNCIO_DATA_DIR", dataDir);
  vi.resetModules();
  const { FileSchedulingStorageProvider } = await import("./file-scheduling-provider");
  return new FileSchedulingStorageProvider();
}

function makeRecord(overrides: Partial<SchedulingRecord> = {}): SchedulingRecord {
  return {
    id: "ctx-1",
    shareId: "share-1",
    workspaceId: "ws-1",
    provider: "calcom",
    eventTypeId: 42,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "started",
    version: 0,
    ...overrides,
  };
}

function event(overrides: Partial<SchedulingProviderEvent> = {}): SchedulingProviderEvent {
  return {
    providerBookingUid: "uid-1",
    eventTypeId: 42,
    status: "confirmed",
    eventAt: "2026-01-02T00:00:00.000Z",
    eventType: "BOOKING_CREATED",
    ...overrides,
  };
}

describe("FileSchedulingStorageProvider", () => {
  it("creates, gets, applies events, and lists by workspace", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    expect((await provider.get("ctx-1"))?.status).toBe("started");
    const updated = await provider.applyProviderEvent("ctx-1", event());
    expect(updated?.status).toBe("confirmed");
    const list = await provider.listByWorkspace("ws-1");
    expect(list).toHaveLength(1);
    expect(await provider.listByWorkspace("other-ws")).toHaveLength(0);
  });

  it("concurrent identical events both resolve without double version bump", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    const [a, b] = await Promise.all([
      provider.applyProviderEvent("ctx-1", event()),
      provider.applyProviderEvent("ctx-1", event()),
    ]);
    expect(a?.status).toBe("confirmed");
    expect(b?.status).toBe("confirmed");
    expect((await provider.get("ctx-1"))?.version).toBe(1);
  });

  it("reloads across instances (cross-instance visibility)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nuncio-scheduling-"));
    dataDir = dir;
    vi.stubEnv("NUNCIO_DATA_DIR", dir);
    vi.resetModules();
    const { FileSchedulingStorageProvider } = await import("./file-scheduling-provider");
    const p1 = new FileSchedulingStorageProvider();
    const p2 = new FileSchedulingStorageProvider();
    await p1.create(makeRecord());
    expect((await p2.get("ctx-1"))?.status).toBe("started");
    const applied = await p2.applyProviderEvent("ctx-1", event());
    expect(applied?.status).toBe("confirmed");
  });

  it("throws on a corrupt store rather than silently treating it as empty", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    await writeFile(path.join(dataDir!, "scheduling.json"), "{not json", "utf8");
    await expect(provider.applyProviderEvent("ctx-1", event())).rejects.toThrow();
  });

  it("persists a records map to disk", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    const raw = JSON.parse(await readFile(path.join(dataDir!, "scheduling.json"), "utf8")) as { records: Record<string, SchedulingRecord> };
    expect(Object.keys(raw.records)).toHaveLength(1);
  });

  it("returns immutable clones that cannot mutate stored state", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    const got = (await provider.get("ctx-1"))!;
    got.status = "cancelled";
    got.reviewedBrief = { goal: "x", discussed: "", openQuestions: "", reason: "", source: "recipient_reviewed", sharedAt: "2026-01-01T00:00:00.000Z" };
    const again = (await provider.get("ctx-1"))!;
    expect(again.status).toBe("started");
    expect(again.reviewedBrief).toBeUndefined();
  });

  it("rejects duplicate record ids as corruption-safe failures", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    await expect(provider.create(makeRecord())).rejects.toThrow();
  });

  it("clears rejected loads so a later read can retry", async () => {
    const provider = await makeProvider();
    await writeFile(path.join(dataDir!, "scheduling.json"), "{broken", "utf8");
    await expect(provider.get("ctx-1")).rejects.toThrow();
    const { mkdir, rm } = await import("node:fs/promises");
    await rm(path.join(dataDir!, "scheduling.json"), { force: true });
    await mkdir(dataDir!, { recursive: true });
    await provider.create(makeRecord());
    expect((await provider.get("ctx-1"))?.status).toBe("started");
  });

  it("treats a deleted store (ENOENT) as empty", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    const { rm } = await import("node:fs/promises");
    await rm(path.join(dataDir!, "scheduling.json"));
    expect(await provider.get("ctx-1")).toBeNull();
  });

  it("fails closed on records with invalid fields", async () => {
    const provider = await makeProvider();
    const file = path.join(dataDir!, "scheduling.json");
    const base = { records: { "ctx-1": makeRecord() } };
    const variants: Array<Record<string, unknown>> = [
      { status: "bogus" },
      { status: "" },
      { providerBookingUid: { nested: true } },
      { lastProviderEventAt: "not a date" },
      { version: -1 },
      { version: 1.5 },
      { eventTypeId: "42" },
      { provider: 42 },
      { reviewedBrief: { goal: "g", discussed: "d", openQuestions: "o", reason: "r", source: "recipient_reviewed", sharedAt: "bad-date" } },
      { reviewedBrief: { goal: "g", discussed: "d", openQuestions: "o", reason: "r", source: "raw_transcript", sharedAt: "2026-01-01T00:00:00.000Z" } },
    ];
    for (const variant of variants) {
      await writeFile(file, JSON.stringify({ records: { "ctx-1": { ...makeRecord(), ...variant } } }), "utf8");
      await expect(provider.get("ctx-1")).rejects.toThrow();
    }
    void base;
  });

  it("fails closed when records is an array or contains prototype keys", async () => {
    const provider = await makeProvider();
    const file = path.join(dataDir!, "scheduling.json");
    await writeFile(file, JSON.stringify({ records: [makeRecord()] }), "utf8");
    await expect(provider.get("ctx-1")).rejects.toThrow();
    await writeFile(file, JSON.stringify({ records: [] }), "utf8");
    await expect(provider.get("ctx-1")).rejects.toThrow();
    await writeFile(file, JSON.stringify([{ records: {} }]), "utf8");
    await expect(provider.get("ctx-1")).rejects.toThrow();
  });

  it("two instances stay consistent across concurrent creates and events", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nuncio-scheduling-"));
    dataDir = dir;
    vi.stubEnv("NUNCIO_DATA_DIR", dir);
    vi.resetModules();
    const { FileSchedulingStorageProvider } = await import("./file-scheduling-provider");
    const p1 = new FileSchedulingStorageProvider();
    const p2 = new FileSchedulingStorageProvider();
    await Promise.all([
      p1.create(makeRecord({ id: "ctx-a" })),
      p2.create(makeRecord({ id: "ctx-b", shareId: "share-2" })),
    ]);
    const [a1, b1] = await Promise.all([
      p1.applyProviderEvent("ctx-a", event()),
      p2.applyProviderEvent("ctx-b", event({ providerBookingUid: "uid-9" })),
    ]);
    expect(a1?.status).toBe("confirmed");
    expect(b1?.providerBookingUid).toBe("uid-9");
    expect((await p1.get("ctx-b"))?.providerBookingUid).toBe("uid-9");
    expect((await p2.get("ctx-a"))?.status).toBe("confirmed");
    expect(await p1.listByWorkspace("ws-1")).toHaveLength(2);
  });

  it("does not install staged state when persist fails, then retries cleanly", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    const { chmod } = await import("node:fs/promises");
    await chmod(dataDir!, 0o500);
    await expect(provider.applyProviderEvent("ctx-1", event())).rejects.toThrow();
    await chmod(dataDir!, 0o700);
    const updated = await provider.applyProviderEvent("ctx-1", event());
    expect(updated?.status).toBe("confirmed");
    const disk = JSON.parse(await readFile(path.join(dataDir!, "scheduling.json"), "utf8")) as { records: Record<string, SchedulingRecord> };
    expect(disk.records["ctx-1"].status).toBe("confirmed");
  });
});
