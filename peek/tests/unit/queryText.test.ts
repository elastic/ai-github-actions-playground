import { describe, expect, it } from "vitest";

import { splitEsqlPipeline, formatEsqlQuery } from "../../src/services/es/queryText";

describe("splitEsqlPipeline (services/es/queryText)", () => {
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

  it("does not split on pipes inside quoted strings", () => {
    expect(splitEsqlPipeline('FROM logs-* | WHERE message == "foo|bar"')).toEqual([
      "FROM logs-*",
      'WHERE message == "foo|bar"',
    ]);
  });

  it("does not split on pipes inside single-quoted strings", () => {
    expect(splitEsqlPipeline("FROM logs-* | WHERE message == 'foo|bar' | LIMIT 1")).toEqual([
      "FROM logs-*",
      "WHERE message == 'foo|bar'",
      "LIMIT 1",
    ]);
  });

  it("does not split on pipes inside comments", () => {
    expect(splitEsqlPipeline("FROM logs-* // note with | pipe\n| LIMIT 5")).toEqual([
      "FROM logs-* // note with | pipe",
      "LIMIT 5",
    ]);
  });
});

describe("formatEsqlQuery (services/es/queryText)", () => {
  it("uppercases the leading keyword of each pipeline stage", () => {
    expect(formatEsqlQuery("from logs-* | sort @timestamp | limit 50")).toBe(
      "FROM logs-*\n| SORT @timestamp\n| LIMIT 50",
    );
  });

  it("returns a single stage without a pipe prefix", () => {
    expect(formatEsqlQuery("FROM logs-*")).toBe("FROM logs-*");
  });

  it("returns the original query unchanged for a blank input", () => {
    expect(formatEsqlQuery("")).toBe("");
    expect(formatEsqlQuery("   ")).toBe("   ");
  });
});
