/**
 * ES|QL query builders for the Service Dashboard page.
 * Provides per-route breakdown and recent traces for a single service.
 */
import { DEFAULT_FIELD_MAPPING, type TraceFieldMapping } from "../traces/traceQueryBuilder";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import {
  buildPipeline,
  buildWherePipe,
  normalizeTimeExpression,
} from "../../services/es/queryParts";

export interface ServiceDashboardFilters {
  serviceName: string;
  timeFrom: string;
  timeTo: string;
}

function toSafeRelativeTimeExpression(value: string): string {
  const normalized = normalizeTimeExpression(value);
  if (normalized) return normalized;
  throw new Error(`Unsupported time expression: ${value}`);
}

function buildServiceWhereClauses(
  filters: ServiceDashboardFilters,
  fields: TraceFieldMapping,
): string[] {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  return [
    `${fields.parentSpanId} IS NULL`,
    `${fields.serviceName} == "${escapeEsqlString(filters.serviceName)}"`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];
}

function buildDurationMsExpr(fields: TraceFieldMapping): string {
  return `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000) / 1000.0`;
}

/**
 * Builds an ES|QL query that aggregates per-route metrics for a single service.
 * Returns: route, request count, avg latency, error count, error rate.
 */
export function buildServiceRoutesQuery(
  filters: ServiceDashboardFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const whereClauses = buildServiceWhereClauses(filters, fields);
  const durationMsExpr = buildDurationMsExpr(fields);

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    "EVAL duration_ms = " +
      `${durationMsExpr}, ` +
      `is_error = CASE(${fields.statusCode} IN ("Error", "STATUS_CODE_ERROR"), 1, 0), ` +
      'route_key = COALESCE(attributes.http.route, "/")',
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_count = SUM(is_error) BY route_key`,
    `EVAL error_rate = error_count / request_count`,
    `SORT request_count DESC`,
  ]);
}

/**
 * Builds an ES|QL query to fetch recent traces for a specific service.
 */
export function buildServiceRecentTracesQuery(
  filters: ServiceDashboardFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const whereClauses = buildServiceWhereClauses(filters, fields);
  const durationMsExpr = buildDurationMsExpr(fields);

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    `EVAL duration_ms = ${durationMsExpr}`,
    `KEEP ${fields.traceId}, ${fields.spanId}, ${fields.spanName}, duration_ms, ${fields.statusCode}, ${fields.timestamp}`,
    `SORT ${fields.timestamp} DESC`,
    `LIMIT 100`,
  ]);
}

/**
 * Builds an ES|QL query that detects deployment changes by aggregating
 * distinct service.version values with their first and last seen timestamps.
 */
export function buildServiceDeploymentsQuery(
  filters: ServiceDashboardFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const whereClauses = buildServiceWhereClauses(filters, fields);

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    `EVAL version_key = CASE(${fields.serviceVersion} IS NULL OR TRIM(${fields.serviceVersion}) == "", "unknown", ${fields.serviceVersion})`,
    `STATS first_seen = MIN(${fields.timestamp}), last_seen = MAX(${fields.timestamp}), request_count = COUNT(*) BY version_key`,
    `SORT last_seen DESC, first_seen DESC`,
  ]);
}

const SPARKLINE_BUCKETS = 20;

/**
 * Builds an ES|QL query that returns time-bucketed per-route metrics for sparklines
 * on the service dashboard. Produces ~SPARKLINE_BUCKETS data points per route.
 */
export function buildServiceRouteSparklineQuery(
  filters: ServiceDashboardFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const whereClauses = buildServiceWhereClauses(filters, fields);
  const durationMsExpr = buildDurationMsExpr(fields);

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    "EVAL duration_ms = " +
      `${durationMsExpr}, ` +
      `is_error = CASE(${fields.statusCode} IN ("Error", "STATUS_CODE_ERROR"), 1, 0), ` +
      'route_key = COALESCE(attributes.http.route, "/")',
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_count = SUM(is_error) BY route_key, bucket = BUCKET(${fields.timestamp}, ${SPARKLINE_BUCKETS}, ${safeTimeFrom}, ${safeTimeTo})`,
    `EVAL error_rate = error_count / request_count`,
    `SORT bucket`,
  ]);
}
