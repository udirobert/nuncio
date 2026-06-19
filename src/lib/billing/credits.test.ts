import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  creditsEnforced,
  estimateCreditCost,
  getCreditSubject,
  getCreditBalance,
  reserveCredits,
  commitCreditReservation,
  refundCreditReservation,
  InsufficientCreditsError,
} from "./credits";

// In-memory mock storage provider for tests
const balances = new Map<string, number>();
const workspaces = new Map<string, { id: string }>();

vi.mock("@/lib/storage", () => ({
  getAccountStorageProvider: () => ({
    name: "test-mock",
    getCreditSummary: async (workspaceId: string) => {
      const balance = balances.get(workspaceId) || 0;
      const ws = workspaces.get(workspaceId) || { id: workspaceId };
      return { workspace: ws, balance, transactions: [] };
    },
    appendCreditTransaction: async (input: { workspaceId: string; type: string; amount: number }) => {
      const current = balances.get(input.workspaceId) || 0;
      const delta = input.type === "debit" ? -input.amount : input.amount;
      balances.set(input.workspaceId, Math.max(0, current + delta));
      return { id: "tx-mock", ...input, createdAt: new Date().toISOString() };
    },
    getWorkspace: async (id: string) => workspaces.get(id) || null,
    upsertUserByEmail: async (email: string) => ({ id: `user-${email}`, email, createdAt: "", updatedAt: "" }),
    upsertWorkspaceForUser: async (user: { id: string }, updates?: { id?: string }) => {
      const ws = { id: updates?.id || user.id, ownerUserId: user.id };
      workspaces.set(ws.id, ws);
      return ws;
    },
  }),
}));

function mockRequest(headers: Record<string, string> = {}): Request {
  const req = new Request("http://localhost:3000");
  for (const [k, v] of Object.entries(headers)) {
    req.headers.set(k, v);
  }
  return req;
}

beforeEach(() => {
  process.env.NUNCIO_CREDITS_ENFORCED = "true";
  process.env.NUNCIO_TRIAL_CREDITS = "10";
  balances.clear();
  workspaces.clear();
});

describe("creditsEnforced", () => {
  it("returns true when env var is 'true'", () => {
    process.env.NUNCIO_CREDITS_ENFORCED = "true";
    expect(creditsEnforced()).toBe(true);
  });

  it("returns false when env var is unset", () => {
    delete process.env.NUNCIO_CREDITS_ENFORCED;
    expect(creditsEnforced()).toBe(false);
  });

  it("returns false when env var is not 'true'", () => {
    process.env.NUNCIO_CREDITS_ENFORCED = "false";
    expect(creditsEnforced()).toBe(false);
  });
});

describe("estimateCreditCost", () => {
  it("returns correct cost for known actions", () => {
    expect(estimateCreditCost("profile.research")).toBe(1);
    expect(estimateCreditCost("script.generate")).toBe(1);
    expect(estimateCreditCost("canvas.build")).toBe(1);
    expect(estimateCreditCost("video.render")).toBe(8);

    expect(estimateCreditCost("video.render", 2)).toBe(16);
  });

  it("clamps quantity to 0", () => {
    expect(estimateCreditCost("profile.research", -1)).toBe(0);
  });
});

describe("getCreditSubject", () => {
  it("uses workspace header when present", () => {
    const req = mockRequest({ "x-nuncio-workspace-id": "ws-1", "x-nuncio-user-id": "user-1" });
    const subject = getCreditSubject(req);
    expect(subject.workspaceId).toBe("ws-1");
    expect(subject.userId).toBe("user-1");
    expect(subject.anonymous).toBe(false);
  });

  it("falls back to anonymous when no headers", () => {
    const req = mockRequest();
    const subject = getCreditSubject(req);
    expect(subject.workspaceId).toMatch(/^anon:/);
    expect(subject.anonymous).toBe(true);
  });
});

