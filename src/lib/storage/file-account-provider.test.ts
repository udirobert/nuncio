import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

let dataDir: string | undefined;

afterEach(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  dataDir = undefined;
  vi.unstubAllEnvs();
});

describe("FileAccountStorageProvider idempotency", () => {
  it("deduplicates concurrent appends with the same idempotency key", async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "nuncio-billing-"));
    vi.stubEnv("NUNCIO_DATA_DIR", dataDir);
    vi.resetModules();

    const { FileAccountStorageProvider } = await import("./file-account-provider");
    const provider = new FileAccountStorageProvider();
    const input = {
      workspaceId: "workspace-1",
      type: "refund" as const,
      amount: 5,
      reason: "live_session_reconcile:start_failed",
      reservationId: "reservation-1",
      idempotencyKey: "live-session-reconcile:reservation-1",
    };

    const transactions = await Promise.all([
      provider.appendCreditTransaction(input),
      provider.appendCreditTransaction(input),
    ]);

    expect(transactions[0].id).toBe(transactions[1].id);
    const persisted = JSON.parse(await readFile(path.join(dataDir, "billing.json"), "utf8")) as {
      transactions: unknown[];
    };
    expect(persisted.transactions).toHaveLength(1);
  });
});
