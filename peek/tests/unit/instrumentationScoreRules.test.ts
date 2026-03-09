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
    rootClientSpanCount: 0,
    rootSpanCount: 100,
    maxInternalSpansPerTrace: 5,
    totalSpanCount: 500,
    ...overrides,
  };
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

describe("RES-005: service.name is present", () => {
  const rule = resourceRules.find((r) => r.id === "RES-005")!;

  it("has critical impact", () => {
    expect(rule.impact).toBe("critical");
  });

  it("passes when service.name is present", () => {
    const result = rule.evaluate(makeSnapshot({ hasServiceName: true }));
    expect(result.passed).toBe(true);
  });

  it("fails when service.name is missing", () => {
    const result = rule.evaluate(makeSnapshot({ hasServiceName: false }));
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("missing");
  });
});

describe("RES-001: service.instance.id is present", () => {
  const rule = resourceRules.find((r) => r.id === "RES-001")!;

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

// ---------------------------------------------------------------------------
// Span rules
// ---------------------------------------------------------------------------

describe("SPA-004: Root spans are not CLIENT spans", () => {
  const rule = spanRules.find((r) => r.id === "SPA-004")!;

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
  const rule = spanRules.find((r) => r.id === "SPA-001")!;

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
});
