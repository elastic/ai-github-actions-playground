import { describe, expect, it } from "vitest";

import { clusterChecks } from "../../src/health-checks/checks/cluster";
import { ilmChecks } from "../../src/health-checks/checks/ilm";
import { nodeChecks } from "../../src/health-checks/checks/nodes";
import { shardChecks } from "../../src/health-checks/checks/shards";
import { taskChecks } from "../../src/health-checks/checks/tasks";
import { INITIAL_HEALTH_CHECKS } from "../../src/health-checks/checks/index";

import type { HealthSnapshot } from "../../src/health-checks";

function makeSnapshot(overrides: Partial<HealthSnapshot["data"]> = {}): HealthSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    data: {
      clusterCore: {
        clusterHealth: {
          status: "green",
          unassigned_shards: 0,
          initializing_shards: 0,
          relocating_shards: 0,
          active_shards_percent_as_number: 100,
        },
        pendingTasks: { tasks: [] },
      },
      shards: { catShards: [] },
      allocationSample: { allocationExplain: null },
      nodesCore: { nodeStats: { nodes: {} } },
      tasksCore: { tasks: { nodes: {} } },
      ilmCore: { ilmExplain: { indices: {} }, ilmPolicies: {} },
      ...overrides,
    },
    errors: {},
  };
}

function findCheck(checks: typeof INITIAL_HEALTH_CHECKS, id: string) {
  const check = checks.find((c) => c.id === id);
  if (!check) throw new Error(`Check ${id} not found`);
  return check;
}

