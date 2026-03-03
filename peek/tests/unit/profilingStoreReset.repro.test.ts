// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

import { resetAllStores } from "../fixtures/test-utils";
import { usePageFiltersStore } from "../../src/store/usePageFiltersStore";

describe("profiling store reset reproduction", () => {
  it("global reset should reset profiling filters", () => {
    usePageFiltersStore.setState({
      profilingFilters: {
        serviceName: "svc-a",
        environment: "prod",
        kuery: "labels.team:platform",
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-01-01T01:00:00.000Z",
      },
      profilingRawQuery: "FROM profiling-*",
      profilingViewMode: "flamescope",
      expandedStacktraceIds: new Set(["st-1"]),
    });

    resetAllStores();

    const state = usePageFiltersStore.getState();
    expect(state.profilingFilters.serviceName).toBeNull();
    expect(state.profilingRawQuery).toBeNull();
    expect(state.expandedStacktraceIds.size).toBe(0);
    expect(state.profilingViewMode).toBe("topFunctions");
  });
});
