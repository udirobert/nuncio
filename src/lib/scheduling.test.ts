import { describe, expect, it } from "vitest";
import { resolveSchedulingProvider } from "./scheduling";

describe("resolveSchedulingProvider", () => {
  it("recognizes cal.com exact hosts with embed + lifecycle", () => {
    expect(resolveSchedulingProvider("https://cal.com/alex/30min")).toMatchObject({ id: "calcom", capabilities: { embed: true, lifecycle: true } });
    expect(resolveSchedulingProvider("https://app.cal.com/alex/30min")?.id).toBe("calcom");
  });

  it("recognizes calendly.com as embed without lifecycle tracking", () => {
    const info = resolveSchedulingProvider("https://calendly.com/alex/30min");
    expect(info).toMatchObject({ id: "calendly", capabilities: { embed: true, lifecycle: false } });
  });

  it("does not match lookalike hosts as providers", () => {
    expect(resolveSchedulingProvider("https://cal.com.evil.com/x")?.id).toBe("link");
    expect(resolveSchedulingProvider("https://evilcal.com/x")?.id).toBe("link");
    expect(resolveSchedulingProvider("https://calendly.com.evil.com/x")?.id).toBe("link");
  });

  it("rejects non-HTTPS, userinfo, fragments, and private hosts", () => {
    expect(resolveSchedulingProvider("http://cal.com/alex")).toBeNull();
    expect(resolveSchedulingProvider("https://user:pass@cal.com/alex")).toBeNull();
    expect(resolveSchedulingProvider("https://cal.com/alex#secret")).toBeNull();
    expect(resolveSchedulingProvider("https://localhost/book")).toBeNull();
    expect(resolveSchedulingProvider("https://127.0.0.1/book")).toBeNull();
    expect(resolveSchedulingProvider("https://192.168.1.1/book")).toBeNull();
    expect(resolveSchedulingProvider("https://[::1]/book")).toBeNull();
    expect(resolveSchedulingProvider("not a url")).toBeNull();
    expect(resolveSchedulingProvider(null)).toBeNull();
  });

  it("rejects all IP literals — only public DNS hostnames validate", () => {
    expect(resolveSchedulingProvider("https://8.8.8.8/book")).toBeNull();
    expect(resolveSchedulingProvider("https://203.0.113.10/book")).toBeNull();
    expect(resolveSchedulingProvider("https://[2606:4700:4700::1111]/book")).toBeNull();
    expect(resolveSchedulingProvider("https://[::ffff:8.8.8.8]/book")).toBeNull();
  });

  it("falls back to a generic link for unknown public HTTPS hosts", () => {
    const info = resolveSchedulingProvider("https://calendar.example.com/book");
    expect(info).toMatchObject({ id: "link", capabilities: { embed: false, lifecycle: false } });
  });
});
