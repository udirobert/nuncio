import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Batch } from "@/lib/batch/types";

const batchStore = vi.hoisted(() => ({
  records: new Map<string, Batch>(),
  list: vi.fn(async () => Array.from(batchStore.records.values())),
  get: vi.fn(async (id: string) => batchStore.records.get(id) || null),
  update: vi.fn(async (record: Batch) => {
    batchStore.records.set(record.id, record);
  }),
  delete: vi.fn(async (id: string) => {
    batchStore.records.delete(id);
  }),
  create: vi.fn(async (batch: Batch) => {
    batchStore.records.set(batch.id, batch);
  }),
}));

const sessionState = vi.hoisted(() => ({
  session: null as { userId: string; workspaceId: string; email: string } | null,
}));

vi.mock("@/lib/storage", () => ({
  getBatchStorageProvider: vi.fn(() => batchStore),
}));

vi.mock("@/lib/batch/processor", () => ({
  processBatch: vi.fn(async () => {}),
}));

vi.mock("@/lib/auth/session", () => ({
  readAccountSession: vi.fn(() => sessionState.session),
}));

import { GET as listBatches, POST as createBatch } from "./route";
import { GET as getBatch, DELETE as deleteBatch } from "./[id]/route";

const ALICE_BATCH: Batch = {
  id: "batch-alice",
  name: "Ops leads",
  senderBrief: "We help ops teams map handoffs",
  senderName: "Alex",
  creatorEmail: "alice@example.com",
  workspaceId: "ws-alice",
  webhookUrl: "https://internal.example.com/hook",
  jobs: [{ id: "j1", url: "https://linkedin.com/in/maya", status: "queued" }],
  status: "queued",
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  completedCount: 0,
  failedCount: 0,
};

function get() {
  return new NextRequest("https://nuncio.test/api/batch", { method: "GET" });
}

function getOne(id: string) {
  return new NextRequest(`https://nuncio.test/api/batch/${id}`, { method: "GET" });
}

function del(id: string) {
  return new NextRequest(`https://nuncio.test/api/batch/${id}`, { method: "DELETE" });
}

describe("batch API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchStore.records.clear();
    batchStore.records.set(ALICE_BATCH.id, { ...ALICE_BATCH });
    sessionState.session = null;
  });

  it("refuses to list batches without a session", async () => {
    const res = await listBatches(get());
    expect(res.status).toBe(401);
  });

  it("lists only the caller's own batches", async () => {
    sessionState.session = { userId: "u-alice", workspaceId: "ws-alice", email: "alice@example.com" };
    const res = await listBatches(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("batch-alice");
  });

  it("never returns another workspace's batch", async () => {
    sessionState.session = { userId: "u-bob", workspaceId: "ws-bob", email: "bob@example.com" };
    const res = await listBatches(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(0);
  });

  it("strips the creator email and webhook url from the list", async () => {
    sessionState.session = { userId: "u-alice", workspaceId: "ws-alice", email: "alice@example.com" };
    const res = await listBatches(get());
    const body = await res.json();
    expect(body[0]).not.toHaveProperty("creatorEmail");
    expect(body[0]).not.toHaveProperty("webhookUrl");
  });

  it("refuses to read a batch from another workspace", async () => {
    sessionState.session = { userId: "u-bob", workspaceId: "ws-bob", email: "bob@example.com" };
    const res = await getBatch(getOne("batch-alice"), { params: Promise.resolve({ id: "batch-alice" }) });
    expect(res.status).toBe(404);
  });

  it("refuses to delete a batch without a session", async () => {
    const res = await deleteBatch(del("batch-alice"), { params: Promise.resolve({ id: "batch-alice" }) });
    expect(res.status).toBe(401);
    expect(batchStore.records.has("batch-alice")).toBe(true);
  });

  it("refuses to delete another workspace's batch", async () => {
    sessionState.session = { userId: "u-bob", workspaceId: "ws-bob", email: "bob@example.com" };
    const res = await deleteBatch(del("batch-alice"), { params: Promise.resolve({ id: "batch-alice" }) });
    expect(res.status).toBe(404);
    expect(batchStore.records.has("batch-alice")).toBe(true);
  });

  it("lets the owner delete their own batch", async () => {
    sessionState.session = { userId: "u-alice", workspaceId: "ws-alice", email: "alice@example.com" };
    const res = await deleteBatch(del("batch-alice"), { params: Promise.resolve({ id: "batch-alice" }) });
    expect(res.status).toBe(200);
    expect(batchStore.records.has("batch-alice")).toBe(false);
  });

  it("refuses to create a batch without a session", async () => {
    const res = await createBatch(
      new NextRequest("https://nuncio.test/api/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "x", urls: ["https://linkedin.com/in/a"], senderBrief: "b" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
