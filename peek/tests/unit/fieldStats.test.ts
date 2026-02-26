import { describe, it, expect, vi } from "vitest";

import {
  isKeywordLikeType,
  isNumericOrDateType,
  buildFieldStatsQuery,
  buildTopValuesQuery,
  buildMinMaxQuery,
  fetchFieldStats,
  computeConfidenceLevel,
} from "../../src/services/es/fieldStats";
import type { ElasticsearchClient } from "../../src/services/es/client";

function makeMockClient(queryFn: ElasticsearchClient["query"]): ElasticsearchClient {
  return { query: queryFn } as unknown as ElasticsearchClient;
}

// ---------------------------------------------------------------------------
// Type classification
// ---------------------------------------------------------------------------

describe("isKeywordLikeType", () => {
  it("returns true for keyword-like types", () => {
    expect(isKeywordLikeType("keyword")).toBe(true);
    expect(isKeywordLikeType("constant_keyword")).toBe(true);
    expect(isKeywordLikeType("wildcard")).toBe(true);
    expect(isKeywordLikeType("text")).toBe(true);
    expect(isKeywordLikeType("ip")).toBe(true);
    expect(isKeywordLikeType("boolean")).toBe(true);
    expect(isKeywordLikeType("version")).toBe(true);
  });

  it("returns false for non-keyword types", () => {
    expect(isKeywordLikeType("long")).toBe(false);
    expect(isKeywordLikeType("date")).toBe(false);
    expect(isKeywordLikeType("double")).toBe(false);
    expect(isKeywordLikeType("geo_point")).toBe(false);
  });
});

