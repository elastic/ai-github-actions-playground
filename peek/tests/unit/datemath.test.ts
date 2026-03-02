import { describe, it, expect, vi, afterEach } from "vitest";

import {
  resolveDateTime,
  buildTimeParams,
  resolveToPositionalParams,
} from "../../src/services/datemath";

// Fixed reference time for deterministic tests
const NOW = new Date("2025-06-15T12:00:00.000Z");

// ---------------------------------------------------------------------------
// resolveDateTime
// ---------------------------------------------------------------------------

describe("resolveDateTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves "now" to the provided time', () => {
    const result = resolveDateTime("now", NOW);
    expect(result?.toISOString()).toBe("2025-06-15T12:00:00.000Z");
  });

  it("resolves now-Xm (minutes)", () => {
    expect(resolveDateTime("now-15m", NOW)?.toISOString()).toBe("2025-06-15T11:45:00.000Z");
    expect(resolveDateTime("now-1m", NOW)?.toISOString()).toBe("2025-06-15T11:59:00.000Z");
  });

  it("resolves now-Xh (hours)", () => {
    expect(resolveDateTime("now-1h", NOW)?.toISOString()).toBe("2025-06-15T11:00:00.000Z");
    expect(resolveDateTime("now-4h", NOW)?.toISOString()).toBe("2025-06-15T08:00:00.000Z");
    expect(resolveDateTime("now-24h", NOW)?.toISOString()).toBe("2025-06-14T12:00:00.000Z");
  });

  it("resolves now-Xd (days)", () => {
    expect(resolveDateTime("now-7d", NOW)?.toISOString()).toBe("2025-06-08T12:00:00.000Z");
    expect(resolveDateTime("now-30d", NOW)?.toISOString()).toBe("2025-05-16T12:00:00.000Z");
  });

  it("resolves now-Xs (seconds)", () => {
    expect(resolveDateTime("now-30s", NOW)?.toISOString()).toBe("2025-06-15T11:59:30.000Z");
  });

  it("resolves now-Xw (weeks)", () => {
    expect(resolveDateTime("now-2w", NOW)?.toISOString()).toBe("2025-06-01T12:00:00.000Z");
  });

  it("resolves now+X (positive offset)", () => {
    expect(resolveDateTime("now+1h", NOW)?.toISOString()).toBe("2025-06-15T13:00:00.000Z");
  });

  it("returns undefined for unrecognised expressions", () => {
    expect(resolveDateTime("2025-01-01T00:00:00.000Z")).toBeUndefined();
    expect(resolveDateTime("yesterday")).toBeUndefined();
    expect(resolveDateTime("")).toBeUndefined();
  });

  it("defaults to Date.now() when no reference time is given", () => {
    vi.useFakeTimers({ now: NOW });
    const result = resolveDateTime("now");
    expect(result?.toISOString()).toBe(NOW.toISOString());
  });
});

// ---------------------------------------------------------------------------
// buildTimeParams
// ---------------------------------------------------------------------------

describe("buildTimeParams", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns both _tstart and _tend for a query using both placeholders", () => {
    vi.useFakeTimers({ now: NOW });
    const query =
      "FROM logs-* | STATS doc_count = COUNT(*) BY time_bucket = BUCKET(@timestamp, 50, ?_tstart, ?_tend)";
    const params = buildTimeParams(query, { from: "now-1h", to: "now" });

    expect(params).toEqual({
      _tstart: "2025-06-15T11:00:00.000Z",
      _tend: "2025-06-15T12:00:00.000Z",
    });
  });

  it("returns only _tstart when only ?_tstart is used", () => {
    vi.useFakeTimers({ now: NOW });
    const query = "FROM logs-* | WHERE @timestamp >= ?_tstart";
    const params = buildTimeParams(query, { from: "now-15m", to: "now" });

    expect(Object.keys(params)).toHaveLength(1);
    expect(params).toHaveProperty("_tstart");
  });

  it("returns empty object when query has no placeholders", () => {
    const query = "FROM logs-* | STATS COUNT(*)";
    const params = buildTimeParams(query, { from: "now-1h", to: "now" });
    expect(params).toEqual({});
  });

  it("falls back to raw values when date-math cannot be resolved", () => {
    vi.useFakeTimers({ now: NOW });
    const query = "FROM logs-* | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)";
    const params = buildTimeParams(query, {
      from: "2025-01-01T00:00:00.000Z",
      to: "2025-01-02T00:00:00.000Z",
    });
    expect(params).toEqual({
      _tstart: "2025-01-01T00:00:00.000Z",
      _tend: "2025-01-02T00:00:00.000Z",
    });
  });
});

