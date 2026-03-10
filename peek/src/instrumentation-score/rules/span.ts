/**
 * Span-level rules from the instrumentation-score spec.
 *
 * These checks evaluate trace span quality:
 * - SPA-004: Root spans are not CLIENT spans (Important)
 * - SPA-001: Limited number of INTERNAL spans per trace per service (Normal)
 * - SPA-003: Span names have bound cardinality (Important)
 * - SPA-005: No high number of short INTERNAL spans per trace (Important)
 */
import type { InstrumentationScoreRule } from "../types";

const SPEC_BASE_URL = "https://github.com/instrumentation-score/spec/blob/main/rules";

/** Per the spec, no more than 10 INTERNAL spans per trace per service. */
const MAX_INTERNAL_SPANS_PER_TRACE = 10;
const MAX_SHORT_INTERNAL_SPANS_PER_TRACE = 20;
const MIN_SPAN_SAMPLES_FOR_CARDINALITY_CHECK = 50;
const MAX_DISTINCT_SPAN_NAMES = 200;
const MAX_DISTINCT_SPAN_NAME_RATIO = 0.3;

export const spanRules: InstrumentationScoreRule[] = [
  {
    id: "SPA-004",
    description: "Root spans are not CLIENT spans",
    rationale:
      "CLIENT root spans typically indicate missing instrumentation or lost trace context. " +
      "A root span should describe which request the application is serving, not an outbound call.",
    target: "span",
    impact: "important",
    specUrl: `${SPEC_BASE_URL}/SPA-004.md`,
    evaluate: (snapshot) => {
      if (snapshot.rootSpanCount === 0) {
        return {
          passed: true,
          summary: "No root spans observed to evaluate.",
          observed: { rootSpanCount: 0 },
        };
      }
      if (snapshot.rootClientSpanCount === 0) {
        return {
          passed: true,
          summary: "No root spans have span kind CLIENT.",
          observed: {
            rootClientSpanCount: 0,
            rootSpanCount: snapshot.rootSpanCount,
          },
        };
      }
      const pct = ((snapshot.rootClientSpanCount / snapshot.rootSpanCount) * 100).toFixed(1);
      return {
        passed: false,
        summary:
          `${snapshot.rootClientSpanCount} of ${snapshot.rootSpanCount} root spans (${pct}%) have kind CLIENT. ` +
          "Ensure root spans use SERVER or INTERNAL kind to properly describe the entry point.",
        observed: {
          rootClientSpanCount: snapshot.rootClientSpanCount,
          rootSpanCount: snapshot.rootSpanCount,
        },
      };
    },
  },
  {
    id: "SPA-001",
    description: "Traces contain a limited number of INTERNAL spans per service",
    rationale:
      "Services producing an excessive number of internal spans may indicate inefficient " +
      "or overly complex operations, making it harder to identify bottlenecks and troubleshoot issues.",
    target: "span",
    impact: "normal",
    specUrl: `${SPEC_BASE_URL}/SPA-001.md`,
    evaluate: (snapshot) => {
      if (snapshot.totalSpanCount === 0) {
        return {
          passed: true,
          summary: "No spans observed to evaluate.",
          observed: { totalSpanCount: 0 },
        };
      }
      if (!snapshot.internalSpanMetricsAvailable) {
        return {
          passed: false,
          summary:
            "Could not evaluate INTERNAL span density because span metrics were unavailable. " +
            "Check query compatibility and retry.",
          observed: { internalSpanMetricsAvailable: false },
        };
      }
      if (snapshot.maxInternalSpansPerTrace <= MAX_INTERNAL_SPANS_PER_TRACE) {
        return {
          passed: true,
          summary: `Maximum INTERNAL spans per trace is ${snapshot.maxInternalSpansPerTrace} (limit: ${MAX_INTERNAL_SPANS_PER_TRACE}).`,
          observed: {
            maxInternalSpansPerTrace: snapshot.maxInternalSpansPerTrace,
            threshold: MAX_INTERNAL_SPANS_PER_TRACE,
          },
        };
      }
      return {
        passed: false,
        summary:
          `Found traces with up to ${snapshot.maxInternalSpansPerTrace} INTERNAL spans per service ` +
          `(limit: ${MAX_INTERNAL_SPANS_PER_TRACE}). Review instrumentation to reduce unnecessary internal spans.`,
        observed: {
          maxInternalSpansPerTrace: snapshot.maxInternalSpansPerTrace,
          threshold: MAX_INTERNAL_SPANS_PER_TRACE,
        },
      };
    },
  },
  {
    id: "SPA-003",
    description: "Span names have bound cardinality",
    rationale:
      "High-cardinality span names reduce aggregation quality and can inflate index/storage costs. " +
      "Prefer stable operation names over request-specific literals.",
    target: "span",
    impact: "important",
    specUrl: `${SPEC_BASE_URL}/SPA-003.md`,
    evaluate: (snapshot) => {
      if (snapshot.totalSpanCount === 0) {
        return {
          passed: true,
          summary: "No spans observed to evaluate.",
          observed: { totalSpanCount: 0 },
        };
      }
      if (!snapshot.spanNameCardinalityMetricsAvailable) {
        return {
          passed: false,
          summary:
            "Could not evaluate span-name cardinality because cardinality metrics were unavailable. " +
            "Check query compatibility and retry.",
          observed: { spanNameCardinalityMetricsAvailable: false },
        };
      }
      if (snapshot.totalSpanCount < MIN_SPAN_SAMPLES_FOR_CARDINALITY_CHECK) {
        return {
          passed: true,
          summary: `Span-name cardinality check skipped for low sample size (${snapshot.totalSpanCount} spans).`,
          observed: {
            totalSpanCount: snapshot.totalSpanCount,
            minimumSampleSize: MIN_SPAN_SAMPLES_FOR_CARDINALITY_CHECK,
          },
        };
      }
      const ratio = snapshot.distinctSpanNameCount / snapshot.totalSpanCount;
      if (
        snapshot.distinctSpanNameCount <= MAX_DISTINCT_SPAN_NAMES ||
        ratio <= MAX_DISTINCT_SPAN_NAME_RATIO
      ) {
        return {
          passed: true,
          summary: `Observed ${snapshot.distinctSpanNameCount} distinct span names across ${snapshot.totalSpanCount} spans.`,
          observed: {
            distinctSpanNameCount: snapshot.distinctSpanNameCount,
            totalSpanCount: snapshot.totalSpanCount,
            ratio: Number(ratio.toFixed(3)),
          },
        };
      }
      return {
        passed: false,
        summary:
          `High span-name cardinality detected: ${snapshot.distinctSpanNameCount} distinct names across ${snapshot.totalSpanCount} spans. ` +
          "Avoid embedding IDs or raw paths in span names.",
        observed: {
          distinctSpanNameCount: snapshot.distinctSpanNameCount,
          totalSpanCount: snapshot.totalSpanCount,
          ratio: Number(ratio.toFixed(3)),
          maxDistinctSpanNames: MAX_DISTINCT_SPAN_NAMES,
          maxRatio: MAX_DISTINCT_SPAN_NAME_RATIO,
        },
      };
    },
  },
  {
    id: "SPA-005",
    description: "Traces do not contain a high number of short INTERNAL spans",
    rationale:
      "A high count of short INTERNAL spans can indicate excessive instrumentation " +
      "overhead or unnecessarily chatty internal operations.",
    target: "span",
    impact: "important",
    specUrl: `${SPEC_BASE_URL}/SPA-005.md`,
    evaluate: (snapshot) => {
      if (snapshot.totalSpanCount === 0) {
        return {
          passed: true,
          summary: "No spans observed to evaluate.",
          observed: { totalSpanCount: 0 },
        };
      }
      if (!snapshot.internalSpanMetricsAvailable) {
        return {
          passed: false,
          summary:
            "Could not evaluate short INTERNAL span volume because span metrics were unavailable. " +
            "Check query compatibility and retry.",
          observed: { internalSpanMetricsAvailable: false },
        };
      }
      if (snapshot.maxShortInternalSpansPerTrace <= MAX_SHORT_INTERNAL_SPANS_PER_TRACE) {
        return {
          passed: true,
          summary:
            `Maximum short INTERNAL spans per trace is ${snapshot.maxShortInternalSpansPerTrace} ` +
            `(limit: ${MAX_SHORT_INTERNAL_SPANS_PER_TRACE}).`,
          observed: {
            maxShortInternalSpansPerTrace: snapshot.maxShortInternalSpansPerTrace,
            threshold: MAX_SHORT_INTERNAL_SPANS_PER_TRACE,
          },
        };
      }
      return {
        passed: false,
        summary:
          `Found traces with up to ${snapshot.maxShortInternalSpansPerTrace} short INTERNAL spans ` +
          `(limit: ${MAX_SHORT_INTERNAL_SPANS_PER_TRACE}). Reduce excessive short internal operations.`,
        observed: {
          maxShortInternalSpansPerTrace: snapshot.maxShortInternalSpansPerTrace,
          threshold: MAX_SHORT_INTERNAL_SPANS_PER_TRACE,
        },
      };
    },
  },
];
