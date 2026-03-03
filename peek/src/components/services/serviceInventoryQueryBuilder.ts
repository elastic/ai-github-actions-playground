/**
 * ES|QL query builders for the Service Inventory page.
 * Aggregates service-level metrics (throughput, latency, error rate) from OTel trace data.
 */
import { DEFAULT_FIELD_MAPPING, type TraceFieldMapping } from "../traces/traceQueryBuilder";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import {
  buildPipeline,
  buildWherePipe,
  normalizeTimeExpression,
} from "../../services/es/queryParts";
import {
  DEFAULT_SERVICE_INVENTORY_FILTERS,
  type ServiceInventoryFilters,
} from "../../types/pageFilters";

export type { ServiceInventoryFilters };
export { DEFAULT_SERVICE_INVENTORY_FILTERS };

function toSafeRelativeTimeExpression(value: string): string {
  const normalized = normalizeTimeExpression(value);
  if (normalized) return normalized;
  throw new Error(`Unsupported time expression: ${value}`);
}

/**
 * Builds an ES|QL query that aggregates per-service metrics from root spans.
 * Returns: service name, throughput/latency/error metrics plus investigative context.
 */
export function buildServiceInventoryQuery(
  filters: ServiceInventoryFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const whereClauses: string[] = [
    `${fields.parentSpanId} IS NULL`,
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
      'route_key = COALESCE(attributes.http.route, "/"), ' +
      `span_name_key = COALESCE(${fields.spanName}, "unknown"), ` +
      "error_message_key = CASE(is_error == 1, COALESCE(status.message, span_name_key), NULL), " +
      'language_key = COALESCE(service.language.name, "unknown"), ' +
      'environment_key = COALESCE(service.environment, deployment.environment, "unknown")',
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_count = SUM(is_error), unique_routes = COUNT_DISTINCT(route_key), unique_span_names = COUNT_DISTINCT(span_name_key), top_route = TOP(route_key, 1, "desc"), top_span_name = TOP(span_name_key, 1, "desc"), top_error = TOP(error_message_key, 1, "desc"), language = TOP(language_key, 1, "desc"), environment = TOP(environment_key, 1, "desc") BY ${fields.serviceName}`,
    `EVAL error_rate = error_count / request_count`,
    `SORT request_count DESC`,
    `LIMIT 200`,
  ]);
}

const SPARKLINE_BUCKETS = 20;

/**
 * Builds an ES|QL query that returns time-bucketed per-service metrics for sparklines.
 * Produces ~SPARKLINE_BUCKETS data points per service for requests, latency, and error rate.
 */
export function buildServiceSparklineQuery(
  filters: ServiceInventoryFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  serviceNames: string[] = [],
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const whereClauses: string[] = [
    `${fields.parentSpanId} IS NULL`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];
  if (serviceNames.length > 0) {
    const serviceInList = serviceNames.map((name) => `"${escapeEsqlString(name)}"`).join(", ");
    whereClauses.push(`${fields.serviceName} IN (${serviceInList})`);
  }

  const durationExpr = `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000)`;

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    `EVAL duration_ms = ${durationExpr} / 1000.0, ` +
      `is_error = CASE(${fields.statusCode} IN ("Error", "STATUS_CODE_ERROR"), 1, 0)`,
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_rate = SUM(is_error) / COUNT(*) BY ${fields.serviceName}, bucket = BUCKET(${fields.timestamp}, ${SPARKLINE_BUCKETS}, ${safeTimeFrom}, ${safeTimeTo})`,
    `SORT bucket`,
  ]);
}

/**
 * Builds an ES|QL query that fetches the list of unique environments for a service.
 */
export function buildServiceEnvironmentsQuery(
  serviceName: string,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const where = buildWherePipe([`${fields.serviceName} == "${escapeEsqlString(serviceName)}"`]);
  return `FROM ${fields.index} | ${where} | EVAL environment_key = COALESCE(service.environment, deployment.environment, "unknown") | STATS count = COUNT(*) BY environment_key | SORT count DESC | LIMIT 20`;
}
