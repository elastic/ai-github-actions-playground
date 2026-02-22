import { describe, expect, it } from "vitest";
import { deserializeExplorerState } from "../../src/store/useExplorerStore";

describe("deserializeExplorerState", () => {
  it("accepts valid aggregation values", () => {
    const state = deserializeExplorerState("?agg=p95&index=metrics-*");
    expect(state.aggregation).toBe("p95");
  });

  it("ignores invalid aggregation values", () => {
    const state = deserializeExplorerState("?agg=median&index=metrics-*");
    expect(state.aggregation).toBeUndefined();
  });
});