describe("isNumericOrDateType", () => {
  it("returns true for numeric types", () => {
    expect(isNumericOrDateType("long")).toBe(true);
    expect(isNumericOrDateType("integer")).toBe(true);
    expect(isNumericOrDateType("double")).toBe(true);
    expect(isNumericOrDateType("float")).toBe(true);
    expect(isNumericOrDateType("short")).toBe(true);
    expect(isNumericOrDateType("byte")).toBe(true);
    expect(isNumericOrDateType("half_float")).toBe(true);
    expect(isNumericOrDateType("scaled_float")).toBe(true);
    expect(isNumericOrDateType("unsigned_long")).toBe(true);
    expect(isNumericOrDateType("counter_long")).toBe(true);
    expect(isNumericOrDateType("counter_double")).toBe(true);
    expect(isNumericOrDateType("counter_integer")).toBe(true);
    expect(isNumericOrDateType("aggregate_metric_double")).toBe(true);
  });

  it("returns true for date types", () => {
    expect(isNumericOrDateType("date")).toBe(true);
    expect(isNumericOrDateType("date_nanos")).toBe(true);
  });

  it("returns false for non-numeric/date types", () => {
    expect(isNumericOrDateType("keyword")).toBe(false);
    expect(isNumericOrDateType("text")).toBe(false);
    expect(isNumericOrDateType("boolean")).toBe(false);
    expect(isNumericOrDateType("geo_point")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeConfidenceLevel
// ---------------------------------------------------------------------------

describe("computeConfidenceLevel", () => {
  it('returns "high" when totalCount is well below the sample limit', () => {
    // 1,000 docs against default 50,000 sample → clearly full coverage
    expect(computeConfidenceLevel(1000)).toBe("high");
    expect(computeConfidenceLevel(0)).toBe("high");
    expect(computeConfidenceLevel(24999)).toBe("high");
  });

  it('returns "medium" when totalCount is between 50% and 100% of the sample limit', () => {
    expect(computeConfidenceLevel(25000)).toBe("medium");
    expect(computeConfidenceLevel(40000)).toBe("medium");
    expect(computeConfidenceLevel(49999)).toBe("medium");
  });

  it('returns "low" when the sample limit is reached', () => {
    expect(computeConfidenceLevel(50000)).toBe("low");
    expect(computeConfidenceLevel(99999)).toBe("low");
  });

  it("respects a custom sampleSize", () => {
    expect(computeConfidenceLevel(600, 1000)).toBe("medium"); // 60% of 1000
    expect(computeConfidenceLevel(200, 1000)).toBe("high"); // 20% of 1000
    expect(computeConfidenceLevel(1000, 1000)).toBe("low"); // at cap
  });
});

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

describe("buildFieldStatsQuery", () => {
  it("builds a STATS query with total, non_null, and cardinality", () => {
    const q = buildFieldStatsQuery("logs-*", "host.name");
    expect(q).toContain("FROM logs-*");
    expect(q).toContain("LIMIT 50000");
    expect(q).toContain("COUNT(*)");
    expect(q).toContain("COUNT(`host.name`)");
    expect(q).toContain("COUNT_DISTINCT(`host.name`)");
    expect(q).toContain("total");
    expect(q).toContain("non_null");
    expect(q).toContain("cardinality");
  });
});

describe("buildTopValuesQuery", () => {
  it("builds a top-values query with COUNT BY and SORT", () => {
    const q = buildTopValuesQuery("logs-*", "host.name");
    expect(q).toContain("FROM logs-*");
    expect(q).toContain("LIMIT 50000");
    expect(q).toContain("COUNT(*) BY `host.name`");
    expect(q).toContain("SORT count DESC");
    expect(q).toContain("LIMIT 10");
  });

  it("respects a custom limit", () => {
    const q = buildTopValuesQuery("logs-*", "host.name", 5);
    expect(q).toContain("LIMIT 5");
  });
});

describe("buildMinMaxQuery", () => {
  it("builds a MIN/MAX query for a numeric field", () => {
    const q = buildMinMaxQuery("logs-*", "event.duration");
    expect(q).toContain("FROM logs-*");
    expect(q).toContain("LIMIT 50000");
    expect(q).toContain("MIN(`event.duration`)");
    expect(q).toContain("MAX(`event.duration`)");
    expect(q).toContain("min_val");
    expect(q).toContain("max_val");
  });
});

// ---------------------------------------------------------------------------
// fetchFieldStats
// ---------------------------------------------------------------------------

const statsRow = [1000, 800, 42]; // total, non_null, cardinality
const statsColumns = [
  { name: "total", type: "long" },
  { name: "non_null", type: "long" },
  { name: "cardinality", type: "long" },
];

describe("fetchFieldStats — keyword field", () => {
  it("returns counts, null%, cardinality, and top values", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] })
      .mockResolvedValueOnce({
        columns: [
          { name: "count", type: "long" },
          { name: "host.name", type: "keyword" },
        ],
        values: [
          [500, "web-01"],
          [300, "web-02"],
        ],
      });
    const client = makeMockClient(queryFn);

    const result = await fetchFieldStats(client, "logs-*", "host.name", "keyword");

    expect(result.totalCount).toBe(1000);
    expect(result.nonNullCount).toBe(800);
    expect(result.nullPercent).toBeCloseTo(20);
    expect(result.cardinality).toBe(42);
    expect(result.topValues).toEqual([
      { value: "web-01", count: 500 },
      { value: "web-02", count: 300 },
    ]);
    expect(result.min).toBeUndefined();
    expect(result.max).toBeUndefined();
    expect(result.sampleCoverage).toBeCloseTo(1000 / 50000);
    expect(result.confidence).toBe("high");
  });

  it("returns empty topValues when no rows are returned", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] })
      .mockResolvedValueOnce({
        columns: [
          { name: "count", type: "long" },
          { name: "host.name", type: "keyword" },
        ],
        values: [],
      });
    const client = makeMockClient(queryFn);

    const result = await fetchFieldStats(client, "logs-*", "host.name", "keyword");

    expect(result.topValues).toEqual([]);
  });

  it("returns empty topValues when expected columns are missing", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] })
      .mockResolvedValueOnce({
        columns: [{ name: "other", type: "keyword" }],
        values: [],
      });
    const client = makeMockClient(queryFn);

    const result = await fetchFieldStats(client, "logs-*", "host.name", "keyword");

    expect(result.topValues).toEqual([]);
  });

  it("filters null values out of topValues", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] })
      .mockResolvedValueOnce({
        columns: [
          { name: "count", type: "long" },
          { name: "host.name", type: "keyword" },
        ],
        values: [
          [500, "web-01"],
          [200, null],
        ],
      });
    const client = makeMockClient(queryFn);

    const result = await fetchFieldStats(client, "logs-*", "host.name", "keyword");

    expect(result.topValues).toEqual([{ value: "web-01", count: 500 }]);
  });
});

