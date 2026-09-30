import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm", () => ({
  chatCompletion: vi.fn(async () => "never reached"),
}));

import { chatCompletion } from "@/lib/llm";
import { draftLiveCallBrief } from "./live-call-brief-server";
import {
  parseBriefDialogue,
  parseLiveCallBrief,
} from "./live-call-brief";
import { hasSenderPlaybook } from "./playbook";

describe("hasSenderPlaybook", () => {
  it("requires all three nonblank fields", () => {
    expect(hasSenderPlaybook(null)).toBe(false);
    expect(hasSenderPlaybook({})).toBe(false);
    expect(hasSenderPlaybook({ playbookWants: "x", playbookOffer: "y", playbookConstraints: "z" })).toBe(true);
    expect(hasSenderPlaybook({ playbookWants: "x", playbookOffer: "y", playbookConstraints: "  " })).toBe(false);
    expect(hasSenderPlaybook({ playbookWants: "", playbookOffer: "y", playbookConstraints: "z" })).toBe(false);
    expect(hasSenderPlaybook({ playbookWants: "x", playbookOffer: "\n\t", playbookConstraints: "z" })).toBe(false);
  });
});

describe("parseBriefDialogue", () => {
  const ok = { role: "user", content: "hello" };

  it("rejects empty and oversized arrays", () => {
    expect(parseBriefDialogue([])).toBeNull();
    expect(parseBriefDialogue(Array(21).fill(ok))).toBeNull();
    expect(parseBriefDialogue(Array(20).fill(ok))).not.toBeNull();
  });

  it("rejects oversized messages and disallowed roles", () => {
    expect(parseBriefDialogue([{ role: "user", content: "x".repeat(2001) }])).toBeNull();
    expect(parseBriefDialogue([{ role: "user", content: "x".repeat(2000) }])).not.toBeNull();
    expect(parseBriefDialogue([{ role: "system", content: "hi" }])).toBeNull();
    expect(parseBriefDialogue([{ role: "tool", content: "hi" }])).toBeNull();
  });

  it("rejects over the total char limit and empty/whitespace content", () => {
    expect(parseBriefDialogue(Array(7).fill({ role: "user", content: "x".repeat(2000) }))).toBeNull();
    expect(parseBriefDialogue(Array(6).fill({ role: "user", content: "x".repeat(2000) }))).not.toBeNull();
    expect(parseBriefDialogue([{ role: "user", content: "   " }])).toBeNull();
    expect(parseBriefDialogue([{ role: "assistant", content: "" }])).toBeNull();
  });

  it("normalizes whitespace in returned content", () => {
    const parsed = parseBriefDialogue([{ role: "user", content: "  hi there  " }]);
    expect(parsed).toEqual([{ role: "user", content: "hi there" }]);
  });
});

describe("parseLiveCallBrief", () => {
  const valid = { goal: "g", discussed: "d", openQuestions: "q", reason: "r" };

  it("accepts exactly four string fields and trims them", () => {
    expect(parseLiveCallBrief(valid)).toEqual(valid);
    expect(parseLiveCallBrief({ ...valid, goal: "  g  " })?.goal).toBe("g");
  });

  it("rejects extra fields, missing fields, wrong types, and over-limit strings", () => {
    expect(parseLiveCallBrief({ ...valid, extra: "x" })).toBeNull();
    expect(parseLiveCallBrief({ goal: "g", discussed: "d", openQuestions: "q" })).toBeNull();
    expect(parseLiveCallBrief({ ...valid, goal: 5 })).toBeNull();
    expect(parseLiveCallBrief({ ...valid, reason: "x".repeat(501) })).toBeNull();
    expect(parseLiveCallBrief({ ...valid, reason: "x".repeat(500) })).not.toBeNull();
    expect(parseLiveCallBrief(null)).toBeNull();
    expect(parseLiveCallBrief(["a"])).toBeNull();
  });
});

describe("draftLiveCallBrief", () => {
  beforeEach(() => {
    vi.mocked(chatCompletion).mockReset();
  });

  it("rejects invalid dialogue before calling the LLM", async () => {
    await expect(draftLiveCallBrief([])).rejects.toThrow();
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("parses a valid JSON object", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce(JSON.stringify({
      goal: "g", discussed: "d", openQuestions: "q", reason: "r",
    }));
    const brief = await draftLiveCallBrief([{ role: "user", content: "what about pricing?" }]);
    expect(brief.goal).toBe("g");
  });

  it("throws on invalid JSON or schema violations from the model", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce("not json");
    await expect(draftLiveCallBrief([{ role: "user", content: "hi" }])).rejects.toThrow();
    vi.mocked(chatCompletion).mockResolvedValueOnce(JSON.stringify({ goal: "g", discussed: "d", openQuestions: "q", reason: "r", extra: "x" }));
    await expect(draftLiveCallBrief([{ role: "user", content: "hi" }])).rejects.toThrow();
  });
});