describe("INITIAL_HEALTH_CHECKS aggregation", () => {
  it("has no duplicate ids", () => {
    const ids = INITIAL_HEALTH_CHECKS.map((c) => c.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("includes all domain checks", () => {
    const total =
      clusterChecks.length +
      shardChecks.length +
      nodeChecks.length +
      taskChecks.length +
      ilmChecks.length;
    expect(INITIAL_HEALTH_CHECKS).toHaveLength(total);
  });
});

// ---------------------------------------------------------------------------
// A) Cluster status & coordination
// ---------------------------------------------------------------------------
describe("cluster checks", () => {
  it("#1 cluster.status.red — fails on red", () => {
    const check = findCheck(clusterChecks, "cluster.status.red");
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "red", unassigned_shards: 0 },
        pendingTasks: { tasks: [] },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.status).toBe("red");
  });

  it("#1 cluster.status.red — passes on green", () => {
    const result = findCheck(clusterChecks, "cluster.status.red").evaluate(makeSnapshot());
    expect(result.status).toBe("pass");
  });

  it("#2 cluster.status.yellow — warns on yellow", () => {
    const check = findCheck(clusterChecks, "cluster.status.yellow");
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "yellow", unassigned_shards: 0 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });

  it("#3 cluster.unassigned_shards.nonzero — fails with unassigned", () => {
    const check = findCheck(clusterChecks, "cluster.unassigned_shards.nonzero");
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "yellow", unassigned_shards: 3 },
        pendingTasks: { tasks: [] },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.unassigned_shards).toBe(3);
  });

  it("#4 cluster.unassigned_primaries.nonzero — fails with unassigned primaries", () => {
    const check = findCheck(clusterChecks, "cluster.unassigned_primaries.nonzero");
    const snap = makeSnapshot({
      shards: {
        catShards: [
          { index: "idx-1", shard: "0", prirep: "p", state: "UNASSIGNED" },
          { index: "idx-1", shard: "1", prirep: "r", state: "UNASSIGNED" },
        ],
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.unassigned_primary_shards).toBe(1);
  });

  it("#4 cluster.unassigned_primaries.nonzero — passes when no unassigned primaries", () => {
    const check = findCheck(clusterChecks, "cluster.unassigned_primaries.nonzero");
    const snap = makeSnapshot({
      shards: {
        catShards: [
          { index: "idx-1", shard: "0", prirep: "p", state: "STARTED" },
          { index: "idx-1", shard: "0", prirep: "r", state: "UNASSIGNED" },
        ],
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });

  it("#5 cluster.initializing_shards.high — warns above threshold", () => {
    const check = findCheck(clusterChecks, "cluster.initializing_shards.high");
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green", initializing_shards: 10 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });

  it("#5 cluster.initializing_shards.high — passes below threshold", () => {
    const check = findCheck(clusterChecks, "cluster.initializing_shards.high");
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green", initializing_shards: 2 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });

  it("#6 cluster.relocating_shards.high — warns above threshold", () => {
    const check = findCheck(clusterChecks, "cluster.relocating_shards.high");
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green", relocating_shards: 8 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });

  it("#7 cluster.active_shards_percent.low — warns below 100%", () => {
    const check = findCheck(clusterChecks, "cluster.active_shards_percent.low");
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "yellow", active_shards_percent_as_number: 85.5 },
        pendingTasks: { tasks: [] },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("warn");
    expect(result.observed?.active_shards_percent).toBe(85.5);
  });

  it("#7 cluster.active_shards_percent.low — passes at 100%", () => {
    const check = findCheck(clusterChecks, "cluster.active_shards_percent.low");
    expect(check.evaluate(makeSnapshot()).status).toBe("pass");
  });

  it("#8 cluster.pending_tasks.nonzero — warns when tasks present", () => {
    const check = findCheck(clusterChecks, "cluster.pending_tasks.nonzero");
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green" },
        pendingTasks: { tasks: [{ source: "test" }] },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// B) Shards, allocation, recovery
// ---------------------------------------------------------------------------
describe("shard checks", () => {
  it("#15 shards.state.unassigned.present — fails with unassigned shards", () => {
    const check = findCheck(shardChecks, "shards.state.unassigned.present");
    const snap = makeSnapshot({
      shards: {
        catShards: [
          { index: "idx-1", shard: "0", prirep: "p", state: "UNASSIGNED" },
          { index: "idx-2", shard: "0", prirep: "r", state: "UNASSIGNED" },
        ],
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.unassigned_count).toBe(2);
  });

  it("#15 shards.state.unassigned.present — passes with no unassigned", () => {
    const check = findCheck(shardChecks, "shards.state.unassigned.present");
    const snap = makeSnapshot({
      shards: {
        catShards: [{ index: "idx-1", shard: "0", prirep: "p", state: "STARTED" }],
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });

  it("#18 shards.unassigned.primary.present — fails with unassigned primary", () => {
    const check = findCheck(shardChecks, "shards.unassigned.primary.present");
    const snap = makeSnapshot({
      shards: {
        catShards: [
          { index: "my-index", shard: "0", prirep: "p", state: "UNASSIGNED" },
          { index: "my-index", shard: "0", prirep: "r", state: "STARTED" },
        ],
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.affected_indices).toEqual(["my-index"]);
  });

  it("#23 allocation.explain.can_allocate.no — fails when cannot allocate", () => {
    const check = findCheck(shardChecks, "allocation.explain.can_allocate.no");
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: {
          index: "test-idx",
          shard: 0,
          primary: true,
          can_allocate: "no",
          allocate_explanation: "cannot allocate because ...",
        },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.can_allocate).toBe("no");
  });

  it("#23 allocation.explain.can_allocate.no — passes when null explain", () => {
    const check = findCheck(shardChecks, "allocation.explain.can_allocate.no");
    expect(check.evaluate(makeSnapshot()).status).toBe("pass");
  });

  it("#24 allocation.explain.disk_watermark — fails when disk threshold blocks", () => {
    const check = findCheck(shardChecks, "allocation.explain.disk_watermark");
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: {
          index: "test-idx",
          shard: 0,
          primary: true,
          can_allocate: "no",
          node_allocation_decisions: [
            {
              node_name: "node-1",
              node_decision: "no",
              deciders: [
                {
                  decider: "disk_threshold",
                  decision: "NO",
                  explanation: "the node is above the low watermark",
                },
              ],
            },
          ],
        },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.blocked_by).toBe("disk_threshold");
  });

  it("#24 allocation.explain.disk_watermark — passes when no disk block", () => {
    const check = findCheck(shardChecks, "allocation.explain.disk_watermark");
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: {
          index: "test-idx",
          shard: 0,
          primary: false,
          can_allocate: "yes",
          node_allocation_decisions: [
            {
              node_name: "node-1",
              node_decision: "yes",
              deciders: [{ decider: "disk_threshold", decision: "YES", explanation: "ok" }],
            },
          ],
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });

  it("#25 allocation.explain.tier_mismatch — fails on data_tier block", () => {
    const check = findCheck(shardChecks, "allocation.explain.tier_mismatch");
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: {
          index: "test-idx",
          shard: 0,
          primary: true,
          can_allocate: "no",
          node_allocation_decisions: [
            {
              node_name: "node-1",
              node_decision: "no",
              deciders: [
                {
                  decider: "data_tier",
                  decision: "NO",
                  explanation: "node does not match required tier",
                },
              ],
            },
          ],
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// C) Nodes: JVM, OS, FS, thread pools
// ---------------------------------------------------------------------------
describe("node checks", () => {
  it("#31 nodes.jvm.heap_percent.high — warns on high heap", () => {
    const check = findCheck(nodeChecks, "nodes.jvm.heap_percent.high");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: { name: "hot-node", jvm: { mem: { heap_used_percent: 92 } } },
          },
        },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("warn");
    expect(result.observed?.heap_used_percent).toBe(92);
  });

  it("#31 nodes.jvm.heap_percent.high — passes on normal heap", () => {
    const check = findCheck(nodeChecks, "nodes.jvm.heap_percent.high");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "node-1", jvm: { mem: { heap_used_percent: 60 } } } },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });

  it("#37 nodes.fs.available.low — warns when disk low", () => {
    const check = findCheck(nodeChecks, "nodes.fs.available.low");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "data-node",
              fs: {
                total: {
                  available_in_bytes: 5 * 1024 * 1024 * 1024, // 5 GB
                  total_in_bytes: 500 * 1024 * 1024 * 1024,
                },
              },
            },
          },
        },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("warn");
    expect(result.summary).toContain("5.0 GB");
  });

  it("#37 nodes.fs.available.low — passes when disk ok", () => {
    const check = findCheck(nodeChecks, "nodes.fs.available.low");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "node-1",
              fs: { total: { available_in_bytes: 100 * 1024 * 1024 * 1024 } },
            },
          },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });

  it("#45 nodes.thread_pool.search.queue.high — warns on high queue", () => {
    const check = findCheck(nodeChecks, "nodes.thread_pool.search.queue.high");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "node-1", thread_pool: { search: { queue: 300 } } } },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });

  it("#45 nodes.thread_pool.search.queue.high — passes on low queue", () => {
    const check = findCheck(nodeChecks, "nodes.thread_pool.search.queue.high");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "node-1", thread_pool: { search: { queue: 10 } } } },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });

  it("#46 nodes.thread_pool.search.rejected.nonzero — warns on rejections", () => {
    const check = findCheck(nodeChecks, "nodes.thread_pool.search.rejected.nonzero");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "node-1", thread_pool: { search: { rejected: 5 } } } },
        },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("warn");
    expect(result.observed?.search_rejected).toBe(5);
  });

  it("#47 nodes.thread_pool.write.queue.high — warns on high queue", () => {
    const check = findCheck(nodeChecks, "nodes.thread_pool.write.queue.high");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "node-1", thread_pool: { write: { queue: 250 } } } },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });

  it("#48 nodes.thread_pool.write.rejected.nonzero — warns on rejections", () => {
    const check = findCheck(nodeChecks, "nodes.thread_pool.write.rejected.nonzero");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "node-1", thread_pool: { write: { rejected: 2 } } } },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });

  it("#49 nodes.thread_pool.bulk.queue.high — warns on high queue", () => {
    const check = findCheck(nodeChecks, "nodes.thread_pool.bulk.queue.high");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "node-1", thread_pool: { bulk: { queue: 400 } } } },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });

  it("#50 nodes.thread_pool.bulk.rejected.nonzero — warns on rejections", () => {
    const check = findCheck(nodeChecks, "nodes.thread_pool.bulk.rejected.nonzero");
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "node-1", thread_pool: { bulk: { rejected: 1 } } } },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// E) Tasks
// ---------------------------------------------------------------------------
describe("task checks", () => {
  it("#59 tasks.running.count.high — warns above threshold", () => {
    const check = findCheck(taskChecks, "tasks.running.count.high");
    const tasks: Record<string, unknown> = {};
    for (let i = 0; i < 120; i++) {
      tasks[`task-${i}`] = { action: "indices:data/read/search", running_time_in_nanos: 1000 };
    }
    const snap = makeSnapshot({
      tasksCore: { tasks: { nodes: { n1: { name: "node-1", tasks } } } },
    });
    expect(check.evaluate(snap).status).toBe("warn");
  });

  it("#60 tasks.long_running.absolute — fails on long tasks", () => {
    const check = findCheck(taskChecks, "tasks.long_running.absolute");
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "node-1",
              tasks: {
                "1": {
                  action: "indices:data/read/search",
                  running_time_in_nanos: 600_000_000_000,
                },
              },
            },
          },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("fail");
  });

  it("#61 tasks.long_running.search — warns on long search tasks", () => {
    const check = findCheck(taskChecks, "tasks.long_running.search");
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "node-1",
              tasks: {
                "1": {
                  action: "indices:data/read/search",
                  running_time_in_nanos: 600_000_000_000,
                },
                "2": {
                  action: "cluster:admin/something",
                  running_time_in_nanos: 600_000_000_000,
                },
              },
            },
          },
        },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("warn");
    expect(result.observed?.long_search_count).toBe(1);
  });

  it("#61 tasks.long_running.search — passes when no long searches", () => {
    const check = findCheck(taskChecks, "tasks.long_running.search");
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "node-1",
              tasks: {
                "1": {
                  action: "indices:data/read/search",
                  running_time_in_nanos: 1000,
                },
              },
            },
          },
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// H) ILM
// ---------------------------------------------------------------------------
describe("ilm checks", () => {
  it("#96 ilm.indices.error.present — fails on failed step", () => {
    const check = findCheck(ilmChecks, "ilm.indices.error.present");
    const snap = makeSnapshot({
      ilmCore: {
        ilmExplain: {
          indices: {
            "my-index": { managed: true, policy: "policy-1", failed_step: "rollover" },
          },
        },
        ilmPolicies: { "policy-1": {} },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.failed_count).toBe(1);
  });

  it("#101 ilm.policy.missing — fails on missing policy", () => {
    const check = findCheck(ilmChecks, "ilm.policy.missing");
    const snap = makeSnapshot({
      ilmCore: {
        ilmExplain: {
          indices: {
            "my-index": { managed: true, policy: "nonexistent-policy" },
          },
        },
        ilmPolicies: { "other-policy": {} },
      },
    });
    const result = check.evaluate(snap);
    expect(result.status).toBe("fail");
    expect(result.observed?.missing_count).toBe(1);
  });

  it("#101 ilm.policy.missing — passes when policies exist", () => {
    const check = findCheck(ilmChecks, "ilm.policy.missing");
    const snap = makeSnapshot({
      ilmCore: {
        ilmExplain: {
          indices: {
            "my-index": { managed: true, policy: "my-policy" },
          },
        },
        ilmPolicies: { "my-policy": {} },
      },
    });
    expect(check.evaluate(snap).status).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: every check has required fields
// ---------------------------------------------------------------------------
describe("check metadata", () => {
  it("every check has id, domain, title, description, severityOnFail, surfaces, dependsOn, evaluate", () => {
    for (const check of INITIAL_HEALTH_CHECKS) {
      expect(check.id).toBeTruthy();
      expect(check.domain).toBeTruthy();
      expect(check.title).toBeTruthy();
      expect(check.description).toBeTruthy();
      expect(["low", "medium", "high", "critical"]).toContain(check.severityOnFail);
      expect(check.surfaces.length).toBeGreaterThan(0);
      expect(check.dependsOn.length).toBeGreaterThan(0);
      expect(typeof check.evaluate).toBe("function");
    }
  });

  it("every check produces observed values and recommendation on failure", () => {
    // Verify structure contract: checks that fail/warn should include observed + recommendation
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: {
          status: "red",
          unassigned_shards: 5,
          initializing_shards: 10,
          relocating_shards: 10,
          active_shards_percent_as_number: 50,
        },
        pendingTasks: { tasks: [{ source: "test" }] },
      },
    });
    for (const check of clusterChecks) {
      if (check.dependsOn.includes("shards")) continue; // skip shard-dependent
      const result = check.evaluate(snap);
      if (result.status === "fail" || result.status === "warn") {
        expect(result.observed).toBeTruthy();
        expect(result.recommendation).toBeTruthy();
      }
    }
  });
});
