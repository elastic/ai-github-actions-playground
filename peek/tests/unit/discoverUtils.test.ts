import { describe, expect, it } from "vitest";

import type { EsqlResponse } from "../../src/types";
import {
  filterColumnsByName,
  filterEsqlResult,
  formatEsqlQuery,
  getEmptyColumnIndices,
  paginateRows,
  splitEsqlPipeline,
  toCsv,
  applyEsqlSort,
  buildColumnInsightsQuery,
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

  it("does not split on pipes inside single-quoted strings", () => {
    expect(splitEsqlPipeline("FROM logs-* | WHERE message == 'foo|bar'")).toEqual([
      "FROM logs-*",
      "WHERE message == 'foo|bar'",
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
    expect(splitEsqlPipeline("  FROM logs-*  |  LIMIT 10  ")).toEqual(["FROM logs-*", "LIMIT 10"]);
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

  it("does not split on pipes inside single-quoted strings", () => {
    expect(splitEsqlPipeline("FROM logs-* | WHERE message == 'foo|bar' | LIMIT 1")).toEqual([
      "FROM logs-*",
      "WHERE message == 'foo|bar'",
      "LIMIT 1",
    ]);
  });

  it("handles escaped single-quote sequences inside single-quoted strings", () => {
    expect(splitEsqlPipeline("FROM logs-* | WHERE msg == 'it''s fine|here'")).toEqual([
      "FROM logs-*",
      "WHERE msg == 'it''s fine|here'",
    ]);
  });

  it("does not split on pipes inside // line comments", () => {
    expect(splitEsqlPipeline("FROM logs-* // note with | pipe\n| LIMIT 5")).toEqual([
      "FROM logs-* // note with | pipe",
      "LIMIT 5",
    ]);
  });

  it("does not split on pipes inside /* block comments */", () => {
    expect(splitEsqlPipeline("FROM logs-* /* note with | pipe */ | LIMIT 5")).toEqual([
      "FROM logs-* /* note with | pipe */",
      "LIMIT 5",
    ]);
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

    expect(toCsv(data)).toBe("value\r\n\"'=SUM(1,2)\"\r\n'+10\r\n'-5\r\n'@cmd\r\n\"' =SUM(3,4)\"");
  });
});

describe("formatEsqlQuery", () => {
  it("uppercases the leading keyword of each pipeline stage", () => {
    expect(formatEsqlQuery("from logs-* | sort @timestamp | limit 50")).toBe(
      "FROM logs-*\n| SORT @timestamp\n| LIMIT 50",
    );
  });

  it("uppercases mixed-case leading keywords", () => {
    expect(formatEsqlQuery('From logs-* | Where level == "error"')).toBe(
      'FROM logs-*\n| WHERE level == "error"',
    );
  });

  it("joins multiple stages with newline + pipe prefix", () => {
    expect(formatEsqlQuery("FROM logs-* | STATS count(*) | SORT count DESC")).toBe(
      "FROM logs-*\n| STATS count(*)\n| SORT count DESC",
    );
  });

  it("returns a single stage without a pipe prefix", () => {
    expect(formatEsqlQuery("FROM logs-*")).toBe("FROM logs-*");
  });

  it("returns the original query unchanged for a blank input", () => {
    expect(formatEsqlQuery("")).toBe("");
    expect(formatEsqlQuery("   ")).toBe("   ");
  });

  it("preserves already-uppercase keywords", () => {
    expect(formatEsqlQuery("FROM logs-* | SORT @timestamp DESC | LIMIT 50")).toBe(
      "FROM logs-*\n| SORT @timestamp DESC\n| LIMIT 50",
    );
  });

  it("does not alter non-keyword content in each stage", () => {
    expect(formatEsqlQuery('FROM logs-* | WHERE message == "hello|world"')).toBe(
      'FROM logs-*\n| WHERE message == "hello|world"',
    );
  });

  it("preserves comments containing pipes", () => {
    expect(formatEsqlQuery("from logs-* // note with | pipe\n| limit 5")).toBe(
      "FROM logs-* // note with | pipe\n| LIMIT 5",
    );
  });
});

describe("applyEsqlSort", () => {
  it("preserves pipes inside single-quoted literals when inserting SORT", () => {
    expect(
      applyEsqlSort("FROM logs-* | WHERE message == 'foo|bar' | LIMIT 10", "message", "asc"),
    ).toBe("FROM logs-* | WHERE message == 'foo|bar' | SORT `message` ASC | LIMIT 10");
  });

  it("preserves escaped single-quoted literals when inserting SORT", () => {
    expect(applyEsqlSort("FROM logs-* | WHERE msg == 'it''s fine|here'", "message", "asc")).toBe(
      "FROM logs-* | WHERE msg == 'it''s fine|here' | SORT `message` ASC",
    );
  });

  it("appends a SORT step before LIMIT when no SORT exists", () => {
    expect(applyEsqlSort("FROM logs-* | LIMIT 50", "message", "asc")).toBe(
      "FROM logs-* | SORT `message` ASC | LIMIT 50",
    );
  });

  it("appends a SORT step at the end when no LIMIT exists", () => {
    expect(applyEsqlSort("FROM logs-*", "message", "asc")).toBe("FROM logs-* | SORT `message` ASC");
  });

  it("replaces an existing SORT step", () => {
    expect(applyEsqlSort("FROM logs-* | SORT @timestamp DESC | LIMIT 50", "message", "asc")).toBe(
      "FROM logs-* | SORT `message` ASC | LIMIT 50",
    );
  });

  it("removes SORT when direction is null", () => {
    expect(applyEsqlSort("FROM logs-* | SORT @timestamp | LIMIT 50", "@timestamp", null)).toBe(
      "FROM logs-* | LIMIT 50",
    );
  });

  it("quotes identifiers that require backticks", () => {
    expect(applyEsqlSort("FROM logs-*", "field name", "desc")).toBe(
      "FROM logs-* | SORT `field name` DESC",
    );
  });

  it("escapes backticks inside quoted identifiers", () => {
    expect(applyEsqlSort("FROM logs-*", "field`name", "asc")).toBe(
      "FROM logs-* | SORT `field``name` ASC",
    );
  });

  it("always quotes identifiers with backticks", () => {
    expect(applyEsqlSort("FROM logs-*", "@timestamp", "asc")).toBe(
      "FROM logs-* | SORT `@timestamp` ASC",
    );
  });
});

describe("buildColumnInsightsQuery", () => {
  it("generates a STATS min/max/avg query for a numeric column", () => {
    expect(buildColumnInsightsQuery("FROM logs-* | LIMIT 50", "count", "long")).toBe(
      "FROM logs-* | LIMIT 500 | STATS MIN(`count`) AS min_value, MAX(`count`) AS max_value, AVG(`count`) AS avg_value, COUNT(*) AS total_count, COUNT(*) - COUNT(`count`) AS null_count",
    );
  });

  it("generates a top-N values query for a keyword column", () => {
    expect(buildColumnInsightsQuery("FROM logs-* | LIMIT 50", "status", "keyword")).toBe(
      "FROM logs-* | LIMIT 500 | STATS value_count = COUNT(*) BY `status` | SORT value_count DESC | LIMIT 10",
    );
  });

  it("generates a top-N values query for a text column", () => {
    expect(buildColumnInsightsQuery("FROM logs-*", "message", "text")).toBe(
      "FROM logs-* | LIMIT 500 | STATS value_count = COUNT(*) BY `message` | SORT value_count DESC | LIMIT 10",
    );
  });

  it("strips existing SORT and LIMIT steps from the base query", () => {
    expect(
      buildColumnInsightsQuery("FROM logs-* | SORT @timestamp DESC | LIMIT 50", "count", "long"),
    ).toBe(
      "FROM logs-* | LIMIT 500 | STATS MIN(`count`) AS min_value, MAX(`count`) AS max_value, AVG(`count`) AS avg_value, COUNT(*) AS total_count, COUNT(*) - COUNT(`count`) AS null_count",
    );
  });

  it("strips existing STATS steps from the base query", () => {
    expect(
      buildColumnInsightsQuery(
        "FROM logs-* | STATS AVG(response_time) BY service",
        "response_time",
        "double",
      ),
    ).toBe(
      "FROM logs-* | LIMIT 500 | STATS MIN(`response_time`) AS min_value, MAX(`response_time`) AS max_value, AVG(`response_time`) AS avg_value, COUNT(*) AS total_count, COUNT(*) - COUNT(`response_time`) AS null_count",
    );
  });

  it("drops post-aggregation steps after an existing STATS stage", () => {
    expect(
      buildColumnInsightsQuery(
        "FROM logs-* | STATS avg_rt = AVG(rt) BY service | WHERE avg_rt > 100",
        "status",
        "keyword",
      ),
    ).toBe(
      "FROM logs-* | LIMIT 500 | STATS value_count = COUNT(*) BY `status` | SORT value_count DESC | LIMIT 10",
    );
  });

  it("preserves WHERE filters in the base query", () => {
    expect(
      buildColumnInsightsQuery(
        'FROM logs-* | WHERE level == "error" | LIMIT 50',
        "count",
        "integer",
      ),
    ).toBe(
      'FROM logs-* | WHERE level == "error" | LIMIT 500 | STATS MIN(`count`) AS min_value, MAX(`count`) AS max_value, AVG(`count`) AS avg_value, COUNT(*) AS total_count, COUNT(*) - COUNT(`count`) AS null_count',
    );
  });

  it("quotes column names that contain special characters", () => {
    expect(buildColumnInsightsQuery("FROM logs-*", "field name", "keyword")).toBe(
      "FROM logs-* | LIMIT 500 | STATS value_count = COUNT(*) BY `field name` | SORT value_count DESC | LIMIT 10",
    );
  });

  it("returns an empty string for a blank base query", () => {
    expect(buildColumnInsightsQuery("", "count", "long")).toBe("");
    expect(buildColumnInsightsQuery("   ", "count", "long")).toBe("");
  });
});
