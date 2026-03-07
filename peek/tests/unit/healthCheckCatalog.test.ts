import { describe, expect, it } from "vitest";

import { clusterChecks } from "../../src/health-checks/checks/cluster";
import { ilmChecks } from "../../src/health-checks/checks/ilm";
import { indicesChecks } from "../../src/health-checks/checks/indices";
import { ingestChecks } from "../../src/health-checks/checks/ingest";
import { nodeChecks } from "../../src/health-checks/checks/nodes";
import { recoveryChecks } from "../../src/health-checks/checks/recovery";
import { securityChecks } from "../../src/health-checks/checks/security";
import { shardChecks } from "../../src/health-checks/checks/shards";
import { snapshotChecks } from "../../src/health-checks/checks/snapshots";
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
          delayed_unassigned_shards: 0,
          number_of_in_flight_fetch: 0,
          active_shards_percent_as_number: 100,
        },
        pendingTasks: { tasks: [] },
      },
      shards: { catShards: [] },
      allocationSample: { allocationExplain: null },
      nodesCore: { nodeStats: { nodes: {} } },
      tasksCore: { tasks: { nodes: {} } },
      indicesCore: { catIndices: [] },
      ilmCore: { ilmExplain: { indices: {} }, ilmPolicies: {} },
      recoveryCore: { recovery: {} },
      securityCore: { apiKeys: { api_keys: [] } },
      snapshotsCore: { snapshots: [], policies: {}, slmStats: {} },
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

// ---------------------------------------------------------------------------
// Catalog integrity
// ---------------------------------------------------------------------------

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
      ilmChecks.length +
      indicesChecks.length +
      ingestChecks.length +
      recoveryChecks.length +
      securityChecks.length +
      snapshotChecks.length;
    expect(INITIAL_HEALTH_CHECKS).toHaveLength(total);
  });

  it("has at least 80 checks", () => {
    expect(INITIAL_HEALTH_CHECKS.length).toBeGreaterThanOrEqual(80);
  });
});

