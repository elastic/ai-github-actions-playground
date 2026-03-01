// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

import { resetAllStores } from "../fixtures/test-utils";
import { useProfilingStore } from "../../src/store/useProfilingStore";

describe("profiling store reset reproduction", () => {
  it("global reset should reset profiling store", () => {
    useProfilingStore.setState({
      filters: {
        serviceName: "svc-a",
        environment: "prod",
        kuery: "labels.team:platform",
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-01-01T01:00:00.000Z",
      },
      rawQuery: "FROM profiling-*",
      viewMode: "flamescope",
      expandedStacktraceIds: new Set(["st-1"]),
    });

    resetAllStores();

    const state = useProfilingStore.getState();
    expect(state.filters.serviceName).toBeNull();
    expect(state.rawQuery).toBeNull();
    expect(state.expandedStacktraceIds.size).toBe(0);
    expect(state.viewMode).toBe("topFunctions");
  });
});
