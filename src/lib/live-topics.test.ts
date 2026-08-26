import { describe, expect, it } from "vitest";
import { classifyQuestionTopics, LIVE_QUESTION_TOPICS } from "./live-topics";

describe("LIVE_QUESTION_TOPICS", () => {
  it("lists the nine playbook-aligned buckets with other last", () => {
    expect(LIVE_QUESTION_TOPICS).toEqual([
      "pricing",
      "product",
      "security",
      "availability",
      "integrations",
      "competitors",
      "company",
      "next_steps",
      "other",
    ]);
  });
});

describe("classifyQuestionTopics", () => {
  it("classifies a pricing question", () => {
    expect(classifyQuestionTopics("What does it cost?")).toEqual(["pricing"]);
  });

  it("returns multiple matching topics in order of first appearance", () => {
    expect(
      classifyQuestionTopics("How does it integrate with HubSpot and what does it cost?"),
    ).toEqual(["integrations", "pricing"]);
  });

  it("returns an empty array for statements", () => {
    expect(classifyQuestionTopics("Thanks, sounds great")).toEqual([]);
  });

  it("returns an empty array for non-questions that mention a topic", () => {
    expect(classifyQuestionTopics("I love the pricing")).toEqual([]);
  });

  it("returns [other] for questions that match no topic", () => {
    expect(classifyQuestionTopics("What do you think?")).toEqual(["other"]);
  });

  it("classifies a security and compliance question", () => {
    expect(classifyQuestionTopics("Do you support SOC 2 and GDPR?")).toEqual(["security"]);
  });

  it("classifies an availability question", () => {
    expect(classifyQuestionTopics("When are you available for a call?")).toEqual(["availability"]);
  });

  it("treats a booking-adjacent demo ask as availability", () => {
    expect(classifyQuestionTopics("Can we book a demo?")).toEqual(["availability"]);
  });

  it("treats a standalone demo ask as product", () => {
    expect(classifyQuestionTopics("Can I see a demo?")).toEqual(["product"]);
  });

  it("matches keywords case-insensitively", () => {
    expect(classifyQuestionTopics("WHAT DOES IT COST?")).toEqual(["pricing"]);
  });

  it("detects questions by trailing question mark alone", () => {
    expect(classifyQuestionTopics("HubSpot integration?")).toEqual(["integrations"]);
  });

  it("detects questions by tell-me phrasing", () => {
    expect(classifyQuestionTopics("Tell me about your mission")).toEqual(["company"]);
  });

  it("does not match substrings inside other words", () => {
    expect(classifyQuestionTopics("Can you explain how this works?")).toEqual(["product"]);
  });

  it("returns [other] for unmatched questions even with a question mark", () => {
    expect(classifyQuestionTopics("How are you today?")).toEqual(["other"]);
  });
});
