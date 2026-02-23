import { describe, it, expect } from "vitest";

import {
  isDateColumn,
  findDateColumnIndex,
  findNumericColumnIndices,
  findStringColumnIndices,
  getColumnValues,
  isDateType,
  isNumericType,
  formatNumber,
  buildGroupedSeries,
} from "../../src/components/visualizations/chartUtils";
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

describe("isDateType", () => {
  it("recognises standard date types", () => {
    expect(isDateType("date")).toBe(true);
    expect(isDateType("datetime")).toBe(true);
    expect(isDateType("date_nanos")).toBe(true);
  });

  it("returns false for non-date types", () => {
    expect(isDateType("long")).toBe(false);
    expect(isDateType("keyword")).toBe(false);
    expect(isDateType("text")).toBe(false);
    expect(isDateType("")).toBe(false);
  });
});

describe("isNumericType", () => {
  it("recognises numeric types", () => {
    expect(isNumericType("long")).toBe(true);
    expect(isNumericType("integer")).toBe(true);
    expect(isNumericType("short")).toBe(true);
    expect(isNumericType("byte")).toBe(true);
    expect(isNumericType("double")).toBe(true);
    expect(isNumericType("float")).toBe(true);
    expect(isNumericType("half_float")).toBe(true);
    expect(isNumericType("scaled_float")).toBe(true);
    expect(isNumericType("unsigned_long")).toBe(true);
    expect(isNumericType("counter_long")).toBe(true);
    expect(isNumericType("counter_integer")).toBe(true);
    expect(isNumericType("counter_double")).toBe(true);
  });

  it("returns false for non-numeric types", () => {
    expect(isNumericType("keyword")).toBe(false);
    expect(isNumericType("text")).toBe(false);
    expect(isNumericType("date")).toBe(false);
    expect(isNumericType("boolean")).toBe(false);
    expect(isNumericType("")).toBe(false);
  });
});

describe("findNumericColumnIndices", () => {
  it("returns indices of numeric columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "ts", type: "date" },
        { name: "count", type: "long" },
        { name: "label", type: "keyword" },
        { name: "avg", type: "double" },
      ],
      values: [],
    };
    expect(findNumericColumnIndices(data)).toEqual([1, 3]);
  });

  it("returns empty array when no numeric columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "ts", type: "date" },
        { name: "label", type: "keyword" },
      ],
      values: [],
    };
    expect(findNumericColumnIndices(data)).toEqual([]);
  });

  it("returns empty array for empty columns", () => {
    const data: EsqlResponse = { columns: [], values: [] };
    expect(findNumericColumnIndices(data)).toEqual([]);
  });
});

describe("findStringColumnIndices", () => {
  it("returns indices of keyword and text columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "id", type: "long" },
        { name: "name", type: "keyword" },
        { name: "desc", type: "text" },
        { name: "ts", type: "date" },
      ],
      values: [],
    };
    expect(findStringColumnIndices(data)).toEqual([1, 2]);
  });

  it("returns empty array when no string columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "id", type: "long" },
        { name: "ts", type: "date" },
      ],
      values: [],
    };
    expect(findStringColumnIndices(data)).toEqual([]);
  });

  it("returns empty array for empty columns", () => {
    const data: EsqlResponse = { columns: [], values: [] };
    expect(findStringColumnIndices(data)).toEqual([]);
  });
});

describe("getColumnValues", () => {
  it("extracts values for the given column index", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "a", type: "keyword" },
        { name: "b", type: "long" },
      ],
      values: [
        ["hello", 1],
        ["world", 2],
        ["foo", 3],
      ],
    };
    expect(getColumnValues(data, 0)).toEqual(["hello", "world", "foo"]);
    expect(getColumnValues(data, 1)).toEqual([1, 2, 3]);
  });

  it("returns undefined for out-of-range column index", () => {
    const data: EsqlResponse = {
      columns: [{ name: "a", type: "keyword" }],
      values: [["hello"], ["world"]],
    };
    expect(getColumnValues(data, 5)).toEqual([undefined, undefined]);
  });

  it("handles null and undefined values", () => {
    const data: EsqlResponse = {
      columns: [{ name: "a", type: "keyword" }],
      values: [[null], [undefined], ["ok"]],
    };
    expect(getColumnValues(data, 0)).toEqual([null, undefined, "ok"]);
  });

  it("returns empty array for no rows", () => {
    const data: EsqlResponse = {
      columns: [{ name: "a", type: "keyword" }],
      values: [],
    };
    expect(getColumnValues(data, 0)).toEqual([]);
  });
});

