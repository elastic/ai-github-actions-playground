import { describe, expect, it } from "vitest";

import { HealthRegistry } from "../../src/health-checks/registry";

import type { HealthCheckDefinition } from "../../src/health-checks";

const SAMPLE_CHECK: HealthCheckDefinition = {
  id: "cluster.sample",
  domain: "cluster",
  title: "Sample",
  description: "sample check",
  severityOnFail: "low",
  surfaces: ["global"],
  dependsOn: ["clusterCore"],
  evaluate: () => ({ status: "pass", summary: "ok" }),
};

describe("HealthRegistry", () => {
  it("registers checks and filters by surface", () => {
    const registry = new HealthRegistry();
    registry.registerHealthChecks([SAMPLE_CHECK]);

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getBySurface("global")).toHaveLength(1);
    expect(registry.getBySurface("local")).toHaveLength(0);
  });

  it("rejects duplicate check ids", () => {
    const registry = new HealthRegistry();
    registry.registerHealthChecks([SAMPLE_CHECK]);

    expect(() => registry.registerHealthChecks([SAMPLE_CHECK])).toThrow(
      /Duplicate health check id/,
    );
  });
});
