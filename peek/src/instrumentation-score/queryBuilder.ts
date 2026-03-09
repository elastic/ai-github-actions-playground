/**
 * ES|QL query builder for fetching instrumentation score data per service.
 *
 * Queries the traces index to gather the signals needed to evaluate
 * instrumentation score rules (resource attributes, span kind distribution, etc.).
 */
import { escapeEsqlString } from "../services/es/esqlUtils";
import { buildPipeline, buildWherePipe, normalizeTimeExpression } from "../services/es/queryParts";
import {
  DEFAULT_FIELD_MAPPING,
  type TraceFieldMapping,
} from "../components/traces/traceQueryBuilder";

function toSafeRelativeTimeExpression(value: string): string {
  const normalized = normalizeTimeExpression(value);
  if (normalized) return normalized;
  throw new Error(`Unsupported time expression: ${value}`);
}

export interface InstrumentationScoreFilters {
  serviceName: string;
  timeFrom: string;
  timeTo: string;
}

/**
 * Builds an ES|QL query that gathers resource-level and span-level signals
 * for a single service. Returns a single-row result with aggregated flags.
 */
export function buildInstrumentationScoreQuery(
  filters: InstrumentationScoreFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const safeServiceName = escapeEsqlString(filters.serviceName);

  const whereClauses: string[] = [
    `${fields.serviceName} == "${safeServiceName}"`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    // Compute per-span signals
    "EVAL " +
      `is_root = CASE(${fields.parentSpanId} IS NULL, 1, 0), ` +
      `is_root_client = CASE(${fields.parentSpanId} IS NULL AND ${fields.spanKind} IN ("Client", "SPAN_KIND_CLIENT"), 1, 0), ` +
      "is_internal = CASE(" +
      `${fields.spanKind} IN ("Internal", "SPAN_KIND_INTERNAL"), 1, 0)`,
    // Aggregate across all spans for this service
    "STATS " +
      "total_spans = COUNT(*), " +
      "root_span_count = SUM(is_root), " +
      "root_client_span_count = SUM(is_root_client), " +
      `has_service_name = COUNT_DISTINCT(${fields.serviceName}), ` +
      'has_instance_id = COUNT_DISTINCT(COALESCE(resource.attributes.service\\.instance\\.id, "@@MISSING@@")), ' +
      `has_version = COUNT_DISTINCT(COALESCE(${fields.serviceVersion}, "@@MISSING@@")), ` +
      'has_environment = COUNT_DISTINCT(COALESCE(service.environment, deployment.environment, "@@MISSING@@"))',
    `LIMIT 1`,
  ]);
}

/**
 * Builds an ES|QL query that finds the maximum number of INTERNAL spans
 * per trace for a given service. Used for SPA-001 evaluation.
 */
export function buildInternalSpanCountQuery(
  filters: InstrumentationScoreFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const safeServiceName = escapeEsqlString(filters.serviceName);

  const whereClauses: string[] = [
    `${fields.serviceName} == "${safeServiceName}"`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
    `${fields.spanKind} IN ("Internal", "SPAN_KIND_INTERNAL")`,
  ];

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    `STATS internal_count = COUNT(*) BY ${fields.traceId}`,
    `STATS max_internal_per_trace = MAX(internal_count)`,
    `LIMIT 1`,
  ]);
}
