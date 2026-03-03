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

/**
 * Builds an ES|QL query that aggregates per-route metrics for a single service.
 * Returns: route, request count, avg latency, error count, error rate.
 */
export function buildServiceRoutesQuery(
  filters: ServiceDashboardFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const whereClauses: string[] = [
    `${fields.parentSpanId} IS NULL`,
    `${fields.serviceName} == "${escapeEsqlString(filters.serviceName)}"`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];

  const durationExpr = `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000)`;

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    "EVAL duration_ms = " +
      `${durationExpr} / 1000.0, ` +
      `is_error = CASE(${fields.statusCode} IN ("Error", "STATUS_CODE_ERROR"), 1, 0), ` +
      'route_key = COALESCE(attributes.http.route, "/")',
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_count = SUM(is_error) BY route_key`,
    `EVAL error_rate = error_count / request_count`,
    `SORT request_count DESC`,
    `LIMIT 50`,
  ]);
}

/**
 * Builds an ES|QL query to fetch recent traces for a specific service.
 */
export function buildServiceRecentTracesQuery(
  filters: ServiceDashboardFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const whereClauses: string[] = [
    `${fields.parentSpanId} IS NULL`,
    `${fields.serviceName} == "${escapeEsqlString(filters.serviceName)}"`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];

  const durationExpr = `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000)`;

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    `EVAL duration_ms = ${durationExpr} / 1000.0`,
    `SORT ${fields.timestamp} DESC`,
    `LIMIT 100`,
  ]);
}
