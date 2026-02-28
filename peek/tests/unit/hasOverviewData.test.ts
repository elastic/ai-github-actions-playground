import { describe, it, expect } from "vitest";

import { hasOverviewData } from "../../src/hooks/useBatchedOverviewQueries";
import type { OverviewQueryResult } from "../../src/hooks/useBatchedOverviewQueries";

describe("hasOverviewData", () => {
  it("returns false for undefined result", () => {
    expect(hasOverviewData(undefined)).toBe(false);
  });

  it("returns false when data is missing", () => {
    const result: OverviewQueryResult = { status: "success" };
    expect(hasOverviewData(result)).toBe(false);
  });

  it("returns false when values array is empty", () => {
    const result: OverviewQueryResult = {
      status: "success",
      data: { columns: [{ name: "metric", type: "double" }], values: [] },
    };
    expect(hasOverviewData(result)).toBe(false);
  });

  it("returns false for non-success/loading status", () => {
    const result: OverviewQueryResult = {
      status: "error",
      data: {
        columns: [{ name: "metric", type: "double" }],
        values: [[42]],
      },
    };
    expect(hasOverviewData(result)).toBe(false);
  });

  it("returns false when no metric column exists", () => {
    const result: OverviewQueryResult = {
      status: "success",
      data: {
        columns: [{ name: "timestamp", type: "date" }],
        values: [["2024-01-01"]],
      },
    };
    expect(hasOverviewData(result)).toBe(false);
  });

  it("returns false when all metric values are null", () => {
    const result: OverviewQueryResult = {
      status: "success",
      data: {
        columns: [
          { name: "timestamp", type: "date" },
          { name: "metric", type: "double" },
        ],
        values: [
          ["2024-01-01", null],
          ["2024-01-02", null],
        ],
      },
    };
    expect(hasOverviewData(result)).toBe(false);
  });

  it("returns true when at least one metric value is non-null (success)", () => {
    const result: OverviewQueryResult = {
      status: "success",
      data: {
        columns: [
          { name: "timestamp", type: "date" },
          { name: "metric", type: "double" },
        ],
        values: [
          ["2024-01-01", null],
          ["2024-01-02", 42],
        ],
      },
    };
    expect(hasOverviewData(result)).toBe(true);
  });

  it("returns true when status is loading with stale data", () => {
    const result: OverviewQueryResult = {
      status: "loading",
      data: {
        columns: [{ name: "metric", type: "double" }],
        values: [[10]],
      },
    };
    expect(hasOverviewData(result)).toBe(true);
  });
});
