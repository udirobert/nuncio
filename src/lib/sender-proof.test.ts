import { describe, expect, it } from "vitest";
import {
  normalizeCanAnswer,
  normalizeImageUrl,
  senderInitials,
  senderProofForShare,
  senderProofFromWorkspace,
} from "./sender-proof";

describe("sender proof", () => {
  it("accepts only https image urls", () => {
    expect(normalizeImageUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(normalizeImageUrl("http://example.com/a.png")).toBeUndefined();
    expect(normalizeImageUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeImageUrl("data:image/png;base64,AAA")).toBeUndefined();
    expect(normalizeImageUrl("not a url")).toBeUndefined();
    expect(normalizeImageUrl("")).toBeUndefined();
    expect(normalizeImageUrl(undefined)).toBeUndefined();
  });

  it("rejects urls carrying credentials", () => {
    expect(normalizeImageUrl("https://user:pw@example.com/a.png")).toBeUndefined();
  });

  it("caps the can-answer line and collapses whitespace", () => {
    expect(normalizeCanAnswer("  Onboarding   and  pilots  ")).toBe("Onboarding and pilots");
    const long = "x".repeat(400);
    expect(normalizeCanAnswer(long)).toHaveLength(158);
    expect(normalizeCanAnswer(long)?.endsWith("…")).toBe(true);
    expect(normalizeCanAnswer("   ")).toBeUndefined();
  });

  it("falls back to initials when there is no photo", () => {
    expect(senderInitials("Alex Rivera")).toBe("AR");
    expect(senderInitials("alex")).toBe("A");
    expect(senderInitials("")).toBe("AI");
    expect(senderInitials(undefined)).toBe("AI");
  });

  it("prefers the share snapshot over the live workspace", () => {
    const proof = senderProofForShare(
      { senderPhotoUrl: "https://example.com/snapshot.png" },
      { senderPhotoUrl: "https://example.com/live.png" },
    );
    expect(proof.photoUrl).toBe("https://example.com/snapshot.png");
  });

  it("falls back to the workspace for links created before the field existed", () => {
    const proof = senderProofForShare(
      {},
      { senderCompanyLogoUrl: "https://example.com/logo.png" },
    );
    expect(proof.logoUrl).toBe("https://example.com/logo.png");
  });

  it("ignores an invalid snapshot rather than failing the page", () => {
    const proof = senderProofFromWorkspace({ senderPhotoUrl: "http://insecure.example/a.png" });
    expect(proof.photoUrl).toBeUndefined();
  });
});