// ---------------------------------------------------------------------------
// Cluster checks
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
    expect(check.evaluate(snap).status).toBe("fail");
  });

  it("#1 cluster.status.red — passes on green", () => {
    expect(findCheck(clusterChecks, "cluster.status.red").evaluate(makeSnapshot()).status).toBe(
      "pass",
    );
  });

  it("#1 cluster.status.red — unknown when cluster health is missing", () => {
    const snap = makeSnapshot({ clusterCore: undefined });
    expect(findCheck(clusterChecks, "cluster.status.red").evaluate(snap).status).toBe("unknown");
  });

  it("#2 cluster.status.yellow — warns on yellow", () => {
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "yellow", unassigned_shards: 0 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(findCheck(clusterChecks, "cluster.status.yellow").evaluate(snap).status).toBe("warn");
  });

  it("#3 cluster.unassigned_shards.nonzero — fails with unassigned", () => {
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "yellow", unassigned_shards: 3 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(
      findCheck(clusterChecks, "cluster.unassigned_shards.nonzero").evaluate(snap).status,
    ).toBe("fail");
  });

  it("#4 cluster.unassigned_primaries.nonzero — fails with unassigned primaries", () => {
    const snap = makeSnapshot({
      shards: {
        catShards: [
          { index: "idx-1", shard: "0", prirep: "p", state: "UNASSIGNED" },
          { index: "idx-1", shard: "1", prirep: "r", state: "UNASSIGNED" },
        ],
      },
    });
    expect(
      findCheck(clusterChecks, "cluster.unassigned_primaries.nonzero").evaluate(snap).status,
    ).toBe("fail");
  });

  it("#5 cluster.initializing_shards.high — warns above threshold", () => {
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green", initializing_shards: 10 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(findCheck(clusterChecks, "cluster.initializing_shards.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#6 cluster.relocating_shards.high — warns above threshold", () => {
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green", relocating_shards: 8 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(findCheck(clusterChecks, "cluster.relocating_shards.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#7 cluster.active_shards_percent.low — warns below 100%", () => {
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "yellow", active_shards_percent_as_number: 85.5 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(
      findCheck(clusterChecks, "cluster.active_shards_percent.low").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#8 cluster.pending_tasks.nonzero — warns when tasks present", () => {
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green" },
        pendingTasks: { tasks: [{ source: "test" }] },
      },
    });
    expect(findCheck(clusterChecks, "cluster.pending_tasks.nonzero").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#9 cluster.pending_tasks.high — warns when >= 10", () => {
    const tasks = Array.from({ length: 12 }, (_, i) => ({
      insert_order: i,
      priority: "NORMAL",
      source: "test",
      time_in_queue_millis: 100,
    }));
    const snap = makeSnapshot({
      clusterCore: { clusterHealth: { status: "green" }, pendingTasks: { tasks } },
    });
    expect(findCheck(clusterChecks, "cluster.pending_tasks.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#10 cluster.pending_tasks.oldest_wait.high — warns when wait >= 30s", () => {
    const tasks = [
      { insert_order: 1, priority: "NORMAL", source: "test", time_in_queue_millis: 35000 },
    ];
    const snap = makeSnapshot({
      clusterCore: { clusterHealth: { status: "green" }, pendingTasks: { tasks } },
    });
    expect(
      findCheck(clusterChecks, "cluster.pending_tasks.oldest_wait.high").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#11 cluster.pending_tasks.priority.urgent — fails on URGENT", () => {
    const tasks = [
      { insert_order: 1, priority: "URGENT", source: "test", time_in_queue_millis: 100 },
    ];
    const snap = makeSnapshot({
      clusterCore: { clusterHealth: { status: "green" }, pendingTasks: { tasks } },
    });
    expect(
      findCheck(clusterChecks, "cluster.pending_tasks.priority.urgent").evaluate(snap).status,
    ).toBe("fail");
  });

  it("#12 cluster.pending_tasks.source.ilm_heavy — warns on many ILM tasks", () => {
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      insert_order: i,
      priority: "NORMAL",
      source: `ilm-move-to-step [index-${i}]`,
      time_in_queue_millis: 100,
    }));
    const snap = makeSnapshot({
      clusterCore: { clusterHealth: { status: "green" }, pendingTasks: { tasks } },
    });
    expect(
      findCheck(clusterChecks, "cluster.pending_tasks.source.ilm_heavy").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#13 cluster.pending_tasks.source.mapping_heavy — warns on mapping tasks", () => {
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      insert_order: i,
      priority: "NORMAL",
      source: `put-mapping [index-${i}]`,
      time_in_queue_millis: 100,
    }));
    const snap = makeSnapshot({
      clusterCore: { clusterHealth: { status: "green" }, pendingTasks: { tasks } },
    });
    expect(
      findCheck(clusterChecks, "cluster.pending_tasks.source.mapping_heavy").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#14 cluster.pending_tasks.source.shard_started_backlog — warns on shard-started", () => {
    const tasks = Array.from({ length: 11 }, (_, i) => ({
      insert_order: i,
      priority: "NORMAL",
      source: `shard-started [index][${i}]`,
      time_in_queue_millis: 100,
    }));
    const snap = makeSnapshot({
      clusterCore: { clusterHealth: { status: "green" }, pendingTasks: { tasks } },
    });
    expect(
      findCheck(clusterChecks, "cluster.pending_tasks.source.shard_started_backlog").evaluate(snap)
        .status,
    ).toBe("warn");
  });

  it("cluster.delayed_unassigned_shards.nonzero — warns", () => {
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green", delayed_unassigned_shards: 1 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(
      findCheck(clusterChecks, "cluster.delayed_unassigned_shards.nonzero").evaluate(snap).status,
    ).toBe("warn");
  });

  it("cluster.in_flight_fetch.high — warns when >= 10", () => {
    const snap = makeSnapshot({
      clusterCore: {
        clusterHealth: { status: "green", number_of_in_flight_fetch: 15 },
        pendingTasks: { tasks: [] },
      },
    });
    expect(findCheck(clusterChecks, "cluster.in_flight_fetch.high").evaluate(snap).status).toBe(
      "warn",
    );
  });
});

