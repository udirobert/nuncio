import { describe, expect, it } from "vitest";
import {
  batchBelongsToWorkspace,
  publicBatchView,
} from "./queue";
import type { Batch } from "./types";

const MINE: Batch = {
  id: "batch-1",
  name: "Ops leads",
  senderBrief: "We help ops teams map handoffs",
  senderName: "Alex",
  creatorEmail: "alex@example.com",
  workspaceId: "ws-alex",
  webhookUrl: "https://internal.example.com/hook",
  jobs: [{ id: "j1", url: "https://linkedin.com/in/maya", status: "queued" }],
  status: "queued",
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  completedCount: 0,
  failedCount: 0,
};

describe("batch ownership", () => {
  it("gives a batch to the workspace that created it", () => {
    expect(batchBelongsToWorkspace(MINE, "ws-alex", "alex@example.com")).toBe(true);
  });

  it("withholds a batch from another workspace", () => {
    expect(batchBelongsToWorkspace(MINE, "ws-someone-else", "other@example.com")).toBe(false);
  });

  it("withholds a batch from another account in the same workspace", () => {
    // Workspace match wins over email — the workspace is the boundary.
    expect(batchBelongsToWorkspace(MINE, "ws-alex", "other@example.com")).toBe(true);
    expect(batchBelongsToWorkspace(MINE, "ws-other", "alex@example.com")).toBe(false);
  });

  it("falls back to the creator email for batches created before scoping", () => {
    const legacy = { ...MINE, workspaceId: undefined };
    expect(batchBelongsToWorkspace(legacy, "ws-alex", "alex@example.com")).toBe(true);
    expect(batchBelongsToWorkspace(legacy, "ws-alex", "other@example.com")).toBe(false);
  });

  it("refuses a batch with no owner at all", () => {
    const orphan = { ...MINE, workspaceId: undefined, creatorEmail: undefined };
    expect(batchBelongsToWorkspace(orphan, "ws-alex", "alex@example.com")).toBe(false);
  });

  it("refuses a missing batch", () => {
    expect(batchBelongsToWorkspace(null, "ws-alex", "alex@example.com")).toBe(false);
    expect(batchBelongsToWorkspace(undefined, "ws-alex")).toBe(false);
  });
});

describe("publicBatchView", () => {
  it("strips the creator email and the webhook url", () => {
    const view = publicBatchView(MINE);
    expect(view).not.toHaveProperty("creatorEmail");
    expect(view).not.toHaveProperty("webhookUrl");
    expect(view.id).toBe("batch-1");
    expect(view.senderBrief).toBe(MINE.senderBrief);
  });
});
