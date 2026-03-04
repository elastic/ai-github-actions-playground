import { describe, it, expect } from "vitest";

import {
  readNestedString,
  readNestedNumber,
  fleetStatusColor,
  computeCheckinStaleness,
  deriveAgentStatus,
  aggregateFleetPolicies,
  type FleetAgentSummary,
} from "../../src/services/fleet";

describe("readNestedString", () => {
  it("reads a deeply nested string", () => {
    const source = { a: { b: { c: "deep" } } };
    expect(readNestedString(source as Record<string, unknown>, ["a", "b", "c"])).toBe("deep");
  });

  it("returns fallback for missing path", () => {
    expect(readNestedString({}, ["a", "b"], "fallback")).toBe("fallback");
  });

  it("returns fallback for empty string", () => {
    expect(readNestedString({ a: "" }, ["a"], "fallback")).toBe("fallback");
  });

  it("returns default fallback 'unknown' when not specified", () => {
    expect(readNestedString({}, ["a"])).toBe("unknown");
  });
});

describe("readNestedNumber", () => {
  it("reads a nested number", () => {
    const source = { metrics: { cpu: 42 } };
    expect(readNestedNumber(source as Record<string, unknown>, ["metrics", "cpu"])).toBe(42);
  });

  it("returns null for missing path", () => {
    expect(readNestedNumber({}, ["a"])).toBeNull();
  });

  it("returns null for non-number value", () => {
    expect(readNestedNumber({ a: "string" }, ["a"])).toBeNull();
  });
});

describe("fleetStatusColor", () => {
  it("returns success for online/healthy", () => {
    expect(fleetStatusColor("online")).toBe("success");
    expect(fleetStatusColor("healthy")).toBe("success");
    expect(fleetStatusColor("ONLINE")).toBe("success");
  });

  it("returns error for error", () => {
    expect(fleetStatusColor("error")).toBe("error");
  });

  it("returns warning for degraded/unhealthy", () => {
    expect(fleetStatusColor("degraded")).toBe("warning");
    expect(fleetStatusColor("unhealthy")).toBe("warning");
    expect(fleetStatusColor("warning")).toBe("warning");
  });

  it("returns primary for updating/upgrading", () => {
    expect(fleetStatusColor("updating")).toBe("primary");
    expect(fleetStatusColor("upgrading")).toBe("primary");
  });

  it("returns default for unknown statuses", () => {
    expect(fleetStatusColor("offline")).toBe("default");
    expect(fleetStatusColor("something")).toBe("default");
  });
});

describe("computeCheckinStaleness", () => {
  it("returns critical for null input", () => {
    expect(computeCheckinStaleness(null)).toEqual({ label: "unknown", severity: "critical" });
  });

  it("returns critical for invalid date", () => {
    expect(computeCheckinStaleness("not-a-date")).toEqual({
      label: "unknown",
      severity: "critical",
    });
  });

  it("returns fresh for recent timestamps", () => {
    const now = new Date().toISOString();
    const result = computeCheckinStaleness(now);
    expect(result.severity).toBe("fresh");
    expect(result.label).toMatch(/\d+s ago/);
  });

  it("returns stale for 10-minute-old timestamps", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const result = computeCheckinStaleness(tenMinAgo);
    expect(result.severity).toBe("stale");
    expect(result.label).toMatch(/\d+m ago/);
  });

  it("returns critical for 2-hour-old timestamps", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = computeCheckinStaleness(twoHoursAgo);
    expect(result.severity).toBe("critical");
    expect(result.label).toMatch(/\d+h ago/);
  });

  it("returns critical for day-old timestamps", () => {
    const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const result = computeCheckinStaleness(dayAgo);
    expect(result.severity).toBe("critical");
    expect(result.label).toMatch(/\d+d ago/);
  });

  it("clamps future timestamps to zero age", () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const result = computeCheckinStaleness(future);
    expect(result).toEqual({ label: "0s ago", severity: "fresh" });
  });
});

describe("deriveAgentStatus", () => {
  it("maps unknown or invalid check-ins to Offline via critical severity", () => {
    expect(deriveAgentStatus(null)).toBe("Offline");
    expect(deriveAgentStatus("not-a-date")).toBe("Offline");
  });

  it("maps recent check-ins to Healthy", () => {
    expect(deriveAgentStatus(new Date().toISOString())).toBe("Healthy");
  });

  it("maps stale check-ins to Unhealthy", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(deriveAgentStatus(tenMinAgo)).toBe("Unhealthy");
  });
});

describe("aggregateFleetPolicies", () => {
  it("aggregates agents by policy", () => {
    const agents: FleetAgentSummary[] = [
      makeSummary({ policyId: "p1", status: "online", active: true }),
      makeSummary({ policyId: "p1", status: "error", active: true }),
      makeSummary({ policyId: "p2", status: "online", active: true }),
    ];
    const policies = aggregateFleetPolicies(agents);
    expect(policies).toHaveLength(2);
    const p1 = policies.find((p) => p.policyId === "p1")!;
    expect(p1.agents).toBe(2);
    expect(p1.healthyAgents).toBe(1);
    expect(p1.errorAgents).toBe(1);
  });

  it("counts inactive agents", () => {
    const agents: FleetAgentSummary[] = [makeSummary({ policyId: "p1", active: false })];
    const policies = aggregateFleetPolicies(agents);
    expect(policies[0]!.inactiveAgents).toBe(1);
  });

  it("returns sorted by agent count descending", () => {
    const agents: FleetAgentSummary[] = [
      makeSummary({ policyId: "small" }),
      makeSummary({ policyId: "big" }),
      makeSummary({ policyId: "big" }),
      makeSummary({ policyId: "big" }),
    ];
    const policies = aggregateFleetPolicies(agents);
    expect(policies[0]!.policyId).toBe("big");
  });
});

function makeSummary(overrides: Partial<FleetAgentSummary> = {}): FleetAgentSummary {
  return {
    id: "agent-1",
    hostname: "host-1",
    status: "online",
    policyId: "default",
    policyRevision: 1,
    active: true,
    lastCheckin: new Date().toISOString(),
    source: {},
    ...overrides,
  };
}