// ---------------------------------------------------------------------------
// resolveToPositionalParams
// ---------------------------------------------------------------------------

describe("resolveToPositionalParams", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces ?_tstart and ?_tend with positional ? and returns flat params array", () => {
    vi.useFakeTimers({ now: NOW });
    const query =
      "FROM metrics-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | STATS metric = AVG(`field`) BY timestamp = BUCKET(@timestamp, 50, ?_tstart, ?_tend) | SORT timestamp";
    const result = resolveToPositionalParams(query, { from: "now-1h", to: "now" });

    expect(result.query).toBe(
      "FROM metrics-* | WHERE @timestamp >= ? AND @timestamp <= ? | STATS metric = AVG(`field`) BY timestamp = BUCKET(@timestamp, 50, ?, ?) | SORT timestamp",
    );
    expect(result.params).toEqual([
      "2025-06-15T11:00:00.000Z",
      "2025-06-15T12:00:00.000Z",
      "2025-06-15T11:00:00.000Z",
      "2025-06-15T12:00:00.000Z",
    ]);
  });

  it("returns empty params array when query has no placeholders", () => {
    const query = "FROM logs-* | STATS COUNT(*)";
    const result = resolveToPositionalParams(query, { from: "now-1h", to: "now" });
    expect(result.query).toBe(query);
    expect(result.params).toEqual([]);
  });

  it("includes user parameters in positional order", () => {
    vi.useFakeTimers({ now: NOW });
    const query =
      "FROM logs-* | WHERE service.name == ?service | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)";
    const result = resolveToPositionalParams(query, { from: "now-1h", to: "now" }, [
      {
        name: "service",
        type: "keyword",
        source: { mode: "text" },
        label: "Service",
        value: "web",
      },
    ]);

    expect(result.query).toContain("service.name == ?");
    expect(result.query).not.toContain("?service");
    expect(result.query).not.toContain("?_tstart");
    expect(result.params).toEqual(["web", "2025-06-15T11:00:00.000Z", "2025-06-15T12:00:00.000Z"]);
  });

  it("falls back to raw time values when date-math cannot be resolved", () => {
    const query = "FROM logs-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend";
    const result = resolveToPositionalParams(query, {
      from: "2025-01-01T00:00:00.000Z",
      to: "2025-01-02T00:00:00.000Z",
    });
    expect(result.params).toEqual(["2025-01-01T00:00:00.000Z", "2025-01-02T00:00:00.000Z"]);
  });

  it("does not replace unknown named params", () => {
    const query = "FROM logs-* | WHERE x == ?unknown";
    const result = resolveToPositionalParams(query, { from: "now-1h", to: "now" });
    expect(result.query).toBe("FROM logs-* | WHERE x == ?unknown");
    expect(result.params).toEqual([]);
  });

  it("replaces known params while preserving unknown ones in the same query", () => {
    vi.useFakeTimers({ now: NOW });
    const query =
      "FROM logs-* | WHERE @timestamp >= ?_tstart AND x == ?unknown AND @timestamp <= ?_tend";
    const result = resolveToPositionalParams(query, { from: "now-1h", to: "now" });
    expect(result.query).toBe(
      "FROM logs-* | WHERE @timestamp >= ? AND x == ?unknown AND @timestamp <= ?",
    );
    expect(result.params).toEqual(["2025-06-15T11:00:00.000Z", "2025-06-15T12:00:00.000Z"]);
  });

  it("does not allow user params to override reserved time params", () => {
    vi.useFakeTimers({ now: NOW });
    const query = "FROM logs-* | WHERE @timestamp >= ?_tstart AND @timestamp < ?_tend";
    const result = resolveToPositionalParams(query, { from: "now-1h", to: "now" }, [
      {
        name: "_tstart",
        label: "Start",
        type: "keyword",
        source: { mode: "text" },
        value: "overridden",
      },
    ]);
    expect(result.params).toEqual(["2025-06-15T11:00:00.000Z", "2025-06-15T12:00:00.000Z"]);
  });
});