describe("formatNumber", () => {
  it("returns dash for null and undefined", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
  });

  it("returns string representation for NaN values", () => {
    expect(formatNumber("abc")).toBe("abc");
    expect(formatNumber("not-a-number")).toBe("not-a-number");
  });

  it("formats millions with M suffix", () => {
    expect(formatNumber(1_000_000)).toBe("1.0M");
    expect(formatNumber(2_500_000)).toBe("2.5M");
    expect(formatNumber(-1_000_000)).toBe("-1.0M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatNumber(1_000)).toBe("1.0K");
    expect(formatNumber(1_500)).toBe("1.5K");
    expect(formatNumber(-1_000)).toBe("-1.0K");
  });

  it("formats integers with locale string", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(999)).toBe("999");
  });

  it("formats decimals to 2 places", () => {
    expect(formatNumber(3.14159)).toBe("3.14");
    expect(formatNumber(0.1)).toBe("0.10");
    expect(formatNumber(-2.5)).toBe("-2.50");
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("handles negative numbers below 1000", () => {
    expect(formatNumber(-42)).toBe("-42");
    expect(formatNumber(-999)).toBe("-999");
  });

  it("handles string numbers", () => {
    expect(formatNumber("42")).toBe("42");
    expect(formatNumber("3.14")).toBe("3.14");
  });
});

describe("buildGroupedSeries", () => {
  it("returns one series per numeric column when groupIdx is -1", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "ts", type: "date" },
        { name: "count", type: "long" },
        { name: "avg", type: "double" },
      ],
      values: [
        ["2024-01-01", 10, 1.5],
        ["2024-01-02", 20, 2.5],
      ],
    };
    const result = buildGroupedSeries(data, [1, 2], -1);
    expect(result).toEqual([
      { name: "count", colIdx: 1, rows: [0, 1] },
      { name: "avg", colIdx: 2, rows: [0, 1] },
    ]);
  });

  it("splits by group column when groupIdx >= 0 with single numeric column", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "time_bucket", type: "date" },
        { name: "data_stream.type", type: "keyword" },
      ],
      values: [
        [100, "2024-01-01", "logs"],
        [200, "2024-01-01", "metrics"],
        [150, "2024-01-02", "logs"],
        [250, "2024-01-02", "metrics"],
      ],
    };
    const result = buildGroupedSeries(data, [0], 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "logs", colIdx: 0, rows: [0, 2] });
    expect(result[1]).toEqual({ name: "metrics", colIdx: 0, rows: [1, 3] });
  });

  it("uses 'colName (groupValue)' when multiple numeric columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "avg_cpu", type: "double" },
        { name: "max_mem", type: "double" },
        { name: "host", type: "keyword" },
      ],
      values: [
        [50, 800, "host-a"],
        [60, 900, "host-b"],
      ],
    };
    const result = buildGroupedSeries(data, [0, 1], 2);
    expect(result).toHaveLength(4);
    expect(result[0]!.name).toBe("avg_cpu (host-a)");
    expect(result[1]!.name).toBe("max_mem (host-a)");
    expect(result[2]!.name).toBe("avg_cpu (host-b)");
    expect(result[3]!.name).toBe("max_mem (host-b)");
  });

  it("handles null group values as '(empty)'", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "count", type: "long" },
        { name: "label", type: "keyword" },
      ],
      values: [
        [10, null],
        [20, "A"],
      ],
    };
    const result = buildGroupedSeries(data, [0], 1);
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("(empty)");
    expect(result[0]!.rows).toEqual([0]);
    expect(result[1]!.name).toBe("A");
    expect(result[1]!.rows).toEqual([1]);
  });

  it("returns empty array when no numeric indices are provided", () => {
    const data: EsqlResponse = {
      columns: [{ name: "label", type: "keyword" }],
      values: [["A"], ["B"]],
    };
    expect(buildGroupedSeries(data, [], -1)).toEqual([]);
    expect(buildGroupedSeries(data, [], 0)).toEqual([]);
  });
});
