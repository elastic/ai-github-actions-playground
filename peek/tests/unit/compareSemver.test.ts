import { describe, it, expect } from "vitest";

import { compareSemver } from "../../src/utils/compareSemver";

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    expect(compareSemver("8.9.0", "8.9.0")).toBe(0);
  });

  it("compares major versions numerically", () => {
    expect(compareSemver("9.0.0", "8.0.0")).toBeGreaterThan(0);
    expect(compareSemver("8.0.0", "9.0.0")).toBeLessThan(0);
  });

  it("compares minor versions numerically", () => {
    expect(compareSemver("8.10.0", "8.9.0")).toBeGreaterThan(0);
    expect(compareSemver("8.9.0", "8.10.0")).toBeLessThan(0);
  });

  it("compares patch versions numerically", () => {
    expect(compareSemver("8.9.2", "8.9.1")).toBeGreaterThan(0);
    expect(compareSemver("8.9.1", "8.9.2")).toBeLessThan(0);
  });

  it("handles versions with different segment counts", () => {
    expect(compareSemver("8.9", "8.9.0")).toBe(0);
    expect(compareSemver("8.9", "8.9.1")).toBeLessThan(0);
  });

  it("sorts an array of versions correctly", () => {
    const versions = ["8.10.0", "8.9.0", "7.17.0", "8.10.1", "8.2.0"];
    expect(versions.sort(compareSemver)).toEqual(["7.17.0", "8.2.0", "8.9.0", "8.10.0", "8.10.1"]);
  });

  it("handles pre-release suffixes gracefully", () => {
    expect(compareSemver("8.9.0-SNAPSHOT", "8.9.0")).toBeLessThan(0);
    expect(compareSemver("8.9.0-rc.1", "8.9.0")).toBeLessThan(0);
    expect(compareSemver("8.9.0-rc.1", "8.9.0-rc.2")).toBeLessThan(0);
    expect(compareSemver("8.9.0-1", "8.9.0-alpha")).toBeLessThan(0);
    expect(compareSemver("8.10.0-alpha", "8.9.0")).toBeGreaterThan(0);
  });
});
