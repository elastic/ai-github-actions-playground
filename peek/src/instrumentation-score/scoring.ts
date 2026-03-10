/**
 * Scoring engine for the Instrumentation Score.
 *
 * Implements the weighted-average formula from the spec:
 *   Score = (Σ (P_i × W_i)) / (Σ (T_i × W_i)) × 100
 *
 * Where P_i = rules passed at impact level i, T_i = total rules at that level,
 * and W_i = weight for that impact level.
 */
import type {
  EvaluatedInstrumentationRule,
  InstrumentationScoreImpact,
  InstrumentationScoreRule,
  InstrumentationScoreSnapshot,
  ScoreCategory,
  ServiceInstrumentationScore,
} from "./types";
import { IMPACT_WEIGHTS } from "./types";

const IMPACT_RANK: Record<InstrumentationScoreImpact, number> = {
  critical: 0,
  important: 1,
  normal: 2,
  low: 3,
};

/**
 * Calculate the weighted instrumentation score (0–100) from per-impact tallies.
 */
export function calculateScore(
  results: ReadonlyArray<{ impact: InstrumentationScoreImpact; passed: boolean }>,
): number {
  if (results.length === 0) return 0;

  let weightedPassed = 0;
  let weightedTotal = 0;

  for (const { impact, passed } of results) {
    const weight = IMPACT_WEIGHTS[impact];
    weightedTotal += weight;
    if (passed) weightedPassed += weight;
  }

  if (weightedTotal === 0) return 0;
  return (weightedPassed / weightedTotal) * 100;
}

/**
 * Map a numerical score to a qualitative category.
 */
export function getScoreCategory(score: number): ScoreCategory {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}

/**
 * Evaluate all instrumentation rules against a service data snapshot.
 * Returns the aggregate score and per-rule results sorted by impact.
 */
export function evaluateInstrumentationScore(
  rules: InstrumentationScoreRule[],
  snapshot: InstrumentationScoreSnapshot,
): ServiceInstrumentationScore {
  const evaluated: EvaluatedInstrumentationRule[] = rules.map((rule) => {
    try {
      const result = rule.evaluate(snapshot);
      return {
        id: rule.id,
        description: rule.description,
        rationale: rule.rationale,
        target: rule.target,
        impact: rule.impact,
        specUrl: rule.specUrl,
        ...result,
      };
    } catch {
      return {
        id: rule.id,
        description: rule.description,
        rationale: rule.rationale,
        target: rule.target,
        impact: rule.impact,
        specUrl: rule.specUrl,
        passed: false,
        summary: "Rule evaluation failed.",
      };
    }
  });

  // Sort by impact level (critical → important → normal → low), then alphabetically by id
  evaluated.sort((a, b) => {
    const rankA = IMPACT_RANK[a.impact];
    const rankB = IMPACT_RANK[b.impact];
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });

  const score = calculateScore(evaluated.map((r) => ({ impact: r.impact, passed: r.passed })));
  const passed = evaluated.filter((r) => r.passed).length;

  return {
    score: Math.round(score * 100) / 100,
    category: getScoreCategory(score),
    rules: evaluated,
    passed,
    total: evaluated.length,
  };
}