// ---------------------------------------------------------------------------
// Shard checks
// ---------------------------------------------------------------------------
describe("shard checks", () => {
  it("#15 shards.state.unassigned.present — fails", () => {
    const snap = makeSnapshot({ shards: { catShards: [{ index: "idx", state: "UNASSIGNED" }] } });
    expect(findCheck(shardChecks, "shards.state.unassigned.present").evaluate(snap).status).toBe(
      "fail",
    );
  });

  it("#16 shards.state.initializing.high — warns on many", () => {
    const shards = Array.from({ length: 12 }, () => ({ state: "INITIALIZING", index: "idx" }));
    const snap = makeSnapshot({ shards: { catShards: shards } });
    expect(findCheck(shardChecks, "shards.state.initializing.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#17 shards.state.relocating.high — warns on many", () => {
    const shards = Array.from({ length: 12 }, () => ({ state: "RELOCATING", index: "idx" }));
    const snap = makeSnapshot({ shards: { catShards: shards } });
    expect(findCheck(shardChecks, "shards.state.relocating.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#19 shards.unassigned.reason.allocation_failed — warns", () => {
    const snap = makeSnapshot({
      shards: {
        catShards: [
          { state: "UNASSIGNED", index: "idx", "unassigned.reason": "ALLOCATION_FAILED" },
        ],
      },
    });
    expect(
      findCheck(shardChecks, "shards.unassigned.reason.allocation_failed").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#20 shards.unassigned.reason.primary_failed — fails", () => {
    const snap = makeSnapshot({
      shards: {
        catShards: [{ state: "UNASSIGNED", index: "idx", "unassigned.reason": "PRIMARY_FAILED" }],
      },
    });
    expect(
      findCheck(shardChecks, "shards.unassigned.reason.primary_failed").evaluate(snap).status,
    ).toBe("fail");
  });

  it("#15 shards.state.unassigned.present — unknown when shard data is missing", () => {
    const check = findCheck(shardChecks, "shards.state.unassigned.present");
    const snap = makeSnapshot({ shards: undefined });
    expect(check.evaluate(snap).status).toBe("unknown");
  });

  it("#21 shards.unassigned.reason.node_left — warns", () => {
    const snap = makeSnapshot({
      shards: {
        catShards: [{ state: "UNASSIGNED", index: "idx", "unassigned.reason": "NODE_LEFT" }],
      },
    });
    expect(findCheck(shardChecks, "shards.unassigned.reason.node_left").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#22 shards.unassigned.reason.index_closed — warns", () => {
    const snap = makeSnapshot({
      shards: {
        catShards: [{ state: "UNASSIGNED", index: "idx", "unassigned.reason": "INDEX_CLOSED" }],
      },
    });
    expect(
      findCheck(shardChecks, "shards.unassigned.reason.index_closed").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#23 allocation.explain.can_allocate.no — fails", () => {
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: { index: "idx", shard: 0, primary: true, can_allocate: "no" },
      },
    });
    expect(findCheck(shardChecks, "allocation.explain.can_allocate.no").evaluate(snap).status).toBe(
      "fail",
    );
  });

  it("#23 allocation.explain.can_allocate.no — fails on can_allocate no", () => {
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

  it("#23 allocation.explain.can_allocate.no — unknown when allocation data is missing", () => {
    const check = findCheck(shardChecks, "allocation.explain.can_allocate.no");
    const snap = makeSnapshot({ allocationSample: undefined });
    expect(check.evaluate(snap).status).toBe("unknown");
  });

  it("#24 allocation.explain.disk_watermark — fails when disk threshold blocks", () => {
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: {
          index: "test-idx",
          shard: 0,
          primary: true,
          can_allocate: "no",
          node_allocation_decisions: [
            {
              node_name: "n1",
              node_decision: "no",
              deciders: [
                { decider: "disk_threshold", decision: "NO", explanation: "above watermark" },
              ],
            },
          ],
        },
      },
    });
    expect(findCheck(shardChecks, "allocation.explain.disk_watermark").evaluate(snap).status).toBe(
      "fail",
    );
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

  it("#24 allocation.explain.disk_watermark — passes when can_allocate is yes despite NO decider", () => {
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
              deciders: [
                {
                  decider: "disk_threshold",
                  decision: "NO",
                  explanation: "node above watermark but shard allocates elsewhere",
                },
              ],
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
              node_name: "n1",
              node_decision: "no",
              deciders: [
                { decider: "data_tier", decision: "NO", explanation: "not on correct tier" },
              ],
            },
          ],
        },
      },
    });
    expect(check.evaluate(snap).status).toBe("fail");
  });

  it("#26 allocation.explain.awareness_constraints — warns", () => {
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: {
          index: "idx",
          shard: 0,
          primary: true,
          node_allocation_decisions: [
            {
              node_name: "n1",
              node_decision: "no",
              deciders: [{ decider: "awareness", decision: "NO", explanation: "blocked" }],
            },
          ],
        },
      },
    });
    expect(
      findCheck(shardChecks, "allocation.explain.awareness_constraints").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#26 allocation.explain.awareness_constraints — unknown when explain is missing", () => {
    const snap = makeSnapshot({ allocationSample: { allocationExplain: null } });
    expect(
      findCheck(shardChecks, "allocation.explain.awareness_constraints").evaluate(snap).status,
    ).toBe("unknown");
  });

  it("#27 allocation.explain.same_shard_host — warns", () => {
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: {
          index: "idx",
          shard: 0,
          primary: true,
          node_allocation_decisions: [
            {
              node_name: "n1",
              node_decision: "no",
              deciders: [{ decider: "same_shard", decision: "NO", explanation: "blocked" }],
            },
          ],
        },
      },
    });
    expect(findCheck(shardChecks, "allocation.explain.same_shard_host").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#28 allocation.explain.max_retry_exceeded — warns", () => {
    const snap = makeSnapshot({
      allocationSample: {
        allocationExplain: {
          index: "idx",
          shard: 0,
          primary: true,
          can_allocate: "no_attempt (max retry exceeded)",
          node_allocation_decisions: [],
        },
      },
    });
    expect(
      findCheck(shardChecks, "allocation.explain.max_retry_exceeded").evaluate(snap).status,
    ).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Node checks
// ---------------------------------------------------------------------------
describe("node checks", () => {
  it("#31 nodes.jvm.heap_percent.high — warns on high heap", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "hot-node", jvm: { mem: { heap_used_percent: 92 } } } } },
      },
    });
    expect(findCheck(nodeChecks, "nodes.jvm.heap_percent.high").evaluate(snap).status).toBe("warn");
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

  it("#31 nodes.jvm.heap_percent.high — unknown when node stats are missing", () => {
    const check = findCheck(nodeChecks, "nodes.jvm.heap_percent.high");
    const snap = makeSnapshot({ nodesCore: undefined });
    expect(check.evaluate(snap).status).toBe("unknown");
  });

  it("#32 nodes.jvm.old_gc.time.high — warns on high GC time", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              jvm: { gc: { collectors: { old: { collection_time_in_millis: 6000 } } } },
            },
          },
        },
      },
    });
    expect(findCheck(nodeChecks, "nodes.jvm.old_gc.time.high").evaluate(snap).status).toBe("warn");
  });

  it("#33 nodes.jvm.young_gc.time.high — warns on high GC time", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              jvm: { gc: { collectors: { young: { collection_time_in_millis: 15000 } } } },
            },
          },
        },
      },
    });
    expect(findCheck(nodeChecks, "nodes.jvm.young_gc.time.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#35 nodes.os.load_1m.high — warns on high load", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "n1", os: { cpu: { percent: 50, load_average: { "1m": 15.0 } } } } },
        },
      },
    });
    expect(findCheck(nodeChecks, "nodes.os.load_1m.high").evaluate(snap).status).toBe("warn");
  });

  it("#36 nodes.process.open_file_descriptors.high — warns on high ratio", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              process: { open_file_descriptors: 9000, max_file_descriptors: 10000 },
            },
          },
        },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.process.open_file_descriptors.high").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#37 nodes.fs.available.low — warns when disk low", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              fs: {
                total: {
                  available_in_bytes: 5 * 1024 * 1024 * 1024,
                  total_in_bytes: 500 * 1024 * 1024 * 1024,
                },
              },
            },
          },
        },
      },
    });
    expect(findCheck(nodeChecks, "nodes.fs.available.low").evaluate(snap).status).toBe("warn");
  });

  it("#38 nodes.fs.used_percent.high — fails when disk > 90%", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              fs: { total: { total_in_bytes: 1000000000, available_in_bytes: 50000000 } },
            },
          },
        },
      },
    });
    expect(findCheck(nodeChecks, "nodes.fs.used_percent.high").evaluate(snap).status).toBe("fail");
  });

  it("#42 nodes.http.current_open.high — warns when > 200", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "n1", http: { current_open: 300, total_opened: 500 } } },
        },
      },
    });
    expect(findCheck(nodeChecks, "nodes.http.current_open.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#43 nodes.http.total_opened.burst_like — warns when > 10000", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "n1", http: { current_open: 10, total_opened: 15000 } } },
        },
      },
    });
    expect(findCheck(nodeChecks, "nodes.http.total_opened.burst_like").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#44 nodes.distribution.hotspotting — warns on uneven CPU", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              os: { cpu: { percent: 95 } },
              jvm: { mem: { heap_used_percent: 30 } },
            },
            n2: {
              name: "n2",
              os: { cpu: { percent: 20 } },
              jvm: { mem: { heap_used_percent: 30 } },
            },
            n3: {
              name: "n3",
              os: { cpu: { percent: 15 } },
              jvm: { mem: { heap_used_percent: 30 } },
            },
          },
        },
      },
    });
    expect(findCheck(nodeChecks, "nodes.distribution.hotspotting").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#45 nodes.thread_pool.search.queue.high — warns on high queue", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", thread_pool: { search: { queue: 300 } } } } },
      },
    });
    expect(findCheck(nodeChecks, "nodes.thread_pool.search.queue.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#46 nodes.thread_pool.search.rejected.nonzero — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", thread_pool: { search: { rejected: 5 } } } } },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.thread_pool.search.rejected.nonzero").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#47 nodes.thread_pool.write.queue.high — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", thread_pool: { write: { queue: 250 } } } } },
      },
    });
    expect(findCheck(nodeChecks, "nodes.thread_pool.write.queue.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#48 nodes.thread_pool.write.rejected.nonzero — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", thread_pool: { write: { rejected: 2 } } } } },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.thread_pool.write.rejected.nonzero").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#51 nodes.thread_pool.management.queue.high — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", thread_pool: { management: { queue: 300 } } } } },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.thread_pool.management.queue.high").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#52 nodes.thread_pool.snapshot.queue.high — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", thread_pool: { snapshot: { queue: 300 } } } } },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.thread_pool.snapshot.queue.high").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#53 nodes.breaker.parent.tripped.nonzero — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", breakers: { parent: { tripped: 5 } } } } },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.breaker.parent.tripped.nonzero").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#54 nodes.breaker.request.tripped.nonzero — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", breakers: { request: { tripped: 3 } } } } },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.breaker.request.tripped.nonzero").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#55 nodes.breaker.fielddata.tripped.nonzero — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", breakers: { fielddata: { tripped: 2 } } } } },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.breaker.fielddata.tripped.nonzero").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#56 nodes.breaker.inflight_requests.tripped.nonzero — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: { n1: { name: "n1", breakers: { in_flight_requests: { tripped: 1 } } } },
        },
      },
    });
    expect(
      findCheck(nodeChecks, "nodes.breaker.inflight_requests.tripped.nonzero").evaluate(snap)
        .status,
    ).toBe("warn");
  });

  it("nodes.os.mem.used_percent.high — warns on high memory", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: { nodes: { n1: { name: "n1", os: { mem: { used_percent: 95 } } } } },
      },
    });
    expect(findCheck(nodeChecks, "nodes.os.mem.used_percent.high").evaluate(snap).status).toBe(
      "warn",
    );
  });
});

