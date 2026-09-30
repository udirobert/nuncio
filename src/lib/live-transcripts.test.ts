import { describe, expect, it } from "vitest";
import { normalizeAnamHistory, normalizeLiveKitSegments } from "./live-transcripts";
import { detectEscalationHint } from "./escalation";

describe("normalizeAnamHistory", () => {
  it("maps user/persona roles and dedupes by id", () => {
    const messages = [
      { id: "m1", role: "user", content: "Can I talk to a real person?" },
      { id: "m2", role: "persona", content: "The sender decides." },
      { id: "m1", role: "user", content: "Can I talk to a real person?" },
    ];
    const utterances = normalizeAnamHistory(messages);
    expect(utterances).toHaveLength(2);
    expect(utterances[0]).toMatchObject({ id: "m1", role: "user" });
    expect(utterances[1]).toMatchObject({ role: "assistant" });
  });
});

describe("normalizeLiveKitSegments", () => {
  it("keeps only final segments and tags recipient turns as user", () => {
    const utterances = normalizeLiveKitSegments(
      [
        { id: "s1", final: true, text: "Can we schedule a meeting?" },
        { id: "s2", final: false, text: "Can we sched" },
        { id: "s3", final: true, text: "  " },
      ],
      { isRecipient: true },
    );
    expect(utterances).toHaveLength(1);
    expect(utterances[0]).toMatchObject({ id: "s1", role: "user" });
  });
});

describe("shared hint path", () => {
  it("the same final user utterance yields the same hint for both providers", () => {
    const anam = normalizeAnamHistory([{ id: "a1", role: "user", content: "I want to speak to a real person" }]);
    const lk = normalizeLiveKitSegments([{ id: "s1", final: true, text: "I want to speak to a real person" }], { isRecipient: true });
    expect(detectEscalationHint(anam[0].text)).toBe(detectEscalationHint(lk[0].text));
    expect(detectEscalationHint(anam[0].text)).toBe("request-human");
  });

  it("assistant/persona utterances never produce a user hint path", () => {
    const anam = normalizeAnamHistory([{ id: "a2", role: "persona", content: "Want to book a call?" }]);
    expect(anam[0].role).toBe("assistant");
    const userUtterances = anam.filter((u) => u.role === "user");
    expect(userUtterances).toHaveLength(0);
  });
});
