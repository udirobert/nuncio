import { describe, expect, it } from "vitest";
import {
  describeRepresentative,
  representativeDisclosure,
  representativeHeadline,
  representativeLabel,
  representativeSummary,
} from "./representative";

describe("describeRepresentative", () => {
  it("calls a photo avatar the sender's own face", () => {
    const described = describeRepresentative({
      anamAvatarId: "av-123",
      lastSenderName: "Alex Rivera",
    });
    expect(described.kind).toBe("self");
    expect(described.configured).toBe(true);
    expect(described.provider).toBe("anam");
    expect(described.name).toBe("Alex Rivera");
  });

  it("calls a provider avatar a persona", () => {
    const described = describeRepresentative({
      synthesiaAvatarId: "av_abc",
      representativeName: "Rowan",
    });
    expect(described.kind).toBe("persona");
    expect(described.provider).toBe("synthesia");
    expect(described.name).toBe("Rowan");
  });

  it("prefers the photo avatar when both are configured", () => {
    const described = describeRepresentative({
      anamAvatarId: "av-123",
      synthesiaAvatarId: "av_abc",
    });
    expect(described.kind).toBe("self");
  });

  it("reports nothing configured when no avatar is set", () => {
    const described = describeRepresentative({});
    expect(described.kind).toBe("unset");
    expect(described.configured).toBe(false);
  });
});

describe("representativeDisclosure", () => {
  it("tells a prospect when it looks like the sender", () => {
    const line = representativeDisclosure({ kind: "self", senderName: "Alex Rivera" });
    expect(line).toContain("Alex Rivera's AI representative");
    expect(line).toContain("photo");
    expect(line).toContain("notes");
  });

  it("tells a prospect when it is not the sender", () => {
    const line = representativeDisclosure({ kind: "persona", senderName: "Alex Rivera" });
    expect(line).toContain("disclosed AI representative");
    expect(line).toContain("not Alex Rivera");
    expect(line).not.toContain("photo");
  });

  it("never lets the two promises read the same", () => {
    const self = representativeDisclosure({ kind: "self", senderName: "Alex Rivera" });
    const persona = representativeDisclosure({ kind: "persona", senderName: "Alex Rivera" });
    expect(self).not.toBe(persona);
  });

  it("copes with a missing sender name", () => {
    const self = representativeDisclosure({ kind: "self" });
    const persona = representativeDisclosure({ kind: "persona" });
    expect(self.length).toBeGreaterThan(10);
    expect(persona.length).toBeGreaterThan(10);
  });
});

describe("representativeLabel", () => {
  it("labels the two kinds differently for the sender's own UI", () => {
    const self = representativeLabel(
      { kind: "self", name: "Alex Rivera", configured: true },
      "Alex Rivera",
    );
    const persona = representativeLabel(
      { kind: "persona", name: "Rowan", configured: true },
      "Alex Rivera",
    );
    expect(self).toContain("face");
    expect(persona).toContain("persona");
    expect(self).not.toBe(persona);
  });

  it("says plainly when nothing is set", () => {
    expect(
      representativeLabel({ kind: "unset", name: "Your AI representative", configured: false }),
    ).toContain("Not set");
  });
});

describe("representativeHeadline and representativeSummary", () => {
  it("names who is speaking without repeating the detail", () => {
    const headline = representativeHeadline({ kind: "self", senderName: "Alex Rivera" });
    const summary = representativeSummary({ kind: "self", senderName: "Alex Rivera" });
    expect(headline).toContain("AI representative");
    expect(summary).toContain("photo");
    // The headline says who; the summary says how. Neither repeats the other.
    expect(summary).not.toContain("You are talking to");
  });

  it("says a persona is not the sender", () => {
    const summary = representativeSummary({ kind: "persona", senderName: "Alex Rivera" });
    expect(summary).toContain("not Alex Rivera");
  });

  it("names a persona when it has one", () => {
    const headline = representativeHeadline({
      kind: "persona",
      senderName: "Alex Rivera",
      representativeName: "Rowan",
    });
    expect(headline).toContain("Rowan");
    expect(headline).toContain("disclosed");
  });
});
