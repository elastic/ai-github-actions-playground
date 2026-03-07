import { describe, expect, it } from "vitest";

import { evaluateHealthChecks } from "../../src/health-checks/engine";

import type { HealthCheckDefinition, HealthSnapshot } from "../../src/health-checks";

const BASE_SNAPSHOT: HealthSnapshot = {
  fetchedAt: new Date().toISOString(),
  data: {
    clusterCore: {
      clusterHealth: { status: "green", unassigned_shards: 0 },
      pendingTasks: { tasks: [] },
    },
  },
  errors: {},
};

describe("evaluateHealthChecks", () => {
  it("marks checks unknown when dependency query group failed", () => {
    const checks: HealthCheckDefinition[] = [
      {
        id: "cluster.depends",
        domain: "cluster",
        title: "Depends",
        description: "depends",
        severityOnFail: "high",
        surfaces: ["global"],
        dependsOn: ["clusterCore"],
        evaluate: () => ({ status: "pass", summary: "ok" }),
      },
    ];

    const result = evaluateHealthChecks(checks, {
      ...BASE_SNAPSHOT,
      errors: { clusterCore: "permission denied" },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("unknown");
    expect(result[0]?.reason).toContain("permission denied");
  });

  it("attaches severity for warn/fail statuses", () => {
    const checks: HealthCheckDefinition[] = [
      {
        id: "cluster.warn",
        domain: "cluster",
        title: "Warn",
        description: "warn",
        severityOnFail: "medium",
        surfaces: ["global"],
        dependsOn: ["clusterCore"],
        evaluate: () => ({ status: "warn", summary: "warning" }),
      },
    ];

    const result = evaluateHealthChecks(checks, BASE_SNAPSHOT);

    expect(result[0]?.status).toBe("warn");
    expect(result[0]?.severity).toBe("medium");
  });
});
