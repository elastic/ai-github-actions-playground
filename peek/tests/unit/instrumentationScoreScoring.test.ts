import { describe, expect, it } from "vitest";

import {
  calculateScore,
  evaluateInstrumentationScore,
  getScoreCategory,
} from "../../src/instrumentation-score/scoring";
import type {
  InstrumentationScoreRule,
  InstrumentationScoreSnapshot,
} from "../../src/instrumentation-score/types";
import { IMPACT_WEIGHTS } from "../../src/instrumentation-score/types";

// ---------------------------------------------------------------------------
// calculateScore
// ---------------------------------------------------------------------------

describe("calculateScore", () => {
  it("returns 0 for empty results", () => {
    expect(calculateScore([])).toBe(0);
  });

  it("returns 100 when all rules pass", () => {
    const results = [
      { impact: "critical" as const, passed: true },
      { impact: "important" as const, passed: true },
      { impact: "normal" as const, passed: true },
      { impact: "low" as const, passed: true },
    ];
    expect(calculateScore(results)).toBe(100);
  });

  it("returns 0 when all rules fail", () => {
    const results = [
      { impact: "critical" as const, passed: false },
      { impact: "important" as const, passed: false },
      { impact: "normal" as const, passed: false },
      { impact: "low" as const, passed: false },
    ];
    expect(calculateScore(results)).toBe(0);
  });

  it("matches the spec example calculation", () => {
    // From spec: Critical 4/8, Important 8/10, Normal 6/8, Low 1/5
    // Score = (4×40 + 8×30 + 6×20 + 1×10) / (8×40 + 10×30 + 8×20 + 5×10) × 100
    // = (160+240+120+10) / (320+300+160+50) × 100 = 530/830 × 100 ≈ 63.86
    const results = [
      ...Array.from({ length: 4 }, () => ({ impact: "critical" as const, passed: true })),
      ...Array.from({ length: 4 }, () => ({ impact: "critical" as const, passed: false })),
      ...Array.from({ length: 8 }, () => ({ impact: "important" as const, passed: true })),
      ...Array.from({ length: 2 }, () => ({ impact: "important" as const, passed: false })),
      ...Array.from({ length: 6 }, () => ({ impact: "normal" as const, passed: true })),
      ...Array.from({ length: 2 }, () => ({ impact: "normal" as const, passed: false })),
      ...Array.from({ length: 1 }, () => ({ impact: "low" as const, passed: true })),
      ...Array.from({ length: 4 }, () => ({ impact: "low" as const, passed: false })),
    ];
    const score = calculateScore(results);
    expect(score).toBeCloseTo(63.86, 1);
  });

  it("weights critical rules higher than low rules", () => {
    // One critical pass + one low fail = critical weight dominates
    const criticalPass = calculateScore([
      { impact: "critical", passed: true },
      { impact: "low", passed: false },
    ]);
    // One critical fail + one low pass = low weight dominates
    const criticalFail = calculateScore([
      { impact: "critical", passed: false },
      { impact: "low", passed: true },
    ]);
    expect(criticalPass).toBeGreaterThan(criticalFail);
    // criticalPass = 40/(40+10) = 80, criticalFail = 10/(40+10) = 20
    expect(criticalPass).toBe(80);
    expect(criticalFail).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// IMPACT_WEIGHTS
// ---------------------------------------------------------------------------

describe("IMPACT_WEIGHTS", () => {
  it("has correct weights per spec", () => {
    expect(IMPACT_WEIGHTS).toEqual({
      critical: 40,
      important: 30,
      normal: 20,
      low: 10,
    });
  });
});

// ---------------------------------------------------------------------------
// getScoreCategory
// ---------------------------------------------------------------------------

describe("getScoreCategory", () => {
  it.each([
    [100, "excellent"],
    [95, "excellent"],
    [90, "excellent"],
    [89, "good"],
    [80, "good"],
    [75, "good"],
    [74, "needs-improvement"],
    [60, "needs-improvement"],
    [50, "needs-improvement"],
    [49, "poor"],
    [25, "poor"],
    [0, "poor"],
  ] as const)("score %d → %s", (score, expected) => {
    expect(getScoreCategory(score)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// evaluateInstrumentationScore
// ---------------------------------------------------------------------------

const GOOD_SNAPSHOT: InstrumentationScoreSnapshot = {
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
  distinctSpanNameCount: 12,
  spanNameCardinalityMetricsAvailable: true,
  duplicateInstanceIdCount: 0,
  duplicateInstanceMetricsAvailable: true,
  totalSpanCount: 500,
};

const POOR_SNAPSHOT: InstrumentationScoreSnapshot = {
  serviceName: "test-service",
  hasServiceName: false,
  hasServiceInstanceId: false,
  hasServiceVersion: false,
  hasDeploymentEnvironment: false,
  hasK8sContext: true,
  hasK8sPodUid: false,
  rootClientSpanCount: 50,
  rootSpanCount: 100,
  maxInternalSpansPerTrace: 25,
  maxShortInternalSpansPerTrace: 30,
  internalSpanMetricsAvailable: true,
  distinctSpanNameCount: 320,
  spanNameCardinalityMetricsAvailable: true,
  duplicateInstanceIdCount: 2,
  duplicateInstanceMetricsAvailable: true,
  totalSpanCount: 500,
};

describe("evaluateInstrumentationScore", () => {
  const rules: InstrumentationScoreRule[] = [
    {
      id: "TEST-CRIT",
      description: "Critical check",
      rationale: "test",
      target: "resource",
      impact: "critical",
      specUrl: "https://example.com/TEST-CRIT",
      evaluate: (s) => ({
        passed: s.hasServiceName,
        summary: s.hasServiceName ? "has service name" : "missing service name",
      }),
    },
    {
      id: "TEST-IMP",
      description: "Important check",
      rationale: "test",
      target: "span",
      impact: "important",
      specUrl: "https://example.com/TEST-IMP",
      evaluate: (s) => ({
        passed: s.rootClientSpanCount === 0,
        summary: "client span check",
      }),
    },
    {
      id: "TEST-NORM",
      description: "Normal check",
      rationale: "test",
      target: "resource",
      impact: "normal",
      specUrl: "https://example.com/TEST-NORM",
      evaluate: (s) => ({
        passed: s.hasServiceInstanceId,
        summary: "instance id check",
      }),
    },
  ];

  it("returns perfect score for good snapshot", () => {
    const result = evaluateInstrumentationScore(rules, GOOD_SNAPSHOT);
    expect(result.score).toBe(100);
    expect(result.category).toBe("excellent");
    expect(result.passed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.rules.every((r) => r.passed)).toBe(true);
  });

  it("returns low score for poor snapshot", () => {
    const result = evaluateInstrumentationScore(rules, POOR_SNAPSHOT);
    expect(result.score).toBe(0);
    expect(result.category).toBe("poor");
    expect(result.passed).toBe(0);
    expect(result.total).toBe(3);
  });

  it("sorts rules by impact (critical first)", () => {
    const result = evaluateInstrumentationScore(rules, GOOD_SNAPSHOT);
    const impacts = result.rules.map((r) => r.impact);
    expect(impacts).toEqual(["critical", "important", "normal"]);
  });

  it("catches rule evaluation errors gracefully", () => {
    const throwingRules: InstrumentationScoreRule[] = [
      {
        id: "TEST-THROW",
        description: "Throwing check",
        rationale: "test",
        target: "resource",
        impact: "normal",
        specUrl: "https://example.com",
        evaluate: () => {
          throw new Error("boom");
        },
      },
    ];
    const result = evaluateInstrumentationScore(throwingRules, GOOD_SNAPSHOT);
    expect(result.rules[0]?.passed).toBe(false);
    expect(result.rules[0]?.summary).toBe("Rule evaluation failed.");
    expect(result.score).toBe(0);
  });

  it("preserves observed data from rule results", () => {
    const ruleWithObserved: InstrumentationScoreRule[] = [
      {
        id: "TEST-OBS",
        description: "Observed check",
        rationale: "test",
        target: "resource",
        impact: "normal",
        specUrl: "https://example.com",
        evaluate: () => ({
          passed: true,
          summary: "ok",
          observed: { key: "value" },
        }),
      },
    ];
    const result = evaluateInstrumentationScore(ruleWithObserved, GOOD_SNAPSHOT);
    expect(result.rules[0]?.observed).toEqual({ key: "value" });
  });
});
