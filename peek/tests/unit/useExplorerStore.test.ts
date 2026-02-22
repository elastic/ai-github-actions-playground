import { beforeEach, describe, expect, it } from "vitest";
import { deserializeExplorerState, useExplorerStore } from "../../src/store/useExplorerStore";

describe("deserializeExplorerState", () => {
  beforeEach(() => {
    useExplorerStore.getState().reset();
  });

  it("accepts valid aggregation values", () => {
    const state = deserializeExplorerState("?agg=p95&index=metrics-*");
    expect(state.aggregation).toBe("p95");
  });

  it("ignores invalid aggregation values", () => {
    const state = deserializeExplorerState("?agg=median&index=metrics-*");
    expect(state.aggregation).toBeUndefined();
  });

  it("clears dependent state when index pattern changes", () => {
    useExplorerStore.setState({
      indexPattern: "metrics-*",
      fields: [{ name: "host.name", type: "keyword", metricType: "unknown" }],
      selectedMetric: "system.cpu.total.pct",
      filters: [{ field: "host.name", op: "==", value: "web-01" }],
      groupBy: "host.name",
      queryResult: { status: "success", esql: "FROM metrics-* | LIMIT 1" },
    });

    useExplorerStore.getState().setIndexPattern("logs-*");
    const next = useExplorerStore.getState();

    expect(next.indexPattern).toBe("logs-*");
    expect(next.selectedMetric).toBeNull();
    expect(next.fields).toEqual([]);
    expect(next.filters).toEqual([]);
    expect(next.groupBy).toBeNull();
    expect(next.queryResult).toEqual({ status: "idle" });
  });
});
