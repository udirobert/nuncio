import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { TursoSchedulingStorageProvider } from "./turso-scheduling-provider";
import type { SchedulingRecord } from "./types";
import type { SchedulingProviderEvent } from "@/lib/scheduling-server";

let dir: string | undefined;
let client: Client | undefined;

afterEach(async () => {
  client?.close();
  client = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function makeProvider() {
  dir = await mkdtemp(path.join(os.tmpdir(), "nuncio-sched-turso-"));
  client = createClient({ url: `file:${path.join(dir, "test.db")}` });
  return new TursoSchedulingStorageProvider(client);
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

describe("TursoSchedulingStorageProvider", () => {
  it("creates schema, stores, applies events, and lists by workspace", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    await provider.create(makeRecord({ id: "ctx-2", workspaceId: "ws-2" }));
    expect((await provider.get("ctx-1"))?.status).toBe("started");
    const updated = await provider.applyProviderEvent("ctx-1", event());
    expect(updated).toMatchObject({ status: "confirmed", version: 1 });
    const ws1 = await provider.listByWorkspace("ws-1");
    expect(ws1).toHaveLength(1);
    expect(ws1[0].id).toBe("ctx-1");
  });

  it("concurrent same-event applications keep version monotonic via CAS", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    const results = await Promise.all([
      provider.applyProviderEvent("ctx-1", event()),
      provider.applyProviderEvent("ctx-1", event()),
    ]);
    expect(results[0]?.status).toBe("confirmed");
    expect(results[1]?.status).toBe("confirmed");
    const final = await provider.get("ctx-1");
    expect(final?.version).toBe(1);
  });

  it("applies requested then confirmed then ignores out-of-order", async () => {
    const provider = await makeProvider();
    await provider.create(makeRecord());
    await provider.applyProviderEvent("ctx-1", event({ status: "requested", eventType: "BOOKING_REQUESTED", eventAt: "2026-01-02T00:00:00.000Z" }));
    await provider.applyProviderEvent("ctx-1", event({ status: "confirmed", eventAt: "2026-01-02T01:00:00.000Z" }));
    const stale = await provider.applyProviderEvent("ctx-1", event({ status: "requested", eventAt: "2026-01-02T00:30:00.000Z" }));
    expect(stale?.status).toBe("confirmed");
  });
});
