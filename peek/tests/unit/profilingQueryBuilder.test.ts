import { describe, expect, it } from "vitest";

import {
  buildProfilingHotspotsQuery,
  buildProfilingTimelineQuery,
  buildProfilingQuery,
  EMPTY_PROFILING_FILTERS,
} from "../../src/components/profiling/profilingQueryBuilder";

describe("profilingQueryBuilder", () => {
  it("builds hotspots query by default", () => {
    const query = buildProfilingQuery("hotspots", EMPTY_PROFILING_FILTERS);
    expect(query).toContain("FROM profiling-*");
    expect(query).toContain("STATS samples = COUNT(*)");
    expect(query).toContain("LIMIT 100");
  });

  it("builds timeline query with bucket aggregation", () => {
    const query = buildProfilingTimelineQuery(EMPTY_PROFILING_FILTERS);
    expect(query).toContain("BUCKET(@timestamp, 40, NOW() - 1 hour, NOW())");
    expect(query).toContain("SORT @timestamp ASC");
  });

  it("escapes user-provided filter values", () => {
    const query = buildProfilingHotspotsQuery({
      ...EMPTY_PROFILING_FILTERS,
      serviceName: 'api"service',
      hostName: "host\\name",
      functionName: "run",
    });
    expect(query).toContain('service.name == "api\\"service"');
    expect(query).toContain('host.name == "host\\\\name"');
    expect(query).toContain('profiling.stacktrace.frame.function.name == "run"');
  });
});
