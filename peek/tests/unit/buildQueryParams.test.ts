import { describe, it, expect, vi, afterEach } from "vitest";

import { buildQueryParams } from "../../src/services/datemath";

const NOW = new Date("2025-06-15T12:00:00.000Z");

describe("buildQueryParams", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns only time params when no user params are provided", () => {
    vi.useFakeTimers({ now: NOW });
    const query = "FROM logs-* | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)";
    const params = buildQueryParams(query, { from: "now-1h", to: "now" });
    expect(params).toEqual({
      _tstart: "2025-06-15T11:00:00.000Z",
      _tend: "2025-06-15T12:00:00.000Z",
    });
  });

  it("includes user params that are referenced in the query", () => {
    vi.useFakeTimers({ now: NOW });
    const query =
      "FROM logs-* | WHERE service.name == ?service | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)";
    const userParams = [
      {
        name: "service",
        type: "keyword" as const,
        source: { mode: "text" as const },
        label: "Service",
        value: "web",
      },
      {
        name: "environment",
        type: "keyword" as const,
        source: { mode: "text" as const },
        label: "Environment",
        value: "prod",
      },
    ];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toEqual({
      _tstart: "2025-06-15T11:00:00.000Z",
      _tend: "2025-06-15T12:00:00.000Z",
      service: "web",
    });
  });

  it("excludes user params not referenced in the query", () => {
    const query = "FROM logs-* | STATS COUNT(*)";
    const userParams = [
      {
        name: "service",
        label: "Service",
        type: "keyword",
        source: { mode: "text" },
        value: "web",
      },
    ];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toEqual({});
  });

  it("handles multiple user params all referenced", () => {
    const query = "FROM logs-* | WHERE service.name == ?service AND host.name == ?host";
    const userParams = [
      {
        name: "service",
        type: "keyword" as const,
        source: { mode: "text" as const },
        label: "Service",
        value: "api",
      },
      {
        name: "host",
        type: "keyword" as const,
        source: { mode: "text" as const },
        label: "Host",
        value: "node-1",
      },
    ];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toEqual({ service: "api", host: "node-1" });
  });

  it("returns empty object when query has no placeholders and no user params", () => {
    const params = buildQueryParams("FROM logs-* | LIMIT 10", { from: "now-1h", to: "now" });
    expect(params).toEqual({});
  });

  it("skips user params with empty names", () => {
    const query = "FROM logs-* | WHERE x == ?service";
    const userParams = [
      {
        name: "",
        type: "keyword" as const,
        source: { mode: "text" as const },
        label: "Ignored",
        value: "ignored",
      },
      {
        name: "service",
        type: "keyword" as const,
        source: { mode: "text" as const },
        label: "Service",
        value: "web",
      },
    ];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toEqual({ service: "web" });
  });

  it("does not match placeholder name prefixes", () => {
    const query = "FROM logs-* | WHERE env_name == ?env_name";
    const userParams = [
      {
        name: "env",
        type: "keyword" as const,
        source: { mode: "text" as const },
        label: "Env",
        value: "prod",
      },
      {
        name: "env_name",
        type: "keyword" as const,
        source: { mode: "text" as const },
        label: "Env Name",
        value: "web",
      },
    ];
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, userParams);
    expect(params).toEqual({ env_name: "web" });
  });

  it("handles undefined userParams gracefully", () => {
    const query = "FROM logs-* | WHERE x == ?_tstart";
    vi.useFakeTimers({ now: NOW });
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, undefined);
    expect(Object.keys(params)).toHaveLength(1);
    expect(params).toHaveProperty("_tstart");
  });

  it("does not allow user params to override reserved time params", () => {
    vi.useFakeTimers({ now: NOW });
    const query = "FROM logs-* | WHERE @timestamp >= ?_tstart AND @timestamp < ?_tend";
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, [
      {
        name: "_tstart",
        label: "Start",
        type: "keyword",
        source: { mode: "text" },
        value: "overridden",
      },
      {
        name: "_tend",
        label: "End",
        type: "keyword",
        source: { mode: "text" },
        value: "overridden",
      },
    ]);
    expect(params).toEqual({
      _tstart: "2025-06-15T11:00:00.000Z",
      _tend: "2025-06-15T12:00:00.000Z",
    });
  });

  it("serializes number, boolean, and date parameters", () => {
    const query =
      "FROM logs-* | WHERE latency > ?latency AND is_error == ?is_error AND @timestamp >= ?from_date";
    const params = buildQueryParams(query, { from: "now-1h", to: "now" }, [
      { name: "latency", label: "Latency", type: "number", source: { mode: "text" }, value: 42 },
      { name: "is_error", label: "Error", type: "boolean", source: { mode: "text" }, value: true },
      {
        name: "from_date",
        label: "From Date",
        type: "date",
        source: { mode: "text" },
        value: "2025-06-01T00:00:00-05:00",
      },
    ]);
    expect(params).toEqual({
      latency: 42,
      is_error: true,
      from_date: "2025-06-01T05:00:00.000Z",
    });
  });
});
