import { describe, it, expect } from "vitest";

import {
  buildExplorerQuery,
  buildOverviewQuery,
  getDefaultAggregation,
  getAggregationOptions,
} from "../../src/services/es/queryBuilder";
import type { ExplorerQuery, OverviewQuery } from "../../src/services/es/queryBuilder";

function makeQuery(overrides: Partial<ExplorerQuery> = {}): ExplorerQuery {
  return {
    indexPattern: "metrics-*",
    metricField: "system.cpu.total.pct",
    metricType: "gauge",
    aggregation: "avg",
    filters: [],
    timeRange: { from: "now-1h", to: "now" },
    ...overrides,
  };
}

describe("buildExplorerQuery", () => {
  it("builds a basic gauge query with no filters", () => {
    const result = buildExplorerQuery(makeQuery());

    expect(result.esql).toContain("FROM metrics-*");
    expect(result.esql).toContain("AVG(`system.cpu.total.pct`)");
    expect(result.esql).toContain("BUCKET(@timestamp, 50,");
    expect(result.esql).toContain("SORT timestamp");
    expect(result.yAxisLabel).toBe("Avg pct");
  });

  it("builds a sum aggregation for counter metrics", () => {
    const result = buildExplorerQuery(makeQuery({ metricType: "counter", aggregation: "sum" }));

    expect(result.esql).toContain("SUM(`system.cpu.total.pct`)");
    expect(result.yAxisLabel).toBe("Sum pct");
  });

  it("includes WHERE clause with filters", () => {
    const result = buildExplorerQuery(
      makeQuery({
        filters: [
          { field: "host.name", op: "==", value: "web-01" },
          { field: "service.name", op: "!=", value: "test" },
        ],
      }),
    );

    expect(result.esql).toContain('`host.name` == "web-01"');
    expect(result.esql).toContain('`service.name` != "test"');
  });

  it("includes LIKE operator in filters", () => {
    const result = buildExplorerQuery(
      makeQuery({
        filters: [{ field: "host.name", op: "LIKE", value: "web-*" }],
      }),
    );

    expect(result.esql).toContain('`host.name` LIKE "web-*"');
  });

  it("escapes special characters in filter values", () => {
    const result = buildExplorerQuery(
      makeQuery({
        filters: [{ field: "host.name", op: "==", value: 'my "host"' }],
      }),
    );

    expect(result.esql).toContain('`host.name` == "my \\"host\\""');
  });

  it("includes groupBy in STATS clause", () => {
    const result = buildExplorerQuery(makeQuery({ groupBy: "service.name" }));

    expect(result.esql).toContain("BY timestamp =");
    expect(result.esql).toContain(", `service.name`");
  });

  it("escapes metric field identifiers containing backticks in aggregation expressions", () => {
    const result = buildExplorerQuery(makeQuery({ metricField: "field`with`backticks" }));
    expect(result.esql).toContain("AVG(`field``with``backticks`)");
  });

  it("escapes groupBy field identifiers containing backticks", () => {
    const result = buildExplorerQuery(makeQuery({ groupBy: "dim`field" }));
    expect(result.esql).toContain(", `dim``field`");
  });

  it("uses custom bucket count", () => {
    const result = buildExplorerQuery(makeQuery({ bucketCount: 100 }));

    expect(result.esql).toContain("BUCKET(@timestamp, 100,");
  });

  it("builds min aggregation", () => {
    const result = buildExplorerQuery(makeQuery({ aggregation: "min" }));
    expect(result.esql).toContain("MIN(`system.cpu.total.pct`)");
    expect(result.yAxisLabel).toBe("Min pct");
  });

  it("builds max aggregation", () => {
    const result = buildExplorerQuery(makeQuery({ aggregation: "max" }));
    expect(result.esql).toContain("MAX(`system.cpu.total.pct`)");
    expect(result.yAxisLabel).toBe("Max pct");
  });

  it("builds count aggregation", () => {
    const result = buildExplorerQuery(makeQuery({ aggregation: "count" }));
    expect(result.esql).toContain("COUNT(`system.cpu.total.pct`)");
    expect(result.yAxisLabel).toBe("Count pct");
  });

  it("builds p50 percentile aggregation", () => {
    const result = buildExplorerQuery(makeQuery({ aggregation: "p50" }));
    expect(result.esql).toContain("PERCENTILE(`system.cpu.total.pct`, 50)");
    expect(result.yAxisLabel).toBe("p50 pct");
  });

  it("builds p95 percentile aggregation", () => {
    const result = buildExplorerQuery(makeQuery({ aggregation: "p95" }));
    expect(result.esql).toContain("PERCENTILE(`system.cpu.total.pct`, 95)");
    expect(result.yAxisLabel).toBe("p95 pct");
  });

  it("builds p99 percentile aggregation", () => {
    const result = buildExplorerQuery(makeQuery({ aggregation: "p99" }));
    expect(result.esql).toContain("PERCENTILE(`system.cpu.total.pct`, 99)");
    expect(result.yAxisLabel).toBe("p99 pct");
  });

  it("includes time range in WHERE clause", () => {
    const result = buildExplorerQuery(makeQuery({ timeRange: { from: "now-7d", to: "now" } }));

    expect(result.esql).toContain("@timestamp >= ?_tstart");
    expect(result.esql).toContain("@timestamp <= ?_tend");
  });

  it("handles filters with backslashes", () => {
    const result = buildExplorerQuery(
      makeQuery({
        filters: [{ field: "path", op: "==", value: "C:\\Users\\test" }],
      }),
    );

    expect(result.esql).toContain('`path` == "C:\\\\Users\\\\test"');
  });

  it("combines multiple filters with AND", () => {
    const result = buildExplorerQuery(
      makeQuery({
        filters: [
          { field: "host.name", op: "==", value: "web-01" },
          { field: "region", op: "==", value: "us-east-1" },
          { field: "env", op: "!=", value: "staging" },
        ],
      }),
    );

    const whereSection = result.esql.split("WHERE ")[1]?.split(" | ")[0] ?? "";
    expect(whereSection).toContain('`host.name` == "web-01"');
    expect(whereSection).toContain('`region` == "us-east-1"');
    expect(whereSection).toContain('`env` != "staging"');
    // All connected by AND
    expect(whereSection.match(/AND/g)?.length).toBe(4);
  });
});