// ---------------------------------------------------------------------------
// Task checks
// ---------------------------------------------------------------------------
describe("task checks", () => {
  it("#59 tasks.running.count.high — warns above threshold", () => {
    const tasks: Record<string, unknown> = {};
    for (let i = 0; i < 120; i++)
      tasks[`task-${i}`] = { action: "indices:data/read/search", running_time_in_nanos: 1000 };
    const snap = makeSnapshot({ tasksCore: { tasks: { nodes: { n1: { name: "n1", tasks } } } } });
    expect(findCheck(taskChecks, "tasks.running.count.high").evaluate(snap).status).toBe("warn");
  });

  it("#60 tasks.long_running.absolute — fails on long tasks", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "n1",
              tasks: { "1": { action: "test", running_time_in_nanos: 600_000_000_000 } },
            },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.long_running.absolute").evaluate(snap).status).toBe("fail");
  });

  it("#61 tasks.long_running.search — warns on long search tasks", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "n1",
              tasks: {
                "1": { action: "indices:data/read/search", running_time_in_nanos: 600_000_000_000 },
              },
            },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.long_running.search").evaluate(snap).status).toBe("warn");
  });

  it("#62 tasks.long_running.reindex — warns on long reindex", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "n1",
              tasks: {
                "1": {
                  action: "indices:data/write/reindex",
                  running_time_in_nanos: 600_000_000_000,
                },
              },
            },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.long_running.reindex").evaluate(snap).status).toBe("warn");
  });

  it("#63 tasks.long_running.update_by_query — warns", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "n1",
              tasks: {
                "1": {
                  action: "indices:data/write/update_by_query",
                  running_time_in_nanos: 600_000_000_000,
                },
              },
            },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.long_running.update_by_query").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#64 tasks.long_running.delete_by_query — warns", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "n1",
              tasks: {
                "1": {
                  action: "indices:data/write/delete_by_query",
                  running_time_in_nanos: 600_000_000_000,
                },
              },
            },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.long_running.delete_by_query").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#65 tasks.long_running.snapshot — warns", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "n1",
              tasks: {
                "1": {
                  action: "cluster:admin/snapshot/create",
                  running_time_in_nanos: 600_000_000_000,
                },
              },
            },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.long_running.snapshot").evaluate(snap).status).toBe("warn");
  });

  it("#66 tasks.cancellable.long_running — warns", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "n1",
              tasks: {
                "1": { action: "test", cancellable: true, running_time_in_nanos: 600_000_000_000 },
              },
            },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.cancellable.long_running").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#69 tasks.action.risky.count.high — warns on many risky", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: {
              name: "n1",
              tasks: {
                "1": { action: "indices:data/write/delete_by_query" },
                "2": { action: "indices:data/write/reindex" },
                "3": { action: "indices:data/write/update_by_query" },
              },
            },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.action.risky.count.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#70 tasks.description.large_fanout — warns on wildcard", () => {
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: { name: "n1", tasks: { "1": { action: "test", description: "indices[logs-*]" } } },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.description.large_fanout").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#68 tasks.node_concentration.high — warns on concentration", () => {
    const tasks: Record<string, unknown> = {};
    for (let i = 0; i < 25; i++) tasks[`t-${i}`] = { action: "test" };
    const snap = makeSnapshot({
      tasksCore: {
        tasks: {
          nodes: {
            n1: { name: "n1", tasks },
            n2: { name: "n2", tasks: { "t-0": { action: "test" } } },
          },
        },
      },
    });
    expect(findCheck(taskChecks, "tasks.node_concentration.high").evaluate(snap).status).toBe(
      "warn",
    );
  });
});

