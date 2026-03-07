import { describe, expect, it } from "vitest";

import { INITIAL_HEALTH_CHECKS } from "../../src/health-checks/checks";
import type { HealthSnapshot } from "../../src/health-checks";

function makeSnapshot(overrides: Partial<HealthSnapshot["data"]> = {}): HealthSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    data: {
      clusterCore: {
        clusterHealth: { status: "green", unassigned_shards: 0, delayed_unassigned_shards: 0 },
        pendingTasks: { tasks: [] },
      },
      nodesCore: { nodeStats: { nodes: {} } },
      tasksCore: { tasks: { nodes: {} } },
      ilmCore: { ilmExplain: { indices: {} }, ilmPolicies: {} },
      ...overrides,
    },
    errors: {},
  };
}

function findCheck(id: string) {
  const check = INITIAL_HEALTH_CHECKS.find((c) => c.id === id);
  if (!check) throw new Error(`Check ${id} not found`);
  return check;
}

describe("Health check catalog", () => {
  describe("cluster.delayed_unassigned_shards", () => {
    const check = findCheck("cluster.delayed_unassigned_shards");

    it("passes when no delayed shards", () => {
      const result = check.evaluate(makeSnapshot());
      expect(result.status).toBe("pass");
    });

    it("warns when delayed unassigned shards present", () => {
      const snapshot = makeSnapshot({
        clusterCore: {
          clusterHealth: {
            status: "yellow",
            unassigned_shards: 3,
            delayed_unassigned_shards: 2,
          },
          pendingTasks: { tasks: [] },
        },
      });
      const result = check.evaluate(snapshot);
      expect(result.status).toBe("warn");
      expect(result.summary).toContain("2 delayed");
    });
  });

  describe("nodes.jvm.heap_percent.high — voting-only exclusion", () => {
    const check = findCheck("nodes.jvm.heap_percent.high");

    it("ignores voting-only nodes with high heap", () => {
      const snapshot = makeSnapshot({
        nodesCore: {
          nodeStats: {
            nodes: {
              tiebreaker: {
                name: "tiebreaker-0000000002",
                roles: ["master", "voting_only"],
                jvm: { mem: { heap_used_percent: 95 } },
              },
              data1: {
                name: "instance-0000000000",
                roles: ["data_content", "data_hot", "master"],
                jvm: { mem: { heap_used_percent: 50 } },
              },
            },
          },
        },
      });
      const result = check.evaluate(snapshot);
      expect(result.status).toBe("pass");
    });

    it("still warns on high heap for data nodes", () => {
      const snapshot = makeSnapshot({
        nodesCore: {
          nodeStats: {
            nodes: {
              data1: {
                name: "instance-0000000001",
                roles: ["data_content", "data_hot", "master"],
                jvm: { mem: { heap_used_percent: 90 } },
              },
            },
          },
        },
      });
      const result = check.evaluate(snapshot);
      expect(result.status).toBe("warn");
      expect(result.summary).toContain("90%");
    });
  });

  describe("tasks.long_running.absolute — persistent task filtering", () => {
    const check = findCheck("tasks.long_running.absolute");
    const TEN_MINUTES_NS = 600_000_000_000;

    it("ignores persistent system tasks", () => {
      const snapshot = makeSnapshot({
        tasksCore: {
          tasks: {
            nodes: {
              node1: {
                tasks: {
                  "node1:1": {
                    action: "health-node",
                    type: "persistent",
                    cancellable: true,
                    running_time_in_nanos: TEN_MINUTES_NS,
                  },
                  "node1:2": {
                    action: "data_frame/transforms[c]",
                    type: "persistent",
                    cancellable: true,
                    running_time_in_nanos: TEN_MINUTES_NS,
                  },
                  "node1:3": {
                    action: "geoip-downloader",
                    type: "persistent",
                    cancellable: true,
                    running_time_in_nanos: TEN_MINUTES_NS,
                  },
                },
              },
            },
          },
        },
      });
      const result = check.evaluate(snapshot);
      expect(result.status).toBe("pass");
    });

    it("warns on long-running non-persistent tasks", () => {
      const snapshot = makeSnapshot({
        tasksCore: {
          tasks: {
            nodes: {
              node1: {
                tasks: {
                  "node1:1": {
                    action: "indices:data/read/search",
                    type: "transport",
                    cancellable: true,
                    running_time_in_nanos: TEN_MINUTES_NS,
                  },
                },
              },
            },
          },
        },
      });
      const result = check.evaluate(snapshot);
      expect(result.status).toBe("warn");
      expect(result.summary).toContain("1 long-running task");
    });
  });

  describe("every check has docs and recommendation", () => {
    it("all checks have docsUrl", () => {
      for (const check of INITIAL_HEALTH_CHECKS) {
        expect(check.docsUrl, `${check.id} missing docsUrl`).toBeTruthy();
      }
    });

    it("all checks have recommendation", () => {
      for (const check of INITIAL_HEALTH_CHECKS) {
        expect(check.recommendation, `${check.id} missing recommendation`).toBeTruthy();
      }
    });
  });
});