describe("fetchFieldStats — numeric field", () => {
  it("returns counts, null%, cardinality, and min/max", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] })
      .mockResolvedValueOnce({
        columns: [
          { name: "min_val", type: "long" },
          { name: "max_val", type: "long" },
        ],
        values: [[0, 9999]],
      });
    const client = makeMockClient(queryFn);

    const result = await fetchFieldStats(client, "logs-*", "event.duration", "long");

    expect(result.min).toBe(0);
    expect(result.max).toBe(9999);
    expect(result.topValues).toBeUndefined();
  });

  it("handles null min/max gracefully", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] })
      .mockResolvedValueOnce({
        columns: [
          { name: "min_val", type: "long" },
          { name: "max_val", type: "long" },
        ],
        values: [[null, null]],
      });
    const client = makeMockClient(queryFn);

    const result = await fetchFieldStats(client, "logs-*", "event.duration", "long");

    expect(result.min).toBeNull();
    expect(result.max).toBeNull();
  });
});

describe("fetchFieldStats — date field", () => {
  it("returns min/max for date type", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] })
      .mockResolvedValueOnce({
        columns: [
          { name: "min_val", type: "date" },
          { name: "max_val", type: "date" },
        ],
        values: [["2024-01-01T00:00:00Z", "2024-12-31T23:59:59Z"]],
      });
    const client = makeMockClient(queryFn);

    const result = await fetchFieldStats(client, "logs-*", "@timestamp", "date");

    expect(result.min).toBe("2024-01-01T00:00:00Z");
    expect(result.max).toBe("2024-12-31T23:59:59Z");
    expect(result.topValues).toBeUndefined();
  });
});

describe("fetchFieldStats — unknown type", () => {
  it("returns only counts/cardinality without topValues or min/max", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] });
    const client = makeMockClient(queryFn);

    const result = await fetchFieldStats(client, "logs-*", "location", "geo_point");

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(result.topValues).toBeUndefined();
    expect(result.min).toBeUndefined();
    expect(result.max).toBeUndefined();
  });
});

describe("fetchFieldStats — null percent calculation", () => {
  it("computes 0% when all docs have the field", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce({
      columns: statsColumns,
      values: [[100, 100, 5]],
    });
    const client = makeMockClient(queryFn);
    const result = await fetchFieldStats(client, "logs-*", "host.name", "geo_point");
    expect(result.nullPercent).toBe(0);
  });

  it("computes 100% when no docs have the field", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce({
      columns: statsColumns,
      values: [[100, 0, 0]],
    });
    const client = makeMockClient(queryFn);
    const result = await fetchFieldStats(client, "logs-*", "host.name", "geo_point");
    expect(result.nullPercent).toBe(100);
  });

  it("handles empty stream (totalCount = 0) without division by zero", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce({
      columns: statsColumns,
      values: [[0, 0, 0]],
    });
    const client = makeMockClient(queryFn);
    const result = await fetchFieldStats(client, "logs-*", "host.name", "geo_point");
    expect(result.nullPercent).toBe(0);
  });
});

describe("fetchFieldStats — signal propagation", () => {
  it("passes the abort signal to both ES|QL queries", async () => {
    const controller = new AbortController();
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: statsColumns, values: [statsRow] })
      .mockResolvedValueOnce({
        columns: [
          { name: "count", type: "long" },
          { name: "host.name", type: "keyword" },
        ],
        values: [],
      });
    const client = makeMockClient(queryFn);

    await fetchFieldStats(client, "logs-*", "host.name", "keyword", controller.signal);

    expect(queryFn).toHaveBeenCalledWith(expect.anything(), controller.signal);
  });
});
