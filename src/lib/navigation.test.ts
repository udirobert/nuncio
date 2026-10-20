import { describe, expect, it } from "vitest";
import {
  APP_ROUTES,
  GETTING_STARTED_STEPS,
  MEMBER_NAV,
  PRODUCT_ONELINER,
  PUBLIC_NAV,
  SECONDARY_NAV,
} from "./navigation";

/**
 * Guards the information architecture.
 *
 * The app used to carry six header destinations, two of which pointed at the
 * same URL with a different query string, and one of which ("Examples" at
 * /playbook) collided with the product's core concept of *your* playbook.
 * These assertions make that regression impossible to reintroduce silently.
 */
describe("information architecture", () => {
  it("gives members exactly three spaces", () => {
    expect(MEMBER_NAV).toHaveLength(3);
    expect(MEMBER_NAV.map((i) => i.href)).toEqual([
      APP_ROUTES.inbox,
      APP_ROUTES.representative,
      APP_ROUTES.create,
    ]);
  });

  it("never lets two destinations share a URL", () => {
    const memberHrefs = [...MEMBER_NAV, ...SECONDARY_NAV].map((i) => i.href);
    expect(new Set(memberHrefs).size).toBe(memberHrefs.length);
    const publicHrefs = PUBLIC_NAV.map((i) => i.href);
    expect(new Set(publicHrefs).size).toBe(publicHrefs.length);
  });

  it("points every destination at a real route, never a query-string variant", () => {
    for (const item of [...MEMBER_NAV, ...SECONDARY_NAV, ...PUBLIC_NAV]) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.href).not.toContain("?");
      expect(item.href).not.toContain("#");
    }
  });

  it("gives every destination a label and a one-line description", () => {
    for (const item of [...MEMBER_NAV, ...SECONDARY_NAV, ...PUBLIC_NAV]) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(8);
    }
  });

  it("keeps the representative's setup on its own route", () => {
    expect(APP_ROUTES.representative).toBe("/setup");
    expect(APP_ROUTES.representative).not.toContain("view=");
  });

  it("keeps public worked examples away from the word 'playbook'", () => {
    expect(APP_ROUTES.examples).toBe("/examples");
    for (const item of [...MEMBER_NAV, ...SECONDARY_NAV, ...PUBLIC_NAV]) {
      expect(item.href).not.toBe("/playbook");
    }
  });

  it("states what the product is in one sentence", () => {
    expect(PRODUCT_ONELINER).toMatch(/nuncio/i);
    expect(PRODUCT_ONELINER).toMatch(/representative/i);
    expect(PRODUCT_ONELINER.split(".").filter(Boolean)).toHaveLength(1);
  });

  it("shares the getting-started steps with the tour and the teaching ladder", () => {
    expect(GETTING_STARTED_STEPS).toHaveLength(3);
    for (const step of GETTING_STARTED_STEPS) {
      expect(step.label.trim().length).toBeGreaterThan(0);
      expect(step.desc.trim().length).toBeGreaterThan(8);
    }
  });
});