describe("getCreditBalance", () => {
  it("returns initial balance for anonymous subjects", async () => {
    const subject = { workspaceId: "anon:test-1", anonymous: true };
    const balance = await getCreditBalance(subject);
    expect(balance).toBe(10);
  });

  it("returns 0 for unknown non-anonymous subjects", async () => {
    const subject = { workspaceId: "unknown-ws", anonymous: false };
    const balance = await getCreditBalance(subject);
    expect(balance).toBe(0);
  });
});

describe("reserveCredits", () => {
  it("reserves credits from anonymous ledger", async () => {
    const subject = { workspaceId: "anon:test-reserve", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "profile.research",
      amount: 3,
      reason: "Test reservation",
    });

    expect(reservation.status).toBe("reserved");
    expect(reservation.amount).toBe(3);
    expect(reservation.balanceAfter).toBe(7);
  });

  it("throws InsufficientCreditsError when balance too low", async () => {
    const subject = { workspaceId: "anon:test-insufficient", anonymous: true };
    await expect(
      reserveCredits({
        subject,
        action: "video.render",
        amount: 999,
        reason: "Too expensive",
      })
    ).rejects.toThrow(InsufficientCreditsError);
  });

  it("returns shadow reservation when credits not enforced", async () => {
    process.env.NUNCIO_CREDITS_ENFORCED = "false";
    const subject = { workspaceId: "anon:test-shadow", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "video.render",
      amount: 999,
      reason: "Shadow mode",
    });

    expect(reservation.status).toBe("shadow");
  });

  it("defaults amount to estimateCreditCost", async () => {
    const subject = { workspaceId: "anon:test-default", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "video.render",
      reason: "Default amount",
    });

    expect(reservation.amount).toBe(8);
  });
});

describe("commitCreditReservation", () => {
  it("commits a reserved reservation", async () => {
    const subject = { workspaceId: "anon:test-commit", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "script.generate",
      reason: "To commit",
    });

    await commitCreditReservation(reservation.id);
    expect(reservation.status).toBe("committed");
  });

  it("is no-op on shadow reservations", async () => {
    process.env.NUNCIO_CREDITS_ENFORCED = "false";
    const subject = { workspaceId: "anon:test-shadow-commit", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "script.generate",
      reason: "Shadow commit",
    });

    await commitCreditReservation(reservation.id);
    expect(reservation.status).toBe("shadow");
  });

  it("is no-op on already committed reservations", async () => {
    const subject = { workspaceId: "anon:test-double-commit", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "script.generate",
      reason: "Double commit",
    });

    await commitCreditReservation(reservation.id);
    await commitCreditReservation(reservation.id);
    expect(reservation.status).toBe("committed");
  });
});

describe("refundCreditReservation", () => {
  it("refunds credits to anonymous ledger", async () => {
    const subject = { workspaceId: "anon:test-refund", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "profile.research",
      amount: 2,
      reason: "To refund",
    });

    expect(reservation.balanceAfter).toBe(8);
    await refundCreditReservation(reservation.id);
    expect(reservation.status).toBe("refunded");
    const balance = await getCreditBalance(subject);
    expect(balance).toBe(10);
  });

  it("is no-op on shadow reservations", async () => {
    process.env.NUNCIO_CREDITS_ENFORCED = "false";
    const subject = { workspaceId: "anon:test-shadow-refund", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "profile.research",
      reason: "Shadow refund",
    });

    await refundCreditReservation(reservation.id);
    expect(reservation.status).toBe("shadow");
  });

  it("is no-op on already committed reservations", async () => {
    const subject = { workspaceId: "anon:test-commit-refund", anonymous: true };
    const reservation = await reserveCredits({
      subject,
      action: "profile.research",
      reason: "Commit then refund",
    });

    await commitCreditReservation(reservation.id);
    await refundCreditReservation(reservation.id);
    expect(reservation.status).toBe("committed");
  });
});

describe("InsufficientCreditsError", () => {
  it("formats error message correctly", () => {
    const error = new InsufficientCreditsError(10, 3);
    expect(error.message).toBe("Insufficient credits — 10 required, 3 available.");
    expect(error.required).toBe(10);
    expect(error.available).toBe(3);
    expect(error.name).toBe("InsufficientCreditsError");
  });
});
