import { beforeEach, describe, expect, it } from "vitest";

import { useExplorerStore } from "../../src/store/useExplorerStore";

describe("useExplorerStore", () => {
  beforeEach(() => {
    useExplorerStore.getState().reset();
  });

  it("clears dependent state when index pattern changes", () => {
    useExplorerStore.setState({
      indexPattern: "metrics-*",
      fields: [{ name: "host.name", type: "keyword", metricType: "unknown" }],
      selectedMetric: "system.cpu.total.pct",
      filters: [{ field: "host.name", op: "==", value: "web-01" }],
      groupBy: "host.name",
    });

    useExplorerStore.getState().setIndexPattern("logs-*");
    const next = useExplorerStore.getState();

    expect(next.indexPattern).toBe("logs-*");
    expect(next.selectedMetric).toBeNull();
    expect(next.fields).toEqual([]);
    expect(next.filters).toEqual([]);
    expect(next.groupBy).toBeNull();
  });
});
