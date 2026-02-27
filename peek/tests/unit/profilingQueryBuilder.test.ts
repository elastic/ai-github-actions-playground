import { describe, expect, it } from "vitest";

import {
  buildProfilingEventsQuery,
  buildProfilingFlamescopeQuery,
  buildProfilingTimelineQuery,
  buildStackframeLookupQuery,
  buildStacktraceLookupQuery,
  buildTopFunctionsRequest,
  EMPTY_FILTERS,
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
});
