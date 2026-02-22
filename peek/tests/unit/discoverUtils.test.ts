import { describe, expect, it } from "vitest";
import type { EsqlResponse } from "../../src/types";
import {
  filterColumnsByName,
  filterEsqlResult,
  paginateRows,
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
});
