/**
 * Span-level rules from the instrumentation-score spec.
 *
 * These checks evaluate trace span quality:
 * - SPA-004: Root spans are not CLIENT spans (Important)
 * - SPA-001: Limited number of INTERNAL spans per trace per service (Normal)
 */
import type { InstrumentationScoreRule } from "../types";

const SPEC_BASE_URL = "https://github.com/instrumentation-score/spec/blob/main/rules";

const MAX_INTERNAL_SPANS_PER_TRACE = 10;

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
];