// ---------------------------------------------------------------------------
// ILM checks
// ---------------------------------------------------------------------------
describe("ilm checks", () => {
  it("#96 ilm.indices.error.present — fails on failed step", () => {
    const snap = makeSnapshot({
      ilmCore: {
        ilmExplain: {
          indices: { "my-index": { managed: true, policy: "p1", failed_step: "rollover" } },
        },
        ilmPolicies: { p1: {} },
      },
    });
    expect(findCheck(ilmChecks, "ilm.indices.error.present").evaluate(snap).status).toBe("fail");
  });

  it("#98 ilm.indices.step_info.exception.present — warns on step_info reason", () => {
    const snap = makeSnapshot({
      ilmCore: {
        ilmExplain: {
          indices: {
            "my-index": {
              managed: true,
              policy: "p1",
              phase: "hot",
              step_info: { reason: "index not found" },
            },
          },
        },
        ilmPolicies: { p1: {} },
      },
    });
    expect(
      findCheck(ilmChecks, "ilm.indices.step_info.exception.present").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#99 ilm.phase.delete_backlog — warns on many delete-phase indices", () => {
    const indices: Record<string, { managed: boolean; policy: string; phase: string }> = {};
    for (let i = 0; i < 55; i++)
      indices[`idx-${i}`] = { managed: true, policy: "p1", phase: "delete" };
    const snap = makeSnapshot({ ilmCore: { ilmExplain: { indices }, ilmPolicies: { p1: {} } } });
    expect(findCheck(ilmChecks, "ilm.phase.delete_backlog").evaluate(snap).status).toBe("warn");
  });

  it("#100 ilm.phase.hot_backlog — warns on many hot-phase indices", () => {
    const indices: Record<string, { managed: boolean; policy: string; phase: string }> = {};
    for (let i = 0; i < 110; i++)
      indices[`idx-${i}`] = { managed: true, policy: "p1", phase: "hot" };
    const snap = makeSnapshot({ ilmCore: { ilmExplain: { indices }, ilmPolicies: { p1: {} } } });
    expect(findCheck(ilmChecks, "ilm.phase.hot_backlog").evaluate(snap).status).toBe("warn");
  });

  it("#101 ilm.policy.missing — fails on missing policy", () => {
    const snap = makeSnapshot({
      ilmCore: {
        ilmExplain: { indices: { "my-index": { managed: true, policy: "nonexistent" } } },
        ilmPolicies: { other: {} },
      },
    });
    expect(findCheck(ilmChecks, "ilm.policy.missing").evaluate(snap).status).toBe("fail");
  });

  it("#102 ilm.policy.invalid_action_config — warns on invalid config", () => {
    const snap = makeSnapshot({
      ilmCore: {
        ilmExplain: {
          indices: {
            "my-index": {
              managed: true,
              policy: "p1",
              phase: "hot",
              step_info: { reason: "invalid [rollover] action config" },
            },
          },
        },
        ilmPolicies: { p1: {} },
      },
    });
    expect(findCheck(ilmChecks, "ilm.policy.invalid_action_config").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#96 ilm.indices.error.present — unknown when ILM explain data is missing", () => {
    const snap = makeSnapshot({ ilmCore: undefined });
    expect(findCheck(ilmChecks, "ilm.indices.error.present").evaluate(snap).status).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Indices checks
// ---------------------------------------------------------------------------
describe("indices checks", () => {
  it("#73 indices.status.red.present — fails on red index", () => {
    const snap = makeSnapshot({
      indicesCore: {
        catIndices: [
          {
            index: "bad",
            health: "red",
            status: "open",
            pri: "1",
            rep: "1",
            "docs.count": "100",
            "docs.deleted": "0",
            "store.size": "1000",
            "pri.store.size": "1000",
          },
        ],
      },
    });
    expect(findCheck(indicesChecks, "indices.status.red.present").evaluate(snap).status).toBe(
      "fail",
    );
  });

  it("#73 indices.status.red.present — unknown when indices data is missing", () => {
    const snap = makeSnapshot({ indicesCore: undefined });
    expect(findCheck(indicesChecks, "indices.status.red.present").evaluate(snap).status).toBe(
      "unknown",
    );
  });

  it("#74 indices.status.yellow.high — warns on many yellow", () => {
    const cats = Array.from({ length: 12 }, (_, i) => ({
      index: `idx-${i}`,
      health: "yellow",
      status: "open",
      pri: "1",
      rep: "1",
      "docs.count": "100",
      "docs.deleted": "0",
      "store.size": "1000",
      "pri.store.size": "1000",
    }));
    const snap = makeSnapshot({ indicesCore: { catIndices: cats } });
    expect(findCheck(indicesChecks, "indices.status.yellow.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#75 indices.shard_size.too_large — warns on > 50 GB shards", () => {
    const snap = makeSnapshot({
      indicesCore: {
        catIndices: [
          {
            index: "big",
            health: "green",
            status: "open",
            pri: "1",
            rep: "1",
            "docs.count": "1000000",
            "docs.deleted": "0",
            "store.size": String(60 * 1024 * 1024 * 1024),
            "pri.store.size": String(60 * 1024 * 1024 * 1024),
          },
        ],
      },
    });
    expect(findCheck(indicesChecks, "indices.shard_size.too_large").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#77 indices.docs_deleted_ratio.high — warns on high deletion ratio", () => {
    const snap = makeSnapshot({
      indicesCore: {
        catIndices: [
          {
            index: "del",
            health: "green",
            status: "open",
            pri: "1",
            rep: "1",
            "docs.count": "100",
            "docs.deleted": "200",
            "store.size": "1000000",
            "pri.store.size": "1000000",
          },
        ],
      },
    });
    expect(findCheck(indicesChecks, "indices.docs_deleted_ratio.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("indices.count.high — warns on many indices", () => {
    const cats = Array.from({ length: 1100 }, (_, i) => ({
      index: `idx-${i}`,
      health: "green",
      status: "open",
      pri: "1",
      rep: "1",
      "docs.count": "100",
      "docs.deleted": "0",
      "store.size": "1000",
      "pri.store.size": "1000",
    }));
    const snap = makeSnapshot({ indicesCore: { catIndices: cats } });
    expect(findCheck(indicesChecks, "indices.count.high").evaluate(snap).status).toBe("warn");
  });

  it("indices.closed.present — warns on closed", () => {
    const snap = makeSnapshot({
      indicesCore: {
        catIndices: [
          {
            index: "closed",
            health: "green",
            status: "close",
            pri: "1",
            rep: "1",
            "docs.count": null,
            "docs.deleted": null,
            "store.size": null,
            "pri.store.size": null,
          },
        ],
      },
    });
    expect(findCheck(indicesChecks, "indices.closed.present").evaluate(snap).status).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Ingest checks
// ---------------------------------------------------------------------------
describe("ingest checks", () => {
  it("#104 ingest.pipelines.with_failures — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              ingest: {
                total: { count: 100, failed: 5 },
                pipelines: {
                  "my-pipeline": { count: 100, failed: 5, current: 0, time_in_millis: 50 },
                },
              },
            },
          },
        },
      },
    });
    expect(findCheck(ingestChecks, "ingest.pipelines.with_failures").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#105 ingest.pipelines.error_rate.high — warns on high error rate", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              ingest: {
                total: { count: 100, failed: 10 },
                pipelines: {
                  "my-pipeline": { count: 100, failed: 10, current: 0, time_in_millis: 50 },
                },
              },
            },
          },
        },
      },
    });
    expect(findCheck(ingestChecks, "ingest.pipelines.error_rate.high").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#106 ingest.pipelines.time_per_doc.high — warns on slow processing", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              ingest: {
                total: { count: 100, failed: 0 },
                pipelines: {
                  "my-pipeline": { count: 100, failed: 0, current: 0, time_in_millis: 5000 },
                },
              },
            },
          },
        },
      },
    });
    expect(
      findCheck(ingestChecks, "ingest.pipelines.time_per_doc.high").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#107 ingest.pipelines.current_inflight.high — warns", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              ingest: { total: { count: 100, failed: 0, current: 150 }, pipelines: {} },
            },
          },
        },
      },
    });
    expect(
      findCheck(ingestChecks, "ingest.pipelines.current_inflight.high").evaluate(snap).status,
    ).toBe("warn");
  });

  it("#109 ingest.nodes.skew — warns on uneven distribution", () => {
    const snap = makeSnapshot({
      nodesCore: {
        nodeStats: {
          nodes: {
            n1: {
              name: "n1",
              ingest: {
                total: { count: 10000, failed: 0, current: 0, time_in_millis: 100 },
                pipelines: {},
              },
            },
            n2: {
              name: "n2",
              ingest: {
                total: { count: 100, failed: 0, current: 0, time_in_millis: 10 },
                pipelines: {},
              },
            },
            n3: {
              name: "n3",
              ingest: {
                total: { count: 50, failed: 0, current: 0, time_in_millis: 5 },
                pipelines: {},
              },
            },
          },
        },
      },
    });
    expect(findCheck(ingestChecks, "ingest.nodes.skew").evaluate(snap).status).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Recovery checks
// ---------------------------------------------------------------------------
describe("recovery checks", () => {
  it("#29 recovery.active.high — warns on many active recoveries", () => {
    const shards = Array.from({ length: 6 }, () => ({ stage: "INDEX" }));
    const snap = makeSnapshot({ recoveryCore: { recovery: { "test-idx": { shards } } } });
    expect(findCheck(recoveryChecks, "recovery.active.high").evaluate(snap).status).toBe("warn");
  });

  it("#30 recovery.stage.long_tail — warns on translog stages", () => {
    const snap = makeSnapshot({
      recoveryCore: {
        recovery: {
          "test-idx": {
            shards: [{ stage: "TRANSLOG" }, { stage: "TRANSLOG" }, { stage: "FINALIZE" }],
          },
        },
      },
    });
    expect(findCheck(recoveryChecks, "recovery.stage.long_tail").evaluate(snap).status).toBe(
      "warn",
    );
  });
});

// ---------------------------------------------------------------------------
// Security checks
// ---------------------------------------------------------------------------
describe("security checks", () => {
  it("#114 security.api_keys.expiring_soon — warns on soon-to-expire keys", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      securityCore: {
        apiKeys: {
          api_keys: [
            {
              id: "1",
              name: "test-key",
              username: "admin",
              creation: now - 86400000,
              expiration: now + 3 * 86400000,
              invalidated: false,
            },
          ],
        },
      },
    });
    expect(findCheck(securityChecks, "security.api_keys.expiring_soon").evaluate(snap).status).toBe(
      "warn",
    );
  });

  it("#115 security.api_keys.invalidated_high — warns on many invalidated", () => {
    const keys = Array.from({ length: 110 }, (_, i) => ({
      id: String(i),
      name: `key-${i}`,
      username: "admin",
      creation: Date.now(),
      invalidated: true,
    }));
    const snap = makeSnapshot({ securityCore: { apiKeys: { api_keys: keys } } });
    expect(
      findCheck(securityChecks, "security.api_keys.invalidated_high").evaluate(snap).status,
    ).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Check metadata
// ---------------------------------------------------------------------------
describe("check metadata", () => {
  it("every check has required fields", () => {
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
    for (const check of INITIAL_HEALTH_CHECKS) {
      if (check.dependsOn.includes("shards")) continue; // skip shard-dependent
      const result = check.evaluate(snap);
      if (result.status === "fail" || result.status === "warn") {
        expect(result.observed).toBeTruthy();
        expect(result.recommendation).toBeTruthy();
      }
    }
  });
});
