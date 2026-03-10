import { describe, expect, it } from "vitest";

import { INSTRUMENTATION_SCORE_RULES } from "../../src/instrumentation-score/rules";
import { resourceRules } from "../../src/instrumentation-score/rules/resource";
import { spanRules } from "../../src/instrumentation-score/rules/span";
import type { InstrumentationScoreSnapshot } from "../../src/instrumentation-score/types";

function makeSnapshot(
  overrides: Partial<InstrumentationScoreSnapshot> = {},
): InstrumentationScoreSnapshot {
  return {
    serviceName: "test-service",
    hasServiceName: true,
    hasServiceInstanceId: true,
    hasServiceVersion: true,
    hasDeploymentEnvironment: true,
    hasK8sContext: false,
    hasK8sPodUid: false,
    rootClientSpanCount: 0,
    rootSpanCount: 100,
    maxInternalSpansPerTrace: 5,
    maxShortInternalSpansPerTrace: 5,
    internalSpanMetricsAvailable: true,
    distinctSpanNameCount: 10,
    spanNameCardinalityMetricsAvailable: true,
    duplicateInstanceIdCount: 0,
    duplicateInstanceMetricsAvailable: true,
    totalSpanCount: 500,
    ...overrides,
  };
}

function getResourceRule(id: string) {
  const rule = resourceRules.find((candidate) => candidate.id === id);
  expect(rule).toBeDefined();
  return rule!;
}

function getSpanRule(id: string) {
  const rule = spanRules.find((candidate) => candidate.id === id);
  expect(rule).toBeDefined();
  return rule!;
}

// ---------------------------------------------------------------------------
// Catalog integrity
// ---------------------------------------------------------------------------

