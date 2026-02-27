import { describe, it, expect, vi, afterEach } from "vitest";

import { buildEsqlRequest } from "../../src/services/es/buildEsqlRequest";

const NOW = new Date("2025-06-15T12:00:00.000Z");

describe("buildEsqlRequest", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns bare query body when no options given", () => {
    const result = buildEsqlRequest("FROM logs-* | LIMIT 10");
    expect(result).toEqual({ query: "FROM logs-* | LIMIT 10" });
  });

  it("returns bare query body when timeRange is undefined", () => {
    const result = buildEsqlRequest("FROM logs-* | LIMIT 10", { timeRange: undefined });
    expect(result).toEqual({ query: "FROM logs-* | LIMIT 10" });
  });

  it("does not include filter by default (includeTimeRangeFilter=false)", () => {
    vi.useFakeTimers({ now: NOW });
    const result = buildEsqlRequest(
      "FROM logs-* | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)",
      { timeRange: { from: "now-1h", to: "now" } },
    );
    expect(result.filter).toBeUndefined();
    expect(result.params).toHaveLength(2);
  });

  it("includes @timestamp range filter when includeTimeRangeFilter=true", () => {
    const result = buildEsqlRequest("FROM logs-* | LIMIT 10", {
      timeRange: { from: "2025-01-01T00:00:00Z", to: "2025-01-02T00:00:00Z" },
      includeTimeRangeFilter: true,
    });
    expect(result.filter).toEqual({
      range: {
        "@timestamp": {
          gte: "2025-01-01T00:00:00Z",
          lte: "2025-01-02T00:00:00Z",
        },
      },
    });
  });

  it("merges user parameters referenced in the query", () => {
    const result = buildEsqlRequest("FROM logs-* | WHERE service.name == ?service", {
      timeRange: { from: "now-1h", to: "now" },
      parameters: [
        {
          name: "service",
          type: "keyword",
          source: { mode: "text" },
          label: "Service",
          value: "web",
        },
      ],
    });
    const params = result.params as Array<Record<string, string>>;
    expect(params.some((p) => p["service"] === "web")).toBe(true);
  });

  it("omits params when none are resolved", () => {
    const result = buildEsqlRequest("FROM logs-* | LIMIT 10", {
      timeRange: { from: "now-1h", to: "now" },
    });
    expect(result.params).toBeUndefined();
  });
});
