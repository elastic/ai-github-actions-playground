import { describe, it, expect } from "vitest";
import { isDateColumn, findDateColumnIndex } from "../../src/components/visualizations/chartUtils";
import type { EsqlResponse } from "../../src/types";

describe("isDateColumn", () => {
  it("returns true for a column with a date type", () => {
    expect(isDateColumn({ name: "ts", type: "date" })).toBe(true);
    expect(isDateColumn({ name: "ts", type: "datetime" })).toBe(true);
    expect(isDateColumn({ name: "ts", type: "date_nanos" })).toBe(true);
  });

  it("returns false for non-date types", () => {
    expect(isDateColumn({ name: "count", type: "long" })).toBe(false);
    expect(isDateColumn({ name: "label", type: "keyword" })).toBe(false);
  });

  it("returns true for a column named @timestamp regardless of type", () => {
    expect(isDateColumn({ name: "@timestamp", type: "date" })).toBe(true);
    expect(isDateColumn({ name: "@timestamp", type: "keyword" })).toBe(true);
    expect(isDateColumn({ name: "@timestamp", type: "unknown" })).toBe(true);
  });
});

describe("findDateColumnIndex", () => {
  it("finds a column with a date type", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "count", type: "long" },
        { name: "ts", type: "date" },
      ],
      values: [],
    };
    expect(findDateColumnIndex(data)).toBe(1);
  });

  it("finds @timestamp column even when its type is not a recognised date type", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "count", type: "long" },
        { name: "@timestamp", type: "keyword" },
      ],
      values: [],
    };
    expect(findDateColumnIndex(data)).toBe(1);
  });

  it("returns -1 when there is no date column", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "count", type: "long" },
        { name: "label", type: "keyword" },
      ],
      values: [],
    };
    expect(findDateColumnIndex(data)).toBe(-1);
  });
});
