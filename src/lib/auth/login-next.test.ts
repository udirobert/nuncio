import { describe, expect, it } from "vitest";
import { resolveLoginNext } from "./login-next";

describe("resolveLoginNext", () => {
  it("allows each allowlisted target", () => {
    for (const path of ["/dashboard?view=setup", "/dashboard", "/studio", "/pricing"]) {
      expect(resolveLoginNext(path)).toBe(path);
    }
  });

  it("defaults for falsy and non-string input", () => {
    expect(resolveLoginNext(null)).toBe("/studio");
    expect(resolveLoginNext(undefined)).toBe("/studio");
    expect(resolveLoginNext("")).toBe("/studio");
    expect(resolveLoginNext(42)).toBe("/studio");
    expect(resolveLoginNext({})).toBe("/studio");
  });

  it("rejects external and malformed targets", () => {
    expect(resolveLoginNext("https://evil.example.com")).toBe("/studio");
    expect(resolveLoginNext("//evil.example.com")).toBe("/studio");
    expect(resolveLoginNext("\\\\evil.example.com")).toBe("/studio");
    expect(resolveLoginNext("/dashboard%3Fview%3Dsetup")).toBe("/studio");
    expect(resolveLoginNext("/dashboard?view=setup&x=1")).toBe("/studio");
    expect(resolveLoginNext("/dashb0ard")).toBe("/studio");
    expect(resolveLoginNext("dashboard")).toBe("/studio");
    expect(resolveLoginNext("/api/account/brief")).toBe("/studio");
  });
});
