/**
 * Parses ES|QL responses into an InstrumentationScoreSnapshot.
 */
import type { EsqlResponse } from "../types";
import { buildColumnAccessor, toFiniteNumber } from "../services/es/columnUtils";

import type { InstrumentationScoreSnapshot } from "./types";

/**
 * Parse the main instrumentation score query result into a snapshot.
 * The query returns a single row with aggregated signals.
 */
export function parseInstrumentationScoreResult(
  serviceName: string,
  mainResult: EsqlResponse | null,
  internalSpanResult: EsqlResponse | null,
): InstrumentationScoreSnapshot {
  const defaults: InstrumentationScoreSnapshot = {
    serviceName,
    hasServiceName: true, // Always true since we queried by service name
    hasServiceInstanceId: false,
    hasServiceVersion: false,
    hasDeploymentEnvironment: false,
    rootClientSpanCount: 0,
    rootSpanCount: 0,
    maxInternalSpansPerTrace: 0,
    totalSpanCount: 0,
  };

  if (!mainResult || mainResult.values.length === 0) return defaults;

  const get = buildColumnAccessor(mainResult.columns);
  const row = mainResult.values[0]!;

  const totalSpans = toFiniteNumber(get(row, "total_spans"));
  const rootSpanCount = toFiniteNumber(get(row, "root_span_count"));
  const rootClientSpanCount = toFiniteNumber(get(row, "root_client_span_count"));

  // COUNT_DISTINCT returns 1 even for "@@MISSING@@"; a value > 1 means
  // at least one real value existed alongside the sentinel.
  // If exactly 1, it could be either the sentinel OR a real value;
  // we treat > 1 as "has real value" and == 1 as "check the sentinel".
  const hasInstanceIdDistinct = toFiniteNumber(get(row, "has_instance_id"));
  const hasVersionDistinct = toFiniteNumber(get(row, "has_version"));
  const hasEnvironmentDistinct = toFiniteNumber(get(row, "has_environment"));

  // > 1 means at least one non-sentinel value was found
  const hasServiceInstanceId = hasInstanceIdDistinct > 1;
  const hasServiceVersion = hasVersionDistinct > 1;
  const hasDeploymentEnvironment = hasEnvironmentDistinct > 1;

  // Parse internal span count from the second query
  let maxInternalSpansPerTrace = 0;
  if (internalSpanResult && internalSpanResult.values.length > 0) {
    const internalGet = buildColumnAccessor(internalSpanResult.columns);
    const internalRow = internalSpanResult.values[0]!;
    maxInternalSpansPerTrace = toFiniteNumber(internalGet(internalRow, "max_internal_per_trace"));
  }

  return {
    serviceName,
    hasServiceName: totalSpans > 0,
    hasServiceInstanceId,
    hasServiceVersion,
    hasDeploymentEnvironment,
    rootClientSpanCount,
    rootSpanCount,
    maxInternalSpansPerTrace,
    totalSpanCount: totalSpans,
  };
}
