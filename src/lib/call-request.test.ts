import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallRequestRecord } from "@/lib/storage/types";
import { CALL_REQUEST_ACCEPTED_TTL_MS, CALL_REQUEST_PENDING_TTL_MS } from "@/lib/call-request";

function buildRecord(overrides: Partial<CallRequestRecord> = {}): CallRequestRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: `cr-${Math.random().toString(36).slice(2, 10)}`,
    shareId: "share-1",
    workspaceId: "ws-1",
    recipientTokenHash: "hash",
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CALL_REQUEST_PENDING_TTL_MS).toISOString(),
    ...overrides,
  };
}

describe("Call request storage (file provider)", () => {
  let dataDir: string;
  let provider: import("@/lib/storage/types").CallRequestStorageProvider;

  beforeEach(async () => {
    dataDir = mkdtempSync(path.join(tmpdir(), "nuncio-cr-"));
    vi.stubEnv("NUNCIO_DATA_DIR", dataDir);
    vi.resetModules();
    const mod = await import("@/lib/storage/file-call-request-provider");
    provider = new mod.FileCallRequestStorageProvider();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("admits one open request per share and rejects concurrent duplicates", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const a = await provider.createIfNoOpen(buildRecord(), now);
    const b = await provider.createIfNoOpen(buildRecord(), now);
    expect(a).not.toBeNull();
    expect(b).toBeNull();
  });

  it("admits a new request once the previous one is expired", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expired = buildRecord({
      expiresAt: new Date(now.getTime() - 1).toISOString(),
    });
    await provider.createIfNoOpen(expired, new Date(now.getTime() - CALL_REQUEST_PENDING_TTL_MS - 10));
    const fresh = await provider.createIfNoOpen(buildRecord(), now);
    expect(fresh).not.toBeNull();
  });

  it("allows exactly one pending->accepted CAS to win", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const record = await provider.createIfNoOpen(buildRecord(), now);
    const accepted = { ...record!, status: "accepted" as const, acceptedAt: now.toISOString(), expiresAt: new Date(now.getTime() + CALL_REQUEST_ACCEPTED_TTL_MS).toISOString() };
    const first = await provider.transition(record!.id, ["pending"], accepted);
    const second = await provider.transition(record!.id, ["pending"], accepted);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("does not transition an expired request", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const record = await provider.createIfNoOpen(buildRecord(), now);
    const later = new Date(now.getTime() + CALL_REQUEST_PENDING_TTL_MS + 1000);
    const accepted = { ...record!, status: "accepted" as const, acceptedAt: later.toISOString() };
    const result = await provider.transition(record!.id, ["pending"], accepted, later);
    expect(result).toBeNull();
  });

  it("lists workspace records without token hashes", async () => {
    const now = new Date();
    await provider.createIfNoOpen(buildRecord(), now);
    const list = await provider.listByWorkspace("ws-1");
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("recipientTokenHash");
    expect(list[0].workspaceId).toBe("ws-1");
  });
});

describe("Call request storage (libsql provider)", () => {
  let dbFile: string;
  let provider: import("@/lib/storage/types").CallRequestStorageProvider;

  beforeEach(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "nuncio-cr-turso-"));
    dbFile = path.join(dir, "test.db");
    vi.stubEnv("TURSO_DATABASE_URL", `file:${dbFile}`);
    vi.resetModules();
    const mod = await import("@/lib/storage/turso-call-request-provider");
    provider = new mod.TursoCallRequestStorageProvider();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("admits exactly one open request under concurrent insert", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const [a, b] = await Promise.all([
      provider.createIfNoOpen(buildRecord(), now),
      provider.createIfNoOpen(buildRecord(), now),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("CAS accepts only once", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const record = await provider.createIfNoOpen(buildRecord(), now);
    const accepted = { ...record!, status: "accepted" as const, acceptedAt: now.toISOString(), expiresAt: new Date(now.getTime() + CALL_REQUEST_ACCEPTED_TTL_MS).toISOString() };
    const [first, second] = await Promise.all([
      provider.transition(record!.id, ["pending"], accepted, now),
      provider.transition(record!.id, ["pending"], accepted, now),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });
});
