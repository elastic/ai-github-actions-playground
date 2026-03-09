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
    // Aggregate across all spans for this service.
    // Note: resource.attributes.service.instance.id, service.environment, and
    // deployment.environment.name are instrumentation-specific fields not present in
    // the shared TraceFieldMapping (which covers core trace query fields).
    "STATS " +
      "total_spans = COUNT(*), " +
      "root_span_count = SUM(is_root), " +
      "root_client_span_count = SUM(is_root_client), " +
      "has_instance_id = SUM(CASE(resource.attributes.service\\.instance\\.id IS NOT NULL, 1, 0)), " +
      `has_version = SUM(CASE(${fields.serviceVersion} IS NOT NULL, 1, 0)), ` +
      "has_environment = SUM(CASE(COALESCE(service.environment, deployment.environment.name) IS NOT NULL, 1, 0)), " +
      "has_k8s_context = SUM(CASE(COALESCE(k8s.pod.uid, k8s.pod.name, k8s.namespace.name, k8s.node.name) IS NOT NULL, 1, 0)), " +
      "has_k8s_pod_uid = SUM(CASE(k8s.pod.uid IS NOT NULL, 1, 0))",
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
    `EVAL is_short_internal = CASE(${fields.durationNs} < 5000000 OR ${fields.durationUs} < 5000, 1, 0)`,
    `STATS internal_count = COUNT(*), short_internal_count = SUM(is_short_internal) BY ${fields.traceId}`,
    `STATS max_internal_per_trace = MAX(internal_count), max_short_internal_per_trace = MAX(short_internal_count)`,
    `LIMIT 1`,
  ]);
}

/**
 * Builds an ES|QL query that finds duplicate service.instance.id usage across
 * logical resources (e.g. pod/host/container). Used for RES-002 evaluation.
 */
export function buildDuplicateInstanceIdQuery(
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
    "resource.attributes.service\\.instance\\.id IS NOT NULL",
    'resource.attributes.service\\.instance\\.id != ""',
  ];

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    'EVAL logical_resource = COALESCE(k8s.pod.uid, k8s.pod.name, host.id, host.name, container.id, service.node.name, "@@UNKNOWN@@")',
    "STATS distinct_resources = COUNT_DISTINCT(logical_resource) BY instance_id = resource.attributes.service\\.instance\\.id",
    "STATS duplicate_instance_id_count = COUNT(*) WHERE distinct_resources > 1",
    "LIMIT 1",
  ]);
}