describe("INSTRUMENTATION_SCORE_RULES aggregation", () => {
  it("has no duplicate ids", () => {
    const ids = INSTRUMENTATION_SCORE_RULES.map((r) => r.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("includes all rule categories", () => {
    const total = resourceRules.length + spanRules.length;
    expect(INSTRUMENTATION_SCORE_RULES).toHaveLength(total);
  });

  it("every rule has required fields", () => {
    for (const rule of INSTRUMENTATION_SCORE_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(rule.rationale).toBeTruthy();
      expect(["resource", "span", "metric", "log", "sdk"]).toContain(rule.target);
      expect(["critical", "important", "normal", "low"]).toContain(rule.impact);
      expect(rule.specUrl).toContain("github.com/instrumentation-score/spec");
      expect(typeof rule.evaluate).toBe("function");
    }
  });
});

// ---------------------------------------------------------------------------
// Resource rules
// ---------------------------------------------------------------------------

describe("RES-001: service.instance.id is present", () => {
  const rule = getResourceRule("RES-001");

  it("has normal impact", () => {
    expect(rule.impact).toBe("normal");
  });

  it("passes when service.instance.id is present", () => {
    const result = rule.evaluate(makeSnapshot({ hasServiceInstanceId: true }));
    expect(result.passed).toBe(true);
  });

  it("fails when service.instance.id is missing", () => {
    const result = rule.evaluate(makeSnapshot({ hasServiceInstanceId: false }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("missing");
  });
});

describe("RES-002: service.instance.id is unique across logical resources", () => {
  const rule = getResourceRule("RES-002");

  it("has important impact", () => {
    expect(rule.impact).toBe("important");
  });

  it("passes when no duplicate instance IDs are detected", () => {
    const result = rule.evaluate(
      makeSnapshot({ duplicateInstanceIdCount: 0, hasServiceInstanceId: true }),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when duplicate instance IDs are detected", () => {
    const result = rule.evaluate(
      makeSnapshot({ duplicateInstanceIdCount: 2, hasServiceInstanceId: true }),
    );
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("2");
  });

  it("fails when duplicate-instance metrics are unavailable", () => {
    const result = rule.evaluate(
      makeSnapshot({ duplicateInstanceMetricsAvailable: false, hasServiceInstanceId: true }),
    );
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("unavailable");
  });
});

describe("RES-003: k8s.pod.uid is present for Kubernetes workloads", () => {
  const rule = getResourceRule("RES-003");

  it("has important impact", () => {
    expect(rule.impact).toBe("important");
  });

  it("passes when no Kubernetes context is detected", () => {
    const result = rule.evaluate(makeSnapshot({ hasK8sContext: false, hasK8sPodUid: false }));
    expect(result.passed).toBe(true);
  });

  it("passes when Kubernetes context includes k8s.pod.uid", () => {
    const result = rule.evaluate(makeSnapshot({ hasK8sContext: true, hasK8sPodUid: true }));
    expect(result.passed).toBe(true);
  });

  it("fails when Kubernetes context exists without k8s.pod.uid", () => {
    const result = rule.evaluate(makeSnapshot({ hasK8sContext: true, hasK8sPodUid: false }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("k8s.pod.uid");
  });
});

// ---------------------------------------------------------------------------
// Span rules
// ---------------------------------------------------------------------------

describe("SPA-004: Root spans are not CLIENT spans", () => {
  const rule = getSpanRule("SPA-004");

  it("has important impact", () => {
    expect(rule.impact).toBe("important");
  });

  it("passes when no root spans exist", () => {
    const result = rule.evaluate(makeSnapshot({ rootSpanCount: 0, rootClientSpanCount: 0 }));
    expect(result.passed).toBe(true);
  });

  it("passes when no root CLIENT spans exist", () => {
    const result = rule.evaluate(makeSnapshot({ rootSpanCount: 50, rootClientSpanCount: 0 }));
    expect(result.passed).toBe(true);
  });

  it("fails when root CLIENT spans are found", () => {
    const result = rule.evaluate(makeSnapshot({ rootSpanCount: 100, rootClientSpanCount: 30 }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("30");
    expect(result.summary).toContain("CLIENT");
  });
});

describe("SPA-001: Limited INTERNAL spans per trace", () => {
  const rule = getSpanRule("SPA-001");

  it("has normal impact", () => {
    expect(rule.impact).toBe("normal");
  });

  it("passes when no spans exist", () => {
    const result = rule.evaluate(makeSnapshot({ totalSpanCount: 0 }));
    expect(result.passed).toBe(true);
  });

  it("passes when internal span count is within limit", () => {
    const result = rule.evaluate(makeSnapshot({ maxInternalSpansPerTrace: 10 }));
    expect(result.passed).toBe(true);
  });

  it("fails when internal span count exceeds limit", () => {
    const result = rule.evaluate(makeSnapshot({ maxInternalSpansPerTrace: 15 }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("15");
    expect(result.observed?.maxInternalSpansPerTrace).toBe(15);
  });

  it("fails when internal span metrics are unavailable", () => {
    const result = rule.evaluate(makeSnapshot({ internalSpanMetricsAvailable: false }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("unavailable");
  });
});

describe("SPA-005: No high number of short INTERNAL spans per trace", () => {
  const rule = getSpanRule("SPA-005");

  it("has important impact", () => {
    expect(rule.impact).toBe("important");
  });

  it("passes when no spans exist", () => {
    const result = rule.evaluate(makeSnapshot({ totalSpanCount: 0 }));
    expect(result.passed).toBe(true);
  });

  it("passes when short internal span count is within limit", () => {
    const result = rule.evaluate(makeSnapshot({ maxShortInternalSpansPerTrace: 20 }));
    expect(result.passed).toBe(true);
  });

  it("fails when short internal span count exceeds limit", () => {
    const result = rule.evaluate(makeSnapshot({ maxShortInternalSpansPerTrace: 35 }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("35");
  });

  it("fails when short internal metrics are unavailable", () => {
    const result = rule.evaluate(makeSnapshot({ internalSpanMetricsAvailable: false }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("unavailable");
  });
});

describe("SPA-003: Span names have bound cardinality", () => {
  const rule = getSpanRule("SPA-003");

  it("has important impact", () => {
    expect(rule.impact).toBe("important");
  });

  it("passes for low sample sizes", () => {
    const result = rule.evaluate(makeSnapshot({ totalSpanCount: 25, distinctSpanNameCount: 20 }));
    expect(result.passed).toBe(true);
    expect(result.summary).toContain("skipped");
  });

  it("passes when cardinality is bounded", () => {
    const result = rule.evaluate(makeSnapshot({ totalSpanCount: 500, distinctSpanNameCount: 80 }));
    expect(result.passed).toBe(true);
  });

  it("fails when cardinality is too high", () => {
    const result = rule.evaluate(makeSnapshot({ totalSpanCount: 500, distinctSpanNameCount: 260 }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("High span-name cardinality");
  });

  it("fails when cardinality metrics are unavailable", () => {
    const result = rule.evaluate(makeSnapshot({ spanNameCardinalityMetricsAvailable: false }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("unavailable");
  });
});
