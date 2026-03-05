import { describe, expect, it } from "vitest";

import { appendPipeClause, buildLogsQuery } from "../../src/components/logs/logsQueryBuilder";

describe("buildLogsQuery", () => {
  it("builds query with structured filters and keep columns", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: "",
      filters: [
        { field: "service.name", value: "checkout-service" },
        { field: "log.level", value: "debug", exclude: true },
      ],
      selectedColumns: ["@timestamp", "service.name", "log.level", "message"],
    });

    expect(query).toContain(
      'FROM logs-* | WHERE @timestamp >= NOW() - 1 hour AND service.name == "checkout-service" AND (log.level != "debug" OR log.level IS NULL)',
    );
    expect(query).toContain("KEEP @timestamp, service.name, log.level, message");
  });

  it("skips blank filter values", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: "",
      filters: [{ field: "service.name", value: "   " }],
      selectedColumns: ["@timestamp", "message"],
    });

    expect(query).toBe(
      "FROM logs-* | WHERE @timestamp >= NOW() - 1 hour | SORT @timestamp DESC | KEEP @timestamp, message | LIMIT 500",
    );
  });

  it("uses phrase query when search text is quoted", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: '"connection reset"',
      filters: [],
      selectedColumns: ["@timestamp", "message"],
    });

    expect(query).toContain('MATCH_PHRASE(message, "connection reset")');
  });

  it("normalizes escaped quoted phrase before building ES|QL", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: '"Error: \\"C:\\\\temp\\\\app.log\\""',
      filters: [],
      selectedColumns: ["@timestamp", "message"],
    });

    expect(query).toContain('MATCH_PHRASE(message, "Error: \\"C:\\\\temp\\\\app.log\\"")');
  });

  it("uses match operator when search text is unquoted", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: "connection reset",
      filters: [],
      selectedColumns: ["@timestamp", "message"],
    });

    expect(query).toContain('message : "connection reset"');
  });

  it("supports configurable time range and limit", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: "",
      filters: [],
      selectedColumns: ["@timestamp", "message"],
      timeRange: { amount: 2, unit: "day" },
      limit: 1000,
    });

    expect(query).toContain("@timestamp >= NOW() - 2 days");
    expect(query).toContain("LIMIT 1000");
  });
});

describe("appendPipeClause", () => {
  it("appends a clause using pipe separators", () => {
    expect(appendPipeClause("FROM logs-*", "LIMIT 10")).toBe("FROM logs-* | LIMIT 10");
  });

  it("returns query when clause is blank", () => {
    expect(appendPipeClause("FROM logs-*", "  ")).toBe("FROM logs-*");
  });

  it("returns clause when query is blank", () => {
    expect(appendPipeClause("   ", " LIMIT 10 ")).toBe("LIMIT 10");
  });

  it("trims both query and clause before joining", () => {
    expect(appendPipeClause("FROM logs-*  ", "  LIMIT 10")).toBe("FROM logs-* | LIMIT 10");
  });
});
