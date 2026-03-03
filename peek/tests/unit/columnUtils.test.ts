import { describe, it, expect } from "vitest";

import {
  isDateColumn,
  findDateColumnIndex,
  findStringColumnIndices,
  findNumericColumnIndices,
} from "../../src/services/es/columnUtils";
import type { EsqlResponse } from "../../src/types";

describe("isDateColumn", () => {
  it("returns true for date types", () => {
    expect(isDateColumn({ name: "ts", type: "date" })).toBe(true);
    expect(isDateColumn({ name: "ts", type: "datetime" })).toBe(true);
    expect(isDateColumn({ name: "ts", type: "date_nanos" })).toBe(true);
  });

  it("returns true for @timestamp regardless of type", () => {
    expect(isDateColumn({ name: "@timestamp", type: "keyword" })).toBe(true);
  });

  it("returns false for non-date types", () => {
    expect(isDateColumn({ name: "count", type: "long" })).toBe(false);
  });
});

describe("findDateColumnIndex", () => {
  it("finds a date column", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "count", type: "long" },
        { name: "ts", type: "date" },
      ],
      values: [],
    };
    expect(findDateColumnIndex(data)).toBe(1);
  });

  it("returns -1 when no date column exists", () => {
    const data: EsqlResponse = {
      columns: [{ name: "count", type: "long" }],
      values: [],
    };
    expect(findDateColumnIndex(data)).toBe(-1);
  });

  it("finds @timestamp even when typed as keyword", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "count", type: "long" },
        { name: "@timestamp", type: "keyword" },
      ],
      values: [],
    };
    expect(findDateColumnIndex(data)).toBe(1);
  });

  it("finds @timestamp when typed as date", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "count", type: "long" },
        { name: "@timestamp", type: "date" },
      ],
      values: [],
    };
    expect(findDateColumnIndex(data)).toBe(1);
  });
});

describe("findStringColumnIndices", () => {
  it("returns indices of keyword and text columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "id", type: "long" },
        { name: "name", type: "keyword" },
        { name: "desc", type: "text" },
      ],
      values: [],
    };
    expect(findStringColumnIndices(data)).toEqual([1, 2]);
  });

  it("returns empty array when no string columns", () => {
    const data: EsqlResponse = {
      columns: [{ name: "id", type: "long" }],
      values: [],
    };
    expect(findStringColumnIndices(data)).toEqual([]);
  });
});

describe("findNumericColumnIndices", () => {
  it("returns indices of numeric columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "ts", type: "date" },
        { name: "count", type: "long" },
        { name: "avg", type: "double" },
      ],
      values: [],
    };
    expect(findNumericColumnIndices(data)).toEqual([1, 2]);
  });

  it("returns empty array when no numeric columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "ts", type: "date" },
        { name: "name", type: "keyword" },
      ],
      values: [],
    };
    expect(findNumericColumnIndices(data)).toEqual([]);
  });
});
