import { describe, expect, it } from "vitest";

import {
  getDiskWatermarks,
  getGcSummary,
  getThreadPoolRejections,
  getCircuitBreakerTrips,
  groupPendingTasks,
  groupUnassignedReasons,
  isAllocationDisabled,
  parseNumber,
  percentSeverity,
  totalCircuitBreakerTrips,
  totalThreadPoolRejections,
} from "../../src/components/cluster-health/clusterHealthUtils";

describe("getDiskWatermarks", () => {
  it("returns ES defaults when no settings", () => {
    expect(getDiskWatermarks(null)).toEqual({ low: 85, high: 90, flood: 95 });
  });

  it("reads from defaults", () => {
    const settings = {
      persistent: {},
      transient: {},
      defaults: {
        "cluster.routing.allocation.disk.watermark.low": "80%",
        "cluster.routing.allocation.disk.watermark.high": "88%",
        "cluster.routing.allocation.disk.watermark.flood_stage": "93%",
      },
    };
    expect(getDiskWatermarks(settings)).toEqual({ low: 80, high: 88, flood: 93 });
  });

  it("transient overrides persistent and defaults", () => {
    const settings = {
      persistent: { "cluster.routing.allocation.disk.watermark.high": "85%" },
      transient: { "cluster.routing.allocation.disk.watermark.high": "92%" },
      defaults: { "cluster.routing.allocation.disk.watermark.high": "90%" },
    };
    expect(getDiskWatermarks(settings).high).toBe(92);
  });

  it("falls back to default for byte-based watermarks", () => {
    const settings = {
      persistent: {},
      transient: {},
      defaults: { "cluster.routing.allocation.disk.watermark.low": "500gb" },
    };
    expect(getDiskWatermarks(settings).low).toBe(85);
  });
});

describe("isAllocationDisabled", () => {
  it('returns false for "all"', () => {
    expect(isAllocationDisabled(null)).toBe(false);
    expect(
      isAllocationDisabled({
        persistent: {},
        transient: {},
        defaults: { "cluster.routing.allocation.enable": "all" },
      }),
    ).toBe(false);
  });

  it('returns true for "none"', () => {
    expect(
      isAllocationDisabled({
        persistent: {},
        transient: { "cluster.routing.allocation.enable": "none" },
        defaults: {},
      }),
    ).toBe(true);
  });

  it('returns true for "primaries"', () => {
    expect(
      isAllocationDisabled({
        persistent: { "cluster.routing.allocation.enable": "primaries" },
        transient: {},
        defaults: {},
      }),
    ).toBe(true);
  });
});

describe("getThreadPoolRejections", () => {
  it("returns empty for undefined nodes", () => {
    expect(getThreadPoolRejections(undefined)).toEqual([]);
  });

  it("skips nodes with 0 rejections", () => {
    const nodes = {
      a: {
        name: "node-a",
        thread_pool: { write: { rejected: 0 }, search: { rejected: 0 } },
      },
    };
    expect(getThreadPoolRejections(nodes)).toEqual([]);
  });

  it("returns rejections for nodes with positive counts", () => {
    const nodes = {
      a: { name: "node-a", thread_pool: { write: { rejected: 5 }, search: { rejected: 0 } } },
      b: { name: "node-b", thread_pool: { search: { rejected: 3 } } },
    };
    const result = getThreadPoolRejections(nodes);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ pool: "write", nodeName: "node-a", rejected: 5 });
    expect(result).toContainEqual({ pool: "search", nodeName: "node-b", rejected: 3 });
  });
});

describe("totalThreadPoolRejections", () => {
  it("sums rejections across nodes", () => {
    const nodes = {
      a: { name: "a", thread_pool: { write: { rejected: 5 }, search: { rejected: 3 } } },
    };
    expect(totalThreadPoolRejections(nodes)).toBe(8);
  });
});

