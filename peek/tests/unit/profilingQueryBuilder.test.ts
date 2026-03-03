import { describe, expect, it } from "vitest";

import {
  buildDistinctValuesQuery,
  buildProfilingEventsQuery,
  buildProfilingFlamescopeQuery,
  buildProfilingTimelineQuery,
  buildStackframeLookupQuery,
  buildStacktraceLookupQuery,
  buildTopFunctionsRequest,
  EMPTY_FILTERS,
  PROFILING_DIMENSION_LABELS,
} from "../../src/components/profiling/profilingQueryBuilder";

describe("profilingQueryBuilder", () => {
  it("builds events query with defaults", () => {
    const query = buildProfilingEventsQuery(EMPTY_FILTERS);
    expect(query).toContain("FROM profiling-events-all");
    expect(query).toContain("@timestamp >= NOW() - 1 hour");
    expect(query).toContain("LIMIT 100");
  });

  it("escapes filter values", () => {
    const query = buildProfilingEventsQuery({
      ...EMPTY_FILTERS,
      executableName: 'cmd"runner',
      threadName: "worker\\thread",
    });
    expect(query).toContain('process.executable.name == "cmd\\"runner"');
    expect(query).toContain('process.thread.name == "worker\\\\thread"');
  });

  it("builds lookup queries", () => {
    expect(buildStacktraceLookupQuery(["a", "b"])).toContain('_id IN ("a", "b")');
    expect(buildStackframeLookupQuery(["f1"])).toContain('_id IN ("f1")');
  });

  it("builds no-results lookup queries for empty ids", () => {
    expect(buildStacktraceLookupQuery([])).toContain("WHERE 1 == 0");
    expect(buildStackframeLookupQuery([])).toContain("WHERE 1 == 0");
  });

  it("builds timeline query and top functions request", () => {
    const timeline = buildProfilingTimelineQuery(EMPTY_FILTERS);
    expect(timeline).toContain("BUCKET(@timestamp, 50, NOW() - 1 hour, NOW())");

    const request = buildTopFunctionsRequest({
      ...EMPTY_FILTERS,
      executableName: "node",
      limit: 20,
    });
    expect(request.limit).toBe(20);
    expect(request.query.bool.filter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          range: {
            "@timestamp": {
              gte: "now-1h",
              lt: "now",
            },
          },
        }),
        expect.objectContaining({ term: { "process.executable.name": "node" } }),
      ]),
    );
  });

  it("builds flamescope query with explicit fields and sort", () => {
    const query = buildProfilingFlamescopeQuery(EMPTY_FILTERS);
    expect(query).toContain(
      "KEEP @timestamp, Stacktrace.id, Stacktrace.count, service.name, host.name",
    );
    expect(query).toContain("SORT @timestamp ASC");
  });

  it("applies non-executable filters in top functions request", () => {
    const request = buildTopFunctionsRequest({
      ...EMPTY_FILTERS,
      threadName: "worker-thread",
      serviceName: "checkout-service",
      hostName: "host-a",
    });
    expect(request.query.bool.filter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: { "process.thread.name": "worker-thread" } }),
        expect.objectContaining({ term: { "service.name": "checkout-service" } }),
        expect.objectContaining({ term: { "host.name": "host-a" } }),
      ]),
    );
  });

  it("normalizes ES|QL and absolute timestamps for Query DSL ranges", () => {
    const request = buildTopFunctionsRequest({
      ...EMPTY_FILTERS,
      timeFrom: "NOW() - 15 minutes",
      timeTo: "2026-02-24T03:00:00.000Z",
    });
    expect(request.query.bool.filter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          range: {
            "@timestamp": {
              gte: "now-15m",
              lt: "2026-02-24T03:00:00.000Z",
            },
          },
        }),
      ]),
    );
  });

  it("quotes custom absolute timestamps in ES|QL filters", () => {
    const query = buildProfilingEventsQuery({
      ...EMPTY_FILTERS,
      timeFrom: "2026-02-24T03:00:00.000Z",
      timeTo: "2026-02-24T04:00:00.000Z",
    });
    expect(query).toContain('@timestamp >= "2026-02-24T03:00:00.000Z"');
    expect(query).toContain('@timestamp <= "2026-02-24T04:00:00.000Z"');

    const timeline = buildProfilingTimelineQuery({
      ...EMPTY_FILTERS,
      timeFrom: "2026-02-24T03:00:00.000Z",
      timeTo: "2026-02-24T04:00:00.000Z",
    });
    expect(timeline).toContain(
      'BUCKET(@timestamp, 50, "2026-02-24T03:00:00.000Z", "2026-02-24T04:00:00.000Z")',
    );
  });

  describe("buildDistinctValuesQuery", () => {
    it("queries profiling-events-all with a STATS BY clause for the chosen dimension", () => {
      const query = buildDistinctValuesQuery("service.name", "NOW() - 1 hour", "NOW()");
      expect(query).toContain("FROM profiling-events-all");
      expect(query).toContain("STATS samples = SUM(Stacktrace.count) BY `service.name`");
      expect(query).toContain("SORT samples DESC");
      expect(query).toContain("LIMIT 50");
    });

    it("applies the time range filter", () => {
      const query = buildDistinctValuesQuery("host.name", "NOW() - 30 minutes", "NOW()");
      expect(query).toContain("@timestamp >= NOW() - 30 minutes");
      expect(query).toContain("@timestamp <= NOW()");
    });

    it("produces distinct queries for each supported dimension", () => {
      const dimensions = [
        "service.name",
        "host.name",
        "process.executable.name",
        "process.thread.name",
      ] as const;
      const queries = dimensions.map((d) => buildDistinctValuesQuery(d, "NOW() - 1 hour", "NOW()"));
      // Each dimension produces a unique STATS BY clause
      const unique = new Set(queries);
      expect(unique.size).toBe(dimensions.length);
    });

    it("handles absolute ISO timestamps", () => {
      const query = buildDistinctValuesQuery(
        "process.executable.name",
        "2026-02-24T03:00:00.000Z",
        "2026-02-24T04:00:00.000Z",
      );
      expect(query).toContain('@timestamp >= "2026-02-24T03:00:00.000Z"');
      expect(query).toContain('@timestamp <= "2026-02-24T04:00:00.000Z"');
    });
  });

  describe("PROFILING_DIMENSION_LABELS", () => {
    it("has a label for every supported dimension", () => {
      const dimensions = [
        "service.name",
        "host.name",
        "process.executable.name",
        "process.thread.name",
      ] as const;
      for (const d of dimensions) {
        expect(PROFILING_DIMENSION_LABELS[d]).toBeTruthy();
      }
    });
  });
});
