import { describe, it, expect } from "vitest";

import {
  buildColumnLookup,
  findColumnIndex,
  isDateColumn,
  findDateColumnIndex,
  findStringColumnIndices,
  findNumericColumnIndices,
  getColumnIndex,
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

describe("findColumnIndex", () => {
  const columns = [
    { name: "foo", type: "keyword" },
    { name: "bar", type: "long" },
    { name: "foo", type: "long" },
  ];

  it("returns first matching alias index", () => {
    expect(findColumnIndex(columns, "foo")).toBe(0);
    expect(findColumnIndex(columns, "missing", "bar")).toBe(1);
  });

  it("returns -1 when aliases are absent", () => {
    expect(findColumnIndex(columns, "baz")).toBe(-1);
  });

  it("matches getColumnIndex(buildColumnLookup(...)) semantics", () => {
    const lookup = buildColumnLookup(columns);
    expect(findColumnIndex(columns, "foo")).toBe(getColumnIndex(lookup, "foo"));
    expect(findColumnIndex(columns, "bar")).toBe(getColumnIndex(lookup, "bar"));
  });

  it("honors alias order when multiple aliases exist in columns", () => {
    const dualAliasColumns = [
      { name: "legacy", type: "keyword" },
      { name: "canonical", type: "keyword" },
    ];
    const lookup = buildColumnLookup(dualAliasColumns);

    expect(findColumnIndex(dualAliasColumns, "canonical", "legacy")).toBe(1);
    expect(findColumnIndex(dualAliasColumns, "canonical", "legacy")).toBe(
      getColumnIndex(lookup, "canonical", "legacy"),
    );
  });
});
