import { describe, it, expect } from "vitest";

import {
  type ServiceRow,
  deriveServiceInsights,
} from "../../src/components/services/serviceInventoryHelpers";

function makeRow(overrides: Partial<ServiceRow> = {}): ServiceRow {
  return {
    serviceName: "test-service",
    requestCount: 100,
    avgLatencyMs: 50,
    errorCount: 2,
    errorRate: 0.02,
    uniqueRoutes: 3,
    uniqueSpanNames: 5,
    topRoute: "/api/test",
    topSpanName: "GET /api/test",
    topError: "—",
    language: "java",
    environment: "production",
    ...overrides,
  };
}

describe("deriveServiceInsights", () => {
  it("returns empty array for no services", () => {
    expect(deriveServiceInsights([])).toEqual([]);
  });

  it("identifies the slowest service", () => {
    const rows = [
      makeRow({ serviceName: "fast-svc", avgLatencyMs: 10 }),
      makeRow({ serviceName: "slow-svc", avgLatencyMs: 500 }),
    ];
    const insights = deriveServiceInsights(rows);
    const slowest = insights.find((i) => i.label === "Slowest Service");
    expect(slowest).toBeDefined();
    expect(slowest!.description).toContain("slow-svc");
    expect(slowest!.description).toContain("500.0ms");
    expect(slowest!.severity).toBe("info");
    expect(slowest!.icon).toBe("speed");
  });

  it("marks slowest service as warning when latency >= 1000ms", () => {
    const rows = [makeRow({ serviceName: "slow-svc", avgLatencyMs: 1500 })];
    const insights = deriveServiceInsights(rows);
    const slowest = insights.find((i) => i.label === "Slowest Service");
    expect(slowest!.severity).toBe("warning");
    expect(slowest!.description).toContain("1.5s");
  });

  it("identifies the service with highest error rate", () => {
    const rows = [
      makeRow({ serviceName: "healthy-svc", errorRate: 0.01 }),
      makeRow({ serviceName: "failing-svc", errorRate: 0.1, topError: "NullPointerException" }),
    ];
    const insights = deriveServiceInsights(rows);
    const errorInsight = insights.find((i) => i.label === "Highest Error Rate");
    expect(errorInsight).toBeDefined();
    expect(errorInsight!.description).toContain("failing-svc");
    expect(errorInsight!.description).toContain("10.0%");
    expect(errorInsight!.description).toContain("NullPointerException");
    expect(errorInsight!.severity).toBe("error");
    expect(errorInsight!.icon).toBe("error");
  });

  it("uses warning severity when error rate <= 5%", () => {
    const rows = [makeRow({ serviceName: "svc", errorRate: 0.03 })];
    const insights = deriveServiceInsights(rows);
    const errorInsight = insights.find((i) => i.label === "Highest Error Rate");
    expect(errorInsight!.severity).toBe("warning");
  });

  it("omits top error text when it is the dash fallback", () => {
    const rows = [makeRow({ serviceName: "svc", errorRate: 0.05, topError: "—" })];
    const insights = deriveServiceInsights(rows);
    const errorInsight = insights.find((i) => i.label === "Highest Error Rate");
    expect(errorInsight!.description).not.toContain("top error");
  });

  it("identifies the most active service", () => {
    const rows = [
      makeRow({ serviceName: "quiet-svc", requestCount: 10 }),
      makeRow({ serviceName: "busy-svc", requestCount: 5000 }),
    ];
    const insights = deriveServiceInsights(rows);
    const active = insights.find((i) => i.label === "Most Active Service");
    expect(active).toBeDefined();
    expect(active!.description).toContain("busy-svc");
    expect(active!.description).toContain((5000).toLocaleString());
    expect(active!.severity).toBe("info");
    expect(active!.icon).toBe("trending");
  });

  it("skips insights for zero-value metrics", () => {
    const rows = [makeRow({ avgLatencyMs: 0, errorRate: 0, requestCount: 0 })];
    const insights = deriveServiceInsights(rows);
    expect(insights).toHaveLength(0);
  });

  it("returns all three insights for a typical dataset", () => {
    const rows = [
      makeRow({ serviceName: "svc-a", requestCount: 200, avgLatencyMs: 100, errorRate: 0.01 }),
      makeRow({ serviceName: "svc-b", requestCount: 500, avgLatencyMs: 300, errorRate: 0.08 }),
    ];
    const insights = deriveServiceInsights(rows);
    expect(insights).toHaveLength(3);
    const labels = insights.map((i) => i.label);
    expect(labels).toContain("Slowest Service");
    expect(labels).toContain("Highest Error Rate");
    expect(labels).toContain("Most Active Service");
  });
});
