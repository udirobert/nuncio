import { describe, expect, it } from "vitest";
import { detectEscalationHint } from "./escalation";

describe("detectEscalationHint", () => {
  it("detects explicit request-human intent", () => {
    expect(detectEscalationHint("Can I speak to the actual sender?")).toBe("request-human");
    expect(detectEscalationHint("Can I talk to papa directly?", "Papa")).toBe("request-human");
    expect(detectEscalationHint("I want to speak to a real person")).toBe("request-human");
    expect(detectEscalationHint("Can I talk to Alex?", "Alex")).toBe("request-human");
  });

  it("detects explicit scheduling intent", () => {
    expect(detectEscalationHint("Can we schedule a meeting?")).toBe("schedule");
    expect(detectEscalationHint("Can we meet tomorrow?")).toBe("schedule");
    expect(detectEscalationHint("I would like to book a call")).toBe("schedule");
  });

  it("suppresses negations", () => {
    expect(detectEscalationHint("I do not want to speak to a person")).toBeNull();
    expect(detectEscalationHint("do not book a meeting")).toBeNull();
    expect(detectEscalationHint("I don't want to talk to the real person")).toBeNull();
  });

  it("does not fire on mentions without asking verbs", () => {
    expect(detectEscalationHint("Is the actual sender a real person?")).toBeNull();
    expect(detectEscalationHint("We built a real person avatar")).toBeNull();
    expect(detectEscalationHint("Tell me about the actual sender's company")).toBeNull();
  });

  it("ignores generic product discussion", () => {
    expect(detectEscalationHint("Tell me about the pricing plans")).toBeNull();
    expect(detectEscalationHint("What does the product do?")).toBeNull();
    expect(detectEscalationHint("")).toBeNull();
  });
});
