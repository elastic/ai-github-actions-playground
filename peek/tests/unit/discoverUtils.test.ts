import { describe, expect, it } from "vitest";
import type { EsqlResponse } from "../../src/types";
import {
  filterColumnsByName,
  filterEsqlResult,
  getEmptyColumnIndices,
  paginateRows,
  splitEsqlPipeline,
  toCsv,
} from "../../src/components/discoverUtils";

function createLargeResult(rowCount = 1000, columnCount = 500): EsqlResponse {
  const columns = Array.from({ length: columnCount }, (_, i) => ({
    name: `field_${i}`,
    type: "keyword",
  }));
  const values = Array.from({ length: rowCount }, (_, rowIdx) =>
    Array.from({ length: columnCount }, (_, colIdx) => `r${rowIdx}c${colIdx}`),
  );
  return { columns, values };
}

describe("splitEsqlPipeline", () => {
  it("splits a simple multi-stage query on pipes", () => {
    expect(splitEsqlPipeline("FROM logs-* | SORT @timestamp | LIMIT 50")).toEqual([
      "FROM logs-*",
      "SORT @timestamp",
      "LIMIT 50",
    ]);
  });

  it("returns a single-element array for a query without pipes", () => {
    expect(splitEsqlPipeline("FROM logs-*")).toEqual(["FROM logs-*"]);
  });

  it("returns an empty array for a blank query", () => {
    expect(splitEsqlPipeline("")).toEqual([]);
    expect(splitEsqlPipeline("   ")).toEqual([]);
  });

  it("does not split on pipes inside double-quoted strings", () => {
    expect(splitEsqlPipeline('FROM logs-* | WHERE message == "foo|bar"')).toEqual([
      "FROM logs-*",
      'WHERE message == "foo|bar"',
    ]);
  });

  it("does not split on pipes inside triple-quoted strings", () => {
    expect(splitEsqlPipeline('FROM logs-* | WHERE message == """foo|bar"""')).toEqual([
      "FROM logs-*",
      'WHERE message == """foo|bar"""',
    ]);
  });

  it("does not split on pipes inside backtick-quoted identifiers", () => {
    expect(splitEsqlPipeline("FROM logs-* | RENAME `field|name` AS renamed")).toEqual([
      "FROM logs-*",
      "RENAME `field|name` AS renamed",
    ]);
  });

  it("trims whitespace from each step", () => {
    expect(splitEsqlPipeline("  FROM logs-*  |  LIMIT 10  ")).toEqual([
      "FROM logs-*",
      "LIMIT 10",
    ]);
  });

  it("handles escaped double-quote sequences inside strings", () => {
    expect(splitEsqlPipeline('FROM logs-* | WHERE msg == "it""s fine|here"')).toEqual([
      "FROM logs-*",
      'WHERE msg == "it""s fine|here"',
    ]);
  });

  it("ignores empty stages from consecutive pipes", () => {
    expect(splitEsqlPipeline("FROM logs-* || LIMIT 10")).toEqual(["FROM logs-*", "LIMIT 10"]);
  });

  it("ignores a trailing pipe without adding empty stages", () => {
    expect(splitEsqlPipeline("FROM logs-* | LIMIT 10 |")).toEqual(["FROM logs-*", "LIMIT 10"]);
  });
});

describe("getEmptyColumnIndices", () => {
  it("returns indices of columns where all values are null", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "a", type: "keyword" },
        { name: "b", type: "keyword" },
        { name: "c", type: "keyword" },
      ],
      values: [
        ["hello", null, null],
        ["world", null, null],
      ],
    };
    expect(getEmptyColumnIndices(data)).toEqual(new Set([1, 2]));
  });

  it("returns an empty set when all columns have data", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "a", type: "keyword" },
        { name: "b", type: "keyword" },
      ],
      values: [["hello", "world"]],
    };
    expect(getEmptyColumnIndices(data)).toEqual(new Set());
  });

  it("returns an empty set when there are no rows", () => {
    const data: EsqlResponse = {
      columns: [{ name: "a", type: "keyword" }],
      values: [],
    };
    expect(getEmptyColumnIndices(data)).toEqual(new Set());
  });

  it("treats undefined values as empty", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "a", type: "keyword" },
        { name: "b", type: "keyword" },
      ],
      values: [
        ["hello", undefined],
        ["world", undefined],
      ],
    };
    expect(getEmptyColumnIndices(data)).toEqual(new Set([1]));
  });

  it("does not mark a column as empty when at least one row has a non-null value", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "a", type: "keyword" },
        { name: "b", type: "keyword" },
      ],
      values: [
        [null, null],
        ["hello", null],
      ],
    };
    expect(getEmptyColumnIndices(data)).toEqual(new Set([1]));
  });
});

describe("filterEsqlResult", () => {
  it("filters columns and values using selected fields", () => {
    const result = createLargeResult(3, 4);
    const filtered = filterEsqlResult(result, new Set(["field_1", "field_3"]));

    expect(filtered?.columns.map((c) => c.name)).toEqual(["field_1", "field_3"]);
    expect(filtered?.values).toEqual([
      ["r0c1", "r0c3"],
      ["r1c1", "r1c3"],
      ["r2c1", "r2c3"],
    ]);
  });

  it("supports wide/large result sets within a regression budget", () => {
    const result = createLargeResult();
    const selectedFields = new Set(result.columns.filter((_, i) => i % 2 === 0).map((c) => c.name));

    const start = performance.now();
    const filtered = filterEsqlResult(result, selectedFields);
    const durationMs = performance.now() - start;

    expect(filtered?.columns).toHaveLength(250);
    expect(filtered?.values).toHaveLength(1000);
    expect(filtered?.values[0]).toHaveLength(250);
    expect(durationMs).toBeLessThan(2000);
  });
});

describe("filterColumnsByName", () => {
  it("filters visible field list case-insensitively", () => {
    const result = createLargeResult(1, 5);
    const filtered = filterColumnsByName(result.columns, "FIELD_2");
    expect(filtered.map((c) => c.name)).toEqual(["field_2"]);
  });
});

describe("paginateRows", () => {
  it("returns only rows for the current page", () => {
    const rows = [["r0"], ["r1"], ["r2"], ["r3"], ["r4"]];
    expect(paginateRows(rows, 0, 2)).toEqual([["r0"], ["r1"]]);
    expect(paginateRows(rows, 2, 2)).toEqual([["r4"]]);
  });

  it("returns an empty array when page is beyond available data", () => {
    const rows = [["r0"], ["r1"], ["r2"], ["r3"], ["r4"]];
    expect(paginateRows(rows, 10, 2)).toEqual([]);
  });
});

describe("toCsv", () => {
  it("serializes headers and rows with csv escaping", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "name", type: "keyword" },
        { name: "message", type: "text" },
      ],
      values: [
        ["alice", 'hello "world"'],
        ["bob", "line1\nline2,with comma"],
        [null, undefined],
      ],
    };

    expect(toCsv(data)).toBe(
      'name,message\r\nalice,"hello ""world"""\r\nbob,"line1\nline2,with comma"\r\n,',
    );
  });

  it("prefixes formula-like cells to prevent spreadsheet execution", () => {
    const data: EsqlResponse = {
      columns: [{ name: "value", type: "keyword" }],
      values: [["=SUM(1,2)"], ["+10"], ["-5"], ["@cmd"], [" =SUM(3,4)"]],
    };

    expect(toCsv(data)).toBe(
      'value\r\n"\'=SUM(1,2)"\r\n\'+10\r\n\'-5\r\n\'@cmd\r\n"\' =SUM(3,4)"',
    );
  });
});