describe("getCircuitBreakerTrips", () => {
  it("returns empty for undefined nodes", () => {
    expect(getCircuitBreakerTrips(undefined)).toEqual([]);
  });

  it("returns trips for tripped breakers", () => {
    const nodes = {
      a: { name: "node-a", breakers: { parent: { tripped: 2 }, fielddata: { tripped: 0 } } },
    };
    const result = getCircuitBreakerTrips(nodes);
    expect(result).toEqual([{ breaker: "parent", nodeName: "node-a", tripped: 2 }]);
  });
});

describe("totalCircuitBreakerTrips", () => {
  it("sums trips", () => {
    const nodes = {
      a: { name: "a", breakers: { parent: { tripped: 2 }, fielddata: { tripped: 1 } } },
    };
    expect(totalCircuitBreakerTrips(nodes)).toBe(3);
  });
});

describe("getGcSummary", () => {
  it("extracts GC counts per node", () => {
    const nodes = {
      a: {
        name: "node-a",
        jvm: {
          gc: {
            collectors: {
              young: { collection_count: 100, collection_time_in_millis: 5000 },
              old: { collection_count: 2, collection_time_in_millis: 800 },
            },
          },
        },
      },
    };
    expect(getGcSummary(nodes)).toEqual([
      { nodeName: "node-a", youngCount: 100, youngTimeMs: 5000, oldCount: 2, oldTimeMs: 800 },
    ]);
  });

  it("defaults to 0 for missing GC data", () => {
    const nodes = { a: { name: "node-a" } };
    expect(getGcSummary(nodes)).toEqual([
      { nodeName: "node-a", youngCount: 0, youngTimeMs: 0, oldCount: 0, oldTimeMs: 0 },
    ]);
  });
});

describe("percentSeverity", () => {
  it("returns undefined for null", () => {
    expect(percentSeverity(null, 75, 90)).toBeUndefined();
    expect(percentSeverity(undefined, 75, 90)).toBeUndefined();
  });

  it("returns success below warn", () => {
    expect(percentSeverity(50, 75, 90)).toBe("success");
  });

  it("returns warning at warn threshold", () => {
    expect(percentSeverity(75, 75, 90)).toBe("warning");
  });

  it("returns error at error threshold", () => {
    expect(percentSeverity(90, 75, 90)).toBe("error");
  });
});

describe("groupPendingTasks", () => {
  it("returns empty map for empty array", () => {
    expect(groupPendingTasks([])).toEqual(new Map());
  });

  it("groups tasks by priority", () => {
    const tasks = [
      { priority: "URGENT", source: "a" },
      { priority: "HIGH", source: "b" },
      { priority: "URGENT", source: "c" },
    ];
    const result = groupPendingTasks(tasks);
    expect(result.get("URGENT")).toHaveLength(2);
    expect(result.get("HIGH")).toHaveLength(1);
  });

  it("uses UNKNOWN for missing priority", () => {
    const tasks = [{ source: "a" }];
    const result = groupPendingTasks(tasks);
    expect(result.has("UNKNOWN")).toBe(true);
  });
});

describe("groupUnassignedReasons", () => {
  it("only counts UNASSIGNED shards", () => {
    const shards = [
      { state: "STARTED", "unassigned.reason": undefined },
      { state: "UNASSIGNED", "unassigned.reason": "NODE_LEFT" },
      { state: "UNASSIGNED", "unassigned.reason": "NODE_LEFT" },
      { state: "UNASSIGNED", "unassigned.reason": "ALLOCATION_FAILED" },
    ];
    const result = groupUnassignedReasons(shards);
    expect(result.get("NODE_LEFT")).toBe(2);
    expect(result.get("ALLOCATION_FAILED")).toBe(1);
    expect(result.size).toBe(2);
  });

  it("uses UNKNOWN for missing reason", () => {
    const shards = [{ state: "UNASSIGNED" }];
    const result = groupUnassignedReasons(shards);
    expect(result.get("UNKNOWN")).toBe(1);
  });
});

describe("parseNumber", () => {
  it("parses valid numbers", () => {
    expect(parseNumber("42")).toBe(42);
    expect(parseNumber("3.14")).toBe(3.14);
  });

  it("returns null for invalid values", () => {
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});
