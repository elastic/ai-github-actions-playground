import { describe, it, expect } from "vitest";

import { getNextDuplicatedTitle } from "../../src/store/dashboardTitleUtils";

describe("getNextDuplicatedTitle", () => {
  it("appends (copy) when no copies exist", () => {
    expect(getNextDuplicatedTitle("My Panel", [], "Panel")).toBe("My Panel (copy)");
  });

  it("increments to (copy 2) when one copy exists", () => {
    expect(getNextDuplicatedTitle("My Panel", ["My Panel (copy)"], "Panel")).toBe(
      "My Panel (copy 2)",
    );
  });

  it("increments to (copy 3) when copy 2 exists", () => {
    expect(
      getNextDuplicatedTitle("My Panel", ["My Panel (copy)", "My Panel (copy 2)"], "Panel"),
    ).toBe("My Panel (copy 3)");
  });

  it("strips existing (copy) suffix from source before generating", () => {
    expect(getNextDuplicatedTitle("My Panel (copy)", ["My Panel (copy)"], "Panel")).toBe(
      "My Panel (copy 2)",
    );
  });

  it("strips existing (copy N) suffix from source before generating", () => {
    expect(
      getNextDuplicatedTitle("My Panel (copy 5)", ["My Panel (copy)", "My Panel (copy 5)"], "Panel"),
    ).toBe("My Panel (copy 6)");
  });

  it("uses fallback when source title is empty after stripping", () => {
    expect(getNextDuplicatedTitle("", [], "Panel")).toBe("Panel (copy)");
    expect(getNextDuplicatedTitle("", [], "Dashboard")).toBe("Dashboard (copy)");
  });

  it("uses fallback when source title is only whitespace", () => {
    expect(getNextDuplicatedTitle("   ", [], "Panel")).toBe("Panel (copy)");
  });

  it("handles case-insensitive copy suffix matching", () => {
    expect(getNextDuplicatedTitle("My Panel", ["My Panel (Copy)"], "Panel")).toBe(
      "My Panel (copy 2)",
    );
  });

  it("handles regex special characters in titles", () => {
    expect(
      getNextDuplicatedTitle("Panel [1] (test)", ["Panel [1] (test) (copy)"], "Panel"),
    ).toBe("Panel [1] (test) (copy 2)");
  });

  it("finds the max copy number across non-contiguous copies", () => {
    expect(
      getNextDuplicatedTitle("Panel", ["Panel (copy)", "Panel (copy 5)"], "Panel"),
    ).toBe("Panel (copy 6)");
  });

  it("ignores unrelated titles", () => {
    expect(
      getNextDuplicatedTitle("Alpha", ["Beta (copy)", "Gamma (copy 2)"], "Panel"),
    ).toBe("Alpha (copy)");
  });

  it("works with Dashboard fallback", () => {
    expect(getNextDuplicatedTitle("Overview", [], "Dashboard")).toBe("Overview (copy)");
  });
});