describe("getDefaultAggregation", () => {
  it("returns avg for gauge metrics", () => {
    expect(getDefaultAggregation("gauge")).toBe("avg");
  });

  it("returns count aggregation for counter metrics (SUM/AVG/etc are unsupported for counter types)", () => {
    expect(getDefaultAggregation("counter")).toBe("count");
  });
});

describe("getAggregationOptions", () => {
  it("returns gauge-appropriate options starting with avg", () => {
    const options = getAggregationOptions("gauge");
    expect(options[0]).toBe("avg");
    expect(options).toContain("sum");
    expect(options).toContain("min");
    expect(options).toContain("max");
    expect(options).toContain("count");
    expect(options).toContain("p50");
    expect(options).toContain("p95");
    expect(options).toContain("p99");
  });

  it("returns counter-appropriate options (count only, since SUM/AVG/etc are unsupported for counter types)", () => {
    const options = getAggregationOptions("counter");
    expect(options).toEqual(["count"]);
  });
});

// ---------------------------------------------------------------------------
// buildOverviewQuery
// ---------------------------------------------------------------------------

function makeOverviewQuery(overrides: Partial<OverviewQuery> = {}): OverviewQuery {
  return {
    indexPattern: "metrics-*",
    metricField: "system.cpu.total.pct",
    metricType: "gauge",
    timeRange: { from: "now-1h", to: "now" },
    ...overrides,
  };
}

describe("buildOverviewQuery", () => {
  it("builds an overview query with 20 buckets by default", () => {
    const result = buildOverviewQuery(makeOverviewQuery());
    expect(result.esql).toContain("FROM metrics-*");
    expect(result.esql).toContain("AVG(`system.cpu.total.pct`)");
    expect(result.esql).toContain("BUCKET(@timestamp, 20,");
    expect(result.esql).toContain("SORT timestamp");
  });

  it("uses count aggregation for counter metrics", () => {
    const result = buildOverviewQuery(makeOverviewQuery({ metricType: "counter" }));
    expect(result.esql).toContain("COUNT(`system.cpu.total.pct`)");
  });

  it("includes time range in WHERE clause", () => {
    const result = buildOverviewQuery(makeOverviewQuery());
    expect(result.esql).toContain("@timestamp >= ?_tstart");
    expect(result.esql).toContain("@timestamp <= ?_tend");
  });

  it("uses custom bucket count", () => {
    const result = buildOverviewQuery(makeOverviewQuery({ bucketCount: 10 }));
    expect(result.esql).toContain("BUCKET(@timestamp, 10,");
  });

  it("returns a meaningful y-axis label", () => {
    const result = buildOverviewQuery(makeOverviewQuery());
    expect(result.yAxisLabel).toBe("Avg pct");
  });

  it("does not include GROUP BY or filters", () => {
    const result = buildOverviewQuery(makeOverviewQuery());
    expect(result.esql).not.toContain("GROUP BY");
    expect(result.esql).not.toContain("LIKE");
    expect(result.esql).not.toContain("==");
  });
});
