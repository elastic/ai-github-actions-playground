import { describe, expect, it } from "vitest";

import {
  buildProfilingEventsQuery,
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
        expect.objectContaining({ term: { "process.executable.name": "node" } }),
      ]),
    );
  });
});
