import { describe, expect, it } from "vitest";
import { isViralRef, normalizeViralRef } from "./viral-ref";

describe("viral ref grammar", () => {
  it("accepts the refs the app actually emits", () => {
    expect(isViralRef("share-37522e7d-24c3-41fc-ad40-146b6c07342e")).toBe(true);
    expect(isViralRef("share-abc123-ctab")).toBe(true);
    expect(isViralRef("share-abc123-header-ctaa")).toBe(true);
    expect(isViralRef("live-abc123")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isViralRef("")).toBe(false);
    expect(isViralRef("drop-table")).toBe(false);
    expect(isViralRef("http://evil.example/?ref=x")).toBe(false);
    expect(isViralRef("share-")).toBe(false);
    expect(isViralRef("share-abc def")).toBe(false);
    expect(isViralRef("share-abc!")).toBe(false);
    expect(isViralRef(undefined)).toBe(false);
    expect(isViralRef(null)).toBe(false);
    expect(isViralRef(42)).toBe(false);
  });

  it("caps length and normalizes whitespace", () => {
    expect(isViralRef(`share-${"a".repeat(110)}`)).toBe(true);
    expect(isViralRef(`share-${"a".repeat(111)}`)).toBe(false);
    expect(normalizeViralRef("  share-abc123-ctab  ")).toBe("share-abc123-ctab");
    expect(normalizeViralRef("nope")).toBeNull();
  });
});
