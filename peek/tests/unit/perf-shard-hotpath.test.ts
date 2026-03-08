import { describe, expect, it } from "vitest";

import { shardChecks } from "../../src/health-checks/checks/shards";
import { evaluateHealthChecks } from "../../src/health-checks/engine";
import type { HealthSnapshot } from "../../src/health-checks";
import type { CatShardRecord } from "../../src/services/es/clusterTypes";

const SHARD_COUNT = 50_000;
const ITERATIONS = 20;

function generateShards(count: number): CatShardRecord[] {
  const states = ["STARTED", "UNASSIGNED", "INITIALIZING", "RELOCATING"] as const;
  const reasons = [
    "ALLOCATION_FAILED",
    "PRIMARY_FAILED",
    "NODE_LEFT",
    "NODE_RESTARTING",
    "INDEX_CLOSED",
    "",
  ];
  return Array.from({ length: count }, (_, i) => ({
    index: `index-${i % 100}`,
    shard: String(i % 5),
    prirep: i % 3 === 0 ? "p" : "r",
    state: states[i % states.length],
    "unassigned.reason":
      states[i % states.length] === "UNASSIGNED" ? reasons[i % reasons.length] : undefined,
  }));
}

function makeSnapshot(catShards: CatShardRecord[]): HealthSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    data: {
      clusterCore: {
        clusterHealth: {
          status: "red",
          unassigned_shards: catShards.filter((s) => s.state === "UNASSIGNED").length,
          initializing_shards: catShards.filter((s) => s.state === "INITIALIZING").length,
          relocating_shards: catShards.filter((s) => s.state === "RELOCATING").length,
          delayed_unassigned_shards: 0,
          number_of_in_flight_fetch: 0,
          active_shards_percent_as_number: 50,
        },
        pendingTasks: { tasks: [] },
      },
      shards: { catShards },
      allocationSample: { allocationExplain: null },
      nodesCore: { nodeStats: { nodes: {} } },
      tasksCore: { tasks: { nodes: {} } },
      indicesCore: { catIndices: [] },
      ilmCore: { ilmExplain: { indices: {} }, ilmPolicies: {} },
      recoveryCore: { recovery: {} },
      securityCore: { apiKeys: { api_keys: [] } },
    },
    errors: {},
  };
}

describe("shard health-check hot-path performance", () => {
  it("evaluates shard checks on large catShards array within performance budget", () => {
    const shards = generateShards(SHARD_COUNT);
    const snapshot = makeSnapshot(shards);

    const timings: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      evaluateHealthChecks(shardChecks, snapshot);
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const median = timings[Math.floor(timings.length / 2)];
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;

    // Log for profiling visibility
    console.log(`PERF_SHARDS_MEDIAN_MS=${median.toFixed(2)}`);
    console.log(`PERF_SHARDS_AVG_MS=${avg.toFixed(2)}`);

    // With caching, median should be well under 50ms for 50k shards
    expect(median).toBeLessThan(50);
  });
});
