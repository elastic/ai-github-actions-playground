import { describe, it, expect, vi, afterEach } from "vitest";
import { buildQueryParams } from "../../src/services/datemath";

const NOW = new Date("2025-06-15T12:00:00.000Z");

describe("buildQueryParams", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns only time params when no user params are provided", () => {
    vi.useFakeTimers({ now: NOW });
    const query =
      "FROM logs-* | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)";
    const params = buildQueryParams(query, { from: "now-1h", to: "now" });
    expect(params).toHaveLength(2);
    expect(params[0]).toEqual({ _tstart: "2025-06-15T11:00:00.000Z" });
    expect(params[1]).toEqual({ _tend: "2025-06-15T12:00:00.000Z" });
  });

  it("includes user params that are referenced in the query", () => {
    vi.useFakeTimers({ now: NOW });
    const query =
      'FROM logs-* | WHERE service.name == ?service | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)';
    const userParams = [
      { name: "service", value: "web" },
      { name: "environment", value: "prod" },
    ];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toHaveLength(3);
    expect(params[0]).toEqual({ _tstart: "2025-06-15T11:00:00.000Z" });
    expect(params[1]).toEqual({ _tend: "2025-06-15T12:00:00.000Z" });
    expect(params[2]).toEqual({ service: "web" });
  });

  it("excludes user params not referenced in the query", () => {
    const query = "FROM logs-* | STATS COUNT(*)";
    const userParams = [{ name: "service", value: "web" }];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toEqual([]);
  });

  it("handles multiple user params all referenced", () => {
    const query =
      "FROM logs-* | WHERE service.name == ?service AND host.name == ?host";
    const userParams = [
      { name: "service", value: "api" },
      { name: "host", value: "node-1" },
    ];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toHaveLength(2);
    expect(params[0]).toEqual({ service: "api" });
    expect(params[1]).toEqual({ host: "node-1" });
  });

  it("returns empty array when query has no placeholders and no user params", () => {
    const params = buildQueryParams("FROM logs-* | LIMIT 10", { from: "now-1h", to: "now" });
    expect(params).toEqual([]);
  });

  it("skips user params with empty names", () => {
    const query = "FROM logs-* | WHERE x == ?service";
    const userParams = [
      { name: "", value: "ignored" },
      { name: "service", value: "web" },
    ];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toHaveLength(1);
    expect(params[0]).toEqual({ service: "web" });
  });

  it("handles undefined userParams gracefully", () => {
    const query = "FROM logs-* | WHERE x == ?_tstart";
    vi.useFakeTimers({ now: NOW });
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, undefined);
    expect(params).toHaveLength(1);
    expect(params[0]).toHaveProperty("_tstart");
  });
});
