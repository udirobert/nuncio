import { describe, expect, it } from "vitest";
import { deriveRelationshipState } from "./inbox";

describe("deriveRelationshipState", () => {
  it("starts at sent", () => {
    expect(deriveRelationshipState({})).toBe("sent");
  });

  it("moves to opened once the link was opened", () => {
    expect(deriveRelationshipState({ firstViewedAt: "2026-10-20T10:00:00.000Z" })).toBe("opened");
  });

  it("moves to talking after a conversation", () => {
    expect(
      deriveRelationshipState({
        conversationCount: 1,
        firstViewedAt: "2026-10-20T10:00:00.000Z",
      }),
    ).toBe("talking");
  });

  it("moves to booked after a booking", () => {
    expect(deriveRelationshipState({ hasBooking: true, conversationCount: 2 })).toBe("booked");
  });

  it("puts a pending call request above everything else", () => {
    expect(
      deriveRelationshipState({
        hasCallRequest: true,
        hasBooking: true,
        conversationCount: 3,
        firstViewedAt: "2026-10-20T10:00:00.000Z",
      }),
    ).toBe("requested");
  });
});
