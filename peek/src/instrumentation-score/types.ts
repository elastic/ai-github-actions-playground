/**
 * Types for the Instrumentation Score feature, based on the
 * instrumentation-score/spec (https://github.com/instrumentation-score/spec).
 *
 * The Instrumentation Score is a 0–100 metric that quantifies OpenTelemetry
 * instrumentation quality against best practices and semantic conventions.
 * Each aspect of the score is represented as a rule (check) that evaluates
 * to pass or fail, following the same pattern as our cluster health checks.
 */

/* ────── Impact levels and weights (per spec) ────── */

export type InstrumentationScoreImpact = "critical" | "important" | "normal" | "low";

/** Weights assigned to each impact level for the weighted-average formula. */
export const IMPACT_WEIGHTS: Record<InstrumentationScoreImpact, number> = {
  critical: 40,
  important: 30,
  normal: 20,
  low: 10,
};

/* ────── OTLP target types ────── */

export type InstrumentationScoreTarget = "resource" | "span" | "metric" | "log" | "sdk";

/* ────── Score qualitative categories ────── */

export type ScoreCategory = "excellent" | "good" | "needs-improvement" | "poor";

/* ────── Per-service data snapshot for evaluation ────── */

/**
 * Aggregated data fetched from Elasticsearch for a single service,
 * used to evaluate instrumentation score rules.
 */
export interface InstrumentationScoreSnapshot {
  serviceName: string;

  /** Whether a non-empty service.name was observed (always true when querying by service). */
  hasServiceName: boolean;

  /** Whether any span carries a service.instance.id value. */
  hasServiceInstanceId: boolean;

  /** Whether any span carries a service.version value. */
  hasServiceVersion: boolean;

  /** Whether any span carries a deployment.environment.name or service.environment value. */
  hasDeploymentEnvironment: boolean;

  /** Count of root spans (parent.id IS NULL) with span kind = CLIENT. */
  rootClientSpanCount: number;

  /** Total count of root spans. */
  rootSpanCount: number;

  /** Maximum number of INTERNAL spans observed in any single trace for this service. */
  maxInternalSpansPerTrace: number;

  /** Total number of spans sampled. */
  totalSpanCount: number;
}

/* ────── Rule result ────── */

export interface InstrumentationScoreRuleResult {
  /** Whether the rule passed. */
  passed: boolean;
  /** Human-readable summary describing the outcome. */
  summary: string;
  /** Observed values that led to this result. */
  observed?: Record<string, unknown>;
}

/* ────── Rule definition ────── */

export interface InstrumentationScoreRule {
  /** Unique identifier matching the spec (e.g. "RES-001"). */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Why this rule matters for quality. */
  rationale: string;
  /** The OTLP element this rule targets. */
  target: InstrumentationScoreTarget;
  /** Impact level used for weighting. */
  impact: InstrumentationScoreImpact;
  /** Link to the spec rule for details. */
  specUrl: string;
  /** Evaluate the rule against a service snapshot. */
  evaluate: (snapshot: InstrumentationScoreSnapshot) => InstrumentationScoreRuleResult;
}

/* ────── Evaluated rule (definition + result) ────── */

export interface EvaluatedInstrumentationRule extends InstrumentationScoreRuleResult {
  id: string;
  description: string;
  rationale: string;
  target: InstrumentationScoreTarget;
  impact: InstrumentationScoreImpact;
  specUrl: string;
}

/* ────── Aggregate score for a service ────── */

export interface ServiceInstrumentationScore {
  /** Numerical score from 0 to 100. */
  score: number;
  /** Qualitative category. */
  category: ScoreCategory;
  /** Per-rule results, ordered by impact (critical first). */
  rules: EvaluatedInstrumentationRule[];
  /** Number of rules that passed. */
  passed: number;
  /** Total number of rules evaluated. */
  total: number;
}
