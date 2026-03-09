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
  duplicateInstanceResult: EsqlResponse | null,
): InstrumentationScoreSnapshot {
  const defaults: InstrumentationScoreSnapshot = {
    serviceName,
    hasServiceName: true, // Always true since we queried by service name
    hasServiceInstanceId: false,
    hasServiceVersion: false,
    hasDeploymentEnvironment: false,
    hasK8sContext: false,
    hasK8sPodUid: false,
    rootClientSpanCount: 0,
    rootSpanCount: 0,
    maxInternalSpansPerTrace: 0,
    maxShortInternalSpansPerTrace: 0,
    duplicateInstanceIdCount: 0,
    totalSpanCount: 0,
  };

  if (!mainResult || mainResult.values.length === 0) return defaults;

  const get = buildColumnAccessor(mainResult.columns);
  const row = mainResult.values[0]!;

  const totalSpans = toFiniteNumber(get(row, "total_spans"));
  const rootSpanCount = toFiniteNumber(get(row, "root_span_count"));
  const rootClientSpanCount = toFiniteNumber(get(row, "root_client_span_count"));

  // Query builder emits count-of-present values for each optional attribute.
  // Any positive count means the attribute was present in at least one span.
  const hasInstanceIdDistinct = toFiniteNumber(get(row, "has_instance_id"));
  const hasVersionDistinct = toFiniteNumber(get(row, "has_version"));
  const hasEnvironmentDistinct = toFiniteNumber(get(row, "has_environment"));
  const hasK8sContextDistinct = toFiniteNumber(get(row, "has_k8s_context"));
  const hasK8sPodUidDistinct = toFiniteNumber(get(row, "has_k8s_pod_uid"));

  const hasServiceInstanceId = hasInstanceIdDistinct > 0;
  const hasServiceVersion = hasVersionDistinct > 0;
  const hasDeploymentEnvironment = hasEnvironmentDistinct > 0;
  const hasK8sContext = hasK8sContextDistinct > 0;
  const hasK8sPodUid = hasK8sPodUidDistinct > 0;

  // Parse internal span count from the second query
  let maxInternalSpansPerTrace = 0;
  let maxShortInternalSpansPerTrace = 0;
  if (internalSpanResult && internalSpanResult.values.length > 0) {
    const internalGet = buildColumnAccessor(internalSpanResult.columns);
    const internalRow = internalSpanResult.values[0]!;
    maxInternalSpansPerTrace = toFiniteNumber(internalGet(internalRow, "max_internal_per_trace"));
    maxShortInternalSpansPerTrace = toFiniteNumber(
      internalGet(internalRow, "max_short_internal_per_trace"),
    );
  }

  // Parse duplicate instance-id result from the third query
  let duplicateInstanceIdCount = 0;
  if (duplicateInstanceResult && duplicateInstanceResult.values.length > 0) {
    const duplicateGet = buildColumnAccessor(duplicateInstanceResult.columns);
    const duplicateRow = duplicateInstanceResult.values[0]!;
    duplicateInstanceIdCount = toFiniteNumber(
      duplicateGet(duplicateRow, "duplicate_instance_id_count"),
    );
  }

  return {
    serviceName,
    hasServiceName: totalSpans > 0,
    hasServiceInstanceId,
    hasServiceVersion,
    hasDeploymentEnvironment,
    hasK8sContext,
    hasK8sPodUid,
    rootClientSpanCount,
    rootSpanCount,
    maxInternalSpansPerTrace,
    maxShortInternalSpansPerTrace,
    duplicateInstanceIdCount,
    totalSpanCount: totalSpans,
  };
}
